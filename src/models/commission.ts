import mongoose from "mongoose";

export interface CommissionDocument extends mongoose.Document {
  agentId: mongoose.Types.ObjectId;
  loadId: mongoose.Types.ObjectId;
  grossMarginAmount: number;
  commissionTier: string;
  commissionPercent: number;
  commissionAmount: number;
  payoutStatus: "pending" | "processing" | "paid";
  payoutDate?: Date;
  month: number;
  year: number;
  createdAt: Date;
  updatedAt: Date;
}

const commissionSchema = new mongoose.Schema<CommissionDocument>(
  {
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    loadId: { type: mongoose.Schema.Types.ObjectId, ref: "Load", required: true },
    grossMarginAmount: { type: Number, required: true, min: 0 },
    commissionTier: { type: String, required: true },
    commissionPercent: { type: Number, required: true, min: 0 },
    commissionAmount: { type: Number, required: true, min: 0 },
    payoutStatus: {
      type: String,
      enum: ["pending", "processing", "paid"],
      default: "pending",
    },
    payoutDate: { type: Date, required: false },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 2000 },
  },
  { timestamps: true },
);

export const Commission =
  mongoose.models.Commission ?? mongoose.model<CommissionDocument>("Commission", commissionSchema);
