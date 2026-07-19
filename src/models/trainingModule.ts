import mongoose from "mongoose";

export interface TrainingCompletion {
  userId: mongoose.Types.ObjectId;
  completedAt: Date;
}

export interface TrainingModuleDocument extends mongoose.Document {
  title: string;
  description?: string;
  contentUrl: string;
  order: number;
  completions: TrainingCompletion[];
  createdAt: Date;
  updatedAt: Date;
}

const completionSchema = new mongoose.Schema<TrainingCompletion>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    completedAt: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false },
);

const trainingModuleSchema = new mongoose.Schema<TrainingModuleDocument>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: false, trim: true },
    contentUrl: { type: String, required: true, trim: true },
    order: { type: Number, required: true, default: 0 },
    completions: { type: [completionSchema], default: [] },
  },
  { timestamps: true },
);

export const TrainingModule =
  mongoose.models.TrainingModule ??
  mongoose.model<TrainingModuleDocument>("TrainingModule", trainingModuleSchema);
