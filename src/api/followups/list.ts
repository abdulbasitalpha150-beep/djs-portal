// @ts-nocheck
import mongoose from "mongoose";
import { connectDb } from "../../lib/db";
import { getSessionUserFromRequest, requireAuth } from "../../lib/auth";
import { jsonResponse, parseJson } from "../../lib/api";
import { FollowUp } from "../../models/followUp";
import { Lead } from "../../models/lead";
import { User } from "../../models/user";
import {
  notifyUser,
  notifyAdmins,
  notifyTeamManager,
  type SenderContext,
} from "../../lib/notification";

async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function ensureObjectId(value: string, fieldName: string) {
  if (!mongoose.isValidObjectId(value)) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return new mongoose.Types.ObjectId(value);
}

function mapFollowUp(
  followUp: any,
  userMap: Record<string, string>,
  leadMap: Record<string, string>,
) {
  return {
    id: followUp._id.toString(),
    leadId: followUp.leadId.toString(),
    leadName: leadMap[followUp.leadId.toString()] ?? "Unknown lead",
    customerId: followUp.customerId?.toString(),
    assignedTo: followUp.assignedTo.toString(),
    assignedToName: userMap[followUp.assignedTo.toString()],
    title: followUp.title,
    notes: followUp.notes,
    priority: followUp.priority,
    dueDate: followUp.dueDate.toISOString(),
    isCompleted: followUp.isCompleted,
    completedAt: followUp.completedAt?.toISOString(),
    completedBy: followUp.completedBy?.toString(),
    completedByName: followUp.completedBy ? userMap[followUp.completedBy.toString()] : undefined,
  };
}

export async function followUpsListHandler(request: Request) {
  const user = requireAuth(await getSessionUserFromRequest(request));

  if (request.method === "POST") {
    const payload = await parseJson(request);
    const leadId = typeof payload.leadId === "string" ? payload.leadId.trim() : "";
    const customerId = typeof payload.customerId === "string" ? payload.customerId.trim() : "";
    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";
    const priority = typeof payload.priority === "string" ? payload.priority.trim() : "medium";
    const dueDate = typeof payload.dueDate === "string" ? payload.dueDate.trim() : "";

    if (!leadId || !title || !dueDate) {
      throw new Error("leadId, title, and dueDate are required");
    }

    await connectDb();
    const leadObjectId = ensureObjectId(leadId, "lead ID");
    const lead = await Lead.findById(leadObjectId).select("_id companyName ownerId").lean().exec();
    if (!lead) {
      throw new Error("Lead not found");
    }
    const created = await FollowUp.create({
      leadId: leadObjectId,
      customerId: customerId ? ensureObjectId(customerId, "customer ID") : undefined,
      assignedTo: new mongoose.Types.ObjectId(user.id),
      title,
      notes,
      priority: ["low", "medium", "high"].includes(priority) ? (priority as any) : "medium",
      dueDate: new Date(dueDate),
      isCompleted: false,
    });

    // Emit follow-up creation notifications
    const fuSender: SenderContext = { userId: user.id, name: user.name, role: user.role, teamId: user.teamId };
    const fuId = created._id.toString();
    const fuUrl = `/followups?focus=${fuId}`;
    // Notify team manager/lead agent if high priority
    if (priority === "high" && user.teamId) {
      void notifyTeamManager(user.teamId, { title: "High-priority follow-up assigned", message: `${user.name} created a high-priority follow-up: "${title}".`, notificationType: "followup_assigned", relatedModule: "followups", recordType: "FollowUp", recordId: fuId, actionUrl: fuUrl, priority: "high", metadata: { priority, leadName: lead.companyName } }, fuSender);
    }

    return jsonResponse({
      followUp: {
        id: created._id.toString(),
        leadId: created.leadId.toString(),
        leadName: lead.companyName,
        customerId: created.customerId?.toString(),
        assignedTo: created.assignedTo.toString(),
        assignedToName: user.name,
        title: created.title,
        notes: created.notes,
        priority: created.priority,
        dueDate: created.dueDate.toISOString(),
        isCompleted: created.isCompleted,
        completedAt: created.completedAt?.toISOString(),
        completedBy: created.completedBy?.toString(),
        completedByName: undefined,
      },
    });
  }

  if (request.method === "PATCH") {
    const payload = await parseJson(request);
    const followUpId = typeof payload.followUpId === "string" ? payload.followUpId.trim() : "";
    const isCompleted = typeof payload.isCompleted === "boolean" ? payload.isCompleted : undefined;

    if (!followUpId) {
      throw new Error("followUpId is required");
    }

    await connectDb();
    const followUpObjectId = ensureObjectId(followUpId, "follow-up ID");
    const followUp = await FollowUp.findById(followUpObjectId).exec();
    if (!followUp) {
      throw new Error("Follow-up not found");
    }

    if (
      followUp.assignedTo.toString() !== user.id &&
      user.role !== "admin" &&
      user.role !== "ops_manager" &&
      user.role !== "team_manager"
    ) {
      throw new Error("Not authorized to edit this follow-up");
    }

    if (isCompleted !== undefined) {
      followUp.isCompleted = isCompleted;
      if (isCompleted) {
        followUp.completedAt = new Date();
        followUp.completedBy = new mongoose.Types.ObjectId(user.id);
      }
    }

    const updated = await followUp.save();

    // Emit follow-up completion notification
    if (isCompleted && followUp.assignedTo.toString() !== user.id) {
      const completeSender: SenderContext = { userId: user.id, name: user.name, role: user.role, teamId: user.teamId };
      void notifyUser(followUp.assignedTo.toString(), { title: "Follow-up completed", message: `${user.name} completed follow-up: "${followUp.title}".`, notificationType: "followup_completed", relatedModule: "followups", recordType: "FollowUp", recordId: followUp._id.toString(), actionUrl: `/followups?focus=${followUp._id.toString()}`, priority: "low", metadata: { title: followUp.title } }, completeSender);
    }

    const [users, leads] = await Promise.all([
      User.find({}).select("_id name").lean().exec(),
      Lead.find({}).select("_id companyName").lean().exec(),
    ]);
    const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u.name]));
    const leadMap = Object.fromEntries(
      leads.map((lead) => [lead._id.toString(), lead.companyName]),
    );
    return jsonResponse({ followUp: mapFollowUp(updated, userMap, leadMap) });
  }

  if (request.method === "DELETE") {
    const payload = await readJsonBody(request);
    const followUpId = typeof payload.followUpId === "string" ? payload.followUpId.trim() : "";

    if (!followUpId) {
      throw new Error("followUpId is required");
    }

    await connectDb();
    const followUpObjectId = ensureObjectId(followUpId, "follow-up ID");
    const followUp = await FollowUp.findById(followUpObjectId).exec();
    if (!followUp) {
      throw new Error("Follow-up not found");
    }

    if (
      followUp.assignedTo.toString() !== user.id &&
      user.role !== "admin" &&
      user.role !== "ops_manager" &&
      user.role !== "team_manager"
    ) {
      throw new Error("Not authorized to delete this follow-up");
    }

    await FollowUp.deleteOne({ _id: followUp._id }).exec();
    return jsonResponse({ deletedId: followUpId });
  }

  await connectDb();

  const scope =
    user.role === "agent" || user.role === "trainee"
      ? { assignedTo: new mongoose.Types.ObjectId(user.id) }
      : {};

  const [followUps, users, leads] = await Promise.all([
    FollowUp.find(scope).sort({ dueDate: 1, createdAt: -1 }).lean().exec(),
    User.find({}).select("_id name").lean().exec(),
    Lead.find({}).select("_id companyName").lean().exec(),
  ]);

  const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u.name]));
  const leadMap = Object.fromEntries(leads.map((lead) => [lead._id.toString(), lead.companyName]));

  return jsonResponse({
    followUps: followUps.map((followUp) => mapFollowUp(followUp, userMap, leadMap)),
  });
}
