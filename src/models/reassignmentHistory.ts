import mongoose from "mongoose";

export interface ReassignmentHistoryDocument extends mongoose.Document {
  leadId: mongoose.Types.ObjectId;
  customerId?: mongoose.Types.ObjectId;
  fromUserId: mongoose.Types.ObjectId;
  toUserId: mongoose.Types.ObjectId;
  reassignedBy: mongoose.Types.ObjectId;
  reason?: string;
  createdAt: Date;
}

const reassignmentHistorySchema = new mongoose.Schema<ReassignmentHistoryDocument>(
  {
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: false },
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reassignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, required: false, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

reassignmentHistorySchema.index({ leadId: 1 });
reassignmentHistorySchema.index({ customerId: 1 });
reassignmentHistorySchema.index({ fromUserId: 1 });
reassignmentHistorySchema.index({ toUserId: 1 });

export const ReassignmentHistory =
  mongoose.models.ReassignmentHistory ??
  mongoose.model<ReassignmentHistoryDocument>("ReassignmentHistory", reassignmentHistorySchema);
