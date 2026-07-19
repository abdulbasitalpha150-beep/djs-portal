import mongoose from "mongoose";

export interface LeadNote {
  authorId: mongoose.Types.ObjectId;
  authorName: string;
  text: string;
  method?: string;
  outcome?: string;
  nextAction?: string;
  createdAt: Date;
}

export interface PipelineStageHistoryItem {
  stage: string;
  changedBy: mongoose.Types.ObjectId;
  changedAt: Date;
  notes?: string;
}

export const PIPELINE_STAGES = [
  "cold",
  "contacted",
  "warm",
  "quote_opp",
  "credit_pending",
  "approved",
  "won",
  "lost",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "prospect",
  "customer",
  "lost",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type LegacyLeadStatus = "warm" | "follow_up_due" | "customer_onboarding" | "not_a_fit";
export type LeadStatusValue = LeadStatus | LegacyLeadStatus;

export interface LeadDocument extends mongoose.Document {
  ownerId: mongoose.Types.ObjectId;
  companyName: string;
  website?: string;
  dmContactName?: string;
  dmContactPhone?: string;
  dmContactEmail?: string;
  dmContactTitle?: string;
  billingContactName?: string;
  billingContactPhone?: string;
  billingContactEmail?: string;
  contactName: string;
  contactPhone?: string;
  contactEmail?: string;
  locations?: string[];
  laneOrNeed?: string;
  status: LeadStatusValue;
  pipelineStage: PipelineStage;
  pipelineStageHistory: PipelineStageHistoryItem[];
  managerId?: mongoose.Types.ObjectId;
  notes: LeadNote[];
  creditStatus?: string;
  winLossReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const leadNoteSchema = new mongoose.Schema<LeadNote>(
  {
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true },
    method: { type: String, required: false, trim: true },
    outcome: { type: String, required: false, trim: true },
    nextAction: { type: String, required: false, trim: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const pipelineStageHistorySchema = new mongoose.Schema<PipelineStageHistoryItem>(
  {
    stage: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    changedAt: { type: Date, required: true, default: () => new Date() },
    notes: { type: String, required: false, trim: true },
  },
  { _id: false },
);

const leadSchema = new mongoose.Schema<LeadDocument>(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    companyName: { type: String, required: true, trim: true },
    website: { type: String, required: false, trim: true },
    dmContactName: { type: String, required: false, trim: true },
    dmContactPhone: { type: String, required: false, trim: true },
    dmContactEmail: { type: String, required: false, trim: true },
    dmContactTitle: { type: String, required: false, trim: true },
    billingContactName: { type: String, required: false, trim: true },
    billingContactPhone: { type: String, required: false, trim: true },
    billingContactEmail: { type: String, required: false, trim: true },
    contactName: { type: String, required: true, trim: true },
    contactPhone: { type: String, required: false, trim: true },
    contactEmail: { type: String, required: false, trim: true },
    locations: { type: [String], required: false },
    laneOrNeed: { type: String, required: false, trim: true },
    status: {
      type: String,
      enum: LEAD_STATUSES,
      default: "new",
    },
    pipelineStage: {
      type: String,
      enum: PIPELINE_STAGES,
      default: "cold",
    },
    pipelineStageHistory: { type: [pipelineStageHistorySchema], default: [] },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
    notes: { type: [leadNoteSchema], default: [] },
    creditStatus: { type: String, required: false, trim: true },
    winLossReason: { type: String, required: false, trim: true },
  },
  { timestamps: true },
);

leadSchema.index({ ownerId: 1 });
leadSchema.index({ companyName: 1 });
leadSchema.index({ pipelineStage: 1 });

export const Lead = mongoose.models.Lead ?? mongoose.model<LeadDocument>("Lead", leadSchema);
