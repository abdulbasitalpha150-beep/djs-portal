import mongoose from "mongoose";

export interface LoginHistoryDocument extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  success: boolean;
  loginAt?: Date;
  logoutAt?: Date;
  ipAddress?: string;
  browser?: string;
  os?: string;
  device?: string;
  userAgent?: string;
  authMethod?: string;
  sessionDurationSeconds?: number;
  createdAt: Date;
}

const loginHistorySchema = new mongoose.Schema<LoginHistoryDocument>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    success: { type: Boolean, default: true },
    loginAt: { type: Date, required: false },
    logoutAt: { type: Date, required: false },
    ipAddress: { type: String, required: false, trim: true },
    browser: { type: String, required: false, trim: true },
    os: { type: String, required: false, trim: true },
    device: { type: String, required: false, trim: true },
    userAgent: { type: String, required: false, trim: true },
    authMethod: { type: String, required: false, trim: true, default: "password" },
    sessionDurationSeconds: { type: Number, required: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const LoginHistory =
  mongoose.models.LoginHistory ??
  mongoose.model<LoginHistoryDocument>("LoginHistory", loginHistorySchema);
