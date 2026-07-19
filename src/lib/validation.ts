import { z } from "zod";
import { LEAD_STATUSES } from "../models/lead";

export const authLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const leadCreateSchema = z.object({
  companyName: z.string().min(1),
  contactName: z.string().min(1),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  location: z.string().optional(),
  laneOrNeed: z.string().optional(),
  status: z.enum(LEAD_STATUSES as unknown as [string, ...string[]]).optional(),
  creditStatus: z.string().optional(),
});

export const quoteApproveSchema = z.object({
  reviewNotes: z.string().min(1),
});

export const quoteRejectSchema = z.object({
  reviewNotes: z.string().min(1),
});

export const quoteRequestChangesSchema = z.object({
  reviewNotes: z.string().min(1),
});
