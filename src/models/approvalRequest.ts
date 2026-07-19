import mongoose from "mongoose";

export const APPROVAL_MODULES = [
  "leads",
  "followups",
  "customers",
  "quotes",
  "carriers",
  "loads",
] as const;
export type ApprovalModule = (typeof APPROVAL_MODULES)[number];

export const APPROVAL_ACTION_TYPES = ["create", "edit", "delete"] as const;
export type ApprovalActionType = (typeof APPROVAL_ACTION_TYPES)[number];

export const APPROVAL_STATUSES = ["pending", "approved", "rejected", "changes_requested"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export interface ApprovalAuditHistoryItem {
  action: string;
  performedBy: mongoose.Types.ObjectId;
  performedByName: string;
  at: Date;
  notes?: string;
}

export interface ApprovalComment {
  id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  userName: string;
  text: string;
  createdAt: Date;
}

export interface ApprovalRequestDocument extends mongoose.Document {
  module: ApprovalModule;
  recordId?: mongoose.Types.ObjectId;
  actionType: ApprovalActionType;
  requestedBy: mongoose.Types.ObjectId;
  requestedByName: string;
  teamId?: mongoose.Types.ObjectId;
  previousValues?: Record<string, any>;
  newValues: Record<string, any>;
  status: ApprovalStatus;
  approvedBy?: mongoose.Types.ObjectId;
  approvedByName?: string;
  approvedAt?: Date;
  rejectedBy?: mongoose.Types.ObjectId;
  rejectedByName?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  comments: ApprovalComment[];
  auditHistory: ApprovalAuditHistoryItem[];
  createdAt: Date;
  updatedAt: Date;
}

const approvalAuditHistoryItemSchema = new mongoose.Schema<ApprovalAuditHistoryItem>(
  {
    action: { type: String, required: true, trim: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    performedByName: { type: String, required: true, trim: true },
    at: { type: Date, default: () => new Date(), required: true },
    notes: { type: String, required: false, trim: true },
  },
  { _id: false },
);

const approvalCommentSchema = new mongoose.Schema<ApprovalComment>(
  {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      required: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    userName: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: () => new Date(), required: true },
  },
  { _id: false },
);

const approvalRequestSchema = new mongoose.Schema<ApprovalRequestDocument>(
  {
    module: {
      type: String,
      enum: APPROVAL_MODULES,
      required: true,
    },
    recordId: { type: mongoose.Schema.Types.ObjectId, required: false },
    actionType: {
      type: String,
      enum: APPROVAL_ACTION_TYPES,
      required: true,
    },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    requestedByName: { type: String, required: true, trim: true },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: false },
    previousValues: { type: mongoose.Schema.Types.Mixed, required: false },
    newValues: { type: mongoose.Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: APPROVAL_STATUSES,
      default: "pending",
      required: true,
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
    approvedByName: { type: String, required: false, trim: true },
    approvedAt: { type: Date, required: false },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
    rejectedByName: { type: String, required: false, trim: true },
    rejectedAt: { type: Date, required: false },
    rejectionReason: { type: String, required: false, trim: true },
    comments: { type: [approvalCommentSchema], default: [] },
    auditHistory: { type: [approvalAuditHistoryItemSchema], default: [] },
  },
  { timestamps: true },
);

approvalRequestSchema.index({ requestedBy: 1, status: 1 });
approvalRequestSchema.index({ teamId: 1, status: 1 });
approvalRequestSchema.index({ module: 1, status: 1 });
approvalRequestSchema.index({ status: 1, createdAt: -1 });

export const ApprovalRequest =
  mongoose.models.ApprovalRequest ??
  mongoose.model<ApprovalRequestDocument>("ApprovalRequest", approvalRequestSchema);
