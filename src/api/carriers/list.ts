import mongoose from "mongoose";
import { connectDb } from "../../lib/db";
import { getSessionUserFromRequest, requireAuth } from "../../lib/auth";
import { errorResponse, jsonResponse, parseJson } from "../../lib/api";
import { Carrier, CARRIER_STATUSES } from "../../models/carrier";
import { can } from "../../lib/roles";
import {
  notifyApprovers,
  notifyAdmins,
  notifyOpsManagers,
  type SenderContext,
} from "../../lib/notification";

function normalizeStatus(value: string | null | undefined) {
  const normalized = (value ?? "pending").toString().trim().toLowerCase();
  return CARRIER_STATUSES.includes(normalized as any)
    ? (normalized as (typeof CARRIER_STATUSES)[number])
    : "pending";
}

function parseStringArray(value: unknown) {
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return [] as string[];
}

function mapCarrier(carrier: any) {
  return {
    id: carrier._id?.toString() ?? carrier.id,
    legalName: carrier.legalName ?? "",
    dba: carrier.dba ?? "",
    companyName: carrier.companyName ?? "",
    mcNumber: carrier.mcNumber ?? "",
    dotNumber: carrier.dotNumber ?? "",
    contactName: carrier.contactName ?? "",
    contactEmail: carrier.contactEmail ?? "",
    contactPhone: carrier.contactPhone ?? "",
    address: carrier.address ?? "",
    taxId: carrier.taxId ?? "",
    equipmentTypes: carrier.equipmentTypes ?? [],
    serviceAreas: carrier.serviceAreas ?? [],
    insuranceCarrier: carrier.insuranceCarrier ?? "",
    insurancePolicyNumber: carrier.insurancePolicyNumber ?? "",
    insuranceExpiresAt: carrier.insuranceExpiresAt
      ? new Date(carrier.insuranceExpiresAt).toISOString()
      : null,
    notes: carrier.notes ?? "",
    status: normalizeStatus(carrier.status),
    vettingChecks: {
      authorityVerified: Boolean(carrier.vettingChecks?.authorityVerified),
      insuranceVerified: Boolean(carrier.vettingChecks?.insuranceVerified),
      safetyVerified: Boolean(carrier.vettingChecks?.safetyVerified),
      fraudChecked: Boolean(carrier.vettingChecks?.fraudChecked),
      complianceVerified: Boolean(carrier.vettingChecks?.complianceVerified),
    },
    reviewHistory: (carrier.reviewHistory ?? []).map((entry: any) => ({
      status: normalizeStatus(entry.status),
      reviewerId: entry.reviewerId?.toString() ?? "",
      reviewerName: entry.reviewerName ?? "",
      reviewDate: entry.reviewDate
        ? new Date(entry.reviewDate).toISOString()
        : new Date().toISOString(),
      comments: entry.comments ?? "",
    })),
    reviewedBy: carrier.reviewedBy?.toString() ?? null,
    reviewedAt: carrier.reviewedAt ? new Date(carrier.reviewedAt).toISOString() : null,
    createdAt: carrier.createdAt
      ? new Date(carrier.createdAt).toISOString()
      : new Date().toISOString(),
    updatedAt: carrier.updatedAt
      ? new Date(carrier.updatedAt).toISOString()
      : new Date().toISOString(),
  };
}

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function buildExcelHtml(columns: string[], rows: string[][]) {
  const headerRow = columns.map((value) => `<th>${value}</th>`).join("");
  const bodyRows = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><table border="1"><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table></body></html>`;
}

export async function carriersListHandler(request: Request) {
  const user = requireAuth(await getSessionUserFromRequest(request));

  if (request.method === "DELETE") {
    const payload = await parseJson(request);
    const carrierId = typeof payload.carrierId === "string" ? payload.carrierId.trim() : "";

    if (!carrierId) {
      throw new Error("carrierId is required");
    }

    if (!["owner", "admin", "ops_manager", "team_manager"].includes(user.role)) {
      const error = new Error("Not authorized to delete carriers");
      (error as any).status = 403;
      throw error;
    }

    await connectDb();
    const carrier = await Carrier.findById(new mongoose.Types.ObjectId(carrierId)).exec();
    if (!carrier || carrier.deletedAt) {
      throw new Error("Carrier not found");
    }

    carrier.deletedAt = new Date();
    await carrier.save();

    return jsonResponse({ deletedId: carrierId });
  }

  if (request.method === "PATCH") {
    const payload = await parseJson(request);
    const carrierId = typeof payload.carrierId === "string" ? payload.carrierId.trim() : "";
    if (!carrierId) {
      throw new Error("carrierId is required");
    }

    await connectDb();
    const carrier = await Carrier.findById(new mongoose.Types.ObjectId(carrierId)).exec();
    if (!carrier || carrier.deletedAt) {
      throw new Error("Carrier not found");
    }

    if (user.role === "trainee") {
      const error = new Error("Not authorized to edit carriers");
      (error as any).status = 403;
      throw error;
    }

    const legalName =
      typeof payload.legalName === "string" ? payload.legalName.trim() : carrier.legalName;
    const dba = typeof payload.dba === "string" ? payload.dba.trim() : carrier.dba;
    const companyName =
      typeof payload.companyName === "string" ? payload.companyName.trim() : carrier.companyName;
    const mcNumber =
      typeof payload.mcNumber === "string" ? payload.mcNumber.trim() : carrier.mcNumber;
    const dotNumber =
      typeof payload.dotNumber === "string" ? payload.dotNumber.trim() : carrier.dotNumber;
    const contactName =
      typeof payload.contactName === "string" ? payload.contactName.trim() : carrier.contactName;
    const contactEmail =
      typeof payload.contactEmail === "string" ? payload.contactEmail.trim() : carrier.contactEmail;
    const contactPhone =
      typeof payload.contactPhone === "string" ? payload.contactPhone.trim() : carrier.contactPhone;
    const address = typeof payload.address === "string" ? payload.address.trim() : carrier.address;
    const taxId = typeof payload.taxId === "string" ? payload.taxId.trim() : carrier.taxId;
    const equipmentTypes = parseStringArray(
      payload.equipmentTypes.length ? payload.equipmentTypes : carrier.equipmentTypes,
    );
    const serviceAreas = parseStringArray(
      payload.serviceAreas.length ? payload.serviceAreas : carrier.serviceAreas,
    );
    const insuranceCarrier =
      typeof payload.insuranceCarrier === "string"
        ? payload.insuranceCarrier.trim()
        : carrier.insuranceCarrier;
    const insurancePolicyNumber =
      typeof payload.insurancePolicyNumber === "string"
        ? payload.insurancePolicyNumber.trim()
        : carrier.insurancePolicyNumber;
    const insuranceExpiresAt = payload.insuranceExpiresAt
      ? new Date(payload.insuranceExpiresAt)
      : carrier.insuranceExpiresAt;
    const notes = typeof payload.notes === "string" ? payload.notes.trim() : carrier.notes;

    const status = payload.status ? normalizeStatus(String(payload.status)) : carrier.status;
    const prevCarrierStatus = carrier.status;
    const reviewComment =
      typeof payload.reviewComment === "string" ? payload.reviewComment.trim() : "";
    const vettingChecks = payload.vettingChecks;

    if (
      ["approved", "rejected", "suspended"].includes(status) &&
      !can(user.role as any, "approval_actions")
    ) {
      const error = new Error("Not authorized to approve or reject carriers");
      (error as any).status = 403;
      throw error;
    }

    carrier.legalName = legalName || carrier.legalName;
    carrier.dba = dba;
    carrier.companyName = companyName;
    carrier.mcNumber = mcNumber;
    carrier.dotNumber = dotNumber;
    carrier.contactName = contactName;
    carrier.contactEmail = contactEmail;
    carrier.contactPhone = contactPhone;
    carrier.address = address;
    carrier.taxId = taxId;
    carrier.equipmentTypes = equipmentTypes;
    carrier.serviceAreas = serviceAreas;
    carrier.insuranceCarrier = insuranceCarrier;
    carrier.insurancePolicyNumber = insurancePolicyNumber;
    carrier.insuranceExpiresAt = insuranceExpiresAt;
    carrier.notes = notes;

    if (vettingChecks && typeof vettingChecks === "object") {
      carrier.vettingChecks = {
        authorityVerified: Boolean(
          vettingChecks.authorityVerified ?? carrier.vettingChecks.authorityVerified,
        ),
        insuranceVerified: Boolean(
          vettingChecks.insuranceVerified ?? carrier.vettingChecks.insuranceVerified,
        ),
        safetyVerified: Boolean(
          vettingChecks.safetyVerified ?? carrier.vettingChecks.safetyVerified,
        ),
        fraudChecked: Boolean(vettingChecks.fraudChecked ?? carrier.vettingChecks.fraudChecked),
        complianceVerified: Boolean(
          vettingChecks.complianceVerified ?? carrier.vettingChecks.complianceVerified,
        ),
      };
    }

    if (status !== carrier.status) {
      carrier.status = status;
      carrier.reviewedBy = new mongoose.Types.ObjectId(user.id);
      carrier.reviewedAt = new Date();
      carrier.reviewHistory = carrier.reviewHistory || [];
      carrier.reviewHistory.unshift({
        status,
        reviewerId: new mongoose.Types.ObjectId(user.id),
        reviewerName: user.name,
        reviewDate: new Date(),
        comments: reviewComment,
      });
    } else if (reviewComment && can(user.role as any, "approval_actions")) {
      carrier.reviewHistory = carrier.reviewHistory || [];
      carrier.reviewHistory.unshift({
        status: carrier.status,
        reviewerId: new mongoose.Types.ObjectId(user.id),
        reviewerName: user.name,
        reviewDate: new Date(),
        comments: reviewComment,
      });
    }

    const updated = await carrier.save();

    // Emit carrier status change notifications
    if (
      ["approved", "rejected", "suspended"].includes(status) &&
      status !== prevCarrierStatus
    ) {
      const sender: SenderContext = {
        userId: user.id,
        name: user.name,
        role: user.role,
        teamId: user.teamId,
      };
      const actionUrl = `/carriers?focus=${carrierId}`;
      const notificationType =
        status === "approved"
          ? "carrier_approved"
          : status === "rejected"
            ? "carrier_rejected"
            : "carrier_rejected";
      const title =
        status === "approved"
          ? "Carrier approved"
          : status === "rejected"
            ? "Carrier rejected"
            : "Carrier suspended";
      const message = `${user.name} ${status === "approved" ? "approved" : status === "rejected" ? "rejected" : "suspended"} carrier "${carrier.legalName}".${reviewComment ? ` Notes: ${reviewComment}` : ""}`;
      const payload = {
        title,
        message,
        notificationType,
        relatedModule: "carriers" as const,
        recordType: "Carrier",
        recordId: carrierId,
        actionUrl,
        priority: status === "approved" ? ("low" as const) : ("high" as const),
        metadata: { status, reviewComment },
      };
      // Notify admins + ops managers (carriers are org-wide, not team-scoped)
      void notifyAdmins(payload, sender);
      void notifyOpsManagers(payload, sender);
    }

    return jsonResponse({ carrier: mapCarrier(updated) });
  }

  if (request.method === "POST") {
    const payload = await parseJson(request);
    if (user.role === "trainee") {
      const error = new Error("Not authorized to add carriers");
      (error as any).status = 403;
      throw error;
    }

    const legalName = typeof payload.legalName === "string" ? payload.legalName.trim() : "";
    const dba = typeof payload.dba === "string" ? payload.dba.trim() : "";
    const companyName = typeof payload.companyName === "string" ? payload.companyName.trim() : "";
    const mcNumber = typeof payload.mcNumber === "string" ? payload.mcNumber.trim() : "";
    const dotNumber = typeof payload.dotNumber === "string" ? payload.dotNumber.trim() : "";
    const contactName = typeof payload.contactName === "string" ? payload.contactName.trim() : "";
    const contactEmail =
      typeof payload.contactEmail === "string" ? payload.contactEmail.trim() : "";
    const contactPhone =
      typeof payload.contactPhone === "string" ? payload.contactPhone.trim() : "";
    const address = typeof payload.address === "string" ? payload.address.trim() : "";
    const taxId = typeof payload.taxId === "string" ? payload.taxId.trim() : "";
    const equipmentTypes = parseStringArray(payload.equipmentTypes);
    const serviceAreas = parseStringArray(payload.serviceAreas);
    const insuranceCarrier =
      typeof payload.insuranceCarrier === "string" ? payload.insuranceCarrier.trim() : "";
    const insurancePolicyNumber =
      typeof payload.insurancePolicyNumber === "string" ? payload.insurancePolicyNumber.trim() : "";
    const insuranceExpiresAt = payload.insuranceExpiresAt
      ? new Date(payload.insuranceExpiresAt)
      : undefined;
    const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";
    const status = normalizeStatus(payload.status ? String(payload.status) : "pending");

    if (!legalName || !contactName) {
      throw new Error("legalName and contactName are required");
    }

    await connectDb();
    const created = await Carrier.create({
      legalName,
      dba,
      companyName,
      mcNumber,
      dotNumber,
      contactName,
      contactEmail,
      contactPhone,
      address,
      taxId,
      equipmentTypes,
      serviceAreas,
      insuranceCarrier,
      insurancePolicyNumber,
      insuranceExpiresAt,
      notes,
      status,
      vettingChecks: {
        authorityVerified: false,
        insuranceVerified: false,
        safetyVerified: false,
        fraudChecked: false,
        complianceVerified: false,
      },
      reviewHistory: [],
    });

    // Notify approvers about the new carrier submission (org-wide — carriers aren't team-scoped)
    const sender: SenderContext = {
      userId: user.id,
      name: user.name,
      role: user.role,
      teamId: user.teamId,
    };
    const actionUrl = `/carriers?focus=${created._id.toString()}`;
    void notifyApprovers(
      {
        title: "New carrier submitted",
        message: `${user.name} submitted carrier "${legalName}" for review.`,
        notificationType: "carrier_submitted",
        relatedModule: "carriers",
        recordType: "Carrier",
        recordId: created._id.toString(),
        actionUrl,
        priority: "medium",
        metadata: { legalName, mcNumber, dotNumber },
      },
      { excludeUserId: user.id, sender },
    );

    return jsonResponse({ carrier: mapCarrier(created) });
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const limit = Math.min(50, Math.max(5, Number(url.searchParams.get("limit") ?? 10)));
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = normalizeStatus(url.searchParams.get("status"));
  const sortBy = [
    "legalName",
    "mcNumber",
    "dotNumber",
    "contactName",
    "status",
    "createdAt",
    "updatedAt",
  ].includes(url.searchParams.get("sortBy") ?? "")
    ? String(url.searchParams.get("sortBy"))
    : "updatedAt";
  const sortOrder = url.searchParams.get("sortOrder") === "asc" ? 1 : -1;
  const exportFormat = url.searchParams.get("export");

  await connectDb();
  const filter: Record<string, any> = { deletedAt: { $exists: false } };
  if (q) {
    filter.$or = [
      { legalName: { $regex: q, $options: "i" } },
      { companyName: { $regex: q, $options: "i" } },
      { contactName: { $regex: q, $options: "i" } },
      { mcNumber: { $regex: q, $options: "i" } },
      { dotNumber: { $regex: q, $options: "i" } },
    ];
  }
  if (url.searchParams.get("status")) {
    filter.status = status;
  }

  const total = await Carrier.countDocuments(filter).exec();
  const carriers = await Carrier.find(filter)
    .sort({ [sortBy]: sortOrder })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean()
    .exec();

  const mapped = carriers.map(mapCarrier);

  if (exportFormat === "csv" || exportFormat === "xls") {
    const header = [
      "Carrier",
      "Company",
      "MC Number",
      "DOT Number",
      "Contact",
      "Email",
      "Phone",
      "Status",
      "Vetting progress",
      "Created",
    ];
    const rows = mapped.map((carrier) => [
      carrier.legalName,
      carrier.companyName,
      carrier.mcNumber,
      carrier.dotNumber,
      carrier.contactName,
      carrier.contactEmail,
      carrier.contactPhone,
      carrier.status,
      `${Object.values(carrier.vettingChecks).filter(Boolean).length}/${Object.keys(carrier.vettingChecks).length}`,
      carrier.createdAt,
    ]);

    if (exportFormat === "csv") {
      const payload = [
        header.map(escapeCsv).join(","),
        ...rows.map((row) => row.map(escapeCsv).join(",")),
      ].join("\n");
      return new Response(payload, {
        status: 200,
        headers: {
          "content-type": "text/csv;charset=utf-8",
          "content-disposition": "attachment; filename=carriers.csv",
        },
      });
    }

    const html = buildExcelHtml(header, rows);
    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "application/vnd.ms-excel;charset=utf-8",
        "content-disposition": "attachment; filename=carriers.xls",
      },
    });
  }

  return jsonResponse({ carriers: mapped, total, page, limit });
}
