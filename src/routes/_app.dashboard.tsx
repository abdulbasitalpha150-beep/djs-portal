import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { useAuth } from "@/lib/auth-context";
import { can, type Role } from "@/lib/roles";
import { usd, num, relative, fmtDate } from "@/lib/format";
import { useDashboard, type DashboardData } from "@/hooks/use-dashboard";
import {
  Users,
  FileText,
  Package,
  ClipboardCheck,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Truck,
  CalendarClock,
  Settings,
  UserPlus,
  FolderOpen,
  GraduationCap,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

// ---------------------------------------------------------------------------
// Icon mapping
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, LucideIcon> = {
  users: Users,
  user: Users,
  "user-plus": UserPlus,
  file: FileText,
  package: Package,
  clipboard: ClipboardCheck,
  dollar: DollarSign,
  alert: AlertTriangle,
  check: CheckCircle2,
  trending: TrendingUp,
  truck: Truck,
  calendar: CalendarClock,
  settings: Settings,
  folder: FolderOpen,
  graduation: GraduationCap,
  chart: BarChart3,
};

function getIcon(name?: string): LucideIcon {
  return ICON_MAP[name ?? ""] ?? FileText;
}

// ---------------------------------------------------------------------------
// Session type
// ---------------------------------------------------------------------------

type Session = {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: string;
  isTemporaryPassword?: boolean;
};

// ---------------------------------------------------------------------------
// Main Dashboard component
// ---------------------------------------------------------------------------

function Dashboard() {
  const { session } = useAuth();
  const { data, loading } = useDashboard();

  const role = session?.role ?? "agent";
  const firstName = session?.name?.split(" ")[0] ?? "";

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title={`Welcome back, ${firstName}`} description="Loading your dashboard..." />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg border border-border bg-card p-4"
            />
          ))}
        </div>
      </div>
    );
  }

  switch (role) {
    case "owner":
    case "admin":
      return <OwnerDashboard data={data} session={session!} firstName={firstName} />;
    case "ops_manager":
      return <OpsManagerDashboard data={data} session={session!} firstName={firstName} />;
    case "team_manager":
      return <TeamManagerDashboard data={data} session={session!} firstName={firstName} />;
    case "leadagent":
      return <LeadAgentDashboard data={data} session={session!} firstName={firstName} />;
    case "agent":
      return <AgentDashboard data={data} session={session!} firstName={firstName} />;
    case "trainee":
      return <TraineeDashboard data={data} session={session!} firstName={firstName} />;
    case "accounting":
      return <AccountingDashboard data={data} session={session!} firstName={firstName} />;
    default:
      return <AgentDashboard data={data} session={session!} firstName={firstName} />;
  }
}

// ---------------------------------------------------------------------------
// Shared widgets
// ---------------------------------------------------------------------------

function KpiGrid({ kpis }: { kpis: DashboardData["kpis"] }) {
  if (kpis.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {kpis.map((kpi) => {
        const Icon = getIcon(kpi.icon);
        return (
          <StatCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            delta={kpi.delta}
            trend={kpi.trend}
            icon={<Icon className="size-4" />}
          />
        );
      })}
    </div>
  );
}

function MarginTrendChart({ trends }: { trends: DashboardData["trends"] }) {
  if (!trends || trends.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Gross margin &mdash; last 12 weeks</h2>
        <span className="text-xs text-muted-foreground">USD per week</span>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trends}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="week"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              stroke="var(--border)"
            />
            <YAxis
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              stroke="var(--border)"
            />
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--muted-foreground)" }}
            />
            <Line
              type="monotone"
              dataKey="margin"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AgentPerformanceChart({ data }: { data: DashboardData["agentPerformance"] }) {
  if (!data || data.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Agent performance &mdash; gross margin</h2>
        <span className="text-xs text-muted-foreground">USD</span>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="name"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              stroke="var(--border)"
            />
            <YAxis
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              stroke="var(--border)"
            />
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 12,
              }}
            />
            <Bar dataKey="margin" fill="var(--primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TeamPerformanceTable({ data }: { data: DashboardData["teamPerformance"] }) {
  if (!data || data.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">Team performance</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="pb-2 pr-4 font-medium">Team</th>
              <th className="pb-2 pr-4 text-right font-medium">Loads</th>
              <th className="pb-2 pr-4 text-right font-medium">Revenue</th>
              <th className="pb-2 text-right font-medium">Margin</th>
            </tr>
          </thead>
          <tbody>
            {data.map((t) => (
              <tr key={t.name} className="border-b border-border/50 last:border-0">
                <td className="py-2 pr-4 font-medium">{t.name}</td>
                <td className="py-2 pr-4 text-right font-mono">{num(t.loads)}</td>
                <td className="py-2 pr-4 text-right font-mono">{usd(t.revenue)}</td>
                <td className="py-2 text-right font-mono">{usd(t.margin)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecentActivityPanel({ items }: { items: DashboardData["recentActivity"] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">Recent activity</h2>
      {items.length === 0 ? (
        <div className="py-6 text-center text-sm text-muted-foreground">No recent activity</div>
      ) : (
        <ul className="space-y-3">
          {items.slice(0, 6).map((n) => (
            <li key={n.id} className="flex items-start gap-2.5">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
              <div className="min-w-0">
                <div className="truncate text-sm">{n.title}</div>
                <div className="truncate text-xs text-muted-foreground">{n.message}</div>
                <div className="text-[10px] text-muted-foreground">{relative(n.createdAt)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PendingApprovalsPanel({ items }: { items: DashboardData["pendingApprovals"] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Pending approvals</h2>
        <Link to="/approvals" className="text-xs text-primary hover:underline">
          View all
        </Link>
      </div>
      <ul className="divide-y divide-border">
        {items.slice(0, 5).map((a) => {
          let title = `${a.module.charAt(0).toUpperCase() + a.module.slice(1)}: ${a.actionType}`;
          if (a.module === "leads") {
            title = `Lead: ${(a.newValues as any)?.companyName || "New Lead"}`;
          } else if (a.module === "customers") {
            title = `Customer: ${(a.newValues as any)?.companyName || "New Customer"}`;
          } else if (a.module === "quotes") {
            const lane = (a.newValues as any)?.lane;
            title = `Quote: ${lane?.origin || "Origin"} \u2192 ${lane?.destination || "Destination"}`;
          }
          return (
            <li
              key={a.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <StatusBadge value={a.module} tone="info" />
                  <span className="truncate text-sm font-medium">{title}</span>
                </div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  Requested by {a.requestedByName} &middot; {relative(a.createdAt)}
                </div>
              </div>
              <span className="text-xs text-muted-foreground">Open</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function UpcomingFollowupsPanel({ items }: { items: DashboardData["upcomingFollowups"] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">Upcoming follow-ups</h2>
      {items.length === 0 ? (
        <div className="py-6 text-center text-sm text-muted-foreground">No upcoming follow-ups</div>
      ) : (
        <ul className="space-y-2">
          {items.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{f.title}</div>
                <div className="text-xs text-muted-foreground">{fmtDate(f.dueDate)}</div>
              </div>
              <StatusBadge
                value={f.priority}
                tone={f.priority === "high" ? "danger" : f.priority === "medium" ? "warning" : "muted"}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecentLoadsPanel({ items }: { items: DashboardData["recentLoads"] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
      <h2 className="mb-3 text-sm font-semibold">Recent loads</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="pb-2 pr-4 font-medium">Load #</th>
              <th className="pb-2 pr-4 font-medium">Route</th>
              <th className="pb-2 pr-4 font-medium">Status</th>
              <th className="pb-2 text-right font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l) => (
              <tr key={l.id} className="border-b border-border/50 last:border-0">
                <td className="py-2 pr-4 font-mono text-xs">{l.loadNumber}</td>
                <td className="py-2 pr-4 text-xs">
                  {l.origin} &rarr; {l.destination}
                </td>
                <td className="py-2 pr-4">
                  <StatusBadge value={l.status} />
                </td>
                <td className="py-2 text-right font-mono text-xs">{usd(l.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InvoiceSummaryPanel({ summary }: { summary: NonNullable<DashboardData["invoiceSummary"]> }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">Invoice summary</h2>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Pending</span>
          <span className="font-mono text-sm">
            {summary.pending} ({usd(summary.pendingTotal)})
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Paid</span>
          <span className="font-mono text-sm">
            {summary.paid} ({usd(summary.paidTotal)})
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Outstanding</span>
          <span className="font-mono text-sm">
            {summary.outstanding} ({usd(summary.outstandingTotal)})
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2">
          <span className="text-sm font-medium text-destructive">Overdue</span>
          <span className="font-mono text-sm text-destructive">
            {summary.overdue} ({usd(summary.overdueTotal)})
          </span>
        </div>
      </div>
    </div>
  );
}

function CommissionSummaryPanel({
  summary,
}: {
  summary: NonNullable<DashboardData["commissionSummary"]>;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">Commission summary</h2>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Pending</span>
          <span className="font-mono text-sm">
            {summary.pending} ({usd(summary.pendingTotal)})
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Processing</span>
          <span className="font-mono text-sm">
            {summary.processing} ({usd(summary.processingTotal)})
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2">
          <span className="text-sm font-medium text-success">Paid</span>
          <span className="font-mono text-sm text-success">
            {summary.paid} ({usd(summary.paidTotal)})
          </span>
        </div>
      </div>
    </div>
  );
}

function TrainingProgressPanel({
  progress,
}: {
  progress: NonNullable<DashboardData["trainingProgress"]>;
}) {
  const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Training progress</h2>
        <StatusBadge
          value={progress.activationStatus}
          tone={progress.activationStatus === "Active" ? "success" : "warning"}
        />
      </div>
      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {progress.completed} / {progress.total} completed
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {progress.requirements.length > 0 && (
        <ul className="space-y-1.5">
          {progress.requirements.map((r) => (
            <li key={r.key} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{r.label}</span>
              <StatusBadge
                value={r.status}
                tone={
                  r.status === "approved"
                    ? "success"
                    : r.status === "rejected"
                      ? "danger"
                      : r.status === "missing"
                        ? "danger"
                        : "warning"
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuickActionsPanel({ actions }: { actions: DashboardData["quickActions"] }) {
  if (actions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => {
        const Icon = getIcon(a.icon);
        return (
          <Link
            key={a.label}
            to={a.href}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Icon className="size-4" />
            {a.label}
          </Link>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Role: Owner / Admin
// ---------------------------------------------------------------------------

function OwnerDashboard({
  data,
  session,
  firstName,
}: {
  data: DashboardData;
  session: Session;
  firstName: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome back, ${firstName}`} description="Company overview" />
      <KpiGrid kpis={data.kpis} />
      <div className="grid gap-4 lg:grid-cols-3">
        <MarginTrendChart trends={data.trends} />
        <RecentActivityPanel items={data.recentActivity} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <TeamPerformanceTable data={data.teamPerformance} />
        <AgentPerformanceChart data={data.agentPerformance} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <PendingApprovalsPanel items={data.pendingApprovals} />
        <UpcomingFollowupsPanel items={data.upcomingFollowups} />
      </div>
      <QuickActionsPanel actions={data.quickActions} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Role: Ops Manager
// ---------------------------------------------------------------------------

function OpsManagerDashboard({
  data,
  session,
  firstName,
}: {
  data: DashboardData;
  session: Session;
  firstName: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={`Operations Dashboard`} description="Daily operations overview" />
      <KpiGrid kpis={data.kpis} />
      <div className="grid gap-4 lg:grid-cols-3">
        <MarginTrendChart trends={data.trends} />
        <RecentActivityPanel items={data.recentActivity} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <PendingApprovalsPanel items={data.pendingApprovals} />
        <UpcomingFollowupsPanel items={data.upcomingFollowups} />
      </div>
      <QuickActionsPanel actions={data.quickActions} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Role: Team Manager
// ---------------------------------------------------------------------------

function TeamManagerDashboard({
  data,
  session,
  firstName,
}: {
  data: DashboardData;
  session: Session;
  firstName: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Team Dashboard${data.teamInfo ? " \u2014 " + data.teamInfo.teamName : ""}`}
        description="Your team's performance at a glance"
      />
      <KpiGrid kpis={data.kpis} />
      <div className="grid gap-4 lg:grid-cols-2">
        <AgentPerformanceChart data={data.agentPerformance} />
        <RecentActivityPanel items={data.recentActivity} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <PendingApprovalsPanel items={data.pendingApprovals} />
        <UpcomingFollowupsPanel items={data.upcomingFollowups} />
      </div>
      <QuickActionsPanel actions={data.quickActions} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Role: Lead Agent
// ---------------------------------------------------------------------------

function LeadAgentDashboard({
  data,
  session,
  firstName,
}: {
  data: DashboardData;
  session: Session;
  firstName: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title="Team Lead Dashboard" description="Your work and team overview" />
      <KpiGrid kpis={data.kpis} />
      <div className="grid gap-4 lg:grid-cols-3">
        <MarginTrendChart trends={data.trends} />
        <AgentPerformanceChart data={data.agentPerformance} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <RecentActivityPanel items={data.recentActivity} />
        <UpcomingFollowupsPanel items={data.upcomingFollowups} />
      </div>
      <QuickActionsPanel actions={data.quickActions} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Role: Agent
// ---------------------------------------------------------------------------

function AgentDashboard({
  data,
  session,
  firstName,
}: {
  data: DashboardData;
  session: Session;
  firstName: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title="My Dashboard" description="Your personal workspace" />
      <KpiGrid kpis={data.kpis} />
      <div className="grid gap-4 lg:grid-cols-3">
        {data.commissionSummary && <CommissionSummaryPanel summary={data.commissionSummary} />}
        <RecentLoadsPanel items={data.recentLoads} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <RecentActivityPanel items={data.recentActivity} />
        <UpcomingFollowupsPanel items={data.upcomingFollowups} />
      </div>
      <QuickActionsPanel actions={data.quickActions} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Role: Trainee
// ---------------------------------------------------------------------------

function TraineeDashboard({
  data,
  session,
  firstName,
}: {
  data: DashboardData;
  session: Session;
  firstName: string;
}) {
  const isActive = session.status === "active";
  return (
    <div className="space-y-6">
      <PageHeader title="My Dashboard" description="Your training and onboarding progress" />
      {data.trainingProgress && <TrainingProgressPanel progress={data.trainingProgress} />}
      <KpiGrid kpis={data.kpis} />
      {!isActive && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
          <div className="flex items-center gap-2 text-sm text-warning">
            <AlertTriangle className="size-4" />
            <span className="font-medium">
              Activate your account to start quoting and creating loads.
            </span>
          </div>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <RecentActivityPanel items={data.recentActivity} />
        <UpcomingFollowupsPanel items={data.upcomingFollowups} />
      </div>
      <QuickActionsPanel actions={data.quickActions} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Role: Accounting
// ---------------------------------------------------------------------------

function AccountingDashboard({
  data,
  session,
  firstName,
}: {
  data: DashboardData;
  session: Session;
  firstName: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title="Finance Dashboard" description="Invoices, payments, and commissions" />
      <KpiGrid kpis={data.kpis} />
      <div className="grid gap-4 lg:grid-cols-2">
        {data.invoiceSummary && <InvoiceSummaryPanel summary={data.invoiceSummary} />}
        {data.commissionSummary && <CommissionSummaryPanel summary={data.commissionSummary} />}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <RecentActivityPanel items={data.recentActivity} />
        <UpcomingFollowupsPanel items={data.upcomingFollowups} />
      </div>
      <QuickActionsPanel actions={data.quickActions} />
    </div>
  );
}
