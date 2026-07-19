import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { loads, commissions, leads, quotes } from "@/lib/mock-data";
import { usd } from "@/lib/format";
import {
  BarChart3,
  DollarSign,
  Package,
  FileText,
  UserCheck,
  Truck,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";

export const Route = createFileRoute("/_app/reports")({ component: ReportsPage });

const REPORTS = [
  { slug: "agent-performance", label: "Agent Performance" },
  { slug: "calls", label: "Calls" },
  { slug: "leads", label: "Leads" },
  { slug: "quotes", label: "Quotes" },
  { slug: "approved-quotes", label: "Approved / Rejected Quotes" },
  { slug: "loads", label: "Loads" },
  { slug: "active-loads", label: "Active / Delivered Loads" },
  { slug: "missing-pod", label: "Missing POD" },
  { slug: "missing-invoice", label: "Missing Invoice" },
  { slug: "open-payments", label: "Open Payments" },
  { slug: "gross-margin", label: "Gross Margin" },
  { slug: "commission", label: "Commission" },
  { slug: "carrier-issues", label: "Carrier Issues" },
  { slug: "missing-docs", label: "Missing Documents" },
  { slug: "inactive-leads", label: "Inactive Leads" },
];

function ReportsPage() {
  const margin = loads
    .slice(0, 12)
    .map((l, i) => ({ w: `W${i + 1}`, margin: l.customerRate - l.carrierPay }));
  const byAgent = ["a1", "a2", "a3", "a4"].map((id) => ({
    agent: id.toUpperCase(),
    loads: loads.filter((l) => l.agentId === id).length,
    commission: commissions.filter((c) => c.agentId === id).reduce((s, c) => s + c.amount, 0),
  }));

  return (
    <div className="space-y-5">
      <PageHeader title="Reports" description="KPI dashboard and exportable operational reports." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Active leads"
          value={leads.filter((l) => !["customer", "lost"].includes(l.status)).length}
          icon={<UserCheck className="size-4" />}
        />
        <StatCard
          label="Pending quotes"
          value={quotes.filter((q) => q.status === "pending").length}
          icon={<FileText className="size-4" />}
        />
        <StatCard
          label="Active loads"
          value={loads.filter((l) => !["paid", "commission_ready"].includes(l.status)).length}
          icon={<Package className="size-4" />}
        />
        <StatCard
          label="Commission (pending)"
          value={usd(
            commissions.filter((c) => c.status === "pending").reduce((s, c) => s + c.amount, 0),
          )}
          icon={<DollarSign className="size-4" />}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 text-sm font-semibold">Gross margin trend</div>
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={margin}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="w" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    fontSize: 12,
                  }}
                />
                <Line dataKey="margin" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 text-sm font-semibold">Performance by agent</div>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={byAgent}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="agent" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="loads" fill="hsl(var(--primary))" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">All reports</h2>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {REPORTS.map((r) => (
            <li key={r.slug}>
              <Link
                to="/reports"
                className="flex items-center justify-between rounded-md border border-border bg-card p-3 text-sm hover:bg-accent/50"
              >
                <span className="inline-flex items-center gap-2">
                  <BarChart3 className="size-4 text-muted-foreground" />
                  {r.label}
                </span>
                <span className="text-xs text-muted-foreground">Open →</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
