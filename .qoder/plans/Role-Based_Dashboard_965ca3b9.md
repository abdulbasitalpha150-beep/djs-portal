# Role-Based Dashboard Upgrade

## Summary

Replace the current dashboard (which fetches 8 separate API endpoints and computes everything client-side with basic `can()` gating) with a dedicated `/api/dashboard` endpoint that computes role-appropriate aggregated metrics server-side in a single round-trip. Rewrite the dashboard page to consume this endpoint with 45s polling + window-focus refetch for real-time updates. Each role gets a tailored widget set with role-scoped data filtering.

---

## Phase 1 — Backend: Dashboard API Endpoint

### 1.1 Create `src/api/dashboard.ts` (new file)

A single `GET /api/dashboard` handler that authenticates the user, then branches by role to compute and return all metrics in one response. The response shape is a single object with optional sections — each role populates only the sections it needs.

**Response shape:**
```
{
  kpis: Record<string, number | string>,  // role-specific KPI cards
  trends: { week: string; margin: number; loads: number; revenue: number }[],  // 12-week chart
  agentPerformance: { name: string; margin: number; loads: number }[],  // for managers
  teamPerformance: { name: string; revenue: number; loads: number; margin: number }[],  // for owner/admin
  recentActivity: { id, title, message, type, createdAt, actionUrl }[],  // notifications as activity
  pendingApprovals: { id, module, actionType, requestedByName, createdAt, newValues }[],  // for approvers
  upcomingFollowups: { id, title, dueDate, priority, leadName }[],  // role-scoped
  recentLoads: { id, loadNumber, status, origin, destination, revenue, createdAt }[],  // recent loads
  invoiceSummary: { pending, paid, outstanding, overdue, totalOutstanding },  // for accounting/admin
  commissionSummary: { pending, processing, paid, pendingCount, paidCount },  // for agent/accounting
  trainingProgress: { completed, total, pending, overdue, activationStatus } | null,  // for trainee
  quickActions: { label, href, icon }[],  // role-specific quick links
  teamInfo: { teamName, memberCount } | null,  // for team_manager/leadagent
}
```

**Role-specific data computation:**

- **Owner/Admin**: Org-wide counts for all KPIs (active leads, pending quotes, active loads, delivered MTD, customers added MTD, pending approvals, commission pending/paid, invoice outstanding/overdue, revenue MTD, gross margin MTD). Team performance array (all teams with revenue/loads/margin). Agent performance array (all agents with margin/loads). Recent activity from notifications. Pending approvals list. Upcoming follow-ups (all). Quick actions: Approvals, New User, Team Management, System Admin.

- **Ops Manager**: Pending quotes, carrier approvals pending, active loads, dispatched loads, in-transit loads, deliveries this week, customer requests pending, follow-ups due, team activity summary. No user management or admin widgets. Quick actions: Approvals, Dispatch Board, Carrier Review.

- **Team Manager**: Team-scoped only — resolve teamId from session, get team memberIds, filter all queries by `agentId: { $in: memberIds }`. KPIs: team leads, team quotes pending, team active loads, team delivered MTD, team revenue, team margin, team pending approvals, team follow-ups due. Agent performance for team members only. Recent activity for team. Quick actions: Team Approvals, Add Team Member, Team Reports.

- **Lead Agent**: Own records + team agents' records (same team-scoped filter as team manager but includes own). KPIs: my quotes, my active loads, team quotes, team loads, pending follow-ups, approval status, daily targets (loads today, revenue today). Agent performance for team members. Quick actions: New Quote, New Load, Team View.

- **Agent**: Own records only (`agentId: user.id`). KPIs: my leads, my quotes pending, my active loads, my delivered MTD, my customers, my commission pending/paid, my revenue MTD, my follow-ups due, my documents missing. Recent activity (own notifications). Recent loads (own). Commission summary. Quick actions: New Quote, New Lead, New Follow-up, My Documents.

- **Trainee**: Same as Agent plus training progress. Query `OnboardingDocument` for the trainee's documents — count approved/submitted/missing/rejected. Activation status from user status. Training reminders from pending/overdue onboarding requirements. Quotes disabled until activated (show but grey out). Quick actions: Upload Document, View Training, New Lead.

- **Accounting**: Finance-only. No CRM/sales data. KPIs: pending invoices count + total, paid invoices count + total MTD, outstanding payments total, overdue invoices count + total, commission pending count + total, commission paid count + total MTD, monthly revenue. Invoice summary with breakdown. Commission summary. Recent activity (invoice/commission notifications only). Quick actions: Create Invoice, Payment Reports, Commission Payouts.

**Implementation details:**
- Use `Promise.all` for parallel DB queries within each role branch
- For team-scoped queries: resolve `Team.findById(teamId)` to get `memberIds`, then use `{ agentId: { $in: memberIds } }` filter
- For 12-week trend: aggregate loads by ISO week using MongoDB aggregation pipeline (`$group` on `$week` of `$createdAt`)
- For agent performance: aggregate commissions by `agentId` using `$group` + `$lookup` on User for names
- For recent activity: query `Notification.find({ recipientUserId: user.id }).sort({ createdAt: -1 }).limit(8)`
- For pending approvals: query `ApprovalRequest.find({ status: "pending" })` filtered by team scope if applicable
- For upcoming follow-ups: query `FollowUp.find({ assignedTo: user.id or team, isCompleted: false, dueDate: { $lte: endOfWeek } }).sort({ dueDate: 1 }).limit(5)`
- For training progress (trainee only): query `OnboardingDocument.find({ userId: user.id })` and `OnboardingRequirement.find({ active: true })` to compute completed/total/pending
- Wrap the entire handler in try/catch — on error, return partial data with empty arrays rather than a 500
- Import models: Lead, QuoteRequest, Load, Customer, Carrier, Invoice, Commission, FollowUp, ApprovalRequest, Notification, User, Team, OnboardingDocument, OnboardingRequirement

### 1.2 Register route in `src/api/index.ts`

Add import `import { dashboardHandler } from "./dashboard";` and register:
`{ method: "GET", pattern: /^\/api\/dashboard$/, handler: dashboardHandler }`

---

## Phase 2 — Frontend: Rewrite Dashboard Page

### 2.1 Create `src/hooks/use-dashboard.ts` (new file)

A hook mirroring the `use-notifications.ts` pattern:
- `useDashboard()` returns `{ data, loading, refresh }`
- Fetches `GET /api/dashboard` on mount
- Polls every 45 seconds
- Refetches on window focus
- Returns typed `DashboardData | null`

### 2.2 Rewrite `src/routes/_app.dashboard.tsx`

Replace the entire 425-line file. The new component:

**Structure:**
- `Dashboard` component calls `useDashboard()` and `useNotifications()` (for unread count badge)
- Switches on `role` to render role-specific layout via sub-components:
  - `<OwnerDashboard data={data} session={session} />`
  - `<OpsManagerDashboard data={data} session={session} />`
  - `<TeamManagerDashboard data={data} session={session} />`
  - `<LeadAgentDashboard data={data} session={session} />`
  - `<AgentDashboard data={data} session={session} />`
  - `<TraineeDashboard data={data} session={session} />`
  - `<AccountingDashboard data={data} session={session} />`

**Shared widgets (rendered conditionally per role):**
- `KpiGrid` — renders StatCards from the `kpis` object (each entry has label, value, icon, optional delta/trend)
- `MarginTrendChart` — Recharts LineChart from `trends` data (12-week margin + loads)
- `AgentPerformanceChart` — Recharts BarChart from `agentPerformance` data
- `TeamPerformanceTable` — table from `teamPerformance` data (for owner/admin)
- `RecentActivityPanel` — list from `recentActivity` (notifications as activity feed, using `relative()` time)
- `PendingApprovalsPanel` — list from `pendingApprovals` with module badges, link to `/approvals`
- `UpcomingFollowupsPanel` — list from `upcomingFollowups` with priority badges, due dates
- `RecentLoadsPanel` — table from `recentLoads` with load number, status badge, route, revenue
- `InvoiceSummaryPanel` — stat cards + breakdown from `invoiceSummary` (for accounting/admin)
- `CommissionSummaryPanel` — stat cards from `commissionSummary` (for agent/accounting)
- `TrainingProgressPanel` — progress bar + requirement list from `trainingProgress` (for trainee)
- `QuickActionsPanel` — row of button links from `quickActions`

**Role layouts:**

- **Owner/Admin**: PageHeader("Welcome back, {name}", "Company overview"). KpiGrid (8 cards: active leads, pending quotes, active loads, delivered MTD, revenue MTD, margin MTD, pending approvals, outstanding invoices). Row: MarginTrendChart (2/3) + RecentActivityPanel (1/3). Row: TeamPerformanceTable (1/2) + AgentPerformanceChart (1/2). Row: PendingApprovalsPanel (1/2) + UpcomingFollowupsPanel (1/2). QuickActionsPanel at bottom.

- **Ops Manager**: PageHeader("Operations Dashboard"). KpiGrid (6 cards: pending quotes, carrier approvals, active loads, dispatched, in-transit, deliveries this week). Row: MarginTrendChart (2/3) + RecentActivityPanel (1/3). Row: PendingApprovalsPanel (1/2) + UpcomingFollowupsPanel (1/2). QuickActionsPanel.

- **Team Manager**: PageHeader("Team Dashboard — {teamName}"). KpiGrid (6 cards: team leads, team quotes pending, team active loads, team delivered MTD, team revenue, team pending approvals). Row: AgentPerformanceChart (1/2) + RecentActivityPanel (1/2). Row: PendingApprovalsPanel (1/2) + UpcomingFollowupsPanel (1/2). QuickActionsPanel.

- **Lead Agent**: PageHeader("Team Lead Dashboard"). KpiGrid (6 cards: my quotes, my active loads, team quotes, team loads, pending follow-ups, approvals pending). Row: MarginTrendChart (2/3) + AgentPerformanceChart (1/3). Row: RecentActivityPanel (1/2) + UpcomingFollowupsPanel (1/2). QuickActionsPanel.

- **Agent**: PageHeader("My Dashboard"). KpiGrid (6 cards: my leads, my quotes pending, my active loads, my delivered MTD, my revenue MTD, my commission pending). Row: CommissionSummaryPanel (1/3) + RecentLoadsPanel (2/3). Row: RecentActivityPanel (1/2) + UpcomingFollowupsPanel (1/2). QuickActionsPanel.

- **Trainee**: PageHeader("My Dashboard"). TrainingProgressPanel (full width, shows activation status + progress bar). KpiGrid (4 cards: my leads, my follow-ups due, documents approved, documents pending). Row: RecentActivityPanel (1/2) + UpcomingFollowupsPanel (1/2). QuickActionsPanel. Quotes section greyed out with "Activate your account to start quoting" if not active.

- **Accounting**: PageHeader("Finance Dashboard"). KpiGrid (6 cards: pending invoices, paid MTD, outstanding total, overdue count, commission pending, commission paid MTD). Row: InvoiceSummaryPanel (1/2) + CommissionSummaryPanel (1/2). Row: RecentActivityPanel (1/2) + UpcomingFollowupsPanel (1/2, finance-related only). QuickActionsPanel.

**Loading state:** Skeleton grid (same as current but 6 cards instead of 4).

**Real-time:** The `useDashboard()` hook polls every 45s and refetches on window focus. No page refresh needed.

**Empty states:** Each panel shows a muted "No data yet" message when its array is empty.

---

## Phase 3 — Verification

### 3.1 Typecheck & build
- Run `npx tsc --noEmit` — verify zero new errors in dashboard files
- Run `npx vite build` — verify successful build

---

## Files Touched

**New files (2)**
- `src/api/dashboard.ts` — role-based dashboard data endpoint
- `src/hooks/use-dashboard.ts` — dashboard data hook with polling

**Modified files (2)**
- `src/api/index.ts` — register `/api/dashboard` route
- `src/routes/_app.dashboard.tsx` — complete rewrite with role-specific layouts

---

## Assumptions

- The existing `useNotifications()` hook (45s polling) pattern is reused for dashboard polling — same interval, same window-focus refetch.
- The dashboard API computes everything server-side to reduce frontend bundle size and avoid 8 separate API round-trips.
- Team-scoped filtering uses `Team.findById(teamId).lean()` to resolve `memberIds`, then `$in` filter. For leadagent, the same team filter applies (leadagent is a team member).
- Trainee "activation status" maps from user `status` field: `pending`/`pending_invitation` = not activated, `active` = activated.
- "Missing documents" for agents is computed from `Load.documents` array where `uploaded: false` — counts missing docs across the agent's loads.
- The `OnboardingRequirement` collection defines required training items; `OnboardingDocument` tracks submitted/approved docs per user. Training progress = approved count / total required.
- Quick action links point to existing routes (`/quotes`, `/leads`, `/followups`, `/invoices`, `/approvals`, `/users`, `/teams`, `/admin`, `/onboarding`).
- Charts use Recharts (already a dependency). StatCard, PageHeader, StatusBadge components are reused.
- The frontend `Session` type does not include `teamId` — the backend resolves team scope server-side, so the frontend just passes the role and the backend does the filtering. This means no changes to `auth-context.tsx` are needed.
