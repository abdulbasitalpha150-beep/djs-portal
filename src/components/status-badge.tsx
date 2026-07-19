import { cn } from "@/lib/utils";

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "critical" | "muted";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-secondary text-secondary-foreground border-border",
  info: "bg-info/15 text-info border-info/30",
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  danger: "bg-destructive/15 text-destructive border-destructive/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  muted: "bg-muted text-muted-foreground border-border",
};

const STATUS_TONE: Record<string, Tone> = {
  // generic
  active: "success",
  inactive: "muted",
  suspended: "danger",
  // leads
  new: "info",
  contacted: "info",
  qualified: "info",
  prospect: "warning",
  customer: "success",
  lost: "muted",
  // activities
  call: "info",
  note: "info",
  followup: "warning",
  task: "warning",
  edit: "neutral",
  // quotes
  pending: "warning",
  approved: "success",
  rejected: "danger",
  changes_requested: "info",
  // loads
  quoted: "muted",
  booked: "info",
  picked_up: "info",
  in_transit: "info",
  delivered: "success",
  pod_received: "success",
  invoiced: "warning",
  paid: "success",
  commission_ready: "success",
  // commissions
  locked: "muted",
  // credit
  submitted: "info",
  review: "warning",
  // onboarding doc
  missing: "danger",
};

const LABELS: Record<string, string> = {
  changes_requested: "Changes requested",
  picked_up: "Picked up",
  in_transit: "In transit",
  pod_received: "POD received",
  commission_ready: "Commission ready",
  edit: "Edited",
};

export function StatusBadge({ value, tone }: { value?: string; tone?: Tone }) {
  const t = tone ?? (value ? STATUS_TONE[value] : "neutral") ?? "neutral";
  const label = (value && LABELS[value]) ?? (value ? value.replace(/_/g, " ") : "N/A");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium capitalize",
        TONE_CLASSES[t],
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-80" />
      {label}
    </span>
  );
}
