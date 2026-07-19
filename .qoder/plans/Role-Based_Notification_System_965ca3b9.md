# Role-Based Notification System

## Summary

Transform the Notifications module from a simple list (currently consuming mock data in the sidebar bell and a basic list on the page) into a fully role-aware, event-driven notification center. Every notification is generated from a real CRUD event across Users, Teams, Leads, Customers, Quotes, Loads, Carriers, Invoices, Commissions, Approvals, Follow-ups, Activity, Onboarding, and Auth. Role-based visibility is enforced at write-time (only eligible recipients get a notification document) and read-time (recipientUserId filter). The existing UI design language is preserved while adding grouping, filters, search, priority color coding, click-to-navigate, and live unread counts.

---

## Phase 1 — Backend Foundation

### 1.1 Extend `src/models/notification.ts`

Replace the current 5-field schema with the full role-aware schema. New fields:

- `recipientUserId` (ObjectId ref User, required, indexed) — replaces `userId`
- `senderUserId` (ObjectId ref User, optional) — null for system-generated
- `senderName` (String, optional)
- `recipientRole` (String enum Role, optional) — denormalized for fast role-based queries
- `teamId` (ObjectId ref Team, optional, indexed) — for team-scoped notifications
- `title` (String, required)
- `message` (String, required) — replaces `body`
- `notificationType` (String, required, indexed) — replaces `kind`; e.g. `user_created`, `quote_approved`, `load_assigned`, `followup_due`, `kpi_summary`, `system_alert`
- `relatedModule` (String enum: team_management, approvals, leads, customers, quotes, loads, carriers, commissions, invoices, daily_activity, followups, user_management, training, kpi, system, auth)
- `recordType` (String, optional) — e.g. `QuoteRequest`, `Load`, `User`
- `recordId` (ObjectId, optional, indexed) — for click-to-navigate
- `priority` (String enum: low, medium, high, critical, default medium)
- `isRead` (Boolean, default false, indexed) — replaces `read`
- `actionUrl` (String, optional) — precomputed frontend route, e.g. `/quotes/123`
- `metadata` (Mixed, default {})
- `createdAt`, `updatedAt` (timestamps)

Add compound index `{ recipientUserId: 1, isRead: 1, createdAt: -1 }` and `{ recipientUserId: 1, createdAt: -1 }`. Export `NOTIFICATION_TYPES`, `NOTIFICATION_MODULES`, `NOTIFICATION_PRIORITIES` constants and a `NotificationDocument` interface.

### 1.2 Enhance `src/lib/auth.ts`

Add `teamId?: string` to the `SessionUser` type and populate it inside `getSessionUserFromRequest` (read from the user document). This is required for team-scoped recipient resolution without an extra DB round-trip in every CRUD handler.

### 1.3 Create `src/lib/notification.ts` (new file — the notification service)

Mirror the `lib/audit.ts` pattern but richer. Exports:

- `createNotification(input)` — creates a single notification document
- `createNotifications(inputs[])` — bulk insert (used when multiple recipients)
- `notifyApprovers({ teamId, excludeUserId, ...payload })` — resolves and notifies all users with `approval_actions` capability for the given team (team_manager, leadagent of that team; ops_manager, admin, owner org-wide)
- `notifyRoleHolders({ roles, ...payload })` — notify all users with a given role (e.g., all `accounting` users for invoice events)
- `notifyTeamManager({ teamId, ...payload })` — lookup Team.managerId and notify
- `notifyLeadAgent({ teamId, ...payload })` — lookup leadagent users in the team
- `notifyUser({ userId, ...payload })` — single recipient helper
- `notifyAdmins({ ...payload })` — notify all owner/admin users
- `resolveActionUrl(recordType, recordId)` — maps record type to a frontend route (e.g. `QuoteRequest` -> `/quotes?focus=<id>`, `Load` -> `/loads?focus=<id>`, `User` -> `/users?focus=<id>`)

Recipient resolution rules (centralized here, not scattered across handlers):

- Owner/Admin: receives every event
- Ops Manager: receives operational events (quotes, loads, customers, carriers, invoices, teams, follow-ups, KPI), never user-management events
- Team Manager: only events for their team (member added/removed, agent submitted quote, quote approved in team, load assigned to team, customer approved in team, follow-up due in team, daily team KPI)
- Lead Agent: own records + records from agents in their team hierarchy (submitted quotes, approvals, load assignments, customer approvals, carrier approvals, team KPI)
- Agent: only their own records (own quote approved/rejected, customer approved/rejected, lead assigned, load assigned, follow-up reminders, invoice available, commission generated/paid, manager comments, document rejected)
- Trainee: same as Agent plus training events (reminders, completed, unlocked, overdue, activation approved/rejected)
- Accounting: only invoices, payments, commissions, load completed, invoice overdue, commission pending/approved, accounting reports

### 1.4 Rewrite `src/api/notifications.ts`

Replace the existing simple handler with a full-featured one:

**GET `/api/notifications`**
- Query params: `filter` (all|unread|read, default all), `q` (search title/message), `limit` (default 50, max 100)
- Always filtered by `recipientUserId = sessionUser.id` (no global notifications — every notification has an explicit recipient now)
- Returns: `{ notifications: [...], unreadCount, totalCount, groups: { today: [], yesterday: [], thisWeek: [], earlier: [] } }`
- Each notification item: `{ id, title, message, notificationType, relatedModule, recordType, recordId, priority, isRead, senderName, actionUrl, createdAt, group }`
- Group assignment computed server-side based on createdAt relative to today (timezone: server local)

**POST `/api/notifications`**
- `action: "mark_read"` with optional `id` (single) or omit (mark all read for current user)
- `action: "mark_unread"` with `id`
- `action: "delete"` with `id` (single delete)
- `action: "clear_all"` — delete all notifications for current user

Returns the updated notification list + unreadCount so the client can update state in one round-trip.

---

## Phase 2 — Event-Driven Notification Emission

Inject `createNotification`/`createNotifications` calls into existing CRUD handlers. All injections happen **after** the successful DB write and audit log, and are awaited (not fire-and-forget) so failures surface in development but wrapped in try/catch so a notification failure never breaks the primary operation.

### 2.1 `src/api/users/index.ts`
- **POST (create user)**: notify all owner/admin (user_created), notify ops_manager (user_created), notify the new user (welcome / account_created), and if `teamId` set, notify the team_manager (team_member_added)
- **PATCH (update user)**: if `status` changed to `suspended` -> notify user (your account suspended), owner/admin, ops_manager, and team_manager if user has teamId (user_suspended). If status -> `active` from suspended/pending -> notify user (account_activated), team_manager. If `role` changed -> notify user (role_changed), owner/admin (user_promoted/user_demoted). If `teamId` changed -> notify old team_manager (team_member_removed), new team_manager (team_member_added), the user (team_assigned), owner/admin, ops_manager
- **DELETE**: notify owner/admin (user_deleted)

### 2.2 `src/api/teams.ts`
- **POST (create team)**: notify owner/admin (team_created), notify the assigned manager (team_manager_assigned)
- **PATCH (update team)**: if managerId changed -> notify old manager (team_assignment_changed), new manager (team_manager_assigned), owner/admin. If name changed -> notify all team members (team_updated)
- **DELETE**: notify owner/admin (team_deleted), notify all former members (team_deleted with actionUrl=/teams)

### 2.3 `src/api/quotes/list.ts`
- **POST (agent/trainee submits)**: call `notifyApprovers({ teamId, notificationType: 'quote_submitted', recordId, relatedModule: 'quotes' })` and notify the submitter (quote_submitted confirmation)
- **POST (other roles direct create)**: notify the assigned agent (quote_created_for_you) if different from actor

### 2.4 `src/api/quotes/approve.ts`
- **On approve**: notify the quote's agentId (quote_approved: "Your Quote Q-XX has been approved."), notify owner/admin (quote_approved), notify team_manager/leadagent of agent's team (quote_approved), notify ops_manager (quote_approved)

### 2.5 `src/api/approvals.ts`
- **PATCH action=approve**: notify the requestedBy user (approval_granted with module-specific type), notify owner/admin, notify team_manager/leadagent of the team
- **PATCH action=reject**: notify requestedBy (approval_rejected), notify owner/admin
- **PATCH action=request_changes**: notify requestedBy (changes_requested)
- **PATCH action=add_comment**: notify requestedBy (if commenter != requestedBy) and notify the commenter (if requestedBy replies) — manager_comment type

### 2.6 `src/api/customers/list.ts`
- **POST (agent/trainee submit)**: `notifyApprovers({ teamId, notificationType: 'customer_submitted', relatedModule: 'customers' })`
- **POST (manager direct create)**: notify agent (customer_created_for_you)
- **PATCH (status change to approved/rejected by manager)**: notify agent (customer_approved / customer_rejected), notify owner/admin, notify team_manager/leadagent

### 2.7 `src/api/carriers/list.ts`
- **POST (submit)**: `notifyApprovers({ teamId, notificationType: 'carrier_submitted', relatedModule: 'carriers' })`
- **PATCH (status -> approved/rejected)**: notify submitter (carrier_approved / carrier_rejected), notify owner/admin, ops_manager

### 2.8 `src/api/loads/list.ts`
- **POST (agent/trainee submit)**: `notifyApprovers({ teamId, notificationType: 'load_submitted', relatedModule: 'loads' })`
- **POST (manager create + assign agentId)**: notify assigned agent (load_assigned), notify team_manager/leadagent (load_assigned), notify owner/admin
- **PATCH (status -> dispatched / in_transit / delivered / invoiced)**: notify agent (load_status_updated), notify owner/admin. On `delivered`: also notify accounting (load_completed)
- **PATCH (reassign agentId)**: notify new agent (load_assigned), old agent (load_unassigned), team managers

### 2.9 `src/api/invoices.ts`
- **POST (create)**: notify all `accounting` users (invoice_created), notify owner/admin, notify the agent who owns the customer (invoice_available) if resolvable
- **PATCH action=add_payment (fully paid)**: notify accounting (invoice_paid), notify owner/admin, notify the agent (invoice_paid)
- **DELETE**: notify owner/admin (invoice_deleted)

### 2.10 `src/api/commissions/list.ts`
- **POST (create commission)**: notify the agent (commission_generated), notify accounting (commission_created)
- **PATCH (payoutStatus -> paid)**: notify agent (commission_paid: "Your commission for load LD-XX has been paid."), notify accounting, notify owner/admin
- **PATCH (payoutStatus -> processing)**: notify agent (commission_processing), notify accounting

### 2.11 `src/api/followups/list.ts`
- **POST (create)**: notify assignedTo (followup_assigned), notify team_manager/leadagent if high priority
- **PATCH (complete)**: notify creator/manager (followup_completed)

### 2.12 `src/api/onboarding/index.ts`
- **POST (upload document)**: notify reviewers (document_submitted)
- **PATCH (review -> approved/rejected)**: notify the document owner (document_approved / document_rejected)

### 2.13 `src/api/activity/clock-in.ts` & `clock-out.ts`
- **clock-in**: no notification (self-action)
- **clock-out**: if reason indicates anomaly (e.g. "forgot") or sessions show > 12h, notify team_manager (activity_anomaly)

### 2.14 `src/api/auth/login.ts` & `logout.ts` (light touch)
- On failed login attempt for a known email -> notify owner/admin (security_alert: failed_login) — only if email exists, to avoid spam
- On 5+ failed attempts leading to lock -> notify owner/admin (account_locked)
- These are read-only safe to add; if the login handler is too complex to modify safely, defer to a later iteration and only add the lock event.

### 2.15 Scheduled-style notifications (on-demand, idempotent)

Create `src/api/notifications/kpi.ts` (new file) exposed at `GET /api/notifications/kpi-summary`:
- Generates daily KPI summary notifications for the current user if not already generated today (idempotency key: `{recipientUserId, notificationType: 'kpi_summary', date}` checked via metadata.date)
- Computes role-appropriate KPIs: Today's Loads, Today's Revenue, New Customers, Quotes Approved, Pending Approvals, Invoices Outstanding (full set for owner/admin/ops; team subset for team_manager/leadagent; own subset for agent/trainee; invoices/commissions subset for accounting)
- Also scans FollowUp collection for due-today / overdue items assigned to the user -> generates `followup_due` / `followup_overdue` notifications (idempotent per day per follow-up id)
- Also scans Invoice collection for overdue invoices -> generates `invoice_overdue` for accounting users (idempotent per day per invoice)
- Also scans QuoteRequest for quotes expiring (status pending_approval > 7 days) -> notify agent + approvers
- This endpoint is called by the frontend whenever the notifications page is opened or the bell is rendered, ensuring KPI/follow-up/overdue notifications appear without requiring a cron system. Generation is wrapped in try/catch so the page never breaks if generation fails.

Register the new route in `src/api/index.ts`:
- `{ method: "GET", pattern: /^\/api\/notifications\/kpi-summary$/, handler: kpiSummaryHandler }`

### 2.16 System alerts

Add a helper `emitSystemAlert({ title, message, priority })` in `lib/notification.ts` that notifies all owner/admin users with `relatedModule: 'system'`. Call sites:
- `src/api/admin/reset-system.ts` — emit `system_alert` after reset
- Database backup / API offline events are infrastructure-level and cannot be emitted from inside the running app, so we expose a POST endpoint `/api/notifications/system-alert` (admin-only) for future use, plus document that real infra alerts would call this endpoint externally.

---

## Phase 3 — Frontend

### 3.1 Create `src/hooks/use-notifications.ts` (new file)

A shared hook used by both the page and the bell:

- `useNotifications()` returns `{ notifications, unreadCount, loading, refresh, markRead, markAllRead, markUnread, deleteNotification, clearAll }`
- Polls `/api/notifications?filter=all&limit=50` on mount and every 45 seconds (bell only needs unreadCount, so a lightweight `/api/notifications?filter=unread&limit=1` poll could be used by the bell — but to keep it simple, both share one poll)
- Exposes mutation helpers that call POST and optimistically update local state, then refetch to reconcile
- Triggers a KPI summary fetch on first mount (calls `/api/notifications/kpi-summary` fire-and-forget before the main fetch) so reminders are fresh

### 3.2 Rewrite `src/routes/_app.notifications.tsx`

Preserve the PageHeader + Card design language. New features:

- **Header**: title + dynamic unread count badge, action buttons (Mark all read, Clear all)
- **Toolbar row**: Filter tabs (All / Unread / Read) with counts, search input (debounced 250ms, queries title/message client-side over the fetched batch)
- **Grouped list**: sections for Today / Yesterday / This Week / Earlier (server-supplied groups). Each section header shows count. Empty sections hidden.
- **Notification row**:
  - Left: module icon (lucide icon mapped from `relatedModule`: Users for user_management, ClipboardCheck for approvals, UserCheck for leads, Building2 for customers, FileText for quotes, Package for loads, Truck for carriers, DollarSign for commissions, FileText for invoices, CalendarClock for daily_activity, ClipboardCheck for followups, GraduationCap for training, BarChart3 for kpi, Server for system, Bell default)
  - Center: title (medium weight), message (muted), bottom row with senderName + relative time + read/unread dot
  - Right: priority badge (color-coded: green=low, blue=medium, orange=high, red=critical) — note: per spec, color coding is also tied to type (approved=green, info=blue, pending=orange, rejected=red, system=gray). We implement a `priorityToVariant` + `typeToVariant` helper and use the type-driven color for the icon background, the priority badge for severity.
  - Hover actions: Mark as read/unread toggle, Delete (trash icon)
- **Click behavior**: if `actionUrl` is present, mark as read then `navigate({ to: actionUrl })`. If only `recordType`+`recordId`, derive a route via a shared `recordUrl(recordType, recordId)` helper (same logic as server-side `resolveActionUrl` but client-side as fallback).
- **Empty state**: dashed-border card with Inbox icon and contextual message based on filter
- **Auto-refresh**: hook polls every 45s; also refetches on window focus

### 3.3 Update `src/components/app-shell.tsx`

- **NotificationsBell**: replace mock data with `useNotifications()` (or a lighter `useUnreadCount()` variant that only fetches the unread count). Render real notifications in the dropdown (top 5 by date). Click on a dropdown item -> mark read + navigate to actionUrl. Mark all read button calls the real API. Unread count badge reflects real data.
- **Sidebar nav item**: add an unread count badge next to the Notifications label in `SidebarNav` for the Notifications nav item. Pass `unreadCount` down from AppShell (which calls `useNotifications` once and shares via context or props to both the bell and the sidebar).
- Remove the `import { notifications } from "@/lib/mock-data"` line. Leave the mock-data file alone (other code may use it) but stop importing the notifications export.

### 3.4 Color coding helper

Add a small `src/lib/notification-ui.ts` (or inline in the page) exporting:
- `moduleIcon(module)` -> lucide icon component
- `priorityVariant(priority)` -> badge variant string
- `typeColor(notificationType)` -> tailwind classes for the icon background (approved=green, info=blue, pending=orange, rejected=red, system=gray, etc.)

---

## Phase 4 — Verification

### 4.1 Typecheck & build
- Run `bun run build` (or `npm run build`) to confirm TypeScript compilation
- Run `bun run lint` / eslint if available
- Fix any errors introduced by the SessionUser teamId addition (any code that constructs a SessionUser literal)

### 4.2 Manual smoke test via browser-use MCP
- Log in as admin (admin.one@djfreight.com / Welcome123!) — open notifications page, confirm empty state
- Create a user as admin -> verify a `user_created` notification appears for admin
- Log in as the new user -> verify a welcome notification appears
- Submit a quote as an agent -> verify approvers receive a `quote_submitted` notification
- Approve the quote as team_manager -> verify agent receives `quote_approved`, admin/ops receive `quote_approved`
- Verify unread badge updates in sidebar + bell without page refresh
- Verify click-to-navigate routes to the correct record page
- Verify Mark all read, Delete, Clear all, Filter tabs, and Search all work

### 4.3 Idempotency check
- Reload the notifications page multiple times -> KPI/follow-up notifications should not duplicate for the same day

---

## Files Touched

**New files (4)**
- `src/lib/notification.ts` — notification service (createNotification, notifyApprovers, etc.)
- `src/hooks/use-notifications.ts` — shared notification polling/mutation hook
- `src/api/notifications/kpi.ts` — on-demand KPI/follow-up/overdue generator
- `src/lib/notification-ui.ts` — frontend color/icon helpers

**Modified files (~18)**
- `src/models/notification.ts` — extended schema
- `src/lib/auth.ts` — add teamId to SessionUser
- `src/api/notifications.ts` — rewrite handler
- `src/api/index.ts` — register kpi-summary route
- `src/api/users/index.ts` — inject user events
- `src/api/teams.ts` — inject team events
- `src/api/quotes/list.ts` — inject quote submit
- `src/api/quotes/approve.ts` — inject quote approve
- `src/api/approvals.ts` — inject approval events
- `src/api/customers/list.ts` — inject customer events
- `src/api/carriers/list.ts` — inject carrier events
- `src/api/loads/list.ts` — inject load events
- `src/api/invoices.ts` — inject invoice events
- `src/api/commissions/list.ts` — inject commission events
- `src/api/followups/list.ts` — inject follow-up events
- `src/api/onboarding/index.ts` — inject onboarding events
- `src/api/activity/clock-out.ts` — inject anomaly alert (clock-in left alone)
- `src/api/admin/reset-system.ts` — inject system alert
- `src/routes/_app.notifications.tsx` — rewrite page UI
- `src/components/app-shell.tsx` — wire bell + sidebar badge to real API

---

## Assumptions

- The app runs on a serverless/edge runtime (Cloudflare Workers-style) so polling is preferred over WebSockets/SSE for live updates. Polling interval: 45s for the bell + page, with immediate refetch on window focus and after mutations.
- KPI summaries, follow-up reminders, and overdue alerts are generated on-demand when the notifications page or bell is rendered (idempotent per day per recipient per type). This avoids needing a cron system; if the user later wants true scheduled emission, the same `kpiSummaryHandler` logic can be moved into a scheduled task.
- The existing `Notification` collection is essentially empty (no seeded notifications), so a clean schema migration is acceptable. Old documents with `userId`/`kind`/`body`/`read` fields (if any exist in production) will be invisible to the new query (which filters on `recipientUserId`); a one-line migration script is not needed since seed-db confirms no notifications are seeded.
- Click-to-navigate uses frontend routes that already exist (`/quotes`, `/loads`, `/customers`, `/carriers`, `/users`, `/teams`, `/invoices`, `/commissions`, `/followups`, `/approvals`, `/leads`). Where a detail route does not exist, we navigate to the list page with a `?focus=<id>` query param that the list page can use to highlight the record (progressive enhancement — list pages currently don't read this param, but navigation still lands on the right list).
- Notification failures (DB write error in `lib/notification.ts`) are logged but never re-thrown to the caller, so a notification bug cannot break a CRUD operation. This is enforced inside `createNotification` with a try/catch + `console.error`.