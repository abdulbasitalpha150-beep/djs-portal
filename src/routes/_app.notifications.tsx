import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { relative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useNotifications, type NotificationItem, type NotificationGroup } from "@/hooks/use-notifications";
import { moduleIcon, typeColor, priorityClasses, priorityLabel, recordUrl } from "@/lib/notification-ui";
import { toast } from "sonner";
import {
  Inbox,
  Check,
  CheckCheck,
  Trash2,
  Search,
  Mail,
  MailOpen,
} from "lucide-react";

export const Route = createFileRoute("/_app/notifications")({ component: NotifsPage });

const GROUP_LABELS: Record<NotificationGroup, string> = {
  today: "Today",
  yesterday: "Yesterday",
  thisWeek: "This Week",
  earlier: "Earlier",
};

type FilterTab = "all" | "unread" | "read";

function NotifsPage() {
  const {
    notifications,
    unreadCount,
    totalCount,
    groups,
    loading,
    markRead,
    markAllRead,
    markUnread,
    deleteNotification,
    clearAll,
  } = useNotifications();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  // Client-side filter + search over the fetched batch
  const filtered = useMemo(() => {
    let result = notifications;
    if (filter === "unread") result = result.filter((n) => !n.isRead);
    else if (filter === "read") result = result.filter((n) => n.isRead);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (n) => n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q),
      );
    }
    return result;
  }, [notifications, filter, search]);

  // Re-group the filtered results
  const filteredGroups = useMemo(() => {
    const g: Record<NotificationGroup, NotificationItem[]> = {
      today: [],
      yesterday: [],
      thisWeek: [],
      earlier: [],
    };
    for (const n of filtered) {
      g[n.group]?.push(n);
    }
    return g;
  }, [filtered]);

  const readCount = totalCount - unreadCount;

  async function handleClick(n: NotificationItem) {
    if (!n.isRead) {
      void markRead(n.id);
    }
    const url = n.actionUrl ?? recordUrl(n.recordType, n.recordId);
    if (url) {
      navigate({ to: url });
    }
  }

  function handleClearAll() {
    if (totalCount === 0) return;
    void clearAll();
    toast.success("Cleared all notifications");
  }

  function handleMarkAllRead() {
    if (unreadCount === 0) return;
    void markAllRead();
    toast.success("Marked all as read");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description="System alerts, follow-ups and event notifications."
        actions={
          <>
            {unreadCount > 0 && (
              <span className="grid place-items-center rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
                {unreadCount} unread
              </span>
            )}
            <Button size="sm" variant="outline" onClick={handleMarkAllRead} disabled={unreadCount === 0}>
              <CheckCheck className="mr-1.5 size-3.5" />
              Mark all read
            </Button>
            <Button size="sm" variant="outline" onClick={handleClearAll} disabled={totalCount === 0}>
              <Trash2 className="mr-1.5 size-3.5" />
              Clear all
            </Button>
          </>
        }
      />

      {/* Toolbar: filter tabs + search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5">
          {(["all", "unread", "read"] as FilterTab[]).map((tab) => {
            const count = tab === "all" ? totalCount : tab === "unread" ? unreadCount : readCount;
            return (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  filter === tab
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab === "all" ? "All" : tab === "unread" ? "Unread" : "Read"}
                {count > 0 && (
                  <span className="ml-1.5 text-[10px] opacity-70">{count}</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="relative min-w-[200px] flex-1 max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search notifications…"
            className="h-8 pl-8 text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading notifications…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          <Inbox className="mb-3 size-8 text-muted-foreground/60" />
          <p className="font-medium">
            {filter === "unread"
              ? "No unread notifications"
              : filter === "read"
                ? "No read notifications"
                : search
                  ? "No notifications match your search"
                  : "You're all caught up."}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {(Object.keys(filteredGroups) as NotificationGroup[]).map((groupKey) => {
            const groupItems = filteredGroups[groupKey];
            if (!groupItems?.length) return null;
            return (
              <div key={groupKey}>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {GROUP_LABELS[groupKey]}
                  </h3>
                  <span className="text-[10px] text-muted-foreground">({groupItems.length})</span>
                </div>
                <ul className="space-y-1.5">
                  {groupItems.map((n) => (
                    <NotificationRow
                      key={n.id}
                      notification={n}
                      onClick={() => void handleClick(n)}
                      onMarkRead={() => void markRead(n.id)}
                      onMarkUnread={() => void markUnread(n.id)}
                      onDelete={() => void deleteNotification(n.id)}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NotificationRow({
  notification: n,
  onClick,
  onMarkRead,
  onMarkUnread,
  onDelete,
}: {
  notification: NotificationItem;
  onClick: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onDelete: () => void;
}) {
  const Icon = moduleIcon(n.relatedModule);
  const iconColor = typeColor(n.notificationType);
  const pClass = priorityClasses(n.priority);

  return (
    <li
      className={cn(
        "group flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent/40",
        n.isRead ? "bg-card/40" : "bg-card",
      )}
    >
      {/* Icon */}
      <button
        onClick={onClick}
        className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-md", iconColor)}
      >
        <Icon className="size-4" />
      </button>

      {/* Content */}
      <button onClick={onClick} className="min-w-0 flex-1 text-left">
        <div className="flex items-start justify-between gap-2">
          <span className={cn("text-sm", n.isRead ? "font-normal" : "font-medium")}>
            {n.title}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {relative(n.createdAt)}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>
        <div className="mt-1 flex items-center gap-2">
          {n.senderName && (
            <span className="text-[10px] text-muted-foreground">From {n.senderName}</span>
          )}
          {!n.isRead && (
            <span className="size-1.5 rounded-full bg-primary" title="Unread" />
          )}
        </div>
      </button>

      {/* Right: priority + hover actions */}
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-medium",
            pClass,
          )}
        >
          {priorityLabel(n.priority)}
        </span>
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {n.isRead ? (
            <button
              onClick={onMarkUnread}
              className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Mark as unread"
            >
              <Mail className="size-3.5" />
            </button>
          ) : (
            <button
              onClick={onMarkRead}
              className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Mark as read"
            >
              <MailOpen className="size-3.5" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-destructive"
            title="Delete"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}
