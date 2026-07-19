import mongoose from "mongoose";
import bcrypt from "bcryptjs";

export type UserRole =
  | "owner"
  | "admin"
  | "ops_manager"
  | "team_manager"
  | "leadagent"
  | "agent"
  | "trainee"
  | "accounting";

export type UserStatus =
  "active" | "inactive" | "suspended" | "locked" | "pending" | "pending_invitation" | "on_leave";

export type EmploymentType = "full-time" | "part-time" | "contractor" | "intern";

export interface UserDocument extends mongoose.Document {
  name: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  email: string;
  phone?: string;
  password: string;
  role: UserRole;
  teamId?: mongoose.Types.ObjectId;
  status: UserStatus;
  avatarUrl?: string;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  lastLoginAt?: Date;
  lastLogoutAt?: Date;
  lastIpAddress?: string;
  lastAuthAction?: "Login" | "Logout";
  createdBy?: mongoose.Types.ObjectId;
  commissionPercentage?: number;
  employmentType?: EmploymentType;
  isTemporaryPassword: boolean;
  passwordChangeCount: number;
  passwordChangeMonth: string;
  passwordLastChangedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new mongoose.Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true },
    firstName: { type: String, required: false, trim: true },
    lastName: { type: String, required: false, trim: true },
    username: { type: String, required: false, unique: true, trim: true, lowercase: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: false, trim: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: [
        "owner",
        "admin",
        "ops_manager",
        "team_manager",
        "leadagent",
        "agent",
        "trainee",
        "accounting",
      ],
      default: "agent",
    },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: false },
    status: {
      type: String,
      enum: [
        "active",
        "inactive",
        "suspended",
        "locked",
        "pending",
        "pending_invitation",
        "on_leave",
      ],
      default: "active",
    },
    avatarUrl: { type: String, required: false },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, required: false },
    lastLoginAt: { type: Date, required: false },
    lastLogoutAt: { type: Date, required: false },
    lastIpAddress: { type: String, required: false },
    lastAuthAction: {
      type: String,
      enum: ["Login", "Logout"],
      required: false,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
    commissionPercentage: { type: Number, min: 0, max: 100, required: false },
    employmentType: {
      type: String,
      enum: ["full-time", "part-time", "contractor", "intern"],
      required: false,
    },
    isTemporaryPassword: { type: Boolean, default: false },
    passwordChangeCount: { type: Number, default: 0 },
    passwordChangeMonth: {
      type: String,
      default: () => new Date().toISOString().substring(0, 7),
    },
    passwordLastChangedAt: { type: Date, required: false },
  },
  { timestamps: true },
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidate: string) {
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.models.User ?? mongoose.model<UserDocument>("User", userSchema);
