import mongoose from "mongoose";

export interface DailyActivitySession {
  checkedInAt?: string;
  checkedOutAt?: string;
  clockStatus: "checked_in" | "checked_out";
  endReason?: string;
  calls?: number;
  followups?: number;
  notes?: string;
}

export interface DailyActivityLogDocument extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  date: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  calls: number;
  followups: number;
  notes: string;
  clockStatus: "checked_in" | "checked_out";
  endReason?: string;
  sessions: DailyActivitySession[];
  createdAt: Date;
  updatedAt: Date;
}

const dailyActivityLogSchema = new mongoose.Schema<DailyActivityLogDocument>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: String, required: true, trim: true, index: true },
    checkedInAt: { type: String, required: false, trim: true },
    checkedOutAt: { type: String, required: false, trim: true },
    calls: { type: Number, default: 0, min: 0 },
    followups: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: "" },
    clockStatus: { type: String, enum: ["checked_in", "checked_out"], default: "checked_out" },
    endReason: { type: String, required: false, trim: true },
    sessions: {
      type: [
        {
          checkedInAt: { type: String, trim: true },
          checkedOutAt: { type: String, trim: true },
          clockStatus: { type: String, enum: ["checked_in", "checked_out"], default: "checked_in" },
          endReason: { type: String, trim: true },
          calls: { type: Number, default: 0, min: 0 },
          followups: { type: Number, default: 0, min: 0 },
          notes: { type: String, default: "" },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

dailyActivityLogSchema.index({ userId: 1, date: 1 }, { unique: true });

export const DailyActivityLog =
  mongoose.models.DailyActivityLog ??
  mongoose.model<DailyActivityLogDocument>("DailyActivityLog", dailyActivityLogSchema);
