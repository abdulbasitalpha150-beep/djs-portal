import mongoose from "mongoose";

export const NOTIFICATION_MODULES = [
  "team_management",
  "approvals",
  "leads",
  "customers",
  "quotes",
  "loads",
  "carriers",
  "commissions",
  "invoices",
  "daily_activity",
  "followups",
  "user_management",
  "training",
  "kpi",
  "system",
  "auth",
] as const;
export type NotificationModule = (typeof NOTIFICATION_MODULES)[number];

export const NOTIFICATION_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];

/**
 * Canonical notification type identifiers. Kept as a const array for runtime
 * validation and as a union type for compile-time safety. New types can be
 * added freely — these are not enforced at the DB level (only indexed as
 * strings) but documented here for consistency.
 */
export const NOTIFICATION_TYPES = [
  // User management
  "user_created",
  "user_updated",
  "user_deleted",
  "user_suspended",
  "user_reactivated",
  "user_locked",
  "user_unlocked",
  "user_promoted",
  "user_demoted",
  "role_changed",
  "team_assigned",
  "account_created",
  "account_activated",
  "welcome",
  // Team management
  "team_created",
  "team_updated",
  "team_deleted",
  "team_manager_assigned",
  "team_assignment_changed",
  "team_member_added",
  "team_member_removed",
  // Approvals
  "approval_requested",
  "approval_granted",
  "approval_rejected",
  "changes_requested",
  "manager_comment",
  // Quotes
  "quote_submitted",
  "quote_approved",
  "quote_rejected",
  "quote_created_for_you",
  "quote_expiring",
  // Loads
  "load_submitted",
  "load_assigned",
  "load_unassigned",
  "load_status_updated",
  "load_completed",
  "load_pickup_today",
  "load_delivery_today",
  // Customers
  "customer_submitted",
  "customer_approved",
  "customer_rejected",
  "customer_created_for_you",
  // Carriers
  "carrier_submitted",
  "carrier_approved",
  "carrier_rejected",
  // Invoices
  "invoice_created",
  "invoice_paid",
  "invoice_overdue",
  "invoice_available",
  "invoice_deleted",
  // Commissions
  "commission_generated",
  "commission_created",
  "commission_processing",
  "commission_paid",
  "commission_pending",
  // Follow-ups
  "followup_assigned",
  "followup_completed",
  "followup_due",
  "followup_overdue",
  // Activity
  "activity_anomaly",
  // Onboarding / Training
  "document_submitted",
  "document_approved",
  "document_rejected",
  "training_reminder",
  "training_completed",
  "training_unlocked",
  "training_overdue",
  // KPI
  "kpi_summary",
  "kpi_alert",
  // System
  "system_alert",
  "security_alert",
  // Auth
  "failed_login",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationDocument extends mongoose.Document {
  recipientUserId: mongoose.Types.ObjectId;
  senderUserId?: mongoose.Types.ObjectId;
  senderName?: string;
  recipientRole?: string;
  teamId?: mongoose.Types.ObjectId;
  title: string;
  message: string;
  notificationType: string;
  relatedModule: NotificationModule;
  recordType?: string;
  recordId?: mongoose.Types.ObjectId;
  priority: NotificationPriority;
  isRead: boolean;
  readAt?: Date;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new mongoose.Schema<NotificationDocument>(
  {
    recipientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    senderUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    senderName: { type: String, required: false, trim: true },
    recipientRole: { type: String, required: false, trim: true },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: false, index: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    notificationType: { type: String, required: true, index: true },
    relatedModule: {
      type: String,
      enum: NOTIFICATION_MODULES,
      required: true,
      default: "system",
    },
    recordType: { type: String, required: false, trim: true },
    recordId: { type: mongoose.Schema.Types.ObjectId, required: false, index: true },
    priority: {
      type: String,
      enum: NOTIFICATION_PRIORITIES,
      required: true,
      default: "medium",
    },
    isRead: { type: Boolean, required: true, default: false, index: true },
    readAt: { type: Date, required: false, index: true },
    actionUrl: { type: String, required: false, trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

// Compound indexes for fast recipient queries
notificationSchema.index({ recipientUserId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipientUserId: 1, createdAt: -1 });
notificationSchema.index({ recipientUserId: 1, notificationType: 1, createdAt: -1 });

export const Notification =
  mongoose.models.Notification ??
  mongoose.model<NotificationDocument>("Notification", notificationSchema);
