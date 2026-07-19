import mongoose from "mongoose";

export const CUSTOMER_STATUSES = ["submitted", "review", "approved", "rejected"] as const;
export const CUSTOMER_CREDIT_STATUSES = ["pending", "approved", "rejected"] as const;

export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];
export type CustomerCreditStatus = (typeof CUSTOMER_CREDIT_STATUSES)[number];

export interface CustomerDocument extends mongoose.Document {
  agentId: mongoose.Types.ObjectId;
  companyName: string;
  contactName: string;
  contactPhone?: string;
  contactEmail?: string;
  creditLimit: number;
  creditStatus: CustomerCreditStatus;
  status: CustomerStatus;
  notes?: string;
  shippingNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new mongoose.Schema<CustomerDocument>(
  {
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    companyName: { type: String, required: true, trim: true },
    contactName: { type: String, required: true, trim: true },
    contactPhone: { type: String, required: false, trim: true },
    contactEmail: { type: String, required: false, trim: true },
    creditLimit: { type: Number, required: false, default: 0, min: 0 },
    creditStatus: {
      type: String,
      enum: CUSTOMER_CREDIT_STATUSES,
      default: "pending",
    },
    status: {
      type: String,
      enum: CUSTOMER_STATUSES,
      default: "submitted",
    },
    notes: { type: String, required: false, trim: true },
    shippingNotes: { type: String, required: false, trim: true },
  },
  { timestamps: true },
);

export const Customer =
  mongoose.models.Customer ?? mongoose.model<CustomerDocument>("Customer", customerSchema);
