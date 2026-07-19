import mongoose from "mongoose";

export interface LoadStatusHistoryItem {
  status: string;
  changedBy: mongoose.Types.ObjectId;
  changedAt: Date;
}

export interface LoadDocument extends mongoose.Document {
  // Basic Info
  quoteRequestId: mongoose.Types.ObjectId;
  agentId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  carrierId: mongoose.Types.ObjectId;
  loadNumber: string;
  customerReference?: string;
  status:
    | "draft"
    | "quoted"
    | "booked"
    | "dispatched"
    | "in_transit"
    | "delivered"
    | "invoiced"
    | "paid"
    | "cancelled";
  statusHistory: LoadStatusHistoryItem[];

  // Pickup
  pickupCompany?: string;
  pickupContact?: string;
  pickupPhone?: string;
  pickupAddress?: string;
  pickupCity?: string;
  pickupState?: string;
  pickupZip?: string;
  pickupDate?: Date;
  pickupTime?: string;

  // Delivery
  deliveryCompany?: string;
  deliveryContact?: string;
  deliveryPhone?: string;
  deliveryAddress?: string;
  deliveryCity?: string;
  deliveryState?: string;
  deliveryZip?: string;
  deliveryDate?: Date;
  deliveryTime?: string;

  // Freight Details
  commodity?: string;
  weight?: number;
  pieces?: number;
  pallets?: number;
  equipmentType?: string;
  trailerLength?: number;
  loadType?: "ftl" | "ltl" | "partial";
  temperature?: number;
  hazmat?: boolean;
  stackable?: boolean;

  // Pricing
  customerRate: number;
  carrierCost: number;
  accessorialCharges?: number;
  revenue: number;
  grossMargin: number;
  marginPercent: number;
  invoiceStatus: "pending" | "sent" | "paid" | "overdue";
  paymentStatus: "pending" | "partial" | "paid";

  // Mileage
  loadedMiles?: number;
  deadheadMiles?: number;

  // Documents
  documents: Array<{ kind: string; uploaded: boolean; uploadedAt?: Date }>;

  // Notes
  internalNotes?: string;
  driverInstructions?: string;
  customerNotes?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const statusHistorySchema = new mongoose.Schema<LoadStatusHistoryItem>(
  {
    status: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    changedAt: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false },
);

const documentSchema = new mongoose.Schema(
  {
    kind: { type: String, required: true },
    uploaded: { type: Boolean, default: false },
    uploadedAt: { type: Date },
  },
  { _id: false },
);

const loadSchema = new mongoose.Schema<LoadDocument>(
  {
    // Basic Info
    quoteRequestId: { type: mongoose.Schema.Types.ObjectId, ref: "QuoteRequest", required: true },
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    carrierId: { type: mongoose.Schema.Types.ObjectId, ref: "Carrier", required: true },
    loadNumber: { type: String, required: true, trim: true },
    customerReference: { type: String, trim: true },
    status: {
      type: String,
      enum: [
        "draft",
        "quoted",
        "booked",
        "dispatched",
        "in_transit",
        "delivered",
        "invoiced",
        "paid",
        "cancelled",
      ],
      default: "draft",
    },
    statusHistory: { type: [statusHistorySchema], default: [] },

    // Pickup
    pickupCompany: { type: String, trim: true },
    pickupContact: { type: String, trim: true },
    pickupPhone: { type: String, trim: true },
    pickupAddress: { type: String, trim: true },
    pickupCity: { type: String, trim: true },
    pickupState: { type: String, trim: true },
    pickupZip: { type: String, trim: true },
    pickupDate: { type: Date },
    pickupTime: { type: String, trim: true },

    // Delivery
    deliveryCompany: { type: String, trim: true },
    deliveryContact: { type: String, trim: true },
    deliveryPhone: { type: String, trim: true },
    deliveryAddress: { type: String, trim: true },
    deliveryCity: { type: String, trim: true },
    deliveryState: { type: String, trim: true },
    deliveryZip: { type: String, trim: true },
    deliveryDate: { type: Date },
    deliveryTime: { type: String, trim: true },

    // Freight Details
    commodity: { type: String, trim: true },
    weight: { type: Number, min: 0 },
    pieces: { type: Number, min: 0 },
    pallets: { type: Number, min: 0 },
    equipmentType: { type: String, trim: true },
    trailerLength: { type: Number, min: 0 },
    loadType: { type: String, enum: ["ftl", "ltl", "partial"] },
    temperature: { type: Number },
    hazmat: { type: Boolean, default: false },
    stackable: { type: Boolean, default: false },

    // Pricing
    customerRate: { type: Number, required: true, min: 0, default: 0 },
    carrierCost: { type: Number, required: true, min: 0, default: 0 },
    accessorialCharges: { type: Number, min: 0, default: 0 },
    revenue: { type: Number, required: true, min: 0, default: 0 },
    grossMargin: { type: Number, required: true, min: 0, default: 0 },
    marginPercent: { type: Number, required: true, min: 0, default: 0 },
    invoiceStatus: {
      type: String,
      enum: ["pending", "sent", "paid", "overdue"],
      default: "pending",
    },
    paymentStatus: { type: String, enum: ["pending", "partial", "paid"], default: "pending" },

    // Mileage
    loadedMiles: { type: Number, min: 0 },
    deadheadMiles: { type: Number, min: 0 },

    // Documents
    documents: {
      type: [documentSchema],
      default: [
        { kind: "rate_confirmation", uploaded: false },
        { kind: "bol", uploaded: false },
        { kind: "pod", uploaded: false },
        { kind: "carrier_invoice", uploaded: false },
        { kind: "customer_invoice", uploaded: false },
      ],
    },

    // Notes
    internalNotes: { type: String, trim: true },
    driverInstructions: { type: String, trim: true },
    customerNotes: { type: String, trim: true },
  },
  { timestamps: true },
);

export const Load = mongoose.models.Load ?? mongoose.model<LoadDocument>("Load", loadSchema);
