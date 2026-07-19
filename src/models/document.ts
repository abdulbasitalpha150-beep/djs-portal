import mongoose from "mongoose";

export interface DocumentDocument extends mongoose.Document {
  ownerId?: mongoose.Types.ObjectId;
  loadId?: mongoose.Types.ObjectId;
  category:
    "rate_confirmation" | "bol" | "pod" | "invoice" | "tax_form" | "training" | "onboarding";
  fileName: string;
  fileUrl: string;
  fileType: string;
  uploadedBy: mongoose.Types.ObjectId;
  visibility: "personal" | "company_wide";
  createdAt: Date;
}

const documentSchema = new mongoose.Schema<DocumentDocument>(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
    loadId: { type: mongoose.Schema.Types.ObjectId, ref: "Load", required: false },
    category: {
      type: String,
      enum: ["rate_confirmation", "bol", "pod", "invoice", "tax_form", "training", "onboarding"],
      required: true,
    },
    fileName: { type: String, required: true, trim: true },
    fileUrl: { type: String, required: true, trim: true },
    fileType: { type: String, required: true, trim: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    visibility: {
      type: String,
      enum: ["personal", "company_wide"],
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const Document =
  mongoose.models.Document ?? mongoose.model<DocumentDocument>("Document", documentSchema);
