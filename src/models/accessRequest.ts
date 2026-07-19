import mongoose from "mongoose";

export interface AccessRequestDocument extends mongoose.Document {
  requestedEmail: string;
  requestedName?: string;
  requestedRole: string;
  status: "pending" | "accepted" | "declined";
  reviewedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const accessRequestSchema = new mongoose.Schema<AccessRequestDocument>(
  {
    requestedEmail: { type: String, required: true, trim: true, lowercase: true },
    requestedName: { type: String, required: false, trim: true },
    requestedRole: {
      type: String,
      enum: ["admin", "ops_manager", "team_manager", "leadagent", "agent", "trainee", "accounting"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined"],
      default: "pending",
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const AccessRequest =
  mongoose.models.AccessRequest ??
  mongoose.model<AccessRequestDocument>("AccessRequest", accessRequestSchema);
