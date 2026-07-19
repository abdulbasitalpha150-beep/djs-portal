import mongoose from "mongoose";

export interface ExportLogDocument extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  exportType: "leads" | "customers" | "quotes" | "loads" | "commissions" | "invoices";
  filters?: Record<string, unknown>;
  recordCount: number;
  exportedAt: Date;
}

const exportLogSchema = new mongoose.Schema<ExportLogDocument>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    exportType: {
      type: String,
      enum: ["leads", "customers", "quotes", "loads", "commissions", "invoices"],
      required: true,
    },
    filters: { type: mongoose.Schema.Types.Mixed, required: false },
    recordCount: { type: Number, required: true, min: 0 },
    exportedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const ExportLog =
  mongoose.models.ExportLog ?? mongoose.model<ExportLogDocument>("ExportLog", exportLogSchema);
