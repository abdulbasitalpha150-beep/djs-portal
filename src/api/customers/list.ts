import mongoose from "mongoose";
import { connectDb } from "../../lib/db";
import { getSessionUserFromRequest, requireAuth } from "../../lib/auth";
import { jsonResponse, parseJson } from "../../lib/api";
import { Customer } from "../../models/customer";
import { User } from "../../models/user";
import { ApprovalRequest } from "../../models/approvalRequest";
import type { Role } from "../../lib/roles";
import {
  notifyApprovers,
  notifyUser,
  notifyAdmins,
  notifyTeamManager,
  notifyLeadAgents,
  type SenderContext,
} from "../../lib/notification";

const ROLES_THAT_NEED_APPROVAL: Role[] = ["agent", "trainee"];

function normalizeCreditStatus(status: string) {
  const normalized = status.toLowerCase();
  switch (normalized) {
    case "approved":
    case "rejected":
      return normalized;
    default:
      return "pending";
  }
}

function normalizeStatus(status: string) {
  const normalized = status.toLowerCase();
  switch (normalized) {
    case "review":
    case "approved":
    case "rejected":
      return normalized;
    default:
      return "submitted";
  }
}

async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export async function customersListHandler(request: Request) {
  const user = requireAuth(await getSessionUserFromRequest(request));

  if (request.method === "DELETE") {
    const payload = await readJsonBody(request);
    const customerId = typeof payload.customerId === "string" ? payload.customerId.trim() : "";

    if (!customerId) {
      throw new Error("customerId is required");
    }

    await connectDb();
    const customer = await Customer.findById(new mongoose.Types.ObjectId(customerId)).exec();

    if (!customer) {
      throw new Error("Customer not found");
    }

    if (
      customer.agentId?.toString() !== user.id &&
      user.role !== "admin" &&
      user.role !== "ops_manager"
    ) {
      throw new Error("Not authorized to delete this customer");
    }

    await Customer.deleteOne({ _id: customer._id }).exec();

    return jsonResponse({ deletedId: customerId });
  }

  if (request.method === "PATCH") {
    const payload = await parseJson(request);
    const customerId = typeof payload.customerId === "string" ? payload.customerId.trim() : "";
    const approvalRequestId =
      typeof payload.approvalRequestId === "string" ? payload.approvalRequestId.trim() : "";
    const companyName = typeof payload.companyName === "string" ? payload.companyName.trim() : "";
    const contactName = typeof payload.contactName === "string" ? payload.contactName.trim() : "";
    const contactEmail =
      typeof payload.contactEmail === "string" ? payload.contactEmail.trim() : "";
    const contactPhone =
      typeof payload.contactPhone === "string" ? payload.contactPhone.trim() : "";
    const creditLimit = Number(payload.creditLimit ?? 0);
    const creditStatus = normalizeCreditStatus(
      typeof payload.creditStatus === "string" ? payload.creditStatus : "pending",
    );
    const status = normalizeStatus(
      typeof payload.status === "string" ? payload.status : "submitted",
    );
    const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";
    const shippingNotes =
      typeof payload.shippingNotes === "string" ? payload.shippingNotes.trim() : "";

    if (!customerId) {
      throw new Error("customerId is required");
    }

    await connectDb();

    // First, check if this is an existing approval request we need to update
    if (approvalRequestId) {
      const approvalRequest = await ApprovalRequest.findById(
        new mongoose.Types.ObjectId(approvalRequestId),
      ).exec();
      if (approvalRequest && approvalRequest.module === "customers") {
        if (approvalRequest.requestedBy.toString() !== user.id) {
          throw new Error("Only the original requester can update this approval request");
        }

        // Update the approval request's newValues
        const newValues = {
          ...approvalRequest.newValues,
          ...(companyName && { companyName }),
          ...(contactName && { contactName }),
          ...(contactEmail && { contactEmail }),
          ...(contactPhone && { contactPhone }),
          ...(!Number.isNaN(creditLimit) && { creditLimit }),
          ...(creditStatus && { creditStatus }),
          ...(status && { status }),
          ...(notes && { notes }),
          ...(shippingNotes && { shippingNotes }),
        };

        approvalRequest.newValues = newValues;
        approvalRequest.status = "pending"; // Reset to pending
        approvalRequest.auditHistory.push({
          action: "request_updated",
          performedBy: new mongoose.Types.ObjectId(user.id),
          performedByName: user.name,
          at: new Date(),
        });

        await approvalRequest.save();

        // Return the updated pending customer
        return jsonResponse({
          customer: {
            id: approvalRequest.recordId?.toString() || approvalRequest._id.toString(),
            company: newValues.companyName,
            contact: newValues.contactName,
            email: newValues.contactEmail ?? "",
            phone: newValues.contactPhone ?? "",
            creditLimit: newValues.creditLimit ?? 0,
            creditStatus: normalizeCreditStatus(newValues.creditStatus ?? "pending"),
            status: normalizeStatus(newValues.status ?? "submitted"),
            agentId: approvalRequest.requestedBy.toString(),
            agentName: approvalRequest.requestedByName,
            notes: newValues.notes ?? "",
            shippingNotes: newValues.shippingNotes ?? "",
            createdAt: approvalRequest.createdAt.toISOString(),
            pendingApproval: true,
            requestedBy: approvalRequest.requestedByName,
            approvalRequestId: approvalRequest._id.toString(),
            approvalStatus: approvalRequest.status,
            approvalComments: approvalRequest.comments,
          },
        });
      }
    }

    // Otherwise, update existing customer
    const customer = await Customer.findById(new mongoose.Types.ObjectId(customerId)).exec();

    if (!customer) {
      throw new Error("Customer not found");
    }

    if (
      customer.agentId?.toString() !== user.id &&
      user.role !== "admin" &&
      user.role !== "ops_manager"
    ) {
      throw new Error("Not authorized to edit this customer");
    }

    const userRole = user.role as Role;
    if (ROLES_THAT_NEED_APPROVAL.includes(userRole)) {
      // Create approval request for edit
      const previousValues = {
        companyName: customer.companyName,
        contactName: customer.contactName,
        contactEmail: customer.contactEmail,
        contactPhone: customer.contactPhone,
        creditLimit: customer.creditLimit,
        creditStatus: customer.creditStatus,
        status: customer.status,
        notes: customer.notes,
        shippingNotes: customer.shippingNotes,
      };

      const newValues = {
        ...previousValues,
        ...(companyName && { companyName }),
        ...(contactName && { contactName }),
        ...(contactEmail && { contactEmail }),
        ...(contactPhone && { contactPhone }),
        ...(!Number.isNaN(creditLimit) && { creditLimit }),
        ...(creditStatus && { creditStatus }),
        ...(status && { status }),
        ...(notes && { notes }),
        ...(shippingNotes && { shippingNotes }),
      };

      const approvalRequest = await ApprovalRequest.create({
        module: "customers",
        recordId: customer._id,
        actionType: "edit",
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
        approvalRequest: { id: approvalRequest._id.toString() },
        customer: {
          id: customer._id.toString(),
          company: customer.companyName,
          contact: customer.contactName,
          email: customer.contactEmail ?? "",
          phone: customer.contactPhone ?? "",
          creditLimit: customer.creditLimit ?? 0,
          creditStatus: customer.creditStatus,
          status: customer.status,
          agentId: customer.agentId.toString(),
          agentName: user.name,
          notes: customer.notes ?? "",
          shippingNotes: customer.shippingNotes ?? "",
          createdAt: customer.createdAt.toISOString(),
          pendingApproval: true,
          requestedBy: user.name,
          approvalRequestId: approvalRequest._id.toString(),
          approvalStatus: approvalRequest.status,
          approvalComments: approvalRequest.comments,
        },
      });
    }

    // User doesn't need approval, update directly
    if (companyName) customer.companyName = companyName;
    if (contactName) customer.contactName = contactName;
    if (contactEmail) customer.contactEmail = contactEmail;
    if (contactPhone) customer.contactPhone = contactPhone;
    if (!Number.isNaN(creditLimit)) customer.creditLimit = creditLimit;
    const prevCustomerStatus = customer.status;
    customer.creditStatus = creditStatus;
    customer.status = status;
    if (notes) customer.notes = notes;
    if (shippingNotes) customer.shippingNotes = shippingNotes;

    const updated = await customer.save();

    // Emit customer status change notifications
    if (
      (status === "approved" || status === "rejected") &&
      status !== prevCustomerStatus
    ) {
      const sender: SenderContext = {
        userId: user.id,
        name: user.name,
        role: user.role,
        teamId: user.teamId,
      };
      const actionUrl = `/customers?focus=${customerId}`;
      const notificationType =
        status === "approved" ? "customer_approved" : "customer_rejected";
      const title =
        status === "approved" ? "Customer approved" : "Customer rejected";
      const message = `${user.name} ${status === "approved" ? "approved" : "rejected"} customer "${customer.companyName}".`;

      if (customer.agentId && customer.agentId.toString() !== user.id) {
        void notifyUser(
          customer.agentId.toString(),
          {
            title:
              status === "approved"
                ? "Your customer has been approved"
                : "Your customer has been rejected",
            message:
              status === "approved"
                ? `Your customer "${customer.companyName}" has been approved.`
                : `Your customer "${customer.companyName}" has been rejected.`,
            notificationType,
            relatedModule: "customers",
            recordType: "Customer",
            recordId: customerId,
            actionUrl,
            priority: status === "approved" ? "low" : "high",
            metadata: { status },
          },
          sender,
        );
      }

      void notifyAdmins(
        { title, message, notificationType, relatedModule: "customers", recordType: "Customer", recordId: customerId, actionUrl, priority: "low", metadata: { status } },
        sender,
      );

      if (customer.agentId) {
        try {
          const agent = (await User.findById(customer.agentId)
            .select("teamId")
            .lean()
            .exec()) as { teamId?: mongoose.Types.ObjectId } | null;
          if (agent?.teamId) {
            const agentTeamId = agent.teamId.toString();
            void notifyTeamManager(agentTeamId, { title, message, notificationType, relatedModule: "customers", recordType: "Customer", recordId: customerId, actionUrl, priority: "low", metadata: { status } }, sender);
            void notifyLeadAgents(agentTeamId, { title, message, notificationType, relatedModule: "customers", recordType: "Customer", recordId: customerId, actionUrl, priority: "low", metadata: { status } }, sender);
          }
        } catch (e) {
          console.error("[notification] customer status team lookup failed:", e);
        }
      }
    }

    return jsonResponse({ customer: mapCustomer(updated, user) });
  }

  if (request.method === "POST") {
    const payload = await parseJson(request);
    const companyName = typeof payload.companyName === "string" ? payload.companyName.trim() : "";
    const contactName = typeof payload.contactName === "string" ? payload.contactName.trim() : "";
    const contactEmail =
      typeof payload.contactEmail === "string" ? payload.contactEmail.trim() : "";
    const contactPhone =
      typeof payload.contactPhone === "string" ? payload.contactPhone.trim() : "";
    const creditLimit = Number(payload.creditLimit ?? 0);
    const creditStatus = normalizeCreditStatus(
      typeof payload.creditStatus === "string" ? payload.creditStatus : "pending",
    );
    const status = normalizeStatus(
      typeof payload.status === "string" ? payload.status : "submitted",
    );
    const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";
    const shippingNotes =
      typeof payload.shippingNotes === "string" ? payload.shippingNotes.trim() : "";

    if (!companyName || !contactName) {
      throw new Error("companyName and contactName are required");
    }

    await connectDb();
    const userRole = user.role as Role;
    if (ROLES_THAT_NEED_APPROVAL.includes(userRole)) {
      // Create approval request instead of directly saving
      const newCustomerId = new mongoose.Types.ObjectId();
      const approvalRequest = await ApprovalRequest.create({
        module: "customers",
        recordId: newCustomerId,
        actionType: "create",
        requestedBy: new mongoose.Types.ObjectId(user.id),
        requestedByName: user.name,
        teamId: user.teamId ? new mongoose.Types.ObjectId(user.teamId) : undefined,
        newValues: {
          agentId: new mongoose.Types.ObjectId(user.id),
          companyName,
          contactName,
          contactPhone,
          contactEmail,
          creditLimit: Number.isNaN(creditLimit) ? 0 : creditLimit,
          creditStatus,
          status,
          notes,
          shippingNotes,
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

      // Notify approvers about the new customer submission
      const submitSender: SenderContext = {
        userId: user.id,
        name: user.name,
        role: user.role,
        teamId: user.teamId,
      };
      void notifyApprovers(
        {
          title: "New customer submission pending approval",
          message: `${user.name} submitted customer "${companyName}" for approval.`,
          notificationType: "customer_submitted",
          relatedModule: "customers",
          recordType: "Customer",
          recordId: newCustomerId.toString(),
          actionUrl: `/customers?focus=${newCustomerId.toString()}`,
          priority: "medium",
          metadata: { companyName, contactName },
        },
        { teamId: user.teamId, excludeUserId: user.id, sender: submitSender },
      );

      // Return both approval request and customer object
      return jsonResponse({
        approvalRequest: { id: approvalRequest._id.toString() },
        customer: {
          id: newCustomerId.toString(),
          company: companyName,
          contact: contactName,
          email: contactEmail ?? "",
          phone: contactPhone ?? "",
          creditLimit: Number.isNaN(creditLimit) ? 0 : creditLimit,
          creditStatus,
          status,
          agentId: user.id,
          agentName: user.name,
          notes: notes ?? "",
          shippingNotes: shippingNotes ?? "",
          createdAt: new Date().toISOString(),
          pendingApproval: true,
          requestedBy: user.name,
        },
      });
    } else {
      const created = await Customer.create({
        agentId: new mongoose.Types.ObjectId(user.id),
        companyName,
        contactName,
        contactPhone,
        contactEmail,
        creditLimit: Number.isNaN(creditLimit) ? 0 : creditLimit,
        creditStatus,
        status,
        notes,
        shippingNotes,
      });

      // Notify admins about the new customer
      const createSender: SenderContext = {
        userId: user.id,
        name: user.name,
        role: user.role,
        teamId: user.teamId,
      };
      const createdId = created._id.toString();
      void notifyAdmins(
        {
          title: "New customer created",
          message: `${user.name} created customer "${companyName}".`,
          notificationType: "customer_created",
          relatedModule: "customers",
          recordType: "Customer",
          recordId: createdId,
          actionUrl: `/customers?focus=${createdId}`,
          priority: "low",
          metadata: { companyName, contactName },
        },
        createSender,
      );

      return jsonResponse({ customer: mapCustomer(created, user) });
    }
  }

  await connectDb();

  const scope =
    user.role === "agent" || user.role === "trainee"
      ? { agentId: new mongoose.Types.ObjectId(user.id) }
      : {};

  // Fetch pending approval requests for customers module
  let approvalRequests: any[] = [];
  try {
    let approvalScope: any = {
      module: "customers",
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
    console.error("Error fetching customer approval requests:", err);
  }

  const [customers, agents] = await Promise.all([
    Customer.find(scope).sort({ updatedAt: -1 }).lean().exec() as Promise<
      Array<{
        _id: mongoose.Types.ObjectId;
        agentId?: mongoose.Types.ObjectId;
        companyName: string;
        contactName: string;
        contactPhone?: string;
        contactEmail?: string;
        creditLimit?: number;
        creditStatus?: string;
        status?: string;
        notes?: string;
        shippingNotes?: string;
        createdAt: Date;
        updatedAt: Date;
      }>
    >,
    User.find({ role: { $in: ["admin", "ops_manager", "team_manager", "agent"] } })
      .select("_id name role")
      .lean()
      .exec() as Promise<Array<{ _id: mongoose.Types.ObjectId; name: string; role: string }>>,
  ]);

  const agentMap = Object.fromEntries(
    agents.map((agentRecord) => [agentRecord._id.toString(), agentRecord.name]),
  );

  // Convert existing customers to response format
  const existingCustomers = customers.map((customer) => {
    const mapped = mapCustomer(customer as any, user, agentMap);
    return { ...mapped, pendingApproval: false };
  });

  // Convert pending approval requests to customer format
  const pendingCustomerRequests = approvalRequests.map((req) => {
    const newValues = req.newValues as any;
    const customerId = req.recordId?.toString() ?? req._id.toString();
    return {
      id: customerId,
      company: newValues.companyName,
      contact: newValues.contactName,
      email: newValues.contactEmail ?? "",
      phone: newValues.contactPhone ?? "",
      creditLimit: newValues.creditLimit ?? 0,
      creditStatus: normalizeCreditStatus(newValues.creditStatus ?? "pending"),
      status: normalizeStatus(newValues.status ?? "submitted"),
      agentId: req.requestedBy?.toString() ?? user.id,
      agentName: req.requestedByName ?? user.name,
      notes: newValues.notes ?? "",
      shippingNotes: newValues.shippingNotes ?? "",
      createdAt: req.createdAt.toISOString(),
      pendingApproval: true,
      requestedBy: req.requestedByName,
      approvalRequestId: req._id.toString(),
      approvalStatus: req.status,
      approvalComments: req.comments,
    };
  });

  // Combine and sort
  const combinedCustomers = [...pendingCustomerRequests, ...existingCustomers].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return jsonResponse({ customers: combinedCustomers });
}

function mapCustomer(
  customer: any,
  user: { id: string; name: string },
  agentMap?: Record<string, string>,
) {
  return {
    id: customer._id?.toString() ?? customer.id,
    company: customer.companyName ?? customer.company,
    contact: customer.contactName ?? customer.contact,
    email: customer.contactEmail ?? "",
    phone: customer.contactPhone ?? "",
    creditLimit: customer.creditLimit ?? 0,
    creditStatus: normalizeCreditStatus(customer.creditStatus ?? "pending"),
    status: normalizeStatus(customer.status ?? "submitted"),
    agentId: customer.agentId?.toString() ?? user.id,
    agentName: customer.agentId
      ? (agentMap?.[customer.agentId.toString()] ?? "Unassigned")
      : user.name,
    notes: customer.notes ?? "",
    shippingNotes: customer.shippingNotes ?? "",
    createdAt: (customer.createdAt ?? new Date()).toISOString(),
  };
}
