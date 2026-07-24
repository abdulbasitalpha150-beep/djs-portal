You are a **Senior Full-Stack Software Architect, Security Engineer, and Database Designer**.

Your task is to **design and generate a production-grade backend** for an existing frontend (already built/being built separately) and wire it into **one single deployable project**.

The application must use:

- MongoDB Atlas (Mongoose)
- Next.js (App Router) serverless API routes — no standalone Express server
- JWT authentication (httpOnly cookies)
- Role-based access control (RBAC)

The final system must be **fully deployable as ONE single project on Vercel**, frontend + backend together, with **no separate backend server/process**.

Do not oversimplify logic. Maintain production-level quality, validation, and error handling throughout.

---

PROJECT NAME

DJ's Freight Broker LLC — Secure Agent Portal (Backend)

---

SYSTEM PURPOSE

This is the backend for a private, role-based freight-brokerage back-office portal. It powers lead/CRM management, shipper quote approval workflows, carrier vetting, load lifecycle tracking, document/training storage, commission calculation, reporting, and admin user management — all scoped by role and, where relevant, by the owning agent.

There is no public-facing content here. Every route in this system sits behind authentication except login, 2FA verification, and password reset.

---

USER ROLES

1. OWNER / ADMIN
   Full access to everything, including user management, audit logs, commission-tier configuration, and all records regardless of who created them.

2. OPERATIONS MANAGER
   Can approve/reject quotes, vet carriers, manage loads, view all agents' data, cannot manage users/roles or view audit logs.

3. TEAM MANAGER
   Same as Operations Manager but scoped to their assigned team's agents only.

4. AGENT
   Can create/edit only their own leads, quote requests, and documents. Read-only on the status of their own submissions. Cannot see other agents' leads or other agents' commission data.

5. TRAINEE
   Same as Agent but additionally gated from submitting quotes until marked "active" by a manager; sees training-library completion tracking.

6. ACCOUNTING
   Read access to commissions, loads, invoices, and reports across all agents. No access to lead/CRM data, no approval permissions.

Enforce role checks **server-side on every route**, never trust the frontend to hide a button as the only protection.

---

DATABASE MODELS

Use MongoDB with Mongoose, in `/models`.

USER MODEL

- name
- email (unique)
- password (hashed, bcrypt)
- role (owner_admin / ops_manager / team_manager / leadAgent /agent / trainee / accounting)
- teamId (ref Team, optional)
- status (active / inactive / trainee / pending_access_request)
- avatarUrl
- twoFactorEnabled
- twoFactorSecret (encrypted at rest)
- lastLoginAt
- createdAt

TEAM MODEL

- name
- managerId (ref User)
- memberIds [ref User]

LEAD MODEL

- ownerId (ref User — the agent who owns this lead)
- companyName
- contactName
- contactPhone / contactEmail
- location
- laneOrNeed
- status (new / warm / follow_up_due / customer_onboarding / not_a_fit)
- notes [ { authorId, text, createdAt } ] (activity/notes timeline)
- creditStatus (for onboarding indicator)
- createdAt / updatedAt

QUOTE REQUEST MODEL

- agentId (ref User)
- shipperLeadId (ref Lead, optional)
- lane (origin, destination)
- equipmentType
- commodity
- customerRate
- carrierCost
- marginAmount (computed: customerRate - carrierCost)
- marginPercent (computed)
- notes
- status (pending_approval / approved / rejected / changes_requested)
- reviewedBy (ref User)
- reviewNotes
- createdAt / reviewedAt

CARRIER MODEL

- legalName / dba
- mcNumber / dotNumber
- contactName / contactPhone / contactEmail
- authorityMatch (bool)
- insuranceVerified (bool)
- insuranceExpiresAt
- fraudFlags [String]
- trustStatus (verified / pending / flagged)
- vettedBy (ref User)
- createdAt

LOAD MODEL

- quoteRequestId (ref QuoteRequest)
- agentId (ref User)
- carrierId (ref Carrier)
- customerName
- lane
- status (quoted / approved / booked / picked_up / in_transit / delivered / pod_received / invoiced / paid / commission_ready)
- statusHistory [ { status, changedBy, changedAt } ]
- grossMargin
- documentIds [ref Document]
- createdAt / updatedAt

DOCUMENT MODEL

- ownerId (ref User, null if company-wide)
- loadId (ref Load, optional)
- category (rate_confirmation / bol / pod / invoice / tax_form / training / onboarding)
- fileName
- fileUrl (cloud storage URL — see File Storage section)
- fileType
- uploadedBy (ref User)
- visibility (personal / company_wide)
- createdAt

TRAINING MODULE MODEL

- title
- description
- contentUrl
- order
- completions [ { userId, completedAt } ]

COMMISSION MODEL

- agentId (ref User)
- loadId (ref Load)
- grossMarginAmount
- commissionTier (derived from monthly cumulative gross margin thresholds)
- commissionPercent
- commissionAmount
- payoutStatus (pending / processing / paid)
- payoutDate
- month / year

AUDIT LOG MODEL

- actorId (ref User)
- actionType (login / approval / upload / edit / role_change / etc.)
- targetType / targetId
- metadata (Object)
- createdAt
- IMPORTANT: if actorId resolves to a watcher-role record, exclude from any admin-facing audit log query (see Hidden Internal Role below).

ACCESS REQUEST MODEL

- requestedEmail / requestedName
- requestedRole
- status (pending / accepted / declined)
- reviewedBy (ref User)
- createdAt

---

HIDDEN INTERNAL ROLE (OPTIONAL — INCLUDE ONLY IF EXPLICITLY CONFIRMED BY CLIENT)

If the client confirms they want an internal-only monitoring account (e.g., for the agency/dev team to audit system health), implement it as a standard `accounting`-equivalent read-only role used transparently and disclosed to the business owner — do not build silent, undisclosed surveillance accounts that are deliberately hidden from the system owner's own user-management screens or audit trail. A back-office portal should give the Owner/Admin full visibility into every account with system access, including any internal support/monitoring account. Confirm this requirement explicitly with the client before implementing.

---

FRONTEND INTEGRATION

Frontend is being designed/built separately (Next.js, role-based screens already specified). Backend must expose REST-style JSON endpoints under `/app/api/...` that match the screens already scoped:

- /api/auth/login, /api/auth/2fa/verify, /api/auth/logout, /api/auth/password-reset/*
- /api/leads (GET list w/ filters, POST create), /api/leads/[id] (GET, PUT, DELETE), /api/leads/[id]/notes (POST)
- /api/quotes (GET, POST), /api/quotes/[id]/approve, /api/quotes/[id]/reject, /api/quotes/[id]/request-changes
- /api/carriers (GET, POST), /api/carriers/[id]/vet (PUT)
- /api/loads (GET, POST), /api/loads/[id], /api/loads/[id]/status (PUT)
- /api/documents (GET, POST upload), /api/documents/[id] (DELETE)
- /api/training (GET modules), /api/training/[id]/complete (POST)
- /api/commissions (GET, scoped by role), /api/commissions/tiers (admin config GET/PUT)
- /api/reports (GET with date-range + team/agent filters)
- /api/users (admin: GET, POST, PUT role/status), /api/access-requests (GET, PUT accept/decline)
- /api/audit-logs (admin GET, filterable)
- /api/export (GET — CSV/PDF for leads, loads, commissions, reports)

Each route must:

- Verify JWT from httpOnly cookie
- Resolve user + role from DB (not just trust JWT claims for sensitive ops)
- Enforce role/ownership scoping (e.g., agents only see `ownerId === session.userId` on leads)
- Validate input (use zod or similar)
- Return consistent JSON shape: `{ success, data, error }`

---

FILE STORAGE

Since this is a single Vercel deployment with no traditional file server, use a cloud object store (e.g., Vercel Blob, S3, or Cloudinary) for document/training uploads. Store only the resulting URL + metadata in MongoDB. Generate signed upload URLs server-side; never expose storage credentials to the client.

---

AUTH & SECURITY REQUIREMENTS

- Passwords hashed with bcrypt (cost factor 12)
- JWT signed with `process.env.JWT_SECRET`, short-lived access token + refresh token pattern, stored in httpOnly/secure cookies
- Optional TOTP-based 2FA (e.g., speakeasy) per Owner/Admin policy
- Rate limiting on `/api/auth/*` routes
- Input validation and sanitization on every mutating route to prevent NoSQL injection (never spread raw `req.body` into Mongoose queries)
- Role-based middleware/utility (`/lib/auth.ts`) used at the top of every protected route handler
- All destructive actions (delete lead, deactivate user, etc.) require explicit confirmation on the frontend and are logged to Audit Log on the backend
- No account, including any internal/support account, is excluded from the Owner/Admin's user list or audit trail

---

MONGODB CONNECTION CACHING

Create `/lib/db.ts` using the standard global-caching pattern for Mongoose in serverless environments, to avoid "too many connections" errors on Vercel. Read the connection string from `process.env.MONGO_URI` — never hardcode it in source. Locally, place the real value in `.env.local` (already gitignored); in production, set it in the Vercel project's Environment Variables dashboard.

---

ENVIRONMENT VARIABLES

```
MONGO_URI=
JWT_SECRET=
JWT_REFRESH_SECRET=
BLOB_READ_WRITE_TOKEN=        # or S3/Cloudinary equivalents
TWOFA_ENCRYPTION_KEY=
```

---

DEPLOYMENT REQUIREMENT

Single Next.js project, single Vercel deployment, frontend pages/components and `/app/api` backend routes living side by side in one repo. No `app.listen()`, no separate `server.js`, no long-running processes, no WebSockets/cron — every request must complete within Vercel's serverless function time limit.

---

FINAL PROJECT STRUCTURE

```
/app
  /api/...            (route handlers described above)
  /(portal)/...        (frontend pages, already designed separately)
/components
/lib
  db.ts
  auth.ts
  validation.ts
/models
/utils
.env.local
package.json
```

---

DELIVERABLES

1. Final folder structure
2. Mongoose schemas for every model above
3. Serverless API route handlers for every endpoint listed
4. Auth/RBAC middleware utilities
5. MongoDB connection caching file
6. One fully worked example route (e.g., quote approval) showing validation + RBAC + audit logging end to end
7. Commission-tier calculation logic
8. Example API request/response payloads for each major resource
9. Deployment instructions for Vercel (env var setup, Blob/S3 setup, build settings)

Ensure the backend is production-ready, fully scoped by role, and ready to be wired directly into the existing frontend without further architectural changes.
