import mongoose from "mongoose";
import { connectDb } from "../lib/db";
import { getSessionUserFromRequest, requireAuth } from "../lib/auth";
import { jsonResponse, parseJson } from "../lib/api";
import { Notification } from "../models/notification";
import { cleanupOldNotifications } from "../lib/notification";

type NotificationGroup = "today" | "yesterday" | "thisWeek" | "earlier";

interface MappedNotification {
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
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function assignGroup(createdAt: Date, now: Date): NotificationGroup {
  const todayStart = startOfDay(now);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  // This week = last 7 days (rolling), excluding today & yesterday
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  if (createdAt >= todayStart) return "today";
  if (createdAt >= yesterdayStart) return "yesterday";
  if (createdAt >= weekStart) return "thisWeek";
  return "earlier";
}

function mapNotification(doc: any, now: Date): MappedNotification {
  return {
    id: doc._id.toString(),
    title: doc.title,
    message: doc.message,
    notificationType: doc.notificationType,
    relatedModule: doc.relatedModule,
    recordType: doc.recordType,
    recordId: doc.recordId?.toString(),
    priority: doc.priority,
    isRead: doc.isRead,
    senderName: doc.senderName,
    actionUrl: doc.actionUrl,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : new Date(doc.createdAt).toISOString(),
    group: assignGroup(doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt), now),
  };
}

function buildGrouped(notifications: MappedNotification[]) {
  const groups: Record<NotificationGroup, MappedNotification[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    earlier: [],
  };
  for (const n of notifications) {
    groups[n.group].push(n);
  }
  return groups;
}

export async function notificationsHandler(request: Request) {
  const user = await getSessionUserFromRequest(request);
  const sessionUser = requireAuth(user);
  await connectDb();

  const recipientFilter = { recipientUserId: new mongoose.Types.ObjectId(sessionUser.id) };

  // -------------------------------------------------------------------------
  // GET: list notifications with filter + search + grouping
  // -------------------------------------------------------------------------
  if (request.method === "GET") {
    const url = new URL(request.url);
    const filter = url.searchParams.get("filter") ?? "all"; // all | unread | read
    const q = url.searchParams.get("q")?.trim() ?? "";
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));

    const query: Record<string, unknown> = { ...recipientFilter };
    if (filter === "unread") query.isRead = false;
    else if (filter === "read") query.isRead = true;
    if (q) {
      query.$or = [
        { title: { $regex: q, $options: "i" } },
        { message: { $regex: q, $options: "i" } },
      ];
    }

    const [docs, unreadCount, totalCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).limit(limit).lean().exec(),
      Notification.countDocuments({ ...recipientFilter, isRead: false }).exec(),
      Notification.countDocuments(recipientFilter).exec(),
    ]);

    const now = new Date();
    const notifications = docs.map((d) => mapNotification(d, now));
    const groups = buildGrouped(notifications);

    return jsonResponse({
      notifications,
      groups,
      unreadCount,
      totalCount,
    });
  }

  // -------------------------------------------------------------------------
  // POST: mark_read / mark_unread / delete / clear_all / cleanup_old
  // -------------------------------------------------------------------------
  if (request.method === "POST") {
    const body = await parseJson(request);
    const action = typeof body.action === "string" ? body.action : "";
    const id = typeof body.id === "string" ? body.id.trim() : "";

    if (action === "mark_read") {
      if (id) {
        await Notification.updateOne(
          { _id: new mongoose.Types.ObjectId(id), ...recipientFilter },
          { $set: { isRead: true, readAt: new Date() } },
        ).exec();
      } else {
        await Notification.updateMany(
          { ...recipientFilter, isRead: false },
          { $set: { isRead: true, readAt: new Date() } },
        ).exec();
      }
    } else if (action === "mark_unread") {
      if (id) {
        await Notification.updateOne(
          { _id: new mongoose.Types.ObjectId(id), ...recipientFilter },
          { $set: { isRead: false, readAt: null } },
        ).exec();
      }
    } else if (action === "delete") {
      if (id) {
        await Notification.deleteOne({
          _id: new mongoose.Types.ObjectId(id),
          ...recipientFilter,
        }).exec();
      }
    } else if (action === "clear_all") {
      await Notification.deleteMany(recipientFilter).exec();
    } else if (action === "cleanup_old") {
      // Delete old notifications (read >24h or unread >2 weeks)
      const result = await cleanupOldNotifications();
      return jsonResponse({ 
        ok: true,
        message: `Cleanup complete. Deleted ${result.deletedCount} notifications.`,
        deletedCount: result.deletedCount,
        details: result.details,
      });
    } else {
      throw Object.assign(new Error(`Unknown action: ${action}`), { status: 400 });
    }

    // Return updated list
    const [docs, unreadCount, totalCount] = await Promise.all([
      Notification.find(recipientFilter).sort({ createdAt: -1 }).limit(50).lean().exec(),
      Notification.countDocuments({ ...recipientFilter, isRead: false }).exec(),
      Notification.countDocuments(recipientFilter).exec(),
    ]);

    const now = new Date();
    const notifications = docs.map((d) => mapNotification(d, now));
    const groups = buildGrouped(notifications);

    return jsonResponse({ notifications, groups, unreadCount, totalCount });
  }

  throw Object.assign(new Error("Method not allowed"), { status: 405 });
}
