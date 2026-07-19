import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";

export type NotificationGroup = "today" | "yesterday" | "thisWeek" | "earlier";

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  notificationType: string;
  relatedModule: string;
  recordType?: string;
  recordId?: string;
  priority: string;
  isRead: boolean;
  senderName?: string;
  actionUrl?: string;
  createdAt: string;
  group: NotificationGroup;
};

type NotificationsResponse = {
  notifications: NotificationItem[];
  groups: Record<NotificationGroup, NotificationItem[]>;
  unreadCount: number;
  totalCount: number;
};

const POLL_INTERVAL = 45_000;

/**
 * Shared notification hook used by both the notifications page and the bell.
 *
 * - Polls `/api/notifications?filter=all&limit=50` on mount and every 45s
 * - Triggers KPI summary generation on first mount (fire-and-forget)
 * - Refetches on window focus
 * - Exposes mutation helpers that POST to the API and refetch to reconcile
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [groups, setGroups] = useState<Record<NotificationGroup, NotificationItem[]>>({
    today: [],
    yesterday: [],
    thisWeek: [],
    earlier: [],
  });
  const [loading, setLoading] = useState(true);
  const kpiTriggered = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const payload = await apiFetch<NotificationsResponse>(
        "/api/notifications?filter=all&limit=50",
        { method: "GET" },
      );
      setNotifications(payload.data.notifications);
      setUnreadCount(payload.data.unreadCount);
      setTotalCount(payload.data.totalCount);
      setGroups(payload.data.groups);
    } catch {
      // Silent fail — notifications are non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + KPI trigger + polling + window focus
  useEffect(() => {
    if (!kpiTriggered.current) {
      kpiTriggered.current = true;
      // Fire-and-forget KPI summary generation before the main fetch
      void apiFetch("/api/notifications/kpi-summary", { method: "GET" }).catch(() => {});
    }

    void refresh();

    const interval = setInterval(() => void refresh(), POLL_INTERVAL);

    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  // --- Mutation helpers ---

  const markRead = useCallback(
    async (id?: string) => {
      try {
        await apiFetch<NotificationsResponse>("/api/notifications", {
          method: "POST",
          body: JSON.stringify({ action: "mark_read", id }),
        });
        await refresh();
      } catch {
        // silent
      }
    },
    [refresh],
  );

  const markAllRead = useCallback(async () => {
    try {
      await apiFetch<NotificationsResponse>("/api/notifications", {
        method: "POST",
        body: JSON.stringify({ action: "mark_read" }),
      });
      await refresh();
    } catch {
      // silent
    }
  }, [refresh]);

  const markUnread = useCallback(
    async (id: string) => {
      try {
        await apiFetch<NotificationsResponse>("/api/notifications", {
          method: "POST",
          body: JSON.stringify({ action: "mark_unread", id }),
        });
        await refresh();
      } catch {
        // silent
      }
    },
    [refresh],
  );

  const deleteNotification = useCallback(
    async (id: string) => {
      try {
        await apiFetch<NotificationsResponse>("/api/notifications", {
          method: "POST",
          body: JSON.stringify({ action: "delete", id }),
        });
        await refresh();
      } catch {
        // silent
      }
    },
    [refresh],
  );

  const clearAll = useCallback(async () => {
    try {
      await apiFetch<NotificationsResponse>("/api/notifications", {
        method: "POST",
        body: JSON.stringify({ action: "clear_all" }),
      });
      await refresh();
    } catch {
      // silent
    }
  }, [refresh]);

  return {
    notifications,
    unreadCount,
    totalCount,
    groups,
    loading,
    refresh,
    markRead,
    markAllRead,
    markUnread,
    deleteNotification,
    clearAll,
  };
}
