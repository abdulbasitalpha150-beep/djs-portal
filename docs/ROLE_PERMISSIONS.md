# Role Permissions

This document outlines the capabilities and restrictions for each user role in the Freight Agent Portal.

## Role Definitions & Descriptions

| Role           | Label              | Description                     |
| -------------- | ------------------ | ------------------------------- |
| `owner`        | Owner              | Full access across the portal   |
| `admin`        | Admin              | Full access across the portal   |
| `ops_manager`  | Operations Manager | Operations oversight org-wide   |
| `team_manager` | Team Manager       | Visibility into assigned team   |
| `leadagent`    | Lead Agent         | Visibility into assigned team   |
| `agent`        | Agent              | Scoped to own records           |
| `trainee`      | Trainee            | Read-only agent view            |
| `accounting`   | Accounting         | Invoices, payments, commissions |
| `suspended`    | Suspended          | No access — locked out          |

---

## Role Capability Matrix

| Capability         | Owner | Admin | Ops Manager | Team Manager | Lead Agent | Agent | Trainee | Accounting | Suspended |
| ------------------ | ----- | ----- | ----------- | ------------ | ---------- | ----- | ------- | ---------- | --------- |
| `dashboard`        | ✅    | ✅    | ✅          | ✅           | ✅         | ✅    | ✅      | ✅         | ❌        |
| `leads`            | ✅    | ✅    | ✅          | ✅           | ✅         | ✅    | ✅      | ❌         | ❌        |
| `followups`        | ✅    | ✅    | ✅          | ✅           | ✅         | ✅    | ✅      | ❌         | ❌        |
| `customers`        | ✅    | ✅    | ✅          | ✅           | ✅         | ✅    | ✅      | ❌         | ❌        |
| `quotes`           | ✅    | ✅    | ✅          | ✅           | ✅         | ✅    | ✅      | ❌         | ❌        |
| `carriers`         | ✅    | ✅    | ✅          | ✅           | ✅         | ✅    | ✅      | ❌         | ❌        |
| `loads`            | ✅    | ✅    | ✅          | ✅           | ✅         | ✅    | ✅      | ❌         | ❌        |
| `documents`        | ✅    | ✅    | ✅          | ✅           | ✅         | ✅    | ✅      | ✅         | ❌        |
| `onboarding`       | ✅    | ✅    | ✅          | ✅           | ✅         | ✅    | ✅      | ❌         | ❌        |
| `commissions`      | ✅    | ✅    | ✅          | ✅           | ✅         | ✅    | ❌      | ✅         | ❌        |
| `invoices`         | ✅    | ✅    | ✅          | ✅           | ✅         | ✅    | ✅      | ✅         | ❌        |
| `activity`         | ✅    | ✅    | ✅          | ✅           | ✅         | ✅    | ✅      | ❌         | ❌        |
| `approvals`        | ✅    | ✅    | ✅          | ✅           | ✅         | ❌    | ❌      | ❌         | ❌        |
| `reports`          | ✅    | ✅    | ✅          | ✅           | ✅         | ✅    | ✅      | ✅         | ❌        |
| `notifications`    | ✅    | ✅    | ✅          | ✅           | ✅         | ✅    | ✅      | ✅         | ❌        |
| `users`            | ✅    | ✅    | ❌          | ❌           | ❌         | ❌    | ❌      | ❌         | ❌        |
| `teams`            | ✅    | ✅    | ✅          | ❌           | ❌         | ❌    | ❌      | ❌         | ❌        |
| `audit`            | ✅    | ✅    | ❌          | ❌           | ❌         | ❌    | ❌      | ❌         | ❌        |
| `admin`            | ✅    | ✅    | ❌          | ❌           | ❌         | ❌    | ❌      | ❌         | ❌        |
| `booking_actions`  | ✅    | ✅    | ✅          | ✅           | ✅         | ✅    | ❌      | ❌         | ❌        |
| `approval_actions` | ✅    | ✅    | ✅          | ❌           | ❌         | ❌    | ❌      | ❌         | ❌        |
| `commission_rules` | ✅    | ✅    | ❌          | ❌           | ❌         | ❌    | ❌      | ❌         | ❌        |

---

## Sidebar Navigation by Role

### Operate Section

- **Dashboard**: All roles except Suspended
- **Approvals**: Owner, Admin, Ops Manager, Team Manager, Lead Agent
- **Daily Activity**: All roles except Accounting & Suspended
- **Notifications**: All roles except Suspended

### Records Section

- **Leads**: All roles except Accounting & Suspended
- **Follow-ups**: All roles except Accounting & Suspended
- **Customers**: All roles except Accounting & Suspended
- **Quotes**: All roles except Accounting & Suspended
- **Carriers**: All roles except Accounting & Suspended
- **Loads**: All roles except Accounting & Suspended
- **Commissions**: All roles except Trainee & Suspended (Accounting included)
- **Invoices**: All roles except Suspended
- **Documents**: All roles except Suspended
- **Onboarding**: All roles except Accounting & Suspended
- **Reports**: All roles except Suspended

### Admin Section

- **Users**: Owner & Admin only
- **Teams**: Owner, Admin & Ops Manager only
- **Session Log**: Owner & Admin only
- **Admin Panel**: Owner & Admin only

---

## Key Restrictions

### Trainee

- No access to commissions
- No booking actions
- No approval actions
- Read-only agent view

### Accounting

- Access limited to Dashboard, Commissions, Invoices, Reports, Notifications & Documents
- No access to operational records (leads, customers, quotes, carriers, loads, follow-ups, activity, approvals, etc.)
- No access to admin or user management

### Team Manager / Lead Agent

- No access to user management (Users, Admin Panel, Audit)
- No access to commission rules
- No approval actions (only view approvals)

### Operations Manager

- No access to user management (Users, Admin Panel, Audit)
- No access to commission rules

### Suspended

- No access to any features
- Locked out of the portal entirely

---

## Role Switcher

Only users with **Owner** or **Admin** roles can use the role switcher to preview the portal as different roles!
