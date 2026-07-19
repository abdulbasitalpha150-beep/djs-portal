// @ts-nocheck
import mongoose from "mongoose";
import { connectDb } from "../../lib/db";
import { getSessionUserFromRequest, requireAuth } from "../../lib/auth";
import { jsonResponse, parseJson } from "../../lib/api";
import { Load } from "../../models/load";
import { Carrier } from "../../models/carrier";
import { Customer } from "../../models/customer";
import { User } from "../../models/user";
import { can } from "../../lib/roles";
import { ApprovalRequest } from "../../models/approvalRequest";
import { doesUserNeedApproval } from "../approvals";
import {
  notifyApprovers,
  notifyUser,
  notifyAdmins,
  notifyAccounting,
  notifyTeamManager,
  notifyLeadAgents,
  type SenderContext,
} from "../../lib/notification";

function calculateFinancials(
  customerRate: number = 0,
  carrierCost: number = 0,
  accessorialCharges: number = 0,
) {
  const revenue = customerRate + accessorialCharges;
  const grossMargin = revenue > carrierCost ? revenue - carrierCost : 0;
  const marginPercent = revenue > 0 ? Math.round((grossMargin / revenue) * 10000) / 100 : 0;

  return {
    revenue,
    grossMargin,
    marginPercent,
  };
}

function ensureObjectId(value: string, fieldName: string): mongoose.Types.ObjectId {
  if (!mongoose.isValidObjectId(value)) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return new mongoose.Types.ObjectId(value);
}

async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function mapLoad(
  load: any,
  userMap: Record<string, string>,
  customerMap: Record<string, any>,
  carrierMap: Record<string, any>,
) {
  const customerIdStr = load.customerId?.toString();
  const carrierIdStr = load.carrierId?.toString();
  const agentIdStr = load.agentId?.toString();

  return {
    id: load._id.toString(),
    ref: load.loadNumber,
    loadNumber: load.loadNumber,
    customerReference: load.customerReference,
    status: load.status,
    statusHistory: (load.statusHistory ?? []).map((h: any) => ({
      status: h.status,
      changedBy: userMap[h.changedBy?.toString()] || "System",
      at: h.changedAt?.toISOString() ?? load.createdAt.toISOString(),
    })),
    customerId: customerIdStr,
    customerName: customerMap[customerIdStr]?.companyName || "Unknown Customer",
    customer: customerMap[customerIdStr],
    carrierId: carrierIdStr,
    carrierName: carrierMap[carrierIdStr]?.legalName || "Unknown Carrier",
    carrier: carrierMap[carrierIdStr],
    agentId: agentIdStr,
    agentName: userMap[agentIdStr] || "Unknown Agent",
    pickupCompany: load.pickupCompany,
    pickupContact: load.pickupContact,
    pickupPhone: load.pickupPhone,
    pickupAddress: load.pickupAddress,
    pickupCity: load.pickupCity,
    pickupState: load.pickupState,
    pickupZip: load.pickupZip,
    pickupDate: load.pickupDate?.toISOString(),
    pickupTime: load.pickupTime,
    deliveryCompany: load.deliveryCompany,
    deliveryContact: load.deliveryContact,
    deliveryPhone: load.deliveryPhone,
    deliveryAddress: load.deliveryAddress,
    deliveryCity: load.deliveryCity,
    deliveryState: load.deliveryState,
    deliveryZip: load.deliveryZip,
    deliveryDate: load.deliveryDate?.toISOString(),
    deliveryTime: load.deliveryTime,
    commodity: load.commodity,
    weight: load.weight,
    pieces: load.pieces,
    pallets: load.pallets,
    equipmentType: load.equipmentType,
    trailerLength: load.trailerLength,
    loadType: load.loadType,
    temperature: load.temperature,
    hazmat: load.hazmat,
    stackable: load.stackable,
    customerRate: load.customerRate,
    carrierCost: load.carrierCost,
    accessorialCharges: load.accessorialCharges,
    revenue: load.revenue,
    grossMargin: load.grossMargin,
    marginPercent: load.marginPercent,
    invoiceStatus: load.invoiceStatus,
    paymentStatus: load.paymentStatus,
    loadedMiles: load.loadedMiles,
    deadheadMiles: load.deadheadMiles,
    documents: load.documents?.map((d: any) => ({
      kind: d.kind,
      uploaded: d.uploaded,
      uploadedAt: d.uploadedAt?.toISOString(),
    })),
    internalNotes: load.internalNotes,
    driverInstructions: load.driverInstructions,
    customerNotes: load.customerNotes,
    createdAt: load.createdAt.toISOString(),
    updatedAt: load.updatedAt.toISOString(),
  };
}

function mapPendingLoad(
  approvalRequest: any,
  loadId: string,
  user: any,
  userMap: Record<string, string>,
  customerMap: Record<string, any>,
  carrierMap: Record<string, any>,
) {
  const newValues = approvalRequest.newValues ?? {};
  const customerId = newValues.customerId?.toString();
  const carrierId = newValues.carrierId?.toString();
  const comments = (approvalRequest.comments || []).map((comment: any) => ({
    by: comment.userName,
    at: comment.createdAt?.toISOString() || new Date().toISOString(),
    body: comment.text,
  }));

  return {
    id: loadId,
    ref: newValues.loadNumber || `PENDING-${loadId.slice(0, 8)}`,
    loadNumber: newValues.loadNumber,
    customerReference: newValues.customerReference,
    status: newValues.status || "draft",
    statusHistory: [],
    customerId: customerId,
    customerName: (customerId && customerMap[customerId]?.companyName) || "",
    customer: customerMap[customerId],
    carrierId: carrierId,
    carrierName: (carrierId && carrierMap[carrierId]?.legalName) || "",
    carrier: carrierMap[carrierId],
    agentId: approvalRequest.requestedBy?.toString() || user.id,
    agentName: approvalRequest.requestedByName || user.name,
    pickupCompany: newValues.pickupCompany,
    pickupContact: newValues.pickupContact,
    pickupPhone: newValues.pickupPhone,
    pickupAddress: newValues.pickupAddress,
    pickupCity: newValues.pickupCity,
    pickupState: newValues.pickupState,
    pickupZip: newValues.pickupZip,
    pickupDate: newValues.pickupDate,
    pickupTime: newValues.pickupTime,
    deliveryCompany: newValues.deliveryCompany,
    deliveryContact: newValues.deliveryContact,
    deliveryPhone: newValues.deliveryPhone,
    deliveryAddress: newValues.deliveryAddress,
    deliveryCity: newValues.deliveryCity,
    deliveryState: newValues.deliveryState,
    deliveryZip: newValues.deliveryZip,
    deliveryDate: newValues.deliveryDate,
    deliveryTime: newValues.deliveryTime,
    commodity: newValues.commodity,
    weight: newValues.weight,
    pieces: newValues.pieces,
    pallets: newValues.pallets,
    equipmentType: newValues.equipmentType,
    trailerLength: newValues.trailerLength,
    loadType: newValues.loadType,
    temperature: newValues.temperature,
    hazmat: newValues.hazmat,
    stackable: newValues.stackable,
    customerRate: newValues.customerRate,
    carrierCost: newValues.carrierCost,
    accessorialCharges: newValues.accessorialCharges,
    revenue: newValues.revenue,
    grossMargin: newValues.grossMargin,
    marginPercent: newValues.marginPercent,
    invoiceStatus: newValues.invoiceStatus || "pending",
    paymentStatus: newValues.paymentStatus || "pending",
    loadedMiles: newValues.loadedMiles,
    deadheadMiles: newValues.deadheadMiles,
    documents: newValues.documents?.map((d: any) => ({
      kind: d.kind,
      uploaded: d.uploaded,
      uploadedAt: d.uploadedAt,
    })),
    internalNotes: newValues.internalNotes,
    driverInstructions: newValues.driverInstructions,
    customerNotes: newValues.customerNotes,
    createdAt: (approvalRequest.createdAt || new Date()).toISOString(),
    updatedAt: (approvalRequest.updatedAt || new Date()).toISOString(),
    pendingApproval: true,
    approvalRequestId: approvalRequest._id.toString(),
    approvalStatus: approvalRequest.status,
    comments,
    auditHistory: (approvalRequest.auditHistory || []).map((h: any) => ({
      action: h.action,
      performedByName: h.performedByName,
      at: h.at instanceof Date ? h.at.toISOString() : (h.at ?? new Date().toISOString()),
      notes: h.notes,
    })),
  };
}

export async function loadsListHandler(request: Request) {
  const user = requireAuth(await getSessionUserFromRequest(request));

  if (request.method === "POST") {
    if (!can(user.role as any, "booking_actions")) {
      const error = new Error("Not authorized to create loads");
      (error as any).status = 403;
      throw error;
    }

    const body = await parseJson(request);
    const {
      customerId,
      carrierId,
      loadNumber,
      customerReference,
      status = "draft",
      pickupCompany,
      pickupContact,
      pickupPhone,
      pickupAddress,
      pickupCity,
      pickupState,
      pickupZip,
      pickupDate,
      pickupTime,
      deliveryCompany,
      deliveryContact,
      deliveryPhone,
      deliveryAddress,
      deliveryCity,
      deliveryState,
      deliveryZip,
      deliveryDate,
      deliveryTime,
      commodity,
      weight,
      pieces,
      pallets,
      equipmentType,
      trailerLength,
      loadType,
      temperature,
      hazmat = false,
      stackable = false,
      customerRate = 0,
      carrierCost = 0,
      accessorialCharges = 0,
      loadedMiles,
      deadheadMiles,
      internalNotes,
      driverInstructions,
      customerNotes,
    } = body;

    if (!customerId || !carrierId) {
      throw new Error("customerId and carrierId are required");
    }

    await connectDb();

    const customerObjectId = ensureObjectId(customerId, "customerId");
    const carrierObjectId = ensureObjectId(carrierId, "carrierId");

    const customer = await Customer.findById(customerObjectId).lean().exec();
    if (!customer) {
      throw new Error("Customer not found");
    }

    const carrier = await Carrier.findById(carrierObjectId).lean().exec();
    if (!carrier) {
      throw new Error("Carrier not found");
    }

    const financials = calculateFinancials(
      Number(customerRate),
      Number(carrierCost),
      Number(accessorialCharges),
    );

    // Check if user needs approval
    if (doesUserNeedApproval(user.role as any)) {
      const tempId = new mongoose.Types.ObjectId();
      const newValues = {
        _id: tempId,
        quoteRequestId: new mongoose.Types.ObjectId(),
        agentId: new mongoose.Types.ObjectId(user.id),
        customerId: customerObjectId,
        carrierId: carrierObjectId,
        loadNumber: loadNumber || `LD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        customerReference: customerReference?.toString().trim(),
        status,
        statusHistory: [
          {
            status,
            changedBy: new mongoose.Types.ObjectId(user.id),
            changedAt: new Date(),
          },
        ],
        pickupCompany: pickupCompany?.toString().trim(),
        pickupContact: pickupContact?.toString().trim(),
        pickupPhone: pickupPhone?.toString().trim(),
        pickupAddress: pickupAddress?.toString().trim(),
        pickupCity: pickupCity?.toString().trim(),
        pickupState: pickupState?.toString().trim(),
        pickupZip: pickupZip?.toString().trim(),
        pickupDate: pickupDate ? new Date(pickupDate) : undefined,
        pickupTime: pickupTime?.toString().trim(),
        deliveryCompany: deliveryCompany?.toString().trim(),
        deliveryContact: deliveryContact?.toString().trim(),
        deliveryPhone: deliveryPhone?.toString().trim(),
        deliveryAddress: deliveryAddress?.toString().trim(),
        deliveryCity: deliveryCity?.toString().trim(),
        deliveryState: deliveryState?.toString().trim(),
        deliveryZip: deliveryZip?.toString().trim(),
        deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
        deliveryTime: deliveryTime?.toString().trim(),
        commodity: commodity?.toString().trim(),
        weight: weight ? Number(weight) : undefined,
        pieces: pieces ? Number(pieces) : undefined,
        pallets: pallets ? Number(pallets) : undefined,
        equipmentType: equipmentType?.toString().trim(),
        trailerLength: trailerLength ? Number(trailerLength) : undefined,
        loadType: loadType?.toString().trim(),
        temperature: temperature ? Number(temperature) : undefined,
        hazmat: Boolean(hazmat),
        stackable: Boolean(stackable),
        customerRate: Number(customerRate),
        carrierCost: Number(carrierCost),
        accessorialCharges: Number(accessorialCharges),
        revenue: financials.revenue,
        grossMargin: financials.grossMargin,
        marginPercent: financials.marginPercent,
        invoiceStatus: "pending",
        paymentStatus: "pending",
        loadedMiles: loadedMiles ? Number(loadedMiles) : undefined,
        deadheadMiles: deadheadMiles ? Number(deadheadMiles) : undefined,
        internalNotes: internalNotes?.toString().trim(),
        driverInstructions: driverInstructions?.toString().trim(),
        customerNotes: customerNotes?.toString().trim(),
      };

      const approvalRequest = await ApprovalRequest.create({
        module: "loads",
        recordId: tempId,
        actionType: "create",
        requestedBy: new mongoose.Types.ObjectId(user.id),
        requestedByName: user.name,
        teamId: (user as any).teamId ? new mongoose.Types.ObjectId((user as any).teamId) : undefined,
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

      // Notify approvers about the new load submission
      const submitSender: SenderContext = {
        userId: user.id,
        name: user.name,
        role: user.role,
        teamId: (user as any).teamId,
      };
      void notifyApprovers(
        {
          title: "New load submission pending approval",
          message: `${user.name} submitted load ${loadNumber || ""} for approval.`,
          notificationType: "load_submitted",
          relatedModule: "loads",
          recordType: "Load",
          recordId: tempId.toString(),
          actionUrl: `/loads?focus=${tempId.toString()}`,
          priority: "medium",
          metadata: { loadNumber },
        },
        { teamId: (user as any).teamId, excludeUserId: user.id, sender: submitSender },
      );

      const [customers, carriers, users] = (await Promise.all([
        Customer.find()
          .select("_id companyName contactName contactPhone contactEmail creditLimit creditStatus")
          .lean()
          .exec(),
        Carrier.find().lean().exec(),
        User.find().select("_id name").lean().exec(),
      ])) as any[];

      const userMap = Object.fromEntries((users as any[]).map((u: any) => [u._id.toString(), u.name]));
      const customerMap = Object.fromEntries((customers as any[]).map((c: any) => [c._id.toString(), c]));
      const carrierMap = Object.fromEntries((carriers as any[]).map((c: any) => [c._id.toString(), c]));

      return jsonResponse({
        load: mapPendingLoad(
          approvalRequest,
          tempId.toString(),
          user,
          userMap,
          customerMap,
          carrierMap,
        ),
        customers: (customers as any[]).map((c: any) => ({
          id: c._id.toString(),
          company: c.companyName,
          contact: c.contactName,
        })),
        carriers: (carriers as any[]).map((c: any) => ({ id: c._id.toString(), legalName: c.legalName })),
      });
    }

    // No approval needed, create directly
    const created = await Load.create({
      quoteRequestId: new mongoose.Types.ObjectId(),
      agentId: new mongoose.Types.ObjectId(user.id),
      customerId: customerObjectId,
      carrierId: carrierObjectId,
      loadNumber: loadNumber || `LD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      customerReference: customerReference?.toString().trim(),
      status,
      statusHistory: [
        {
          status,
          changedBy: new mongoose.Types.ObjectId(user.id),
          changedAt: new Date(),
        },
      ],
      pickupCompany: pickupCompany?.toString().trim(),
      pickupContact: pickupContact?.toString().trim(),
      pickupPhone: pickupPhone?.toString().trim(),
      pickupAddress: pickupAddress?.toString().trim(),
      pickupCity: pickupCity?.toString().trim(),
      pickupState: pickupState?.toString().trim(),
      pickupZip: pickupZip?.toString().trim(),
      pickupDate: pickupDate ? new Date(pickupDate) : undefined,
      pickupTime: pickupTime?.toString().trim(),
      deliveryCompany: deliveryCompany?.toString().trim(),
      deliveryContact: deliveryContact?.toString().trim(),
      deliveryPhone: deliveryPhone?.toString().trim(),
      deliveryAddress: deliveryAddress?.toString().trim(),
      deliveryCity: deliveryCity?.toString().trim(),
      deliveryState: deliveryState?.toString().trim(),
      deliveryZip: deliveryZip?.toString().trim(),
      deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
      deliveryTime: deliveryTime?.toString().trim(),
      commodity: commodity?.toString().trim(),
      weight: weight ? Number(weight) : undefined,
      pieces: pieces ? Number(pieces) : undefined,
      pallets: pallets ? Number(pallets) : undefined,
      equipmentType: equipmentType?.toString().trim(),
      trailerLength: trailerLength ? Number(trailerLength) : undefined,
      loadType: loadType?.toString().trim(),
      temperature: temperature ? Number(temperature) : undefined,
      hazmat: Boolean(hazmat),
      stackable: Boolean(stackable),
      customerRate: Number(customerRate),
      carrierCost: Number(carrierCost),
      accessorialCharges: Number(accessorialCharges),
      revenue: financials.revenue,
      grossMargin: financials.grossMargin,
      marginPercent: financials.marginPercent,
      invoiceStatus: "pending",
      paymentStatus: "pending",
      loadedMiles: loadedMiles ? Number(loadedMiles) : undefined,
      deadheadMiles: deadheadMiles ? Number(deadheadMiles) : undefined,
      internalNotes: internalNotes?.toString().trim(),
      driverInstructions: driverInstructions?.toString().trim(),
      customerNotes: customerNotes?.toString().trim(),
    });

    // Emit load creation notifications
    const createSender: SenderContext = {
      userId: user.id,
      name: user.name,
      role: user.role,
      teamId: (user as any).teamId,
    };
    const createdLoadId = created._id.toString();
    const createdLoadRef = created.loadNumber || createdLoadId;
    const createActionUrl = `/loads?focus=${createdLoadId}`;

    // Notify admins
    void notifyAdmins(
      {
        title: "New load created",
        message: `${user.name} created load ${createdLoadRef}.`,
        notificationType: "load_created",
        relatedModule: "loads",
        recordType: "Load",
        recordId: createdLoadId,
        actionUrl: createActionUrl,
        priority: "low",
        metadata: { loadNumber: createdLoadRef },
      },
      createSender,
    );

    // Notify team manager and lead agents if user has a team
    if ((user as any).teamId) {
      void notifyTeamManager((user as any).teamId, { title: "New load created", message: `${user.name} created load ${createdLoadRef}.`, notificationType: "load_created", relatedModule: "loads", recordType: "Load", recordId: createdLoadId, actionUrl: createActionUrl, priority: "low", metadata: { loadNumber: createdLoadRef } }, createSender);
      void notifyLeadAgents((user as any).teamId, { title: "New load created", message: `${user.name} created load ${createdLoadRef}.`, notificationType: "load_created", relatedModule: "loads", recordType: "Load", recordId: createdLoadId, actionUrl: createActionUrl, priority: "low", metadata: { loadNumber: createdLoadRef } }, createSender);
    }

    const [customers, carriers, users] = await Promise.all([
      Customer.find()
        .select("_id companyName contactName contactPhone contactEmail creditLimit creditStatus")
        .lean()
        .exec(),
      Carrier.find().lean().exec(),
      User.find().select("_id name").lean().exec(),
    ]);


    const userMap = Object.fromEntries((users as any[]).map((u: any) => [u._id.toString(), u.name]));
    const customerMap = Object.fromEntries((customers as any[]).map((c: any) => [c._id.toString(), c]));
    const carrierMap = Object.fromEntries((carriers as any[]).map((c: any) => [c._id.toString(), c]));

    return jsonResponse({
      load: mapLoad(created, userMap, customerMap, carrierMap),
      customers: customers.map((c) => ({
        id: c._id.toString(),
          company: c.companyName,
          contact: c.contactName,
        })),
        carriers: (carriers as any[]).map((c: any) => ({ id: c._id.toString(), legalName: c.legalName })),
    });
  }

  if (request.method === "PATCH") {
    const body = await parseJson(request);
    const loadId = typeof body.loadId === "string" ? body.loadId.trim() : "";
    const approvalRequestId =
      typeof body.approvalRequestId === "string" ? body.approvalRequestId.trim() : "";

    if (!loadId) {
      throw new Error("loadId is required");
    }
    if (!can(user.role as any, "booking_actions")) {
      const error = new Error("Not authorized to update loads");
      (error as any).status = 403;
      throw error;
    }

    await connectDb();

    // First, check if this is an existing approval request we need to update
    if (approvalRequestId) {
      const approvalRequest = await ApprovalRequest.findById(
        new mongoose.Types.ObjectId(approvalRequestId),
      ).exec();
      if (approvalRequest && approvalRequest.module === "loads") {
        if (approvalRequest.requestedBy.toString() !== user.id) {
          throw new Error("Only the original requester can update this approval request");
        }

        // Update the approval request's newValues
        const newValues: any = {
          ...approvalRequest.newValues,
        };

        // Update basic fields
        if (body.customerId) {
          const customerId = ensureObjectId(body.customerId, "customerId");
          const customer = await Customer.findById(customerId).lean().exec();
          if (!customer) throw new Error("Customer not found");
          newValues.customerId = customerId;
        }
        if (body.carrierId) {
          const carrierId = ensureObjectId(body.carrierId, "carrierId");
          const carrier = await Carrier.findById(carrierId).lean().exec();
          if (!carrier) throw new Error("Carrier not found");
          newValues.carrierId = carrierId;
        }
        if (body.loadNumber !== undefined) newValues.loadNumber = body.loadNumber;
        if (body.customerReference !== undefined)
          newValues.customerReference = body.customerReference;
        if (body.status !== undefined) {
          newValues.status = body.status;
          newValues.statusHistory = [
            {
              status: body.status,
              changedBy: new mongoose.Types.ObjectId(user.id),
              changedAt: new Date(),
            },
          ];
        }

        // Update pickup fields
        if (body.pickupCompany !== undefined) newValues.pickupCompany = body.pickupCompany;
        if (body.pickupContact !== undefined) newValues.pickupContact = body.pickupContact;
        if (body.pickupPhone !== undefined) newValues.pickupPhone = body.pickupPhone;
        if (body.pickupAddress !== undefined) newValues.pickupAddress = body.pickupAddress;
        if (body.pickupCity !== undefined) newValues.pickupCity = body.pickupCity;
        if (body.pickupState !== undefined) newValues.pickupState = body.pickupState;
        if (body.pickupZip !== undefined) newValues.pickupZip = body.pickupZip;
        if (body.pickupDate !== undefined)
          newValues.pickupDate = body.pickupDate ? new Date(body.pickupDate) : undefined;
        if (body.pickupTime !== undefined) newValues.pickupTime = body.pickupTime;

        // Update delivery fields
        if (body.deliveryCompany !== undefined) newValues.deliveryCompany = body.deliveryCompany;
        if (body.deliveryContact !== undefined) newValues.deliveryContact = body.deliveryContact;
        if (body.deliveryPhone !== undefined) newValues.deliveryPhone = body.deliveryPhone;
        if (body.deliveryAddress !== undefined) newValues.deliveryAddress = body.deliveryAddress;
        if (body.deliveryCity !== undefined) newValues.deliveryCity = body.deliveryCity;
        if (body.deliveryState !== undefined) newValues.deliveryState = body.deliveryState;
        if (body.deliveryZip !== undefined) newValues.deliveryZip = body.deliveryZip;
        if (body.deliveryDate !== undefined)
          newValues.deliveryDate = body.deliveryDate ? new Date(body.deliveryDate) : undefined;
        if (body.deliveryTime !== undefined) newValues.deliveryTime = body.deliveryTime;

        // Update freight details
        if (body.commodity !== undefined) newValues.commodity = body.commodity;
        if (body.weight !== undefined) newValues.weight = body.weight;
        if (body.pieces !== undefined) newValues.pieces = body.pieces;
        if (body.pallets !== undefined) newValues.pallets = body.pallets;
        if (body.equipmentType !== undefined) newValues.equipmentType = body.equipmentType;
        if (body.trailerLength !== undefined) newValues.trailerLength = body.trailerLength;
        if (body.loadType !== undefined) newValues.loadType = body.loadType;
        if (body.temperature !== undefined) newValues.temperature = body.temperature;
        if (body.hazmat !== undefined) newValues.hazmat = body.hazmat;
        if (body.stackable !== undefined) newValues.stackable = body.stackable;

        // Update pricing and recalculate financials
        if (body.customerRate !== undefined) newValues.customerRate = Number(body.customerRate);
        if (body.carrierCost !== undefined) newValues.carrierCost = Number(body.carrierCost);
        if (body.accessorialCharges !== undefined)
          newValues.accessorialCharges = Number(body.accessorialCharges);
        const financials = calculateFinancials(
          newValues.customerRate,
          newValues.carrierCost,
          newValues.accessorialCharges,
        );
        newValues.revenue = financials.revenue;
        newValues.grossMargin = financials.grossMargin;
        newValues.marginPercent = financials.marginPercent;

        // Update invoice/payment status
        if (body.invoiceStatus !== undefined) newValues.invoiceStatus = body.invoiceStatus;
        if (body.paymentStatus !== undefined) newValues.paymentStatus = body.paymentStatus;

        // Update mileage
        if (body.loadedMiles !== undefined) newValues.loadedMiles = body.loadedMiles;
        if (body.deadheadMiles !== undefined) newValues.deadheadMiles = body.deadheadMiles;

        // Update documents
        if (body.documents !== undefined) {
          newValues.documents = body.documents.map((d: any) => ({
            kind: d.kind,
            uploaded: d.uploaded,
            uploadedAt: d.uploadedAt ? new Date(d.uploadedAt) : undefined,
          }));
        }

        // Update notes
        if (body.internalNotes !== undefined) newValues.internalNotes = body.internalNotes;
        if (body.driverInstructions !== undefined)
          newValues.driverInstructions = body.driverInstructions;
        if (body.customerNotes !== undefined) newValues.customerNotes = body.customerNotes;

        approvalRequest.newValues = newValues;
        approvalRequest.status = "pending"; // Reset to pending after updating
        approvalRequest.auditHistory.push({
          action: "request_updated",
          performedBy: new mongoose.Types.ObjectId(user.id),
          performedByName: user.name,
          at: new Date(),
        });

        await approvalRequest.save();

        const [customers, carriers, users] = (await Promise.all([
          Customer.find()
            .select(
              "_id companyName contactName contactPhone contactEmail creditLimit creditStatus",
            )
            .lean()
            .exec(),
          Carrier.find().lean().exec(),
          User.find().select("_id name").lean().exec(),
        ])) as any[];

        const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u.name]));
        const customerMap = Object.fromEntries(customers.map((c) => [c._id.toString(), c]));
        const carrierMap = Object.fromEntries(carriers.map((c) => [c._id.toString(), c]));

        return jsonResponse({
          load: mapPendingLoad(approvalRequest, loadId, user, userMap, customerMap, carrierMap),
          customers: customers.map((c) => ({
            id: c._id.toString(),
            company: c.companyName,
            contact: c.contactName,
          })),
          carriers: carriers.map((c) => ({ id: c._id.toString(), legalName: c.legalName })),
        });
      }
    }

    // Otherwise, update existing load (check if user needs approval for edit)
    const load = await Load.findById(ensureObjectId(loadId, "loadId")).exec();
    if (!load) {
      const error = new Error("Load not found");
      (error as any).status = 404;
      throw error;
    }

    // Check if user needs approval for edit
    if (doesUserNeedApproval(user.role as any)) {
      // Reuse existing active approval request for this load if one exists
      const existingApproval = await ApprovalRequest.findOne({
        module: "loads",
        recordId: load._id,
        requestedBy: new mongoose.Types.ObjectId(user.id),
        status: { $in: ["pending", "changes_requested", "rejected"] },
      })
        .sort({ createdAt: -1 })
        .exec();

      if (existingApproval) {
        // Update in-place, preserving comments and audit history
        const newValues: any = { ...existingApproval.newValues };

        if (body.customerId) {
          const customerId = ensureObjectId(body.customerId, "customerId");
          const customer = await Customer.findById(customerId).lean().exec();
          if (!customer) throw new Error("Customer not found");
          newValues.customerId = customerId;
        }
        if (body.carrierId) {
          const carrierId = ensureObjectId(body.carrierId, "carrierId");
          const carrier = await Carrier.findById(carrierId).lean().exec();
          if (!carrier) throw new Error("Carrier not found");
          newValues.carrierId = carrierId;
        }
        if (body.loadNumber !== undefined) newValues.loadNumber = body.loadNumber;
        if (body.customerReference !== undefined) newValues.customerReference = body.customerReference;
        if (body.status !== undefined && body.status !== newValues.status) {
          newValues.status = body.status;
          newValues.statusHistory = [
            { status: body.status, changedBy: new mongoose.Types.ObjectId(user.id), changedAt: new Date() },
            ...(newValues.statusHistory || []),
          ];
        }
        if (body.pickupCompany !== undefined) newValues.pickupCompany = body.pickupCompany;
        if (body.pickupContact !== undefined) newValues.pickupContact = body.pickupContact;
        if (body.pickupPhone !== undefined) newValues.pickupPhone = body.pickupPhone;
        if (body.pickupAddress !== undefined) newValues.pickupAddress = body.pickupAddress;
        if (body.pickupCity !== undefined) newValues.pickupCity = body.pickupCity;
        if (body.pickupState !== undefined) newValues.pickupState = body.pickupState;
        if (body.pickupZip !== undefined) newValues.pickupZip = body.pickupZip;
        if (body.pickupDate !== undefined) newValues.pickupDate = body.pickupDate ? new Date(body.pickupDate) : undefined;
        if (body.pickupTime !== undefined) newValues.pickupTime = body.pickupTime;
        if (body.deliveryCompany !== undefined) newValues.deliveryCompany = body.deliveryCompany;
        if (body.deliveryContact !== undefined) newValues.deliveryContact = body.deliveryContact;
        if (body.deliveryPhone !== undefined) newValues.deliveryPhone = body.deliveryPhone;
        if (body.deliveryAddress !== undefined) newValues.deliveryAddress = body.deliveryAddress;
        if (body.deliveryCity !== undefined) newValues.deliveryCity = body.deliveryCity;
        if (body.deliveryState !== undefined) newValues.deliveryState = body.deliveryState;
        if (body.deliveryZip !== undefined) newValues.deliveryZip = body.deliveryZip;
        if (body.deliveryDate !== undefined) newValues.deliveryDate = body.deliveryDate ? new Date(body.deliveryDate) : undefined;
        if (body.deliveryTime !== undefined) newValues.deliveryTime = body.deliveryTime;
        if (body.commodity !== undefined) newValues.commodity = body.commodity;
        if (body.weight !== undefined) newValues.weight = body.weight;
        if (body.pieces !== undefined) newValues.pieces = body.pieces;
        if (body.pallets !== undefined) newValues.pallets = body.pallets;
        if (body.equipmentType !== undefined) newValues.equipmentType = body.equipmentType;
        if (body.trailerLength !== undefined) newValues.trailerLength = body.trailerLength;
        if (body.loadType !== undefined) newValues.loadType = body.loadType;
        if (body.temperature !== undefined) newValues.temperature = body.temperature;
        if (body.hazmat !== undefined) newValues.hazmat = body.hazmat;
        if (body.stackable !== undefined) newValues.stackable = body.stackable;
        if (body.customerRate !== undefined) newValues.customerRate = Number(body.customerRate);
        if (body.carrierCost !== undefined) newValues.carrierCost = Number(body.carrierCost);
        if (body.accessorialCharges !== undefined) newValues.accessorialCharges = Number(body.accessorialCharges);
        const fin = calculateFinancials(newValues.customerRate, newValues.carrierCost, newValues.accessorialCharges);
        newValues.revenue = fin.revenue;
        newValues.grossMargin = fin.grossMargin;
        newValues.marginPercent = fin.marginPercent;
        if (body.invoiceStatus !== undefined) newValues.invoiceStatus = body.invoiceStatus;
        if (body.paymentStatus !== undefined) newValues.paymentStatus = body.paymentStatus;
        if (body.loadedMiles !== undefined) newValues.loadedMiles = body.loadedMiles;
        if (body.deadheadMiles !== undefined) newValues.deadheadMiles = body.deadheadMiles;
        if (body.documents !== undefined) {
          newValues.documents = body.documents.map((d: any) => ({
            kind: d.kind, uploaded: d.uploaded,
            uploadedAt: d.uploadedAt ? new Date(d.uploadedAt) : undefined,
          }));
        }
        if (body.internalNotes !== undefined) newValues.internalNotes = body.internalNotes;
        if (body.driverInstructions !== undefined) newValues.driverInstructions = body.driverInstructions;
        if (body.customerNotes !== undefined) newValues.customerNotes = body.customerNotes;

        existingApproval.newValues = newValues;
        existingApproval.status = "pending"; // resubmit
        existingApproval.auditHistory.push({
          action: "request_updated",
          performedBy: new mongoose.Types.ObjectId(user.id),
          performedByName: user.name,
          at: new Date(),
        });
        await existingApproval.save();

        const [resCust, resCarr, resUsers] = await Promise.all([
          Customer.find().select("_id companyName contactName contactPhone contactEmail creditLimit creditStatus").lean().exec(),
          Carrier.find().lean().exec(),
          User.find().select("_id name").lean().exec(),
        ]);
        const rUserMap = Object.fromEntries(resUsers.map((u) => [u._id.toString(), u.name]));
        const rCustMap = Object.fromEntries(resCust.map((c) => [c._id.toString(), c]));
        const rCarrMap = Object.fromEntries(resCarr.map((c) => [c._id.toString(), c]));
        return jsonResponse({
          load: mapPendingLoad(existingApproval, loadId, user, rUserMap, rCustMap, rCarrMap),
          customers: resCust.map((c) => ({ id: c._id.toString(), company: c.companyName, contact: c.contactName })),
          carriers: resCarr.map((c) => ({ id: c._id.toString(), legalName: c.legalName })),
        });
      }

      // No existing approval — create a fresh one for this edit
      const previousValues = load.toObject();
      const newValues = { ...previousValues };

      // Apply the updates to newValues first
      // Update basic fields
      if (body.customerId) {
        const customerId = ensureObjectId(body.customerId, "customerId");
        const customer = await Customer.findById(customerId).lean().exec();
        if (!customer) throw new Error("Customer not found");
        newValues.customerId = customerId;
      }
      if (body.carrierId) {
        const carrierId = ensureObjectId(body.carrierId, "carrierId");
        const carrier = await Carrier.findById(carrierId).lean().exec();
        if (!carrier) throw new Error("Carrier not found");
        newValues.carrierId = carrierId;
      }
      if (body.loadNumber !== undefined) newValues.loadNumber = body.loadNumber;
      if (body.customerReference !== undefined)
        newValues.customerReference = body.customerReference;
      if (body.status !== undefined && body.status !== load.status) {
        newValues.status = body.status;
        newValues.statusHistory = [
          {
            status: body.status,
            changedBy: new mongoose.Types.ObjectId(user.id),
            changedAt: new Date(),
          },
          ...newValues.statusHistory,
        ];
      }

      // Update pickup fields
      if (body.pickupCompany !== undefined) newValues.pickupCompany = body.pickupCompany;
      if (body.pickupContact !== undefined) newValues.pickupContact = body.pickupContact;
      if (body.pickupPhone !== undefined) newValues.pickupPhone = body.pickupPhone;
      if (body.pickupAddress !== undefined) newValues.pickupAddress = body.pickupAddress;
      if (body.pickupCity !== undefined) newValues.pickupCity = body.pickupCity;
      if (body.pickupState !== undefined) newValues.pickupState = body.pickupState;
      if (body.pickupZip !== undefined) newValues.pickupZip = body.pickupZip;
      if (body.pickupDate !== undefined)
        newValues.pickupDate = body.pickupDate ? new Date(body.pickupDate) : undefined;
      if (body.pickupTime !== undefined) newValues.pickupTime = body.pickupTime;

      // Update delivery fields
      if (body.deliveryCompany !== undefined) newValues.deliveryCompany = body.deliveryCompany;
      if (body.deliveryContact !== undefined) newValues.deliveryContact = body.deliveryContact;
      if (body.deliveryPhone !== undefined) newValues.deliveryPhone = body.deliveryPhone;
      if (body.deliveryAddress !== undefined) newValues.deliveryAddress = body.deliveryAddress;
      if (body.deliveryCity !== undefined) newValues.deliveryCity = body.deliveryCity;
      if (body.deliveryState !== undefined) newValues.deliveryState = body.deliveryState;
      if (body.deliveryZip !== undefined) newValues.deliveryZip = body.deliveryZip;
      if (body.deliveryDate !== undefined)
        newValues.deliveryDate = body.deliveryDate ? new Date(body.deliveryDate) : undefined;
      if (body.deliveryTime !== undefined) newValues.deliveryTime = body.deliveryTime;

      // Update freight details
      if (body.commodity !== undefined) newValues.commodity = body.commodity;
      if (body.weight !== undefined) newValues.weight = body.weight;
      if (body.pieces !== undefined) newValues.pieces = body.pieces;
      if (body.pallets !== undefined) newValues.pallets = body.pallets;
      if (body.equipmentType !== undefined) newValues.equipmentType = body.equipmentType;
      if (body.trailerLength !== undefined) newValues.trailerLength = body.trailerLength;
      if (body.loadType !== undefined) newValues.loadType = body.loadType;
      if (body.temperature !== undefined) newValues.temperature = body.temperature;
      if (body.hazmat !== undefined) newValues.hazmat = body.hazmat;
      if (body.stackable !== undefined) newValues.stackable = body.stackable;

      // Update pricing and recalculate financials
      if (body.customerRate !== undefined) newValues.customerRate = Number(body.customerRate);
      if (body.carrierCost !== undefined) newValues.carrierCost = Number(body.carrierCost);
      if (body.accessorialCharges !== undefined)
        newValues.accessorialCharges = Number(body.accessorialCharges);
      const financials = calculateFinancials(
        newValues.customerRate,
        newValues.carrierCost,
        newValues.accessorialCharges,
      );
      newValues.revenue = financials.revenue;
      newValues.grossMargin = financials.grossMargin;
      newValues.marginPercent = financials.marginPercent;

      // Update invoice/payment status
      if (body.invoiceStatus !== undefined) newValues.invoiceStatus = body.invoiceStatus;
      if (body.paymentStatus !== undefined) newValues.paymentStatus = body.paymentStatus;

      // Update mileage
      if (body.loadedMiles !== undefined) newValues.loadedMiles = body.loadedMiles;
      if (body.deadheadMiles !== undefined) newValues.deadheadMiles = body.deadheadMiles;

      // Update documents
      if (body.documents !== undefined) {
        newValues.documents = body.documents.map((d: any) => ({
          kind: d.kind,
          uploaded: d.uploaded,
          uploadedAt: d.uploadedAt ? new Date(d.uploadedAt) : undefined,
        }));
      }

      // Update notes
      if (body.internalNotes !== undefined) newValues.internalNotes = body.internalNotes;
      if (body.driverInstructions !== undefined)
        newValues.driverInstructions = body.driverInstructions;
      if (body.customerNotes !== undefined) newValues.customerNotes = body.customerNotes;

      const approvalRequest = await ApprovalRequest.create({
        module: "loads",
        recordId: load._id,
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

        const [customers, carriers, users] = (await Promise.all([
        Customer.find()
          .select("_id companyName contactName contactPhone contactEmail creditLimit creditStatus")
          .lean()
          .exec(),
        Carrier.find().lean().exec(),
        User.find().select("_id name").lean().exec(),
        ])) as any[];

      const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u.name]));
      const customerMap = Object.fromEntries(customers.map((c) => [c._id.toString(), c]));
      const carrierMap = Object.fromEntries(carriers.map((c) => [c._id.toString(), c]));

      return jsonResponse({
        load: mapPendingLoad(approvalRequest, loadId, user, userMap, customerMap, carrierMap),
        customers: customers.map((c) => ({
          id: c._id.toString(),
          company: c.companyName,
          contact: c.contactName,
        })),
        carriers: carriers.map((c) => ({ id: c._id.toString(), legalName: c.legalName })),
      });
    }

    // No approval needed, update directly
    // Capture previous state for notifications
    const prevLoadStatus = load.status;
    const prevAgentId = load.agentId?.toString();

    // Update basic fields
    if (body.customerId) {
      const customerId = ensureObjectId(body.customerId, "customerId");
      const customer = await Customer.findById(customerId).lean().exec();
      if (!customer) throw new Error("Customer not found");
      load.customerId = customerId;
    }
    if (body.carrierId) {
      const carrierId = ensureObjectId(body.carrierId, "carrierId");
      const carrier = await Carrier.findById(carrierId).lean().exec();
      if (!carrier) throw new Error("Carrier not found");
      load.carrierId = carrierId;
    }
    if (body.loadNumber !== undefined) load.loadNumber = body.loadNumber;
    if (body.customerReference !== undefined) load.customerReference = body.customerReference;
    if (body.status !== undefined && body.status !== load.status) {
      load.status = body.status;
      load.statusHistory = load.statusHistory || [];
      load.statusHistory.unshift({
        status: body.status,
        changedBy: new mongoose.Types.ObjectId(user.id),
        changedAt: new Date(),
      });
    }

    // Update pickup fields
    if (body.pickupCompany !== undefined) load.pickupCompany = body.pickupCompany;
    if (body.pickupContact !== undefined) load.pickupContact = body.pickupContact;
    if (body.pickupPhone !== undefined) load.pickupPhone = body.pickupPhone;
    if (body.pickupAddress !== undefined) load.pickupAddress = body.pickupAddress;
    if (body.pickupCity !== undefined) load.pickupCity = body.pickupCity;
    if (body.pickupState !== undefined) load.pickupState = body.pickupState;
    if (body.pickupZip !== undefined) load.pickupZip = body.pickupZip;
    if (body.pickupDate !== undefined)
      load.pickupDate = body.pickupDate ? new Date(body.pickupDate) : undefined;
    if (body.pickupTime !== undefined) load.pickupTime = body.pickupTime;

    // Update delivery fields
    if (body.deliveryCompany !== undefined) load.deliveryCompany = body.deliveryCompany;
    if (body.deliveryContact !== undefined) load.deliveryContact = body.deliveryContact;
    if (body.deliveryPhone !== undefined) load.deliveryPhone = body.deliveryPhone;
    if (body.deliveryAddress !== undefined) load.deliveryAddress = body.deliveryAddress;
    if (body.deliveryCity !== undefined) load.deliveryCity = body.deliveryCity;
    if (body.deliveryState !== undefined) load.deliveryState = body.deliveryState;
    if (body.deliveryZip !== undefined) load.deliveryZip = body.deliveryZip;
    if (body.deliveryDate !== undefined)
      load.deliveryDate = body.deliveryDate ? new Date(body.deliveryDate) : undefined;
    if (body.deliveryTime !== undefined) load.deliveryTime = body.deliveryTime;

    // Update freight details
    if (body.commodity !== undefined) load.commodity = body.commodity;
    if (body.weight !== undefined) load.weight = body.weight;
    if (body.pieces !== undefined) load.pieces = body.pieces;
    if (body.pallets !== undefined) load.pallets = body.pallets;
    if (body.equipmentType !== undefined) load.equipmentType = body.equipmentType;
    if (body.trailerLength !== undefined) load.trailerLength = body.trailerLength;
    if (body.loadType !== undefined) load.loadType = body.loadType;
    if (body.temperature !== undefined) load.temperature = body.temperature;
    if (body.hazmat !== undefined) load.hazmat = body.hazmat;
    if (body.stackable !== undefined) load.stackable = body.stackable;

    // Update pricing and recalculate financials
    if (body.customerRate !== undefined) load.customerRate = Number(body.customerRate);
    if (body.carrierCost !== undefined) load.carrierCost = Number(body.carrierCost);
    if (body.accessorialCharges !== undefined)
      load.accessorialCharges = Number(body.accessorialCharges);
    const financials = calculateFinancials(
      load.customerRate,
      load.carrierCost,
      load.accessorialCharges,
    );
    load.revenue = financials.revenue;
    load.grossMargin = financials.grossMargin;
    load.marginPercent = financials.marginPercent;

    // Update invoice/payment status
    if (body.invoiceStatus !== undefined) load.invoiceStatus = body.invoiceStatus;
    if (body.paymentStatus !== undefined) load.paymentStatus = body.paymentStatus;

    // Update mileage
    if (body.loadedMiles !== undefined) load.loadedMiles = body.loadedMiles;
    if (body.deadheadMiles !== undefined) load.deadheadMiles = body.deadheadMiles;

    // Update documents
    if (body.documents !== undefined) {
      load.documents = body.documents.map((d: any) => ({
        kind: d.kind,
        uploaded: d.uploaded,
        uploadedAt: d.uploadedAt ? new Date(d.uploadedAt) : undefined,
      }));
    }

    // Update notes
    if (body.internalNotes !== undefined) load.internalNotes = body.internalNotes;
    if (body.driverInstructions !== undefined) load.driverInstructions = body.driverInstructions;
    if (body.customerNotes !== undefined) load.customerNotes = body.customerNotes;

    await load.save();

    // Emit load status change notifications
    const newStatus = load.status;
    if (newStatus !== prevLoadStatus && newStatus) {
      const statusSender: SenderContext = { userId: user.id, name: user.name, role: user.role, teamId: (user as any).teamId };
      const statusLoadId = load._id.toString();
      const statusActionUrl = `/loads?focus=${statusLoadId}`;
      const statusMsg = `Load ${load.loadNumber || statusLoadId} status changed to "${newStatus}" by ${user.name}.`;

      // Notify the assigned agent
      if (load.agentId && load.agentId.toString() !== user.id) {
        void notifyUser(load.agentId.toString(), { title: "Load status updated", message: statusMsg, notificationType: "load_status_updated", relatedModule: "loads", recordType: "Load", recordId: statusLoadId, actionUrl: statusActionUrl, priority: "medium", metadata: { status: newStatus, prevStatus: prevLoadStatus } }, statusSender);
      }

      // Notify admins
      void notifyAdmins({ title: "Load status updated", message: statusMsg, notificationType: "load_status_updated", relatedModule: "loads", recordType: "Load", recordId: statusLoadId, actionUrl: statusActionUrl, priority: "low", metadata: { status: newStatus } }, statusSender);

      // On delivered, notify accounting
      if (newStatus === "delivered") {
        void notifyAccounting({ title: "Load delivered", message: `Load ${load.loadNumber || statusLoadId} has been delivered and is ready for invoicing.`, notificationType: "load_completed", relatedModule: "loads", recordType: "Load", recordId: statusLoadId, actionUrl: statusActionUrl, priority: "medium", metadata: { status: newStatus } }, statusSender);
      }
    }

    // Emit agent reassignment notifications
    const newAgentId = load.agentId?.toString();
    if (prevAgentId && newAgentId && newAgentId !== prevAgentId) {
      const reassignSender: SenderContext = { userId: user.id, name: user.name, role: user.role, teamId: (user as any).teamId };
      const reassignLoadId = load._id.toString();
      const reassignUrl = `/loads?focus=${reassignLoadId}`;
      void notifyUser(newAgentId, { title: "Load assigned to you", message: `Load ${load.loadNumber || reassignLoadId} has been assigned to you.`, notificationType: "load_assigned", relatedModule: "loads", recordType: "Load", recordId: reassignLoadId, actionUrl: reassignUrl, priority: "high", metadata: {} }, reassignSender);
      void notifyUser(prevAgentId, { title: "Load unassigned", message: `Load ${load.loadNumber || reassignLoadId} has been reassigned away from you.`, notificationType: "load_unassigned", relatedModule: "loads", recordType: "Load", recordId: reassignLoadId, actionUrl: reassignUrl, priority: "medium", metadata: {} }, reassignSender);
    }

      const [customers, carriers, users] = (await Promise.all([
      Customer.find()
        .select("_id companyName contactName contactPhone contactEmail creditLimit creditStatus")
        .lean()
        .exec(),
      Carrier.find().lean().exec(),
      User.find().select("_id name").lean().exec(),
      ])) as any[];

    const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u.name]));
    const customerMap = Object.fromEntries(customers.map((c) => [c._id.toString(), c]));
    const carrierMap = Object.fromEntries(carriers.map((c) => [c._id.toString(), c]));

    return jsonResponse({
      load: mapLoad(load, userMap, customerMap, carrierMap),
      customers: customers.map((c) => ({
        id: c._id.toString(),
        company: c.companyName,
        contact: c.contactName,
      })),
      carriers: carriers.map((c) => ({ id: c._id.toString(), legalName: c.legalName })),
    });
  }

  if (request.method === "DELETE") {
    const body = await readJsonBody(request);
    const loadId = typeof body.loadId === "string" ? body.loadId.trim() : "";

    if (!loadId) {
      throw new Error("loadId is required");
    }
    if (!can(user.role as any, "booking_actions")) {
      const error = new Error("Not authorized to delete loads");
      (error as any).status = 403;
      throw error;
    }

    await connectDb();

    // Try to delete the real load record first
    let deleted = null;
    if (mongoose.isValidObjectId(loadId)) {
      deleted = await Load.findByIdAndDelete(new mongoose.Types.ObjectId(loadId)).exec();
    }

    if (!deleted) {
      // May be a pending-only load backed only by an ApprovalRequest (create action)
      const pendingApproval = await ApprovalRequest.findOne({
        module: "loads",
        recordId: mongoose.isValidObjectId(loadId) ? new mongoose.Types.ObjectId(loadId) : undefined,
        status: { $in: ["pending", "changes_requested", "rejected"] },
      }).exec();

      if (pendingApproval) {
        // Only the original requester or an admin/manager can delete pending loads
        const isRequester = pendingApproval.requestedBy.toString() === user.id;
        const isManager = ["admin", "ops_manager", "owner", "team_manager"].includes(user.role);
        if (!isRequester && !isManager) {
          const error = new Error("Not authorized to delete this load");
          (error as any).status = 403;
          throw error;
        }
        await pendingApproval.deleteOne();
        return jsonResponse({ success: true, deletedId: loadId });
      }

      // Also check if this loadId is an ApprovalRequest._id itself (edit-type approvals)
      if (mongoose.isValidObjectId(loadId)) {
        const approvalById = await ApprovalRequest.findById(new mongoose.Types.ObjectId(loadId)).exec();
        if (approvalById && approvalById.module === "loads") {
          await approvalById.deleteOne();
          return jsonResponse({ success: true, deletedId: loadId });
        }
      }

      const error = new Error("Load not found");
      (error as any).status = 404;
      throw error;
    }

    // Also clean up any associated approval requests for this load
    await ApprovalRequest.deleteMany({
      module: "loads",
      recordId: new mongoose.Types.ObjectId(loadId),
    }).exec();

    return jsonResponse({ success: true, deletedId: loadId });
  }

  if (!can(user.role as any, "loads")) {
    const error = new Error("Not authorized to view loads");
    (error as any).status = 403;
    throw error;
  }

  await connectDb();

  const [loads, customers, carriers, users] = (await Promise.all([
    Load.find().sort({ createdAt: -1 }).lean().exec(),
    Customer.find()
      .select("_id companyName contactName contactPhone contactEmail creditLimit creditStatus")
      .lean()
      .exec(),
    Carrier.find().lean().exec(),
    User.find().select("_id name").lean().exec(),
  ])) as any[];

  const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u.name]));
  const customerMap = Object.fromEntries(customers.map((c) => [c._id.toString(), c]));
  const carrierMap = Object.fromEntries(carriers.map((c) => [c._id.toString(), c]));

  // Fetch pending approval requests for loads module with same scoping rules as customers
  let approvalRequests: any[] = [];
  try {
    let approvalScope: any = {
      module: "loads",
      status: { $in: ["pending", "rejected", "changes_requested"] },
    };
    if (user.role === "agent" || user.role === "trainee") {
      approvalScope.requestedBy = new mongoose.Types.ObjectId(user.id);
    } else if (user.role === "team_manager" || user.role === "leadagent") {
      if ((user as any).teamId) {
        approvalScope.teamId = new mongoose.Types.ObjectId((user as any).teamId);
      }
    }
    approvalRequests = await ApprovalRequest.find(approvalScope).sort({ createdAt: -1 }).lean().exec();
  } catch (err) {
    console.error("Error fetching load approval requests:", err);
  }

  const activeApprovalRequests = approvalRequests.filter(
    (ar) => ar.recordId && ["pending", "changes_requested", "rejected"].includes(ar.status),
  );
  const activeApprovalRecordIds = new Set(
    activeApprovalRequests.filter((ar) => ar.recordId).map((ar) => ar.recordId.toString()),
  );

  // Map approval requests to load items and avoid duplicates for the same record
  const pendingLoads: any[] = [];
  const seenApprovalKeys = new Set<string>();
  for (const ar of activeApprovalRequests) {
    const key = ar.recordId?.toString() || ar._id.toString();
    if (seenApprovalKeys.has(key)) continue;
    seenApprovalKeys.add(key);
    pendingLoads.push(mapPendingLoad(ar, key, user, userMap, customerMap, carrierMap));
  }

  // Map existing loads and combine, skipping records that already have an active approval request
  const existingLoads = loads
    .filter((load) => !activeApprovalRecordIds.has(load._id.toString()))
    .map((load) => mapLoad(load, userMap, customerMap, carrierMap));

  // Merge pending and existing loads while keeping a single entry per load id.
  const mergedLoadMap = new Map<string, any>();
  for (const item of [...pendingLoads, ...existingLoads]) {
    const existingItem = mergedLoadMap.get(item.id);
    if (!existingItem) {
      mergedLoadMap.set(item.id, item);
      continue;
    }

    if (item.pendingApproval && !existingItem.pendingApproval) {
      mergedLoadMap.set(item.id, item);
    }
  }

  const allLoads = Array.from(mergedLoadMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return jsonResponse({
    loads: allLoads,
    customers: customers.map((c) => ({
      id: c._id.toString(),
      company: c.companyName,
      contact: c.contactName,
    })),
    carriers: carriers.map((c) => ({ id: c._id.toString(), legalName: c.legalName })),
  });
}
