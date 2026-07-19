import mongoose from "mongoose";

export interface FollowUpDocument extends mongoose.Document {
  leadId: mongoose.Types.ObjectId;
  customerId?: mongoose.Types.ObjectId;
  assignedTo: mongoose.Types.ObjectId;
  dueDate: Date;
  priority: "low" | "medium" | "high";
  title: string;
  notes?: string;
  isCompleted: boolean;
  completedAt?: Date;
  completedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const followUpSchema = new mongoose.Schema<FollowUpDocument>(
  {
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: false },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    dueDate: { type: Date, required: true, index: true },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    title: { type: String, required: true, trim: true },
    notes: { type: String, required: false, trim: true },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date, required: false },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
  },
  { timestamps: true },
);

followUpSchema.index({ assignedTo: 1, isCompleted: 1, dueDate: 1 });

export const FollowUp =
  mongoose.models.FollowUp ?? mongoose.model<FollowUpDocument>("FollowUp", followUpSchema);
