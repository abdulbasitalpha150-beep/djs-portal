import {
  Users,
  ClipboardCheck,
  UserCheck,
  Building2,
  FileText,
  Package,
  Truck,
  DollarSign,
  CalendarClock,
  GraduationCap,
  BarChart3,
  Server,
  Bell,
  type LucideIcon,
} from "lucide-react";

const MODULE_ICONS: Record<string, LucideIcon> = {
  user_management: Users,
  team_management: Users,
  approvals: ClipboardCheck,
  leads: UserCheck,
  customers: Building2,
  quotes: FileText,
  loads: Package,
  carriers: Truck,
  commissions: DollarSign,
  invoices: FileText,
  daily_activity: CalendarClock,
  followups: ClipboardCheck,
  training: GraduationCap,
  kpi: BarChart3,
  system: Server,
  auth: Bell,
};

export function moduleIcon(module: string): LucideIcon {
  return MODULE_ICONS[module] ?? Bell;
}

const PRIORITY_CLASSES: Record<string, string> = {
  low: "bg-green-500/15 text-green-600 dark:text-green-400",
  medium: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  high: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  critical: "bg-red-500/15 text-red-600 dark:text-red-400",
};

export function priorityClasses(priority: string): string {
  return PRIORITY_CLASSES[priority] ?? PRIORITY_CLASSES.medium;
}

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export function priorityLabel(priority: string): string {
  return PRIORITY_LABELS[priority] ?? "Medium";
}

/**
 * Type-driven color for the icon background.
 * approved=green, info=blue, pending=orange, rejected=red, system=gray
 */
export function typeColor(notificationType: string): string {
  const t = notificationType.toLowerCase();
  if (
    t.includes("approved") ||
    t.includes("paid") ||
    t.includes("completed") ||
    t.includes("activated")
  ) {
    return "bg-green-500/15 text-green-600 dark:text-green-400";
  }
  if (
    t.includes("rejected") ||
    t.includes("overdue") ||
    t.includes("deleted") ||
    t.includes("suspended") ||
    t.includes("anomaly") ||
    t.includes("alert") ||
    t.includes("locked") ||
    t.includes("unassigned")
  ) {
    return "bg-red-500/15 text-red-600 dark:text-red-400";
  }
  if (
    t.includes("submitted") ||
    t.includes("pending") ||
    t.includes("processing") ||
    t.includes("due") ||
    t.includes("assigned") ||
    t.includes("expiring") ||
    t.includes("changes_requested")
  ) {
    return "bg-orange-500/15 text-orange-600 dark:text-orange-400";
  }
  if (t.includes("system")) {
    return "bg-gray-500/15 text-gray-600 dark:text-gray-400";
  }
  return "bg-blue-500/15 text-blue-600 dark:text-blue-400";
}

/**
 * Client-side fallback for deriving a URL from recordType + recordId.
 * Mirrors the server-side resolveActionUrl logic.
 */
export function recordUrl(recordType?: string, recordId?: string): string | undefined {
  if (!recordType || !recordId) return undefined;
  const map: Record<string, string> = {
    QuoteRequest: "/quotes",
    Load: "/loads",
    Customer: "/customers",
    Carrier: "/carriers",
    User: "/users",
    Team: "/teams",
    Invoice: "/invoices",
    Commission: "/commissions",
    FollowUp: "/followups",
    Lead: "/leads",
    ApprovalRequest: "/approvals",
    DailyActivityLog: "/activity",
    OnboardingDocument: "/onboarding",
    TrainingModule: "/onboarding",
  };
  const base = map[recordType];
  if (!base) return undefined;
  return `${base}?focus=${recordId}`;
}
