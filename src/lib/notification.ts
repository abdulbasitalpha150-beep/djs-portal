import mongoose from "mongoose";
import { Notification, type NotificationModule, type NotificationPriority } from "../models/notification";
import { LoginHistory } from "../models/loginHistory";
import { Team } from "../models/team";
import { User } from "../models/user";
import type { Role } from "./roles";

/**
 * Notification service — the single entry point for emitting notifications
 * across the Freight Agent Hub. Mirrors the recordAudit() pattern in lib/audit.ts
 * but with role-aware recipient resolution.
 *
 * Design rules:
 *  - Every public helper wraps DB writes in try/catch and logs failures via
 *    console.error. A notification failure MUST NEVER break the caller's
 *    primary operation.
 *  - Recipients are resolved at write-time: we write one Notification document
 *    per recipient. This keeps read-time queries simple (filter by
 *    recipientUserId) and lets us denormalize senderName/role/teamId.
 *  - Role-based visibility is enforced here, not at query time. Users will
 *    never receive notifications for records they cannot access because we
 *    never create those documents in the first place.
 */

export interface NotificationPayload {
  title: string;
  message: string;
  notificationType: string;
  relatedModule: NotificationModule;
  priority?: NotificationPriority;
  recordType?: string;
  recordId?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface SenderContext {
  userId: string;
  name: string;
  role: string;
  teamId?: string;
}

interface CreateInput extends NotificationPayload {
  recipientUserId: string;
  recipientRole?: string;
  teamId?: string;
  sender?: SenderContext;
}

function toObjectId(value?: string) {
  if (!value) return undefined;
  try {
    return new mongoose.Types.ObjectId(value);
  } catch {
    return undefined;
  }
}

function resolveActionUrl(recordType?: string, recordId?: string, fallback?: string): string | undefined {
  if (fallback) return fallback;
  if (!recordType || !recordId) return undefined;
  const map: Record<string, string> = {
    QuoteRequest: "/quotes",
    Load: "/loads",
    Customer: "/customers",
    Carrier: "/carriers",
    User: "/users",
    Team: "/teams",
    Invoice: "/invoices",
    Commission: "/commissions",
    FollowUp: "/followups",
    Lead: "/leads",
    ApprovalRequest: "/approvals",
    DailyActivityLog: "/activity",
    OnboardingDocument: "/onboarding",
    TrainingModule: "/onboarding",
  };
  const base = map[recordType];
  if (!base) return undefined;
  return `${base}?focus=${recordId}`;
}

/**
 * Create a single notification document. Failures are logged but never thrown.
 */
export async function createNotification(input: CreateInput): Promise<void> {
  try {
    const actionUrl =
      input.actionUrl ?? resolveActionUrl(input.recordType, input.recordId);
    await Notification.create({
      recipientUserId: new mongoose.Types.ObjectId(input.recipientUserId),
      senderUserId: input.sender ? new mongoose.Types.ObjectId(input.sender.userId) : undefined,
      senderName: input.sender?.name,
      recipientRole: input.recipientRole,
      teamId: toObjectId(input.teamId ?? input.sender?.teamId),
      title: input.title,
      message: input.message,
      notificationType: input.notificationType,
      relatedModule: input.relatedModule,
      recordType: input.recordType,
      recordId: toObjectId(input.recordId),
      priority: input.priority ?? "medium",
      isRead: false,
      actionUrl,
      metadata: input.metadata ?? {},
    });
  } catch (error) {
    console.error("[notification] createNotification failed:", error);
  }
}

/**
 * Create many notifications atomically (single insertMany). Failures are logged
 * but never thrown.
 */
export async function createNotifications(inputs: CreateInput[]): Promise<void> {
  if (!inputs.length) return;
  try {
    const docs = inputs.map((input) => ({
      recipientUserId: new mongoose.Types.ObjectId(input.recipientUserId),
      senderUserId: input.sender ? new mongoose.Types.ObjectId(input.sender.userId) : undefined,
      senderName: input.sender?.name,
      recipientRole: input.recipientRole,
      teamId: toObjectId(input.teamId ?? input.sender?.teamId),
      title: input.title,
      message: input.message,
      notificationType: input.notificationType,
      relatedModule: input.relatedModule,
      recordType: input.recordType,
      recordId: toObjectId(input.recordId),
      priority: input.priority ?? "medium",
      isRead: false,
      actionUrl: input.actionUrl ?? resolveActionUrl(input.recordType, input.recordId),
      metadata: input.metadata ?? {},
    }));
    await Notification.insertMany(docs, { ordered: false });
  } catch (error) {
    console.error("[notification] createNotifications failed:", error);
  }
}

// ---------------------------------------------------------------------------
// Recipient resolution helpers
// ---------------------------------------------------------------------------

async function getUsersByRoles(roles: string[]): Promise<Array<{ _id: mongoose.Types.ObjectId; name: string; role: string; status: string }>> {
  return User.find({ role: { $in: roles }, status: "active" })
    .select("_id name role status")
    .lean()
    .exec() as Promise<Array<{ _id: mongoose.Types.ObjectId; name: string; role: string; status: string }>>;
}

async function getAdmins(): Promise<Array<{ _id: mongoose.Types.ObjectId; name: string; role: string }>> {
  return getUsersByRoles(["owner", "admin"]) as Promise<Array<{ _id: mongoose.Types.ObjectId; name: string; role: string }>>;
}

async function getOpsManagers(): Promise<Array<{ _id: mongoose.Types.ObjectId; name: string; role: string }>> {
  return getUsersByRoles(["ops_manager"]) as Promise<Array<{ _id: mongoose.Types.ObjectId; name: string; role: string }>>;
}

async function getAccountingUsers(): Promise<Array<{ _id: mongoose.Types.ObjectId; name: string; role: string }>> {
  return getUsersByRoles(["accounting"]) as Promise<Array<{ _id: mongoose.Types.ObjectId; name: string; role: string }>>;
}

async function getTeamManager(teamId: string): Promise<{ _id: mongoose.Types.ObjectId; name: string } | null> {
  const team = (await Team.findById(teamId).select("managerId").lean().exec()) as
    | { _id: mongoose.Types.ObjectId; managerId?: mongoose.Types.ObjectId }
    | null;
  if (!team?.managerId) return null;
  const manager = (await User.findById(team.managerId).select("_id name status").lean().exec()) as
    | { _id: mongoose.Types.ObjectId; name?: string; status?: string }
    | null;
  if (!manager || manager.status !== "active") return null;
  return { _id: manager._id, name: manager.name ?? "" };
}

async function getLeadAgentsInTeam(teamId: string): Promise<Array<{ _id: mongoose.Types.ObjectId; name: string }>> {
  const users = (await User.find({ teamId: new mongoose.Types.ObjectId(teamId), role: "leadagent", status: "active" })
    .select("_id name")
    .lean()
    .exec()) as Array<{ _id: mongoose.Types.ObjectId; name?: string }>;
  return users.map((u) => ({ _id: u._id, name: u.name ?? "" }));
}

async function getTeamMembers(teamId: string): Promise<Array<{ _id: mongoose.Types.ObjectId; name: string; role: string }>> {
  const team = (await Team.findById(teamId).select("memberIds").lean().exec()) as
    | { _id: mongoose.Types.ObjectId; memberIds?: mongoose.Types.ObjectId[] }
    | null;
  if (!team?.memberIds?.length) return [];
  const users = (await User.find({ _id: { $in: team.memberIds }, status: "active" })
    .select("_id name role")
    .lean()
    .exec()) as Array<{ _id: mongoose.Types.ObjectId; name?: string; role?: string }>;
  return users.map((u) => ({ _id: u._id, name: u.name ?? "", role: u.role ?? "" }));
}

// ---------------------------------------------------------------------------
// Public recipient-scoped emitters
// ---------------------------------------------------------------------------

/**
 * Notify a single user. The most common helper.
 */
export async function notifyUser(
  userId: string,
  payload: NotificationPayload,
  sender?: SenderContext,
  options?: { teamId?: string; recipientRole?: string },
): Promise<void> {
  await createNotification({
    ...payload,
    recipientUserId: userId,
    recipientRole: options?.recipientRole,
    teamId: options?.teamId,
    sender,
  });
}

/**
 * Notify all owner/admin users. Used for org-wide important events.
 */
export async function notifyAdmins(payload: NotificationPayload, sender?: SenderContext): Promise<void> {
  const admins = await getAdmins();
  await createNotifications(
    admins.map((a) => ({
      ...payload,
      recipientUserId: a._id.toString(),
      recipientRole: a.role,
      sender,
    })),
  );
}

/**
 * Notify all operations managers. Used for operational events.
 */
export async function notifyOpsManagers(payload: NotificationPayload, sender?: SenderContext): Promise<void> {
  const ops = await getOpsManagers();
  await createNotifications(
    ops.map((o) => ({
      ...payload,
      recipientUserId: o._id.toString(),
      recipientRole: o.role,
      sender,
    })),
  );
}

/**
 * Notify all accounting users. Used for invoice/commission events.
 */
export async function notifyAccounting(payload: NotificationPayload, sender?: SenderContext): Promise<void> {
  const acct = await getAccountingUsers();
  await createNotifications(
    acct.map((a) => ({
      ...payload,
      recipientUserId: a._id.toString(),
      recipientRole: a.role,
      sender,
    })),
  );
}

/**
 * Notify the manager of a specific team.
 */
export async function notifyTeamManager(
  teamId: string,
  payload: NotificationPayload,
  sender?: SenderContext,
): Promise<void> {
  const manager = await getTeamManager(teamId);
  if (!manager) return;
  await createNotification({
    ...payload,
    recipientUserId: manager._id.toString(),
    recipientRole: "team_manager",
    teamId,
    sender,
  });
}

/**
 * Notify lead agents of a specific team.
 */
export async function notifyLeadAgents(
  teamId: string,
  payload: NotificationPayload,
  sender?: SenderContext,
): Promise<void> {
  const leads = await getLeadAgentsInTeam(teamId);
  await createNotifications(
    leads.map((l) => ({
      ...payload,
      recipientUserId: l._id.toString(),
      recipientRole: "leadagent",
      teamId,
      sender,
    })),
  );
}

/**
 * Notify all active members of a specific team.
 */
export async function notifyTeamMembers(
  teamId: string,
  payload: NotificationPayload,
  sender?: SenderContext,
  excludeUserId?: string,
): Promise<void> {
  const members = await getTeamMembers(teamId);
  const filtered = excludeUserId
    ? members.filter((m) => m._id.toString() !== excludeUserId)
    : members;
  await createNotifications(
    filtered.map((m) => ({
      ...payload,
      recipientUserId: m._id.toString(),
      recipientRole: m.role,
      teamId,
      sender,
    })),
  );
}

/**
 * Notify all approvers for a given team context. Approvers are:
 *  - team_manager of the team
 *  - leadagent users in the team
 *  - ops_manager (org-wide — they can approve anything)
 *  - owner/admin (org-wide — they can approve anything)
 *
 * excludeUserId prevents self-notification (e.g. an admin submitting a quote
 * should not be notified about their own submission).
 */
export async function notifyApprovers(
  payload: NotificationPayload,
  options: { teamId?: string; excludeUserId?: string; sender?: SenderContext },
): Promise<void> {
  const { teamId, excludeUserId, sender } = options;
  const recipients = new Map<string, { role: string; teamId?: string }>();

  // Org-wide approvers
  const [admins, ops] = await Promise.all([getAdmins(), getOpsManagers()]);
  for (const a of admins) {
    recipients.set(a._id.toString(), { role: a.role });
  }
  for (const o of ops) {
    recipients.set(o._id.toString(), { role: o.role });
  }

  // Team-scoped approvers
  if (teamId) {
    const manager = await getTeamManager(teamId);
    if (manager) recipients.set(manager._id.toString(), { role: "team_manager", teamId });
    const leads = await getLeadAgentsInTeam(teamId);
    for (const l of leads) {
      recipients.set(l._id.toString(), { role: "leadagent", teamId });
    }
  }

  if (excludeUserId) recipients.delete(excludeUserId);

  await createNotifications(
    Array.from(recipients.entries()).map(([userId, ctx]) => ({
      ...payload,
      recipientUserId: userId,
      recipientRole: ctx.role,
      teamId: ctx.teamId,
      sender,
    })),
  );
}

/**
 * Emit a system alert to all owner/admin users. Used for infra events
 * (db backup, server restart, permission changes, etc.).
 */
export async function emitSystemAlert(
  payload: { title: string; message: string; priority?: NotificationPriority; metadata?: Record<string, unknown> },
  sender?: SenderContext,
): Promise<void> {
  await notifyAdmins(
    {
      title: payload.title,
      message: payload.message,
      notificationType: "system_alert",
      relatedModule: "system",
      priority: payload.priority ?? "high",
      metadata: payload.metadata,
    },
    sender,
  );
}

/**
 * Cleanup old notifications. Deletes:
 *  1. All read notifications older than 24 hours
 *  2. All unread notifications older than 2 weeks
 * 
 * Returns the count of deleted documents.
 * 
 * This can be called:
 *  - On-demand via an API endpoint
 *  - Periodically via a cron job or scheduled task
 *  - During off-peak hours to maintain database performance
 */
export async function cleanupOldNotifications(): Promise<{ deletedCount: number; details: { readNotifications: number; unreadNotifications: number } }> {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    // Delete read notifications older than 24 hours
    const readResult = await Notification.deleteMany({
      isRead: true,
      readAt: { $lt: twentyFourHoursAgo },
    }).exec();

    // Delete unread notifications older than 2 weeks
    const unreadResult = await Notification.deleteMany({
      isRead: false,
      createdAt: { $lt: twoWeeksAgo },
    }).exec();

    const totalDeleted = readResult.deletedCount + unreadResult.deletedCount;
    console.log(
      `[notification] Cleanup complete: deleted ${readResult.deletedCount} old read notifications and ${unreadResult.deletedCount} old unread notifications (total: ${totalDeleted})`
    );

    return {
      deletedCount: totalDeleted,
      details: {
        readNotifications: readResult.deletedCount,
        unreadNotifications: unreadResult.deletedCount,
      },
    };
  } catch (error) {
    console.error("[notification] cleanupOldNotifications failed:", error);
    return { deletedCount: 0, details: { readNotifications: 0, unreadNotifications: 0 } };
  }
}

/**
 * Legacy alias for backward compatibility. Use cleanupOldNotifications instead.
 * @deprecated Use cleanupOldNotifications instead
 */
export async function cleanupOldReadNotifications(): Promise<{ deletedCount: number }> {
  const result = await cleanupOldNotifications();
  return { deletedCount: result.deletedCount };
}

/**
 * Cleanup old session/login logs. Deletes all login history records
 * older than 2 months to keep the database lean.
 * 
 * Returns the count of deleted documents.
 */
export async function cleanupOldSessionLogs(): Promise<{ deletedCount: number }> {
  try {
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    const result = await LoginHistory.deleteMany({
      createdAt: { $lt: twoMonthsAgo },
    }).exec();

    console.log(`[session-log] Cleanup complete: deleted ${result.deletedCount} old session logs`);
    return { deletedCount: result.deletedCount };
  } catch (error) {
    console.error("[session-log] cleanupOldSessionLogs failed:", error);
    return { deletedCount: 0 };
  }
}

export { resolveActionUrl };
