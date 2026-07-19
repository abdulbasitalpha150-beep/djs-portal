import mongoose from "mongoose";

export interface Payment {
  _id?: string;
  paymentDate: Date;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
  notes?: string;
}

export interface InvoiceDocument extends mongoose.Document {
  invoiceNumber: string;
  customerId: mongoose.Types.ObjectId;
  loadIds?: mongoose.Types.ObjectId[];
  // Billing snapshot
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerBillingContact?: string;
  // Items
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  // Financials
  subtotal: number;
  discount?: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  // Status
  status: "draft" | "sent" | "partially_paid" | "paid" | "overdue" | "cancelled";
  // Dates
  invoiceDate: Date;
  dueDate: Date;
  paidAt?: Date;
  // Other
  paymentTerms?: string;
  referenceNumber?: string;
  currency?: string;
  notes?: string;
  internalNotes?: string;
  // Payments
  payments: Payment[];
  // Meta
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new mongoose.Schema(
  {
    paymentDate: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, required: true },
    referenceNumber: { type: String },
    notes: { type: String },
  },
  { _id: true, timestamps: true },
);

const invoiceSchema = new mongoose.Schema<InvoiceDocument>(
  {
    invoiceNumber: { type: String, required: true, unique: true, trim: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    loadIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Load" }],
    // Billing snapshot
    customerName: { type: String, required: true, trim: true },
    customerEmail: { type: String, trim: true },
    customerPhone: { type: String, trim: true },
    customerAddress: { type: String, trim: true },
    customerBillingContact: { type: String, trim: true },
    // Items
    items: [
      {
        description: { type: String, required: true, trim: true },
        quantity: { type: Number, required: true, default: 1, min: 1 },
        unitPrice: { type: Number, required: true, default: 0, min: 0 },
      },
    ],
    // Financials
    subtotal: { type: Number, required: true, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, required: true, default: 0, min: 0, max: 100 },
    taxAmount: { type: Number, required: true, default: 0, min: 0 },
    total: { type: Number, required: true, default: 0, min: 0 },
    amountPaid: { type: Number, required: true, default: 0, min: 0 },
    balanceDue: { type: Number, required: true, default: 0, min: 0 },
    // Status
    status: {
      type: String,
      enum: ["draft", "sent", "partially_paid", "paid", "overdue", "cancelled"],
      default: "draft",
    },
    // Dates
    invoiceDate: { type: Date, required: true, default: Date.now },
    dueDate: { type: Date, required: true },
    paidAt: { type: Date },
    // Other
    paymentTerms: { type: String, trim: true },
    referenceNumber: { type: String, trim: true },
    currency: { type: String, default: "USD", trim: true },
    notes: { type: String, trim: true },
    internalNotes: { type: String, trim: true },
    // Payments
    payments: [paymentSchema],
    // Meta
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

export const Invoice =
  mongoose.models.Invoice ?? mongoose.model<InvoiceDocument>("Invoice", invoiceSchema);
