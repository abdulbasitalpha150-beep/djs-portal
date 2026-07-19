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
import {
  Users,
  FolderOpen,
  ClipboardCheck,
  BarChart3,
  Download,
  DollarSign,
  Settings,
  Building2,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin copy")({ component: AdminPage });

const TILES = [
  {
    to: "/users",
    icon: Users,
    label: "Users & Roles",
    desc: "Provision agents, suspend access, manage roles.",
  },
  { to: "/invoices", icon: FolderOpen, label: "Invoices", desc: "Manage and track invoices." },
  {
    to: "/approvals",
    icon: ClipboardCheck,
    label: "Approvals",
    desc: "Unified queue across customers, quotes, loads.",
  },
  {
    to: "/reports",
    icon: BarChart3,
    label: "Reports",
    desc: "Operational reports and KPI dashboards.",
  },
  {
    to: "/commissions",
    icon: DollarSign,
    label: "Commission Rules",
    desc: "Configure tier percentages and thresholds.",
  },
  { to: "/audit", icon: Shield, label: "Session Log", desc: "System-wide event log." },
];

function AdminPage() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [processing, setProcessing] = useState(false);
  const canReset = session?.role === "admin";

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

  return (
    <div className="space-y-5">
      <PageHeader
        title="Admin Panel"
        description="Configuration and oversight tools for administrators."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="group rounded-lg border border-border bg-card p-4 transition hover:border-primary/40 hover:bg-accent/30"
          >
            <t.icon className="size-5 text-muted-foreground group-hover:text-primary" />
            <div className="mt-2 text-sm font-semibold">{t.label}</div>
            <div className="text-xs text-muted-foreground">{t.desc}</div>
          </Link>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 inline-flex items-center gap-2 text-sm font-semibold">
          <Settings className="size-4" /> Portal settings
        </div>
        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <Row label="Company name" value="DJ's Freight Broker LLC" />
          <Row label="Support email" value="ops@djfreight.example" />
          <Row label="Default time zone" value="America/Chicago" />
          <Row label="Session timeout" value="30 minutes" />
        </div>
      </div>

      {canReset && (
        <div className="rounded-lg border border-destructive/30 bg-card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="size-4" /> Reset system
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            This permanently clears all operational data while preserving existing user accounts and
            credentials.
          </p>
          <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Reset System</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset the system?</AlertDialogTitle>
                <AlertDialogDescription>
                  Warning: This will permanently delete all application data while preserving user
                  accounts. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="reset-password">Re-enter your password</Label>
                  <Input
                    id="reset-password"
                    type="password"
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
                  />
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={!password || confirmation !== "RESET" || processing}
                  onClick={() => {
                    void handleResetSystem();
                  }}
                >
                  {processing ? "Resetting…" : "Reset System"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-xs">{value}</span>
    </div>
  );
}
