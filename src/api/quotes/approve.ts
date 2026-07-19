import mongoose from "mongoose";
import { connectDb } from "../../lib/db";
import { getSessionUserFromRequest, requireRole } from "../../lib/auth";
import { QuoteRequest } from "../../models/quoteRequest";
import { Team } from "../../models/team";
import { recordAudit } from "../../lib/audit";
import {
  notifyUser,
  notifyAdmins,
  notifyTeamManager,
  notifyLeadAgents,
  notifyOpsManagers,
  type SenderContext,
} from "../../lib/notification";
import { jsonResponse, parseJson, parseZod, errorResponse } from "../../lib/api";
import { quoteApproveSchema } from "../../lib/validation";

export async function quoteApproveHandler(request: Request, params: Record<string, string>) {
  const user = await getSessionUserFromRequest(request);
  const sessionUser = requireRole(user, ["admin", "ops_manager", "team_manager"]);

  const quoteId = params.id;
  if (!quoteId) {
    return errorResponse("Quote ID is required", 400);
  }

  const body = await parseJson(request);
  const payload = parseZod(quoteApproveSchema, body);

  await connectDb();

  const quote = await QuoteRequest.findById(params.id);
  if (!quote) {
    return errorResponse("Quote request not found", 404);
  }

  if (quote.status === "approved") {
    return errorResponse("Quote request is already approved", 400);
  }

  if (sessionUser.role === "team_manager") {
    const team = await Team.findOne({
      managerId: new mongoose.Types.ObjectId(sessionUser.id),
      memberIds: quote.agentId,
    });
    if (!team) {
      return errorResponse("You are not authorized to approve this quote", 403);
    }
  }

  quote.status = "approved";
  quote.reviewedBy = new mongoose.Types.ObjectId(sessionUser.id);
  quote.reviewNotes = payload.reviewNotes;
  quote.reviewedAt = new Date();
  await quote.save();

  await recordAudit({
    actorId: sessionUser.id,
    actionType: "approval",
    targetType: "QuoteRequest",
    targetId: params.id,
    metadata: {
      status: quote.status,
      reviewNotes: payload.reviewNotes,
    },
  });

  // Notifications for quote approval
  const sender: SenderContext = {
    userId: sessionUser.id,
    name: sessionUser.name,
    role: sessionUser.role,
    teamId: sessionUser.teamId,
  };
  const actionUrl = `/quotes?focus=${params.id}`;
  const laneLabel = quote.lane
    ? `${(quote.lane as any).origin ?? ""} → ${(quote.lane as any).destination ?? ""}`
    : "a lane";
  const notifPromises: Promise<void>[] = [];

  // Notify the agent who submitted the quote
  if (quote.agentId && quote.agentId.toString() !== sessionUser.id) {
    notifPromises.push(
      notifyUser(
        quote.agentId.toString(),
        {
          title: "Your quote has been approved",
          message: `Your quote for ${laneLabel} has been approved.`,
          notificationType: "quote_approved",
          relatedModule: "quotes",
          recordType: "QuoteRequest",
          recordId: params.id,
          actionUrl,
          priority: "low",
          metadata: { reviewNotes: payload.reviewNotes },
        },
        sender,
      ),
    );
  }

  // Notify owner/admin, ops managers
  const adminNotif = {
    title: "Quote approved",
    message: `${sessionUser.name} approved a quote for ${laneLabel}.`,
    notificationType: "quote_approved" as const,
    relatedModule: "quotes" as const,
    recordType: "QuoteRequest",
    recordId: params.id,
    actionUrl,
    priority: "low" as const,
    metadata: { reviewNotes: payload.reviewNotes },
  };
  notifPromises.push(notifyAdmins(adminNotif, sender));
  notifPromises.push(notifyOpsManagers(adminNotif, sender));

  // Notify team_manager and lead_agents of the agent's team
  // Look up the agent's teamId
  try {
    const agentUser = (await QuoteRequest.findById(params.id)
      .select("agentId")
      .populate("agentId", "teamId")
      .lean()
      .exec()) as any;
    const agentTeamId = agentUser?.agentId?.teamId?.toString();
    if (agentTeamId) {
      notifPromises.push(
        notifyTeamManager(agentTeamId, adminNotif, sender),
        notifyLeadAgents(agentTeamId, adminNotif, sender),
      );
    }
  } catch (err) {
    console.error("[notification] quote approve team lookup failed:", err);
  }

  if (notifPromises.length) await Promise.all(notifPromises);

  return jsonResponse({
    quote: {
      id: quote._id.toString(),
      status: quote.status,
      reviewedBy: quote.reviewedBy?.toString(),
      reviewNotes: quote.reviewNotes,
      reviewedAt: quote.reviewedAt,
    },
  });
}
