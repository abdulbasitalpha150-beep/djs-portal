import { AuditLog } from "../models/auditLog";
import mongoose from "mongoose";

export async function recordAudit({
  actorId,
  actionType,
  targetType,
  targetId,
  metadata = {},
}: {
  actorId: string;
  actionType: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  return AuditLog.create({
    actorId: new mongoose.Types.ObjectId(actorId),
    actionType,
    targetType,
    targetId: targetId ? new mongoose.Types.ObjectId(targetId) : undefined,
    metadata,
  });
}
