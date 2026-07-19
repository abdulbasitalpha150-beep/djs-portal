import mongoose from "mongoose";

export interface QuoteRequestDocument extends mongoose.Document {
  agentId: mongoose.Types.ObjectId;
  customerId?: mongoose.Types.ObjectId;
  shipperLeadId?: mongoose.Types.ObjectId;
  lane: {
    origin: string;
    destination: string;
  };
  equipmentType: string;
  commodity: string;
  customerRate: number;
  carrierCost: number;
  marginAmount: number;
  marginPercent: number;
  notes?: string;
  status: "pending_approval" | "approved" | "rejected" | "changes_requested" | "won" | "lost";
  expiryDate?: Date;
  winLossReason?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewNotes?: string;
  createdAt: Date;
  reviewedAt?: Date;
}

const quoteRequestSchema = new mongoose.Schema<QuoteRequestDocument>(
  {
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: false },
    shipperLeadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: false },
    lane: {
      origin: { type: String, required: true, trim: true },
      destination: { type: String, required: true, trim: true },
    },
    equipmentType: { type: String, required: true, trim: true },
    commodity: { type: String, required: true, trim: true },
    customerRate: { type: Number, required: true, min: 0 },
    carrierCost: { type: Number, required: true, min: 0 },
    marginAmount: { type: Number, required: true, min: 0 },
    marginPercent: { type: Number, required: true, min: 0 },
    notes: { type: String, required: false, trim: true },
    status: {
      type: String,
      enum: ["pending_approval", "approved", "rejected", "changes_requested", "won", "lost"],
      default: "pending_approval",
    },
    expiryDate: { type: Date, required: false },
    winLossReason: { type: String, required: false, trim: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
    reviewNotes: { type: String, required: false, trim: true },
    reviewedAt: { type: Date, required: false },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
);

quoteRequestSchema.pre("validate", function (next) {
  this.marginAmount = Math.max(0, this.customerRate - this.carrierCost);
  this.marginPercent =
    this.customerRate > 0 ? Number(((this.marginAmount / this.customerRate) * 100).toFixed(2)) : 0;
  next();
});

export const QuoteRequest =
  mongoose.models.QuoteRequest ??
  mongoose.model<QuoteRequestDocument>("QuoteRequest", quoteRequestSchema);
