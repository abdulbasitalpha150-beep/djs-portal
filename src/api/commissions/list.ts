import mongoose from "mongoose";
import { connectDb } from "../../lib/db";
import { getSessionUserFromRequest, requireAuth, requireRole } from "../../lib/auth";
import { errorResponse, jsonResponse, parseJson } from "../../lib/api";
import { Commission, type CommissionDocument } from "../../models/commission";
import { Load } from "../../models/load";
import { User } from "../../models/user";
import {
  notifyUser,
  notifyAdmins,
  notifyAccounting,
  type SenderContext,
} from "../../lib/notification";

const SORT_FIELDS = [
  "commissionAmount",
  "grossMarginAmount",
  "commissionPercent",
  "payoutStatus",
  "payoutDate",
  "createdAt",
  "updatedAt",
] as const;

type SortField = (typeof SORT_FIELDS)[number];

type CommissionRecord = {
  id: string;
  loadId: string;
  loadRef: string;
  agentId: string;
  agentName: string;
  grossMarginAmount: number;
  commissionTier: string;
  commissionPercent: number;
  commissionAmount: number;
  payoutStatus: "pending" | "processing" | "paid";
  payoutDate?: string;
  month: number;
  year: number;
  createdAt: string;
  updatedAt: string;
};

// import type { CommissionDocument } from "../../models/commission";

function mapCommission(
  record: CommissionDocument | Record<string, any>,
  agentMap: Record<string, string>,
  loadMap: Record<string, string>,
): CommissionRecord {
  const raw = record as Record<string, any>;
  const agentId = String(raw.agentId?.toString?.() ?? raw.agentId ?? "");
  const loadId = String(raw.loadId?.toString?.() ?? raw.loadId ?? "");
  return {
    id: String(raw._id?.toString?.() ?? raw.id ?? ""),
    loadId,
    loadRef: loadMap[loadId] ?? `LD-${loadId.slice(-6).toUpperCase()}`,
    agentId,
    agentName: agentMap[agentId] ?? "Unknown agent",
    grossMarginAmount: Number(raw.grossMarginAmount ?? 0),
    commissionTier: String(raw.commissionTier ?? "Standard"),
    commissionPercent: Number(raw.commissionPercent ?? 0),
    commissionAmount: Number(raw.commissionAmount ?? 0),
    payoutStatus: String(raw.payoutStatus ?? "pending") as "pending" | "processing" | "paid",
    payoutDate: raw.payoutDate ? new Date(raw.payoutDate).toISOString() : undefined,
    month: Number(raw.month ?? new Date().getMonth() + 1),
    year: Number(raw.year ?? new Date().getFullYear()),
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : new Date().toISOString(),
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

export async function commissionsListHandler(request: Request) {
  const user = requireAuth(await getSessionUserFromRequest(request));
  if (request.method === "POST") {
    requireRole(user, ["admin", "accounting"]);

    const payload = await parseJson(request);
    const loadId = typeof payload.loadId === "string" ? payload.loadId.trim() : "";
    const agentId = typeof payload.agentId === "string" ? payload.agentId.trim() : "";
    const grossMarginAmount =
      typeof payload.grossMarginAmount === "number" ? payload.grossMarginAmount : NaN;
    const commissionTier =
      typeof payload.commissionTier === "string" ? payload.commissionTier.trim() : "";
    const commissionPercent =
      typeof payload.commissionPercent === "number" ? payload.commissionPercent : NaN;
    const payoutStatus =
      typeof payload.payoutStatus === "string" ? payload.payoutStatus.trim() : "pending";
    const payoutDate = typeof payload.payoutDate === "string" ? payload.payoutDate.trim() : "";
    const month = typeof payload.month === "number" ? payload.month : NaN;
    const year = typeof payload.year === "number" ? payload.year : NaN;

    if (!loadId) {
      throw new Error("loadId is required");
    }
    if (!agentId) {
      throw new Error("agentId is required");
    }
    if (!Number.isFinite(grossMarginAmount) || grossMarginAmount < 0) {
      throw new Error("grossMarginAmount must be a valid number");
    }
    if (!commissionTier) {
      throw new Error("commissionTier is required");
    }
    if (!Number.isFinite(commissionPercent) || commissionPercent < 0) {
      throw new Error("commissionPercent must be a valid number");
    }
    if (!Number.isFinite(month) || month < 1 || month > 12) {
      throw new Error("month must be a valid month number");
    }
    if (!Number.isFinite(year) || year < 2000) {
      throw new Error("year must be a valid year");
    }

    const allowed = ["pending", "processing", "paid"];
    if (!allowed.includes(payoutStatus)) {
      throw new Error("payoutStatus must be pending, processing, or paid");
    }

    await connectDb();
    const commissionAmount =
      Math.round(((grossMarginAmount * commissionPercent) / 100) * 100) / 100;

    const created = await Commission.create({
      loadId: new mongoose.Types.ObjectId(loadId),
      agentId: new mongoose.Types.ObjectId(agentId),
      grossMarginAmount,
      commissionTier,
      commissionPercent,
      commissionAmount,
      payoutStatus: payoutStatus as "pending" | "processing" | "paid",
      payoutDate: payoutDate
        ? new Date(payoutDate)
        : payoutStatus === "paid"
          ? new Date()
          : undefined,
      month,
      year,
    });

    // Emit commission creation notifications
    const commSender: SenderContext = { userId: user.id, name: user.name, role: user.role, teamId: user.teamId };
    const commId = created._id.toString();
    const commActionUrl = `/commissions?focus=${commId}`;
    void notifyUser(agentId, { title: "Commission generated", message: `A commission of $${commissionAmount.toFixed(2)} (${commissionPercent}%) has been generated for your load.`, notificationType: "commission_generated", relatedModule: "commissions", recordType: "Commission", recordId: commId, actionUrl: commActionUrl, priority: "low", metadata: { commissionAmount, commissionPercent } }, commSender);
    void notifyAccounting({ title: "New commission created", message: `Commission of $${commissionAmount.toFixed(2)} for agent has been created.`, notificationType: "commission_created", relatedModule: "commissions", recordType: "Commission", recordId: commId, actionUrl: commActionUrl, priority: "low", metadata: { commissionAmount, agentId } }, commSender);

    const createdAgent = (await User.findById(created.agentId).lean().exec()) as {
      name?: string;
    } | null;
    const createdLoad = (await Load.findById(created.loadId).lean().exec()) as {
      _id?: mongoose.Types.ObjectId;
    } | null;

    return jsonResponse({
      commission: mapCommission(
        created,
        {
          [created.agentId.toString()]: createdAgent?.name ?? "Unknown agent",
        },
        {
          [created.loadId.toString()]: createdLoad
            ? `LD-${createdLoad._id?.toString().slice(-6).toUpperCase()}`
            : "Unknown load",
        },
      ),
    });
  }

  if (request.method === "PATCH") {
    const payload = await parseJson(request);
    const commissionId =
      typeof payload.commissionId === "string" ? payload.commissionId.trim() : "";

    if (!commissionId) {
      throw new Error("commissionId is required");
    }

    requireRole(user, ["admin", "accounting"]);

    await connectDb();
    const commission = await Commission.findById(new mongoose.Types.ObjectId(commissionId)).exec();
    if (!commission) {
      throw new Error("Commission not found");
    }

    const allowed = ["pending", "processing", "paid"];
    const prevPayoutStatus = commission.payoutStatus;
    if (payload.payoutStatus !== undefined) {
      const payoutStatus = String(payload.payoutStatus).trim();
      if (!allowed.includes(payoutStatus)) {
        throw new Error("payoutStatus must be pending, processing, or paid");
      }
      commission.payoutStatus = payoutStatus as "pending" | "processing" | "paid";
      if (commission.payoutStatus === "paid" && !commission.payoutDate) {
        commission.payoutDate = new Date();
      }
    }

    if (payload.payoutDate !== undefined) {
      commission.payoutDate = payload.payoutDate ? new Date(String(payload.payoutDate)) : undefined;
    }
    if (payload.loadId !== undefined) {
      commission.loadId = new mongoose.Types.ObjectId(String(payload.loadId));
    }
    if (payload.agentId !== undefined) {
      commission.agentId = new mongoose.Types.ObjectId(String(payload.agentId));
    }
    if (payload.grossMarginAmount !== undefined) {
      commission.grossMarginAmount = Number(payload.grossMarginAmount);
    }
    if (payload.commissionTier !== undefined) {
      commission.commissionTier = String(payload.commissionTier);
    }
    if (payload.commissionPercent !== undefined) {
      commission.commissionPercent = Number(payload.commissionPercent);
    }
    if (payload.month !== undefined) {
      commission.month = Number(payload.month);
    }
    if (payload.year !== undefined) {
      commission.year = Number(payload.year);
    }

    commission.commissionAmount =
      Math.round(((commission.grossMarginAmount * commission.commissionPercent) / 100) * 100) / 100;

    const updated = await commission.save();

    // Emit commission payout status notifications
    const newPayoutStatus = commission.payoutStatus;
    if (newPayoutStatus !== prevPayoutStatus) {
      const patchSender: SenderContext = { userId: user.id, name: user.name, role: user.role, teamId: user.teamId };
      const patchCommId = commission._id.toString();
      const patchUrl = `/commissions?focus=${patchCommId}`;
      if (newPayoutStatus === "paid") {
        void notifyUser(commission.agentId.toString(), { title: "Commission paid", message: `Your commission of $${commission.commissionAmount.toFixed(2)} has been paid.`, notificationType: "commission_paid", relatedModule: "commissions", recordType: "Commission", recordId: patchCommId, actionUrl: patchUrl, priority: "medium", metadata: { commissionAmount: commission.commissionAmount } }, patchSender);
        void notifyAccounting({ title: "Commission paid", message: `Commission of $${commission.commissionAmount.toFixed(2)} has been marked as paid.`, notificationType: "commission_paid", relatedModule: "commissions", recordType: "Commission", recordId: patchCommId, actionUrl: patchUrl, priority: "low", metadata: { commissionAmount: commission.commissionAmount } }, patchSender);
        void notifyAdmins({ title: "Commission paid", message: `Commission of $${commission.commissionAmount.toFixed(2)} has been paid.`, notificationType: "commission_paid", relatedModule: "commissions", recordType: "Commission", recordId: patchCommId, actionUrl: patchUrl, priority: "low", metadata: { commissionAmount: commission.commissionAmount } }, patchSender);
      } else if (newPayoutStatus === "processing") {
        void notifyUser(commission.agentId.toString(), { title: "Commission processing", message: `Your commission of $${commission.commissionAmount.toFixed(2)} is being processed.`, notificationType: "commission_processing", relatedModule: "commissions", recordType: "Commission", recordId: patchCommId, actionUrl: patchUrl, priority: "low", metadata: { commissionAmount: commission.commissionAmount } }, patchSender);
        void notifyAccounting({ title: "Commission processing", message: `Commission of $${commission.commissionAmount.toFixed(2)} is now processing.`, notificationType: "commission_processing", relatedModule: "commissions", recordType: "Commission", recordId: patchCommId, actionUrl: patchUrl, priority: "low", metadata: { commissionAmount: commission.commissionAmount } }, patchSender);
      }
    }

    const updatedAgent = (await User.findById(updated.agentId).lean().exec()) as {
      name?: string;
    } | null;
    const updatedLoad = (await Load.findById(updated.loadId).lean().exec()) as {
      _id?: mongoose.Types.ObjectId;
    } | null;

    return jsonResponse({
      commission: mapCommission(
        updated,
        {
          [updated.agentId.toString()]: updatedAgent?.name ?? "Unknown agent",
        },
        {
          [updated.loadId.toString()]: updatedLoad
            ? `LD-${updatedLoad._id?.toString().slice(-6).toUpperCase()}`
            : "Unknown load",
        },
      ),
    });
  }

  if (request.method !== "GET") {
    return errorResponse(`Method ${request.method} not allowed`, 405);
  }

  await connectDb();
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const limit = Math.min(50, Math.max(5, Number(url.searchParams.get("limit") ?? 20)));
  const status = (url.searchParams.get("status") ?? "").trim();
  const sortBy = SORT_FIELDS.includes(url.searchParams.get("sortBy") as SortField)
    ? (url.searchParams.get("sortBy") as SortField)
    : "updatedAt";
  const sortOrder = url.searchParams.get("sortOrder") === "asc" ? 1 : -1;
  const exportFormat = url.searchParams.get("export");

  const filter: Record<string, unknown> = {};
  if (status) {
    (filter as Record<string, string>).payoutStatus = status;
  }

  const total = await Commission.countDocuments(filter).exec();
  const commissions = await Commission.find(filter)
    .sort({ [sortBy]: sortOrder })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean()
    .exec();

  const agentIds = Array.from(
    new Set(commissions.map((c) => c.agentId?.toString()).filter(Boolean)),
  );
  const loadIds = Array.from(new Set(commissions.map((c) => c.loadId?.toString()).filter(Boolean)));
  const [agents, loads] = await Promise.all([
    User.find({ _id: { $in: agentIds.map((id) => new mongoose.Types.ObjectId(id)) } })
      .lean()
      .exec(),
    Load.find({ _id: { $in: loadIds.map((id) => new mongoose.Types.ObjectId(id)) } })
      .lean()
      .exec(),
  ]);

  const agentMap = Object.fromEntries(
    agents.map((agent) => [
      String((agent as any)._id?.toString?.() ?? ""),
      (agent as any).name ?? "",
    ]),
  );
  const loadMap = Object.fromEntries(
    loads.map((load) => [
      String((load as any)._id?.toString?.() ?? ""),
      `LD-${String((load as any)._id?.toString?.() ?? "")
        .slice(-6)
        .toUpperCase()}`,
    ]),
  );
  const mapped = commissions.map((commission) => mapCommission(commission, agentMap, loadMap));

  if (exportFormat === "csv" || exportFormat === "xls") {
    const header = [
      "Commission ID",
      "Load Ref",
      "Agent",
      "Gross Margin",
      "Tier",
      "Rate",
      "Commission",
      "Status",
      "Payout Date",
      "Month",
      "Year",
      "Created At",
    ];
    const rows = mapped.map((commission) => [
      commission.id,
      commission.loadRef,
      commission.agentName,
      commission.grossMarginAmount.toString(),
      commission.commissionTier,
      `${commission.commissionPercent}%`,
      commission.commissionAmount.toString(),
      commission.payoutStatus,
      commission.payoutDate ?? "",
      commission.month.toString(),
      commission.year.toString(),
      commission.createdAt,
    ]);

    if (exportFormat === "csv") {
      const payload = [
        header.map(escapeCsv).join(","),
        ...rows.map((row) => row.map(escapeCsv).join(",")).join("\n"),
      ].join("\n");
      return new Response(payload, {
        status: 200,
        headers: {
          "content-type": "text/csv;charset=utf-8",
          "content-disposition": "attachment; filename=commissions.csv",
        },
      });
    }

    const html = buildExcelHtml(header, rows);
    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "application/vnd.ms-excel;charset=utf-8",
        "content-disposition": "attachment; filename=commissions.xls",
      },
    });
  }

  return jsonResponse({ commissions: mapped, total, page, limit });
}
