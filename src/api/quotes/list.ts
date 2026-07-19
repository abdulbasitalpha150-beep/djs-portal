import mongoose from "mongoose";
// @ts-nocheck
import { connectDb } from "../../lib/db";
import { getSessionUserFromRequest, requireAuth } from "../../lib/auth";
import { jsonResponse, parseJson } from "../../lib/api";
import { QuoteRequest } from "../../models/quoteRequest";
import { User } from "../../models/user";
import { Customer } from "../../models/customer";
import { ApprovalRequest } from "../../models/approvalRequest";
import { notifyApprovers, notifyUser, type SenderContext } from "../../lib/notification";
import type { Role } from "../../lib/roles";

const ROLES_THAT_NEED_APPROVAL: Role[] = ["agent", "trainee"];

function normalizeStatus(status: string) {
  const normalized = status.toLowerCase();
  switch (normalized) {
    case "approved":
    case "rejected":
    case "changes_requested":
      return normalized;
    default:
      return "pending_approval";
  }
}

export async function quotesListHandler(request: Request) {
  const user = requireAuth(await getSessionUserFromRequest(request));

  // Helper to get agentMap and customerMap
  const getMaps = async () => {
    const [agents, customers] = await Promise.all([
      User.find({ role: { $in: ["admin", "ops_manager", "team_manager", "agent"] } })
        .select("_id name role")
        .lean()
        .exec() as Promise<Array<{ _id: mongoose.Types.ObjectId; name: string; role: string }>>,
      Customer.find({}).select("_id companyName").lean().exec() as Promise<
        Array<{ _id: mongoose.Types.ObjectId; companyName: string }>
      >,
    ]);
    const agentMap = Object.fromEntries(
      agents.map((agentRecord) => [agentRecord._id.toString(), agentRecord.name]),
    );
    const customerMap = Object.fromEntries(
      customers.map((customerRecord) => [
        customerRecord._id.toString(),
        customerRecord.companyName,
      ]),
    );
    return { agents, customers, agentMap, customerMap };
  };

  if (request.method === "PATCH") {
    const payload = await parseJson(request);
    const quoteId = typeof payload.quoteId === "string" ? payload.quoteId.trim() : "";
    const approvalRequestId =
      typeof payload.approvalRequestId === "string" ? payload.approvalRequestId.trim() : "";
    const status = normalizeStatus(
      typeof payload.status === "string" ? payload.status : "pending_approval",
    );
    const reviewNotes = typeof payload.reviewNotes === "string" ? payload.reviewNotes.trim() : "";
    const origin = typeof payload.origin === "string" ? payload.origin.trim() : "";
    const destination = typeof payload.destination === "string" ? payload.destination.trim() : "";
    const equipmentType =
      typeof payload.equipmentType === "string" ? payload.equipmentType.trim() : "";
    const commodity = typeof payload.commodity === "string" ? payload.commodity.trim() : "";
    const customerRate = Number(payload.customerRate ?? 0);
    const carrierCost = Number(payload.carrierCost ?? 0);
    const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";
    const customerId = typeof payload.customerId === "string" ? payload.customerId.trim() : "";

    if (!quoteId) {
      throw new Error("quoteId is required");
    }

    await connectDb();

    // First, check if this is an existing approval request we need to update
    if (approvalRequestId) {
      const approvalRequest = await ApprovalRequest.findById(
        new mongoose.Types.ObjectId(approvalRequestId),
      ).exec();
      if (approvalRequest && approvalRequest.module === "quotes") {
        if (approvalRequest.requestedBy.toString() !== user.id) {
          throw new Error("Only the original requester can update this approval request");
        }

        // Update the approval request's newValues
        const newValues: any = {
          ...approvalRequest.newValues,
        };
        if (origin) newValues.lane = { ...newValues.lane, origin };
        if (destination) newValues.lane = { ...newValues.lane, destination };
        if (equipmentType) newValues.equipmentType = equipmentType;
        if (commodity) newValues.commodity = commodity;
        if (!Number.isNaN(customerRate)) newValues.customerRate = customerRate;
        if (!Number.isNaN(carrierCost)) newValues.carrierCost = carrierCost;
        if (notes) newValues.notes = notes;
        if (customerId) {
          newValues.customerId = new mongoose.Types.ObjectId(customerId);
        } else if (payload.customerId === null) {
          newValues.customerId = undefined;
        }
        newValues.status = "pending_approval"; // Reset to pending

        approvalRequest.newValues = newValues;
        approvalRequest.status = "pending"; // Reset to pending
        approvalRequest.auditHistory.push({
          action: "request_updated",
          performedBy: new mongoose.Types.ObjectId(user.id),
          performedByName: user.name,
          at: new Date(),
        });

        await approvalRequest.save();
        const { agentMap, customerMap, customers } = await getMaps();

        // Return the updated pending quote
        return jsonResponse({
          quote: mapPendingQuote(
            approvalRequest,
            approvalRequest.recordId?.toString() || approvalRequest._id.toString(),
            user,
            agentMap,
            customerMap,
          ),
          customers: customers.map((c) => ({ id: c._id.toString(), company: c.companyName })),
        });
      }
    }

    // Otherwise, update existing quote
    const quote = await QuoteRequest.findById(new mongoose.Types.ObjectId(quoteId)).exec();

    if (!quote) {
      throw new Error("Quote request not found");
    }

    if (
      quote.agentId?.toString() !== user.id &&
      user.role !== "admin" &&
      user.role !== "ops_manager"
    ) {
      throw new Error("Not authorized to edit this quote");
    }

    quote.status = status;
    quote.reviewNotes = reviewNotes;
    quote.reviewedBy = new mongoose.Types.ObjectId(user.id);
    quote.reviewedAt = new Date();
    if (origin) quote.lane.origin = origin;
    if (destination) quote.lane.destination = destination;
    if (equipmentType) quote.equipmentType = equipmentType;
    if (commodity) quote.commodity = commodity;
    if (!Number.isNaN(customerRate)) quote.customerRate = customerRate;
    if (!Number.isNaN(carrierCost)) quote.carrierCost = carrierCost;
    if (notes) quote.notes = notes;
    if (customerId) {
      quote.customerId = new mongoose.Types.ObjectId(customerId);
    } else if (payload.customerId === null) {
      quote.customerId = undefined;
    }

    const updated = await quote.save();
    const { agentMap, customerMap, customers } = await getMaps();

    // Notify the quote's agent about status change (approved/rejected/changes_requested)
    if (
      (status === "approved" || status === "rejected" || status === "changes_requested") &&
      quote.agentId &&
      quote.agentId.toString() !== user.id
    ) {
      const sender: SenderContext = {
        userId: user.id,
        name: user.name,
        role: user.role,
        teamId: user.teamId,
      };
      const quoteIdStr = quote._id.toString();
      const actionUrl = `/quotes?focus=${quoteIdStr}`;
      const notificationType =
        status === "approved"
          ? "quote_approved"
          : status === "rejected"
            ? "quote_rejected"
            : "changes_requested";
      const title =
        status === "approved"
          ? "Your quote has been approved"
          : status === "rejected"
            ? "Your quote has been rejected"
            : "Changes requested on your quote";
      const message =
        status === "approved"
          ? `Your quote for ${origin || destination ? `${origin} → ${destination}` : "a lane"} has been approved.`
          : status === "rejected"
            ? `Your quote has been rejected. ${reviewNotes ? `Reason: ${reviewNotes}` : ""}`
            : `Changes have been requested on your quote. ${reviewNotes ? `Notes: ${reviewNotes}` : ""}`;
      void notifyUser(
        quote.agentId.toString(),
        {
          title,
          message,
          notificationType,
          relatedModule: "quotes",
          recordType: "QuoteRequest",
          recordId: quoteIdStr,
          actionUrl,
          priority: status === "approved" ? "low" : "high",
          metadata: { status, reviewNotes },
        },
        sender,
      );
    }

    return jsonResponse({
      quote: mapQuote(updated, user, agentMap, customerMap),
      customers: customers.map((c) => ({ id: c._id.toString(), company: c.companyName })),
    });
  }

  if (request.method === "POST") {
    const payload = await parseJson(request);
    const origin = typeof payload.origin === "string" ? payload.origin.trim() : "";
    const destination = typeof payload.destination === "string" ? payload.destination.trim() : "";
    const equipmentType =
      typeof payload.equipmentType === "string" ? payload.equipmentType.trim() : "";
    const commodity = typeof payload.commodity === "string" ? payload.commodity.trim() : "";
    const customerRate = Number(payload.customerRate ?? 0);
    const carrierCost = Number(payload.carrierCost ?? 0);
    const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";
    const status = normalizeStatus(
      typeof payload.status === "string" ? payload.status : "pending_approval",
    );
    const customerId = typeof payload.customerId === "string" ? payload.customerId.trim() : "";

    if (!origin || !destination || !equipmentType || !commodity) {
      throw new Error("origin, destination, equipmentType, and commodity are required");
    }

    await connectDb();
    const userRole = user.role as Role;
    if (ROLES_THAT_NEED_APPROVAL.includes(userRole)) {
      // Create approval request instead of directly saving
      const newQuoteId = new mongoose.Types.ObjectId();
      const newValues: any = {
        agentId: new mongoose.Types.ObjectId(user.id),
        lane: { origin, destination },
        equipmentType,
        commodity,
        customerRate,
        carrierCost,
        notes,
        status: "pending_approval",
      };
      if (customerId) {
        newValues.customerId = new mongoose.Types.ObjectId(customerId);
      }
      const approvalRequest = await ApprovalRequest.create({
        module: "quotes",
        recordId: newQuoteId,
        actionType: "create",
        requestedBy: new mongoose.Types.ObjectId(user.id),
        requestedByName: user.name,
        teamId: user.teamId ? new mongoose.Types.ObjectId(user.teamId) : undefined,
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
      const { agentMap, customerMap, customers } = await getMaps();

      // Notify approvers about the new quote submission
      const sender: SenderContext = {
        userId: user.id,
        name: user.name,
        role: user.role,
        teamId: user.teamId,
      };
      const quoteIdStr = newQuoteId.toString();
      const actionUrl = `/quotes?focus=${quoteIdStr}`;
      void notifyApprovers(
        {
          title: "New quote submitted for approval",
          message: `${user.name} submitted a quote for ${origin} → ${destination}.`,
          notificationType: "quote_submitted",
          relatedModule: "quotes",
          recordType: "QuoteRequest",
          recordId: quoteIdStr,
          actionUrl,
          priority: "medium",
          metadata: { origin, destination, equipmentType, customerRate, carrierCost },
        },
        { teamId: user.teamId, excludeUserId: user.id, sender },
      );
      // Notify the submitter (confirmation)
      void notifyUser(
        user.id,
        {
          title: "Quote submitted",
          message: `Your quote for ${origin} → ${destination} has been submitted and is awaiting approval.`,
          notificationType: "quote_submitted",
          relatedModule: "quotes",
          recordType: "QuoteRequest",
          recordId: quoteIdStr,
          actionUrl,
          priority: "low",
        },
        sender,
      );

      // Return both approval request and quote object
      return jsonResponse({
        approvalRequest: { id: approvalRequest._id.toString() },
        quote: mapPendingQuote(approvalRequest as any, newQuoteId as any, user as any, agentMap, customerMap),
        customers: customers.map((c) => ({ id: c._id.toString(), company: c.companyName })),
      });
    } else {
      // Save directly
      const createData: any = {
        agentId: new mongoose.Types.ObjectId(user.id),
        lane: { origin, destination },
        equipmentType,
        commodity,
        customerRate,
        carrierCost,
        notes,
        status,
      };
      if (customerId) {
        createData.customerId = new mongoose.Types.ObjectId(customerId);
      }
      const created = await QuoteRequest.create(createData);
      const { agentMap, customerMap, customers } = await getMaps();

      // Notify the agent (if different from actor) about the quote created on their behalf
      if (created.agentId && created.agentId.toString() !== user.id) {
        const sender: SenderContext = {
          userId: user.id,
          name: user.name,
          role: user.role,
          teamId: user.teamId,
        };
        const quoteIdStr = created._id.toString();
        void notifyUser(
          created.agentId.toString(),
          {
            title: "A quote has been created on your behalf",
            message: `${user.name} created a quote for ${origin} → ${destination} on your behalf.`,
            notificationType: "quote_created_for_you",
            relatedModule: "quotes",
            recordType: "QuoteRequest",
            recordId: quoteIdStr,
            actionUrl: `/quotes?focus=${quoteIdStr}`,
            priority: "low",
          },
          sender,
        );
      }

      return jsonResponse({
        quote: mapQuote(created, user, agentMap, customerMap),
        customers: customers.map((c) => ({ id: c._id.toString(), company: c.companyName })),
      });
    }
  }

  await connectDb();

  const scope =
    user.role === "agent" || user.role === "trainee"
      ? { agentId: new mongoose.Types.ObjectId(user.id) }
      : {};

  // Fetch pending approval requests for quotes module
  let approvalRequests: any[] = [];
  try {
    let approvalScope: any = {
      module: "quotes",
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
    console.error("Error fetching quote approval requests:", err);
  }

  const [quotes, agents, customers] = await Promise.all([
    QuoteRequest.find(scope).sort({ createdAt: -1 }).lean().exec() as Promise<
      Array<{
        _id: mongoose.Types.ObjectId;
        agentId?: mongoose.Types.ObjectId;
        customerId?: mongoose.Types.ObjectId;
        lane?: { origin: string; destination: string };
        equipmentType?: string;
        commodity?: string;
        customerRate?: number;
        carrierCost?: number;
        marginAmount?: number;
        marginPercent?: number;
        notes?: string;
        status?: string;
        reviewNotes?: string;
        reviewedBy?: mongoose.Types.ObjectId;
        reviewedAt?: Date;
        createdAt: Date;
      }>
    >,
    User.find({ role: { $in: ["admin", "ops_manager", "team_manager", "agent"] } })
      .select("_id name role")
      .lean()
      .exec() as Promise<Array<{ _id: mongoose.Types.ObjectId; name: string; role: string }>>,
    Customer.find({}).select("_id companyName").lean().exec() as Promise<
      Array<{ _id: mongoose.Types.ObjectId; companyName: string }>
    >,
  ]);

  const agentMap = Object.fromEntries(
    agents.map((agentRecord) => [agentRecord._id.toString(), agentRecord.name]),
  );
  const customerMap = Object.fromEntries(
    customers.map((customerRecord) => [customerRecord._id.toString(), customerRecord.companyName]),
  );

  // Convert existing quotes to response format
  const existingQuotes = quotes.map((quote) => ({
    ...mapQuote(quote as any, user, agentMap, customerMap),
    pendingApproval: false,
  }));

  // Convert pending approval requests to quote format
  const pendingQuotes = approvalRequests.map((approvalRequest) => {
    const quoteId = approvalRequest.recordId?.toString() || approvalRequest._id.toString();
    return {
      ...mapPendingQuote(approvalRequest, quoteId, user, agentMap, customerMap),
      pendingApproval: true,
    };
  });

  // Combine and sort
  const allQuotes = [...pendingQuotes, ...existingQuotes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return jsonResponse({
    quotes: allQuotes,
    customers: customers.map((c) => ({ id: c._id.toString(), company: c.companyName })),
  });
}

function mapQuote(
  quote: any,
  user: { id: string; name: string },
  agentMap?: Record<string, string>,
  customerMap?: Record<string, string>,
) {
  const customerId = quote.customerId?.toString();
  return {
    id: quote._id?.toString() ?? quote.id,
    customerId: customerId ?? "",
    customerName: (customerId && customerMap?.[customerId]) ?? "",
    origin: quote.lane?.origin ?? "",
    destination: quote.lane?.destination ?? "",
    equipment: quote.equipmentType ?? "",
    commodity: quote.commodity ?? "",
    weight: quote.weight ?? 0,
    pickupDate:
      quote.pickupDate ??
      (quote.createdAt ? quote.createdAt.toISOString() : new Date().toISOString()),
    customerRate: quote.customerRate ?? 0,
    carrierEstimate: quote.carrierCost ?? 0,
    status: normalizeStatus(quote.status ?? "pending_approval"),
    agentId: quote.agentId?.toString() ?? user.id,
    agentName: quote.agentId ? (agentMap?.[quote.agentId.toString()] ?? "Unassigned") : user.name,
    notes: quote.notes ?? "",
    reviewNotes: quote.reviewNotes ?? "",
    comments: quote.reviewNotes
      ? [
          {
            by: user.name,
            at: (quote.reviewedAt ?? quote.createdAt ?? new Date()).toISOString(),
            body: quote.reviewNotes,
          },
        ]
      : [],
    createdAt: (quote.createdAt ?? new Date()).toISOString(),
  };
}

function mapPendingQuote(
  approvalRequest: any,
  quoteId: string,
  user: { id: string; name: string },
  agentMap?: Record<string, string>,
  customerMap?: Record<string, string>,
) {
  const newValues = approvalRequest.newValues ?? {};
  const customerId = newValues.customerId?.toString();
  
  // Convert approval comments to the format expected by the frontend
  const comments = (approvalRequest.comments || []).map((comment: any) => ({
    by: comment.userName,
    at: comment.createdAt?.toISOString() || new Date().toISOString(),
    body: comment.text,
  }));

  return {
    id: quoteId,
    customerId: customerId ?? "",
    customerName: (customerId && customerMap?.[customerId]) ?? "",
    origin: newValues.lane?.origin ?? "",
    destination: newValues.lane?.destination ?? "",
    equipment: newValues.equipmentType ?? "",
    commodity: newValues.commodity ?? "",
    weight: newValues.weight ?? 0,
    pickupDate:
      newValues.pickupDate ??
      (approvalRequest.createdAt
        ? approvalRequest.createdAt.toISOString()
        : new Date().toISOString()),
    customerRate: newValues.customerRate ?? 0,
    carrierEstimate: newValues.carrierCost ?? 0,
    status: normalizeStatus(newValues.status ?? "pending_approval"),
    agentId: approvalRequest.requestedBy?.toString() ?? user.id,
    agentName: approvalRequest.requestedByName ?? user.name,
    notes: newValues.notes ?? "",
    reviewNotes: "",
    comments,
    createdAt: (approvalRequest.createdAt ?? new Date()).toISOString(),
    pendingApproval: true,
    requestedBy: approvalRequest.requestedByName,
    approvalRequestId: approvalRequest._id.toString(),
    approvalStatus: approvalRequest.status,
  };
}
