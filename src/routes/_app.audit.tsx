import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { fmtDate, relative } from "@/lib/format";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut, Search, ShieldAlert, RefreshCw, X } from "lucide-react";

export const Route = createFileRoute("/_app/audit")({ component: AuditPage });

type AuthActivity = {
  id: string;
  name: string;
  email: string;
  action: string;
  ipAddress: string;
  lastLogin: string | null;
  lastLogout: string | null;
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length > 1
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`
      : (parts[0]?.slice(0, 2) ?? "?");
  return initials.toUpperCase();
}

function ActionBadge({ action }: { action: string }) {
  if (action === "Login") {
    return (
      <Badge variant="success" className="gap-1">
        <LogIn className="h-3 w-3" aria-hidden="true" />
        Login
      </Badge>
    );
  }
  if (action === "Logout") {
    return (
      <Badge variant="destructive" className="gap-1">
        <LogOut className="h-3 w-3" aria-hidden="true" />
        Logout
      </Badge>
    );
  }
  return <Badge variant="outline">{action}</Badge>;
}

function AuditTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="divide-y divide-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/5 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
            <div className="hidden h-3 w-24 animate-pulse rounded bg-muted sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditPage() {
  const [items, setItems] = useState<AuthActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    async function loadActivity() {
      try {
        const payload = await apiFetch<{ users: AuthActivity[] }>("/api/audit-logs", {
          method: "GET",
        });
        setItems(payload.data.users);
      } catch (error) {
        toast.error("Failed to load authentication activity");
      } finally {
        setLoading(false);
      }
    }
    void loadActivity();
  }, []);

  async function refreshActivity() {
    setLoading(true);
    try {
      const payload = await apiFetch<{ users: AuthActivity[] }>("/api/audit-logs", {
        method: "GET",
      });
      setItems(payload.data.users);
    } catch (error) {
      toast.error("Failed to load authentication activity");
    } finally {
      setLoading(false);
    }
  }

  function getLastActivityDate(user: AuthActivity) {
    if (user.lastLogin && user.lastLogout) {
      return new Date(user.lastLogin) > new Date(user.lastLogout)
        ? user.lastLogin
        : user.lastLogout;
    }
    if (user.lastLogin) return user.lastLogin;
    if (user.lastLogout) return user.lastLogout;
    return null;
  }

  // Client-side filtering only — does not call the API again or change what's fetched.
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.action.toLowerCase().includes(q) ||
        u.ipAddress.toLowerCase().includes(q),
    );
  }, [items, query]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Authentication Activity"
          description="Latest login/logout activity for all users."
        />
        <Button
          variant="outline"
          size="sm"
          onClick={refreshActivity}
          disabled={loading}
          className="gap-2 self-start sm:mt-1"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {!loading && items.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email, IP…"
              className="pl-8 pr-8"
              aria-label="Search authentication activity"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {filteredItems.length} of {items.length} {items.length === 1 ? "event" : "events"}
          </span>
        </div>
      )}

      {loading ? (
        <AuditTableSkeleton />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-10 text-center">
          <ShieldAlert className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">No authentication activity yet</p>
          <p className="text-sm text-muted-foreground">
            Login and logout events will show up here as they happen.
          </p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-10 text-center">
          <Search className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">No matching activity</p>
          <p className="text-sm text-muted-foreground">
            Try a different name, email, action, or IP address.
          </p>
          <Button variant="outline" size="sm" className="mt-1" onClick={() => setQuery("")}>
            Clear search
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <DataTable
            rows={filteredItems}
            columns={[
              {
                head: "User",
                cell: (u) => (
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                      {getInitials(u.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{u.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                    </div>
                  </div>
                ),
              },
              {
                head: "Action",
                cell: (u) => <ActionBadge action={u.action} />,
              },
              {
                head: "IP Address",
                cell: (u) => (
                  <span className="font-mono text-xs text-muted-foreground">{u.ipAddress}</span>
                ),
              },
              {
                head: "Last Login",
                cell: (u) =>
                  u.lastLogin ? <span className="text-sm">{fmtDate(u.lastLogin)}</span> : "—",
              },
              {
                head: "Last Active",
                cell: (u) => {
                  const lastActivity = getLastActivityDate(u);
                  return lastActivity ? (
                    <span className="text-sm">{relative(lastActivity)}</span>
                  ) : (
                    "—"
                  );
                },
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}
