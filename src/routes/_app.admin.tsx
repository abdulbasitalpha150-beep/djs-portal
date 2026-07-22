import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api-client";
import { can, type Capability } from "@/lib/roles";
import {
  Users,
  FolderOpen,
  ClipboardCheck,
  BarChart3,
  DollarSign,
  Settings,
  Shield,
  AlertTriangle,
  ChevronRight,
  Building2,
  Mail,
  Clock,
  Timer,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin")({ component: AdminPage });

const TILES: Array<{
  to: string;
  icon: typeof Users;
  label: string;
  desc: string;
  cap: Capability;
}> = [
  {
    to: "/users",
    icon: Users,
    label: "Users & Roles",
    desc: "Provision agents, suspend access, manage roles.",
    cap: "users",
  },
  {
    to: "/invoices",
    icon: FolderOpen,
    label: "Invoices",
    desc: "Manage and track invoices.",
    cap: "invoices",
  },
  {
    to: "/approvals",
    icon: ClipboardCheck,
    label: "Approvals",
    desc: "Unified queue across customers, quotes, loads.",
    cap: "approvals",
  },
  {
    to: "/dashboard",
    icon: BarChart3,
    label: "Reports",
    desc: "Operational reports and KPI dashboards.",
    cap: "reports",
  },
  {
    to: "/commissions",
    icon: DollarSign,
    label: "Commission Rules",
    desc: "Configure tier percentages and thresholds.",
    cap: "commission_rules",
  },
  {
    to: "/audit",
    icon: Shield,
    label: "Session Log",
    desc: "System-wide event log.",
    cap: "audit",
  },
];

const SETTINGS_ROWS = [
  { icon: Building2, label: "Company name", value: "DJ's Freight Broker LLC" },
  { icon: Mail, label: "Support email", value: "ops@djfreight.example" },
  { icon: Clock, label: "Default time zone", value: "America/Chicago" },
  { icon: Timer, label: "Session timeout", value: "30 minutes" },
];

function AdminPage() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [processing, setProcessing] = useState(false);
  const role = session?.role ?? "suspended";
  const visibleTiles = TILES.filter((tile) => can(role, tile.cap));
  const canReset = can(role, "admin");

  async function handleResetSystem() {
    if (!password || confirmation !== "RESET") return;

    setProcessing(true);
    try {
      await apiFetch<{ message: string }>("/api/admin/reset-system", {
        method: "POST",
        body: JSON.stringify({ password, confirmation }),
      });
      toast.success("System reset complete.");
      setOpen(false);
      setPassword("");
      setConfirmation("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reset failed.");
    } finally {
      setProcessing(false);
    }
  }

  function handleDialogChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setPassword("");
      setConfirmation("");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Panel"
        description="Configuration and oversight tools for administrators."
      />

      {/* Quick-access tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibleTiles.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="group flex items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
              <t.icon className="size-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{t.label}</span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Portal settings */}
      <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <Settings className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Portal settings</h3>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {SETTINGS_ROWS.map((row) => (
            <Row key={row.label} icon={row.icon} label={row.label} value={row.value} />
          ))}
        </div>
      </div>

      {/* Danger zone */}
      {canReset && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/[0.03] p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                <AlertTriangle className="size-4.5" />
              </span>
              <div>
                <div className="text-sm font-semibold text-destructive">Reset system</div>
                <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground">
                  Permanently clears all operational data while preserving existing user accounts
                  and credentials. This action cannot be undone.
                </p>
              </div>
            </div>
            <AlertDialog open={open} onOpenChange={handleDialogChange}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full shrink-0 sm:w-auto">
                  Reset system
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset the system?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all application data while preserving user
                    accounts. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="reset-password">Re-enter your password</Label>
                    <Input
                      id="reset-password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reset-confirm">Type RESET to confirm</Label>
                    <Input
                      id="reset-confirm"
                      value={confirmation}
                      onChange={(e) => setConfirmation(e.target.value)}
                      placeholder="RESET"
                      autoComplete="off"
                    />
                  </div>
                </div>
                <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-2">
                  <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={!password || confirmation !== "RESET" || processing}
                    onClick={() => {
                      void handleResetSystem();
                    }}
                    className="w-full sm:w-auto"
                  >
                    {processing ? "Resetting…" : "Reset system"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2.5">
      <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 truncate font-mono text-xs">{value}</span>
    </div>
  );
}