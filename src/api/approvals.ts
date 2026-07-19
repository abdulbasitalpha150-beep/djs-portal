import mongoose from "mongoose";
import { connectDb } from "../lib/db";
import { getSessionUserFromRequest, requireAuth } from "../lib/auth";
import { jsonResponse, parseJson } from "../lib/api";
import {
  ApprovalRequest,
  APPROVAL_MODULES,
  APPROVAL_ACTION_TYPES,
  APPROVAL_STATUSES,
} from "../models/approvalRequest";
import { Lead } from "../models/lead";
import { FollowUp } from "../models/followUp";
import { Customer } from "../models/customer";
import { QuoteRequest } from "../models/quoteRequest";
import { Carrier } from "../models/carrier";
import { Load } from "../models/load";
import {
  notifyUser,
  notifyAdmins,
  notifyTeamManager,
  notifyLeadAgents,
  type SenderContext,
  type NotificationPayload,
} from "../lib/notification";
import type { Role } from "../lib/roles";

const ROLES_THAT_NEED_APPROVAL: Role[] = ["agent", "trainee"];
const ROLES_THAT_CAN_APPROVE: Role[] = [
  "owner",
  "admin",
  "ops_manager",
  "team_manager",
  "leadagent",
];

export async function approvalsHandler(request: Request) {
  const user = requireAuth(await getSessionUserFromRequest(request));
  await connectDb();

  // GET: list approvals with visibility rules
  if (request.method === "GET") {
    let filter: any = {};
    const userRole = user.role as Role;

    if (userRole === "agent" || userRole === "trainee") {
      filter = { requestedBy: new mongoose.Types.ObjectId(user.id) };
    } else if (userRole === "leadagent" || userRole === "team_manager") {
      if (user.teamId) {
        filter = {
          $or: [
            { requestedBy: new mongoose.Types.ObjectId(user.id) },
            { teamId: new mongoose.Types.ObjectId(user.teamId) },
          ],
        };
      } else {
        filter = { requestedBy: new mongoose.Types.ObjectId(user.id) };
      }
    }

    const approvals = await ApprovalRequest.find(filter).sort({ createdAt: -1 }).exec();

    return jsonResponse({
      approvals: approvals.map((a) => ({
        id: a._id.toString(),
        module: a.module,
        recordId: a.recordId?.toString(),
        actionType: a.actionType,
        requestedBy: a.requestedBy.toString(),
        requestedByName: a.requestedByName,
        teamId: a.teamId?.toString(),
        previousValues: a.previousValues,
        newValues: a.newValues,
        status: a.status,
        approvedBy: a.approvedBy?.toString(),
        approvedByName: a.approvedByName,
        approvedAt: a.approvedAt?.toISOString(),
        rejectedBy: a.rejectedBy?.toString(),
        rejectedByName: a.rejectedByName,
        rejectedAt: a.rejectedAt?.toISOString(),
        rejectionReason: a.rejectionReason,
        comments: a.comments,
        auditHistory: a.auditHistory,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      })),
    });
  }

  // POST: create an approval request (internal usage from other APIs)
  if (request.method === "POST") {
    const payload = await parseJson(request);
    const { module, recordId, actionType, previousValues, newValues } = payload;

    if (!module || !APPROVAL_MODULES.includes(module as any)) {
      throw new Error("Invalid module type");
    }
    if (!actionType || !APPROVAL_ACTION_TYPES.includes(actionType as any)) {
      throw new Error("Invalid action type");
    }
    if (!newValues) {
      throw new Error("New values are required");
    }

    const approvalRequest = await ApprovalRequest.create({
      module,
      recordId: recordId ? new mongoose.Types.ObjectId(recordId) : undefined,
      actionType,
      requestedBy: new mongoose.Types.ObjectId(user.id),
      requestedByName: user.name,
      teamId: user.teamId ? new mongoose.Types.ObjectId(user.teamId) : undefined,
      previousValues,
      newValues,
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
        ...approvalRequest.toObject(),
      },
    });
  }

  // PATCH: approve, reject, request changes, update the request, or add comment
  if (request.method === "PATCH") {
    const userRole = user.role as Role;
    const payload = await parseJson(request);
    const { approvalRequestId, action, rejectionReason, newValues, comment } = payload;

    if (!approvalRequestId) throw new Error("approvalRequestId is required");
    const approvalRequest = await ApprovalRequest.findById(approvalRequestId).exec();
    if (!approvalRequest) throw new Error("Approval request not found");

    // Handle adding comment
    if (action === "add_comment") {
      if (!comment || !comment.trim()) throw new Error("Comment text is required");
      approvalRequest.comments.push({
        id: new mongoose.Types.ObjectId(),
        userId: new mongoose.Types.ObjectId(user.id),
        userName: user.name,
        text: comment,
        createdAt: new Date(),
      });
      approvalRequest.auditHistory.push({
        action: "comment_added",
        performedBy: new mongoose.Types.ObjectId(user.id),
        performedByName: user.name,
        at: new Date(),
        notes: comment,
      });
      await approvalRequest.save();

      // Notify the requester if someone else commented on their request
      if (approvalRequest.requestedBy.toString() !== user.id) {
        const sender: SenderContext = {
          userId: user.id,
          name: user.name,
          role: user.role,
          teamId: user.teamId,
        };
        const modulePath = `/${approvalRequest.module}`;
        void notifyUser(
          approvalRequest.requestedBy.toString(),
          {
            title: "New comment on your request",
            message: `${user.name} commented on your ${approvalRequest.module} approval request: "${comment}"`,
            notificationType: "manager_comment",
            relatedModule: "approvals",
            recordType: "ApprovalRequest",
            recordId: approvalRequest._id.toString(),
            actionUrl: modulePath,
            priority: "medium",
            metadata: { comment, module: approvalRequest.module },
          },
          sender,
        );
      }

      return jsonResponse({ approvalRequest });
    }

    // Handle updating the request (for original requester)
    if (action === "update") {
      if (approvalRequest.requestedBy.toString() !== user.id) {
        throw new Error("Only the original requester can update this request");
      }
      if (!newValues) throw new Error("newValues is required");

      approvalRequest.newValues = newValues;
      approvalRequest.status = "pending"; // Reset to pending after updating
      approvalRequest.auditHistory.push({
        action: "request_updated",
        performedBy: new mongoose.Types.ObjectId(user.id),
        performedByName: user.name,
        at: new Date(),
      });

      await approvalRequest.save();
      return jsonResponse({ approvalRequest });
    }

    // Handle approve/reject/request_changes (for approvers)
    if (!ROLES_THAT_CAN_APPROVE.includes(userRole)) {
      throw new Error("You do not have permission to approve/reject/request changes on requests");
    }
    if (!["approve", "reject", "request_changes"].includes(action)) {
      throw new Error(
        "Invalid action: must be 'approve', 'reject', 'request_changes', or 'add_comment'",
      );
    }
    if (!["pending", "changes_requested", "rejected"].includes(approvalRequest.status)) {
      throw new Error("Only pending, changes_requested, or rejected requests can be processed");
    }

    // Check if team_manager or leadagent - only allow their own team's requests
    if (["team_manager", "leadagent"].includes(userRole)) {
      if (!user.teamId) throw new Error("You are not assigned to a team");
      if (approvalRequest.teamId?.toString() !== user.teamId.toString()) {
        throw new Error("You can only process requests from your own team");
      }
    }

    if (action === "approve") {
      await applyApprovalChanges(approvalRequest);

      approvalRequest.status = "approved";
      approvalRequest.approvedBy = new mongoose.Types.ObjectId(user.id);
      approvalRequest.approvedByName = user.name;
      approvalRequest.approvedAt = new Date();
      approvalRequest.auditHistory.push({
        action: "request_approved",
        performedBy: new mongoose.Types.ObjectId(user.id),
        performedByName: user.name,
        at: new Date(),
      });
    } else if (action === "reject") {
      approvalRequest.status = "rejected";
      approvalRequest.rejectedBy = new mongoose.Types.ObjectId(user.id);
      approvalRequest.rejectedByName = user.name;
      approvalRequest.rejectedAt = new Date();
      approvalRequest.rejectionReason = rejectionReason;
      approvalRequest.auditHistory.push({
        action: "request_rejected",
        performedBy: new mongoose.Types.ObjectId(user.id),
        performedByName: user.name,
        at: new Date(),
        notes: rejectionReason,
      });
      if (rejectionReason && rejectionReason.trim()) {
        approvalRequest.comments.push({
          id: new mongoose.Types.ObjectId(),
          userId: new mongoose.Types.ObjectId(user.id),
          userName: user.name,
          text: rejectionReason,
          createdAt: new Date(),
        });
      }
    } else if (action === "request_changes") {
      approvalRequest.status = "changes_requested";
      approvalRequest.auditHistory.push({
        action: "changes_requested",
        performedBy: new mongoose.Types.ObjectId(user.id),
        performedByName: user.name,
        at: new Date(),
        notes: rejectionReason,
      });
      if (rejectionReason && rejectionReason.trim()) {
        approvalRequest.comments.push({
          id: new mongoose.Types.ObjectId(),
          userId: new mongoose.Types.ObjectId(user.id),
          userName: user.name,
          text: rejectionReason,
          createdAt: new Date(),
        });
      }
    }

    await approvalRequest.save();

    // Emit role-aware notifications for the approval outcome
    try {
      const sender: SenderContext = {
        userId: user.id,
        name: user.name,
        role: user.role,
        teamId: user.teamId,
      };
      const moduleStr = approvalRequest.module;
      const modulePath = `/${moduleStr}`;
      const recordId = approvalRequest.recordId?.toString();
      const actionUrl = recordId ? `${modulePath}?focus=${recordId}` : modulePath;
      const teamIdStr = approvalRequest.teamId?.toString();
      const requestedByStr = approvalRequest.requestedBy.toString();

      // Map the module to a relatedModule the notification schema understands
      const moduleToRelated: Record<string, NotificationPayload["relatedModule"]> = {
        quotes: "quotes",
        loads: "loads",
        customers: "customers",
        carriers: "carriers",
        leads: "leads",
        followups: "followups",
      };
      const relatedModule = moduleToRelated[moduleStr] ?? "approvals";

      let title = "";
      let message = "";
      let notificationType: string = "approval_granted";
      let priority: "low" | "medium" | "high" = "medium";

      if (action === "approve") {
        title = `Your ${moduleStr} request has been approved`;
        message = `${user.name} approved your ${moduleStr} request.`;
        notificationType = "approval_granted";
        priority = "low";
      } else if (action === "reject") {
        title = `Your ${moduleStr} request has been rejected`;
        message = `${user.name} rejected your ${moduleStr} request.${rejectionReason ? ` Reason: ${rejectionReason}` : ""}`;
        notificationType = "approval_rejected";
        priority = "high";
      } else if (action === "request_changes") {
        title = `Changes requested on your ${moduleStr} request`;
        message = `${user.name} requested changes on your ${moduleStr} request.${rejectionReason ? ` Notes: ${rejectionReason}` : ""}`;
        notificationType = "changes_requested";
        priority = "medium";
      }

      const requesterPayload: NotificationPayload = {
        title,
        message,
        notificationType,
        relatedModule,
        recordType: "ApprovalRequest",
        recordId: approvalRequest._id.toString(),
        actionUrl,
        priority,
        metadata: { module: moduleStr, action, rejectionReason, recordId },
      };

      const notifPromises: Promise<void>[] = [];

      // Notify the original requester (if not the actor)
      if (requestedByStr !== user.id) {
        notifPromises.push(notifyUser(requestedByStr, requesterPayload, sender));
      }

      // Notify owner/admin about the approval outcome
      const adminPayload: NotificationPayload = {
        title: `${moduleStr} request ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "changes requested"}`,
        message: `${user.name} ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "requested changes on"} ${approvalRequest.requestedByName}'s ${moduleStr} request.`,
        notificationType,
        relatedModule,
        recordType: "ApprovalRequest",
        recordId: approvalRequest._id.toString(),
        actionUrl,
        priority: priority,
        metadata: { module: moduleStr, action, requestedBy: requestedByStr },
      };
      notifPromises.push(notifyAdmins(adminPayload, sender));

      // Notify team_manager and lead_agents of the team (if scoped)
      if (teamIdStr) {
        notifPromises.push(notifyTeamManager(teamIdStr, adminPayload, sender));
        notifPromises.push(notifyLeadAgents(teamIdStr, adminPayload, sender));
      }

      if (notifPromises.length) await Promise.all(notifPromises);
    } catch (err) {
      console.error("[notification] approval outcome emission failed:", err);
    }

    return jsonResponse({ approvalRequest });
  }

  throw new Error(`Method ${request.method} not allowed`);
}

async function applyApprovalChanges(approvalRequest: any) {
  const { module, recordId, actionType, newValues } = approvalRequest;

  switch (module) {
    case "leads":
      if (actionType === "create") {
        // Remove fields specific to approval request
        const { _id, __v, ...cleanValues } = newValues;
        await Lead.create({ ...cleanValues, _id: recordId });
      } else if (actionType === "edit") {
        await Lead.findByIdAndUpdate(recordId, newValues, { new: true }).exec();
      } else if (actionType === "delete") {
        await Lead.findByIdAndDelete(recordId).exec();
      }
      break;
    case "followups":
      if (actionType === "create") {
        const { _id, __v, ...cleanValues } = newValues;
        await FollowUp.create({ ...cleanValues, _id: recordId });
      } else if (actionType === "edit") {
        await FollowUp.findByIdAndUpdate(recordId, newValues, { new: true }).exec();
      } else if (actionType === "delete") {
        await FollowUp.findByIdAndDelete(recordId).exec();
      }
      break;
    case "customers":
      if (actionType === "create") {
        const { _id, __v, ...cleanValues } = newValues;
        await Customer.create({ ...cleanValues, _id: recordId });
      } else if (actionType === "edit") {
        await Customer.findByIdAndUpdate(recordId, newValues, { new: true }).exec();
      } else if (actionType === "delete") {
        await Customer.findByIdAndDelete(recordId).exec();
      }
      break;
    case "quotes":
      if (actionType === "create") {
        const { _id, __v, ...cleanValues } = newValues;
        await QuoteRequest.create({ ...cleanValues, _id: recordId });
      } else if (actionType === "edit") {
        await QuoteRequest.findByIdAndUpdate(recordId, newValues, { new: true }).exec();
      } else if (actionType === "delete") {
        await QuoteRequest.findByIdAndDelete(recordId).exec();
      }
      break;
    case "carriers":
      if (actionType === "create") {
        const { _id, __v, ...cleanValues } = newValues;
        await Carrier.create({ ...cleanValues, _id: recordId });
      } else if (actionType === "edit") {
        await Carrier.findByIdAndUpdate(recordId, newValues, { new: true }).exec();
      } else if (actionType === "delete") {
        await Carrier.findByIdAndDelete(recordId).exec();
      }
      break;
    case "loads":
      if (actionType === "create") {
        const { _id, __v, ...cleanValues } = newValues;
        await Load.create({ ...cleanValues, _id: recordId });
      } else if (actionType === "edit") {
        await Load.findByIdAndUpdate(recordId, newValues, { new: true }).exec();
      } else if (actionType === "delete") {
        await Load.findByIdAndDelete(recordId).exec();
      }
      break;
  }
}

// Helper function for other APIs to check if approval is required
export function doesUserNeedApproval(role: Role): boolean {
  return ROLES_THAT_NEED_APPROVAL.includes(role);
}
