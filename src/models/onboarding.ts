import mongoose from "mongoose";

export type OnboardingDocumentStatus =
  "missing" | "submitted" | "under_review" | "approved" | "rejected";

export interface OnboardingRequirementDocument extends mongoose.Document {
  key: string;
  label: string;
  description?: string;
  required: boolean;
  active: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const onboardingRequirementSchema = new mongoose.Schema<OnboardingRequirementDocument>(
  {
    key: { type: String, required: true, trim: true, unique: true },
    label: { type: String, required: true, trim: true },
    description: { type: String, required: false, trim: true },
    required: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const OnboardingRequirement =
  mongoose.models.OnboardingRequirement ??
  mongoose.model<OnboardingRequirementDocument>(
    "OnboardingRequirement",
    onboardingRequirementSchema,
  );

export interface OnboardingDocumentDocument extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  requirementKey: string;
  requirementLabel: string;
  fileName: string;
  originalFileName: string;
  mimeType: string;
  fileData: string;
  storagePath: string;
  uploadedBy: mongoose.Types.ObjectId;
  status: OnboardingDocumentStatus;
  reviewerId?: mongoose.Types.ObjectId;
  reviewerRole?: string;
  reviewedAt?: Date;
  comments?: string;
  rejectionReason?: string;
  version: number;
  deleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const onboardingDocumentSchema = new mongoose.Schema<OnboardingDocumentDocument>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    requirementKey: { type: String, required: true, trim: true },
    requirementLabel: { type: String, required: true, trim: true },
    fileName: { type: String, required: true, trim: true },
    originalFileName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    fileData: { type: String, required: true },
    storagePath: { type: String, required: true, default: "db:base64" },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["missing", "submitted", "under_review", "approved", "rejected"],
      default: "submitted",
    },
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
    reviewerRole: { type: String, required: false, trim: true },
    reviewedAt: { type: Date, required: false },
    comments: { type: String, required: false, trim: true },
    rejectionReason: { type: String, required: false, trim: true },
    version: { type: Number, default: 1 },
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date, required: false },
  },
  { timestamps: true },
);

export const OnboardingDocument =
  mongoose.models.OnboardingDocument ??
  mongoose.model<OnboardingDocumentDocument>("OnboardingDocument", onboardingDocumentSchema);

export interface OnboardingReviewDocument extends mongoose.Document {
  documentId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  actionType: "uploaded" | "approved" | "rejected" | "request_reupload" | "deleted";
  actorId: mongoose.Types.ObjectId;
  actorRole?: string;
  status?: OnboardingDocumentStatus;
  comments?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const onboardingReviewSchema = new mongoose.Schema<OnboardingReviewDocument>(
  {
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: "OnboardingDocument", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    actionType: { type: String, required: true, trim: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    actorRole: { type: String, required: false, trim: true },
    status: { type: String, required: false, trim: true },
    comments: { type: String, required: false, trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const OnboardingReview =
  mongoose.models.OnboardingReview ??
  mongoose.model<OnboardingReviewDocument>("OnboardingReview", onboardingReviewSchema);
