# CRM_IMPLEMENTATION_PLAN.md

RULES: Not greenfield. Working CRM exists. Audit real code first — mark each item below Existing/Partial/Missing before building. Reuse tables/APIs/auth/UI. Never rebuild working features. No SQL/API code in this doc, spec only. Additive DB changes only.

## Roles

owner_admin: all data/users/perms, final approval.
ops_manager: org-wide ops, approve quotes/credit, no user mgmt.
team_manager: team-scoped data, approve team quotes/credit.
leadAgent: own+team-view, submit only, no approve.
agent: assigned leads only, submit only, no export, no approve.
trainee: view-heavy, no submit quotes/credit, no delete.
accounting: loads/commissions/invoices only, no leads/quotes edit.

## Modules (status: audit & fill Existing/Partial/Missing)

- Leads/Companies/Contacts — [ ] fields: name, locations, website, DM contact, phone, email, title, billing contact; ownership: agent, date, manager, status, reassign history; dup-check on create
- Calls/Activity Log — [ ] date, method, outcome, notes, next-action(required)
- Follow-ups — [ ] due_date, priority, overdue flag, completion history; auto-created from call next-action
- Pipeline — [ ] stages: cold→contacted→warm→quote_opp→credit_pending→approved→won/lost; log transitions
- Quotes — [ ] lane, carrier_cost, customer_rate, margin(auto), approval_status, expiry, win/loss reason; approval required before send
- Credit/Docs — [ ] credit form, OperFi status, limit, agreements, tax docs, files; block "won" without approved credit
- Loads (light TMS) — [ ] status, revenue, carrier_cost, gross_profit(auto), invoice_status, payment_status
- Commissions — [ ] auto-calc from load on invoice/delivered status, per agent
- Agent Accountability — [ ] check-in/out, daily call/follow-up/quote counts, attendance
- Reporting/Dashboard — [ ] role-scoped views (see Reports below)
- Permissions/Export — [ ] role-gated actions; block full-DB export for agent; log all exports

## DB

Extend existing company/contact/user tables (add missing cols only). New tables only if missing: quotes, documents, loads, commissions, follow_ups, export_log, reassignment_history. FKs: quotes/loads/documents→companies, commissions→loads+agents. Indexes: assigned_agent_id, pipeline_stage, due_date, status.

## API (new, if missing)

POST/PUT quotes, POST quotes/:id/approve|reject, POST credit, PUT credit/:id/status, POST documents, GET documents/:accountId, POST/PUT loads, PUT loads/:id/status, GET commissions/:agentId, GET reports/:type, POST follow-ups, PUT follow-ups/:id/complete, POST agents/checkin|checkout, GET export/leads (rate-limited+logged). Enforce role matrix server-side on all.

## UI (new/updated screens)

Company detail (ownership panel, timeline, docs, dup-warning), call quick-log, follow-up queue (overdue sort), pipeline kanban, quote builder+approval queue, credit panel, document library, load list/entry, agent dashboard (stats+checkin), manager team dashboard, owner dashboard (reports+user mgmt), export control (role-gated+logged).

## Automation

Auto follow-up on call next-action → auto-flag overdue → auto-expire quotes → block "won" w/o credit → auto gross-profit/commission on load status → block dup company → block bulk export for agent → notify manager on reassign/quote-submit/credit-submit/large-export.

## Reports

Agent Performance, Sales Pipeline, Gross Profit, Commission, Follow-up Status, Customer Revenue, Overdue Tasks, Quotes Awaiting Approval, Credit Pending/Approved, Won/Lost, Aging Invoices.

## Phases

1. Leads/Calls/Follow-ups/Ownership/Perms baseline
2. Pipeline/Quotes/Credit/Docs
3. Loads/Gross Profit/Commissions
4. Agent Accountability/Dashboards/Reports

## Checklist

- [ ] Audit schema/API/UI/auth vs this doc, update statuses
- [ ] Confirm role set w/ stakeholder
- [ ] Build Phase 1 → validate → Phase 2 → 3 → 4
- [ ] Add audit log on every write listed above
- [ ] Add export limit+log
- [ ] Test against Definition of Done below
- [ ] Mark module complete

## Definition of Done

Leads: dup-check active, ownership+history visible. Calls: no save w/o outcome+next-action/close-reason. Follow-ups: overdue auto-surfaced. Pipeline: 1 current stage + full history. Quotes: no send w/o approval, margin auto-calc'd. Credit: no "won" w/o approved credit. Loads: gross profit+commission auto-shown. Accountability: manager sees any agent's stats in 1 screen. Reports: render correctly per role scope. Export: agent can't bulk-export; all exports logged.
