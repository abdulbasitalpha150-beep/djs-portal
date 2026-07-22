import mongoose from "mongoose";
import { connectDb } from "../../lib/db";
import { getSessionUserFromRequest, requireAuth } from "../../lib/auth";
import { jsonResponse, parseJson } from "../../lib/api";
import { Lead, PIPELINE_STAGES } from "../../models/lead";
import { User } from "../../models/user";
import { ReassignmentHistory } from "../../models/reassignmentHistory";
import { ApprovalRequest } from "../../models/approvalRequest";
import type { Role } from "../../lib/roles";

const ROLES_THAT_NEED_APPROVAL: Role[] = ["agent", "trainee"];
const ROLES_THAT_CAN_SKIP_APPROVAL: Role[] = [
  "owner",
  "admin",
  "ops_manager",
  "team_manager",
  "leadagent",
];

function normalizeStatus(status: string) {
  const normalized = status.toLowerCase();
  switch (normalized) {
    case "warm":
    case "qualified":
      return "qualified";
    case "follow_up_due":
    case "contacted":
      return "contacted";
    case "customer_onboarding":
    case "customer":
      return "customer";
    case "not_a_fit":
    case "lost":
      return "lost";
    case "prospect":
      return "prospect";
    case "new":
    default:
      return "new";
  }
}

async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export async function leadsListHandler(request: Request) {
  const user = requireAuth(await getSessionUserFromRequest(request));

  if (request.method === "DELETE") {
    const payload = await readJsonBody(request);
    const leadId = typeof payload.leadId === "string" ? payload.leadId.trim() : "";

    if (!leadId) {
      throw new Error("leadId is required");
    }

    await connectDb();
    const lead = await Lead.findById(new mongoose.Types.ObjectId(leadId)).exec();

    if (!lead) {
      throw new Error("Lead not found");
    }

    if (
      lead.ownerId?.toString() !== user.id &&
      user.role !== "admin" &&
      user.role !== "ops_manager"
    ) {
      throw new Error("Not authorized to delete this lead");
    }

    await Lead.deleteOne({ _id: lead._id }).exec();

    return jsonResponse({ deletedId: leadId });
  }

  if (request.method === "PATCH") {
    const payload = await parseJson(request);
    const leadId = typeof payload.leadId === "string" ? payload.leadId.trim() : "";
    const companyName = typeof payload.companyName === "string" ? payload.companyName.trim() : "";
    const contactName = typeof payload.contactName === "string" ? payload.contactName.trim() : "";
    const contactEmail =
      typeof payload.contactEmail === "string" ? payload.contactEmail.trim() : "";
    const contactPhone =
      typeof payload.contactPhone === "string" ? payload.contactPhone.trim() : "";
    const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";
    const shippingNotes =
      typeof payload.shippingNotes === "string" ? payload.shippingNotes.trim() : "";
    const status = normalizeStatus(typeof payload.status === "string" ? payload.status : "new");
    const pipelineStage =
      typeof payload.pipelineStage === "string" ? payload.pipelineStage.trim() : "";
    const newOwnerId = typeof payload.ownerId === "string" ? payload.ownerId.trim() : "";

    if (!leadId) {
      throw new Error("leadId is required");
    }

    await connectDb();
    const lead = await Lead.findById(new mongoose.Types.ObjectId(leadId)).exec();

    if (!lead) {
      throw new Error("Lead not found");
    }

    if (
      lead.ownerId?.toString() !== user.id &&
      user.role !== "admin" &&
      user.role !== "ops_manager" &&
      user.role !== "team_manager"
    ) {
      throw new Error("Not authorized to edit this lead");
    }

    // Track what changed
    const changes: string[] = [];
    if (lead.companyName !== companyName && companyName) {
      changes.push(`company: ${lead.companyName} → ${companyName}`);
      lead.companyName = companyName;
    }
    if (lead.contactName !== contactName && contactName) {
      changes.push(`contact: ${lead.contactName} → ${contactName}`);
      lead.contactName = contactName;
    }
    if (lead.contactEmail !== contactEmail && contactEmail) {
      changes.push(`email: ${lead.contactEmail} → ${contactEmail}`);
      lead.contactEmail = contactEmail;
    }
    if (lead.contactPhone !== contactPhone && contactPhone) {
      changes.push(`phone: ${lead.contactPhone} → ${contactPhone}`);
      lead.contactPhone = contactPhone;
    }
    if (lead.status !== status && status) {
      changes.push(`status: ${lead.status} → ${status}`);
      lead.status = status;
    }
    if (
      pipelineStage &&
      PIPELINE_STAGES.includes(pipelineStage as any) &&
      lead.pipelineStage !== pipelineStage
    ) {
      changes.push(`pipeline: ${lead.pipelineStage} → ${pipelineStage}`);
      lead.pipelineStageHistory = lead.pipelineStageHistory || [];
      lead.pipelineStageHistory.unshift({
        stage: pipelineStage,
        changedBy: new mongoose.Types.ObjectId(user.id),
        changedAt: new Date(),
      });
      lead.pipelineStage = pipelineStage as any;
    }
    if (lead.location !== notes && notes) {
      changes.push(`notes updated`);
      lead.location = notes;
    }
    if (lead.laneOrNeed !== shippingNotes && shippingNotes) {
      changes.push(`shipping notes updated`);
      lead.laneOrNeed = shippingNotes;
    }
    if (newOwnerId && newOwnerId !== lead.ownerId?.toString()) {
      changes.push(`owner: ${lead.ownerId?.toString()} → ${newOwnerId}`);
      await ReassignmentHistory.create({
        leadId: lead._id,
        fromUserId: lead.ownerId,
        toUserId: new mongoose.Types.ObjectId(newOwnerId),
        reassignedBy: new mongoose.Types.ObjectId(user.id),
      });
      lead.ownerId = new mongoose.Types.ObjectId(newOwnerId);
    }

    // Add an edit activity note
    const editNote = changes.length > 0 ? `Updated: ${changes.join(", ")}` : "No changes made";
    lead.notes = lead.notes || [];
    lead.notes.unshift({
      authorId: new mongoose.Types.ObjectId(user.id),
      authorName: user.name,
      text: editNote,
      createdAt: new Date(),
    });

    const updated = await lead.save();

    return jsonResponse({
      lead: {
        id: updated._id.toString(),
        company: updated.companyName,
        contact: updated.contactName,
        email: updated.contactEmail ?? "",
        phone: updated.contactPhone ?? "",
        status: normalizeStatus(updated.status),
        pipelineStage: updated.pipelineStage,
        agentId: updated.ownerId?.toString() ?? user.id,
        agentName: user.name,
        lastActivity: updated.updatedAt?.toISOString() ?? updated.createdAt.toISOString(),
        notes: updated.location ?? "",
        shippingNotes: updated.laneOrNeed ?? "",
        activities: (updated.notes ?? []).map((note, index) => ({
          id: `${updated._id.toString()}-${index}`,
          kind: note.text.startsWith("Updated:") ? "edit" : "note",
          body: note.text,
          by: note.authorName ?? user.name,
          at: (note.createdAt ?? updated.updatedAt ?? updated.createdAt).toISOString(),
        })),
      },
    });
  }

  if (request.method === "POST") {
    const payload = await parseJson(request);
    const companyName = typeof payload.companyName === "string" ? payload.companyName.trim() : "";
    const contactName = typeof payload.contactName === "string" ? payload.contactName.trim() : "";
    const contactEmail =
      typeof payload.contactEmail === "string" ? payload.contactEmail.trim() : "";
    const contactPhone =
      typeof payload.contactPhone === "string" ? payload.contactPhone.trim() : "";
    const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";
    const shippingNotes =
      typeof payload.shippingNotes === "string" ? payload.shippingNotes.trim() : "";
    const status = normalizeStatus(typeof payload.status === "string" ? payload.status : "new");

    if (!companyName || !contactName) {
      throw new Error("companyName and contactName are required");
    }

    await connectDb();

    // Duplicate check
    const existingLead = await Lead.findOne({
      companyName: {
        $regex: new RegExp(`^${companyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
      },
    }).exec();
    if (existingLead) {
      throw new Error("A lead with this company name already exists");
    }

    const userRole = user.role as Role;
    if (ROLES_THAT_NEED_APPROVAL.includes(userRole)) {
      // Create approval request instead of directly saving
      const newLeadId = new mongoose.Types.ObjectId();
      const approvalRequest = await ApprovalRequest.create({
        module: "leads",
        recordId: newLeadId,
        actionType: "create",
        requestedBy: new mongoose.Types.ObjectId(user.id),
        requestedByName: user.name,
        teamId: user.teamId ? new mongoose.Types.ObjectId(user.teamId) : undefined,
        newValues: {
          ownerId: new mongoose.Types.ObjectId(user.id),
          companyName,
          contactName,
          contactPhone,
          contactEmail,
          location: notes,
          laneOrNeed: shippingNotes,
          status,
          pipelineStage: "cold",
          pipelineStageHistory: [],
          notes: [
            {
              authorId: new mongoose.Types.ObjectId(user.id),
              authorName: user.name,
              text: notes || "Lead created from the portal",
              createdAt: new Date(),
            },
          ],
        },
        auditHistory: [
          {
            action: "request_created",
            performedBy: new mongoose.Types.ObjectId(user.id),
            performedByName: user.name,
            at: new Date(),
          },
        ],
      });

      return jsonResponse({
        approvalRequest: {
          id: approvalRequest._id.toString(),
        },
        lead: {
          id: newLeadId.toString(),
          company: companyName,
          contact: contactName,
          email: contactEmail ?? "",
          phone: contactPhone ?? "",
          status: normalizeStatus(status),
          pipelineStage: "cold",
          agentId: user.id,
          agentName: user.name,
          lastActivity: new Date().toISOString(),
          notes: notes ?? "",
          shippingNotes: shippingNotes ?? "",
          activities: [
            {
              id: `${newLeadId.toString()}-0`,
              kind: "note" as const,
              body: notes || "Lead created from the portal",
              by: user.name,
              at: new Date().toISOString(),
            },
          ],
          pendingApproval: true,
          requestedBy: user.name,
        },
      });
    } else {
      // User can skip approval - save directly
      const created = await Lead.create({
        ownerId: new mongoose.Types.ObjectId(user.id),
        companyName,
        contactName,
        contactPhone,
        contactEmail,
        location: notes,
        laneOrNeed: shippingNotes,
        status,
        pipelineStage: "cold",
        pipelineStageHistory: [],
        notes: [
          {
            authorId: new mongoose.Types.ObjectId(user.id),
            authorName: user.name,
            text: notes || "Lead created from the portal",
            createdAt: new Date(),
          },
        ],
      });

      return jsonResponse({
        lead: {
          id: created._id.toString(),
          company: created.companyName,
          contact: created.contactName,
          email: created.contactEmail ?? "",
          phone: created.contactPhone ?? "",
          status: normalizeStatus(created.status),
          pipelineStage: created.pipelineStage,
          agentId: created.ownerId?.toString() ?? user.id,
          agentName: user.name,
          lastActivity: created.updatedAt?.toISOString() ?? created.createdAt.toISOString(),
          notes: created.location ?? "",
          shippingNotes: created.laneOrNeed ?? "",
          activities: [
            {
              id: `${created._id.toString()}-0`,
              kind: "note" as const,
              body: notes || "Lead created from the portal",
              by: user.name,
              at: created.updatedAt?.toISOString() ?? created.createdAt.toISOString(),
            },
          ],
          pendingApproval: false,
        },
      });
    }
  }

  await connectDb();

  const scope =
    user.role === "agent" || user.role === "trainee"
      ? { ownerId: new mongoose.Types.ObjectId(user.id) }
      : {};

  // Also fetch pending approval requests for leads module
  let approvalRequests: any[] = [];
  try {
    let approvalScope: any = {
      module: "leads",
      status: { $in: ["pending", "rejected", "changes_requested"] },
    };
    if (user.role === "agent" || user.role === "trainee") {
      approvalScope.requestedBy = new mongoose.Types.ObjectId(user.id);
    } else if (user.role === "team_manager" || user.role === "leadagent") {
      if (user.teamId) {
        approvalScope.teamId = new mongoose.Types.ObjectId(user.teamId);
      }
    }

    approvalRequests = await ApprovalRequest.find(approvalScope)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  } catch (err) {
    console.error("Error fetching approval requests for leads:", err);
  }

  const [leads, agents] = await Promise.all([
    Lead.find(scope).sort({ updatedAt: -1 }).lean().exec() as Promise<Array<any>>,
    User.find({ role: { $in: ["admin", "ops_manager", "team_manager", "agent"] } })
      .select("_id name role")
      .lean()
      .exec() as Promise<Array<{ _id: mongoose.Types.ObjectId; name: string; role: string }>>,
  ]);

  const agentMap = Object.fromEntries(
    agents.map((agentRecord) => [agentRecord._id.toString(), agentRecord.name]),
  );

  // Convert existing leads to response format
  const existingLeads = leads.map((lead) => {
    const lastNote = lead.notes?.[0];
    return {
      id: lead._id.toString(),
      company: lead.companyName,
      contact: lead.contactName,
      email: lead.contactEmail ?? "",
      phone: lead.contactPhone ?? "",
      status: normalizeStatus(lead.status),
      pipelineStage: lead.pipelineStage,
      agentId: lead.ownerId?.toString() ?? user.id,
      agentName: lead.ownerId ? (agentMap[lead.ownerId.toString()] ?? "Unassigned") : user.name,
      lastActivity: (lastNote?.createdAt ?? lead.updatedAt ?? lead.createdAt).toISOString(),
      notes: lead.location ?? "",
      shippingNotes: lead.laneOrNeed ?? "",
      activities: (lead.notes ?? []).map((note: any, index: number) => ({
        id: `${lead._id.toString()}-${index}`,
        kind: note.text?.startsWith("Updated:") ? "edit" : "note",
        body: note.text,
        by: note.authorName ?? agentMap[lead.ownerId?.toString() ?? ""] ?? user.name,
        at: (note.createdAt ?? lead.updatedAt ?? lead.createdAt).toISOString(),
      })),
      pendingApproval: false,
      comments: [],
    };
  });

  // Convert approval requests to lead format
  const pendingLeadRequests = approvalRequests.map((req) => {
    const newValues = req.newValues as any;
    const lastNote = newValues.notes?.[0];
    const leadId = req.recordId?.toString() ?? req._id.toString();
    return {
      id: leadId,
      company: newValues.companyName,
      contact: newValues.contactName,
      email: newValues.contactEmail ?? "",
      phone: newValues.contactPhone ?? "",
      status: normalizeStatus(newValues.status ?? "new"),
      pipelineStage: newValues.pipelineStage ?? "cold",
      agentId: req.requestedBy?.toString() ?? user.id,
      agentName: req.requestedByName ?? user.name,
      lastActivity: req.createdAt.toISOString(),
      notes: newValues.location ?? "",
      shippingNotes: newValues.laneOrNeed ?? "",
      activities: (newValues.notes ?? []).map((note: any, index: number) => ({
        id: `${leadId}-${index}`,
        kind: note.text?.startsWith("Updated:") ? "edit" : "note",
        body: note.text,
        by: note.authorName ?? req.requestedByName ?? user.name,
        at: (note.createdAt ?? req.createdAt).toISOString(),
      })),
      pendingApproval: true,
      approvalStatus: req.status,
      comments: (req.comments || []).map((comment: any) => ({
        by: comment.userName,
        at: comment.createdAt?.toISOString() || new Date().toISOString(),
        body: comment.text,
      })),
      requestedBy: req.requestedByName,
    };
  });

  // Combine existing leads and pending requests, sort by lastActivity descending
  const combinedLeads = [...pendingLeadRequests, ...existingLeads].sort(
    (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime(),
  );

  return jsonResponse({
    leads: combinedLeads,
  });
}
