import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types — mirror src/api/dashboard.ts exports
// ---------------------------------------------------------------------------

export type DashboardKpi = {
  label: string;
  value: number | string;
  icon?: string;
  delta?: string;
  trend?: "up" | "down" | "flat";
};

export type DashboardTrend = {
  week: string;
  margin: number;
  loads: number;
  revenue: number;
};

export type DashboardAgentPerf = {
  name: string;
  margin: number;
  loads: number;
};

export type DashboardTeamPerf = {
  name: string;
  revenue: number;
  loads: number;
  margin: number;
};

export type DashboardActivity = {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  actionUrl?: string;
};

export type DashboardApproval = {
  id: string;
  module: string;
  actionType: string;
  requestedByName: string;
  createdAt: string;
  newValues: Record<string, unknown>;
};

export type DashboardFollowUp = {
  id: string;
  title: string;
  dueDate: string;
  priority: string;
  leadName?: string;
};

export type DashboardRecentLoad = {
  id: string;
  loadNumber: string;
  status: string;
  origin: string;
  destination: string;
  revenue: number;
  createdAt: string;
};

export type DashboardInvoiceSummary = {
  pending: number;
  pendingTotal: number;
  paid: number;
  paidTotal: number;
  outstanding: number;
  outstandingTotal: number;
  overdue: number;
  overdueTotal: number;
};

export type DashboardCommissionSummary = {
  pending: number;
  pendingTotal: number;
  processing: number;
  processingTotal: number;
  paid: number;
  paidTotal: number;
};

export type DashboardTrainingProgress = {
  completed: number;
  total: number;
  pending: number;
  overdue: number;
  activationStatus: string;
  requirements: { key: string; label: string; status: string }[];
} | null;

export type DashboardQuickAction = {
  label: string;
  href: string;
  icon: string;
};

export type DashboardTeamInfo = {
  teamName: string;
  memberCount: number;
} | null;

export type DashboardData = {
  kpis: DashboardKpi[];
  trends: DashboardTrend[];
  agentPerformance: DashboardAgentPerf[];
  teamPerformance: DashboardTeamPerf[];
  recentActivity: DashboardActivity[];
  pendingApprovals: DashboardApproval[];
  upcomingFollowups: DashboardFollowUp[];
  recentLoads: DashboardRecentLoad[];
  invoiceSummary: DashboardInvoiceSummary | null;
  commissionSummary: DashboardCommissionSummary | null;
  trainingProgress: DashboardTrainingProgress;
  quickActions: DashboardQuickAction[];
  teamInfo: DashboardTeamInfo;
};

const POLL_INTERVAL = 45_000;

/**
 * Dashboard data hook with 45s polling and window-focus refetch.
 * Returns { data, loading, refresh }.
 */
export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const payload = await apiFetch<DashboardData>("/api/dashboard", { method: "GET" });
      if (mounted.current) {
        setData(payload.data);
      }
    } catch {
      // Silent fail — dashboard is non-critical
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();

    const interval = setInterval(() => void refresh(), POLL_INTERVAL);

    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);

    return () => {
      mounted.current = false;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  return { data, loading, refresh };
}
