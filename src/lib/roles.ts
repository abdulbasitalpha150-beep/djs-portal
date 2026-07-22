export type Role =
  | "owner"
  | "admin"
  | "ops_manager"
  | "team_manager"
  | "leadagent"
  | "agent"
  | "trainee"
  | "accounting"
  | "suspended";

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  ops_manager: "Operations Manager",
  team_manager: "Team Manager",
  leadagent: "Lead Agent",
  agent: "Agent",
  trainee: "Trainee",
  accounting: "Accounting",
  suspended: "Suspended",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Full access across the portal",
  admin: "Full access across the portal",
  ops_manager: "Operations oversight org-wide",
  team_manager: "Visibility into assigned team",
  leadagent: "Visibility into assigned team",
  agent: "Scoped to own records",
  trainee: "Read-only agent view",
  accounting: "Invoices, payments, commissions",
  suspended: "No access — locked out",
};

export type Capability =
  | "dashboard"
  | "leads"
  | "customers"
  | "quotes"
  | "carriers"
  | "loads"
  | "documents"
  | "onboarding"
  | "commissions"
  | "invoices"
  | "activity"
  | "approvals"
  | "reports"
  | "notifications"
  | "users"
  | "teams"
  | "audit"
  | "admin"
  | "booking_actions"
  | "approval_actions"
  | "commission_rules"
  | "followups";

const MATRIX: Record<Role, Capability[]> = {
  owner: [
    "dashboard",
    "leads",
    "customers",
    "quotes",
    "carriers",
    "loads",
    "documents",
    // "onboarding",
    "commissions",
    "invoices",
    "activity",
    "approvals",
    "reports",
    "notifications",
    "users",
    "teams",
    "audit",
    "admin",
    "booking_actions",
    "approval_actions",
    "commission_rules",
    "followups",
  ],
  admin: [
    "dashboard",
    "leads",
    "customers",
    "quotes",
    "carriers",
    "loads",
    "documents",
    // "onboarding",
    "commissions",
    "invoices",
    "activity",
    "approvals",
    "reports",
    "notifications",
    "users",
    "teams",
    "audit",
    "admin",
    "booking_actions",
    "approval_actions",
    "commission_rules",
    "followups",
  ],
  ops_manager: [
    "dashboard",
    "leads",
    "customers",
    "quotes",
    "carriers",
    "loads",
    "documents",
    // "onboarding",
    "commissions",
    "invoices",
    "activity",
    "approvals",
    "reports",
    "notifications",
    "booking_actions",
    "approval_actions",
    "teams",
    "followups",
  ],
  team_manager: [
    "dashboard",
    "leads",
    "customers",
    "quotes",
    "carriers",
    "loads",
    "documents",
    // "onboarding",
    "commissions",
    "invoices",
    "activity",
    "approvals",
    "reports",
    "notifications",
    "booking_actions",
    "approval_actions",
    "followups",
  ],
  leadagent: [
    "dashboard",
    "leads",
    "customers",
    "quotes",
    "carriers",
    "loads",
    "documents",
    // "onboarding",
    "commissions",
    "invoices",
    "activity",
    "approvals",
    "reports",
    "notifications",
    "booking_actions",
    "approval_actions",
    "followups",
  ],
  agent: [
    "dashboard",
    "leads",
    "customers",
    "quotes",
    "carriers",
    "loads",
    "documents",
    // "onboarding",
    "commissions",
    "invoices",
    "activity",
    "reports",
    "notifications",
    "booking_actions",
    "followups",
  ],
  trainee: [
    "dashboard",
    "leads",
    "customers",
    "quotes",
    "carriers",
    "loads",
    "documents",
    // "onboarding",
    "invoices",
    "activity",
    "reports",
    "notifications",
    "followups",
  ],
  accounting: ["dashboard", "commissions", "invoices", "reports", "notifications", "documents"],
  suspended: [],
};

export function can(role: Role, cap: Capability): boolean {
  return MATRIX[role].includes(cap);
}
