import mongoose from "mongoose";

export interface AuditLogDocument extends mongoose.Document {
  actorId: mongoose.Types.ObjectId;
  actionType: string;
  targetType?: string;
  targetId?: mongoose.Types.ObjectId;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const auditLogSchema = new mongoose.Schema<AuditLogDocument>(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    actionType: { type: String, required: true, trim: true },
    targetType: { type: String, required: false, trim: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: false },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const AuditLog =
  mongoose.models.AuditLog ?? mongoose.model<AuditLogDocument>("AuditLog", auditLogSchema);
