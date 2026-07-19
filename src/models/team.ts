import mongoose from "mongoose";

export interface TeamDocument extends mongoose.Document {
  name: string;
  managerId: mongoose.Types.ObjectId;
  memberIds: mongoose.Types.ObjectId[];
  createdAt: Date;
}

const teamSchema = new mongoose.Schema<TeamDocument>(
  {
    name: { type: String, required: true, trim: true },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    memberIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const Team = mongoose.models.Team ?? mongoose.model<TeamDocument>("Team", teamSchema);
