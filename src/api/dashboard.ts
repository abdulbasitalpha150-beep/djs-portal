import mongoose from "mongoose";
import { connectDb } from "../lib/db";
import { getSessionUserFromRequest, requireAuth } from "../lib/auth";
import { jsonResponse } from "../lib/api";
import { Lead } from "../models/lead";
import { QuoteRequest } from "../models/quoteRequest";
import { Load } from "../models/load";
import { Customer } from "../models/customer";
import { Carrier } from "../models/carrier";
import { Invoice } from "../models/invoice";
import { Commission } from "../models/commission";
import { FollowUp } from "../models/followUp";
import { ApprovalRequest } from "../models/approvalRequest";
import { Notification } from "../models/notification";
import { User } from "../models/user";
import { Team } from "../models/team";
import { OnboardingDocument, OnboardingRequirement } from "../models/onboarding";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DashboardKpi = {
  label: string;
  value: number | string;
  icon?: string;
  delta?: string;
  trend?: "up" | "down" | "flat";
};

export type DashboardTrend = {
  week: string;
  margin: number;
  loads: number;
  revenue: number;
};

export type DashboardAgentPerf = {
  name: string;
  margin: number;
  loads: number;
};

export type DashboardTeamPerf = {
  name: string;
  revenue: number;
  loads: number;
  margin: number;
};

export type DashboardActivity = {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  actionUrl?: string;
};

export type DashboardApproval = {
  id: string;
  module: string;
  actionType: string;
  requestedByName: string;
  createdAt: string;
  newValues: Record<string, unknown>;
};

export type DashboardFollowUp = {
  id: string;
  title: string;
  dueDate: string;
  priority: string;
  leadName?: string;
};

export type DashboardRecentLoad = {
  id: string;
  loadNumber: string;
  status: string;
  origin: string;
  destination: string;
  revenue: number;
  createdAt: string;
};

export type DashboardInvoiceSummary = {
  pending: number;
  pendingTotal: number;
  paid: number;
  paidTotal: number;
  outstanding: number;
  outstandingTotal: number;
  overdue: number;
  overdueTotal: number;
};

export type DashboardCommissionSummary = {
  pending: number;
  pendingTotal: number;
  processing: number;
  processingTotal: number;
  paid: number;
  paidTotal: number;
};

export type DashboardTrainingProgress = {
  completed: number;
  total: number;
  pending: number;
  overdue: number;
  activationStatus: string;
  requirements: { key: string; label: string; status: string }[];
} | null;

export type DashboardQuickAction = {
  label: string;
  href: string;
  icon: string;
};

export type DashboardTeamInfo = {
  teamName: string;
  memberCount: number;
} | null;

export type DashboardData = {
  kpis: DashboardKpi[];
  trends: DashboardTrend[];
  agentPerformance: DashboardAgentPerf[];
  teamPerformance: DashboardTeamPerf[];
  recentActivity: DashboardActivity[];
  pendingApprovals: DashboardApproval[];
  upcomingFollowups: DashboardFollowUp[];
  recentLoads: DashboardRecentLoad[];
  invoiceSummary: DashboardInvoiceSummary | null;
  commissionSummary: DashboardCommissionSummary | null;
  trainingProgress: DashboardTrainingProgress;
  quickActions: DashboardQuickAction[];
  teamInfo: DashboardTeamInfo;
};

const EMPTY_DATA: DashboardData = {
  kpis: [],
  trends: [],
  agentPerformance: [],
  teamPerformance: [],
  recentActivity: [],
  pendingApprovals: [],
  upcomingFollowups: [],
  recentLoads: [],
  invoiceSummary: null,
  commissionSummary: null,
  trainingProgress: null,
  quickActions: [],
  teamInfo: null,
};

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as start
  d.setDate(diff);
  return d;
}

function endOfWeek(date: Date): Date {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 7);
  return d;
}

function twelveWeeksAgo(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - 84);
  return d;
}

function isoWeekKey(date: Date): string {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const week =
    1 +
    Math.round(
      ((target.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getDay() + 6) % 7)) /
        7,
    );
  return `${target.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Shared computation helpers
// ---------------------------------------------------------------------------

async function getRecentActivity(userId: string): Promise<DashboardActivity[]> {
  const docs = await Notification.find({
    recipientUserId: new mongoose.Types.ObjectId(userId),
  })
    .sort({ createdAt: -1 })
    .limit(8)
    .lean()
    .exec();

  return docs.map((d: any) => ({
    id: d._id.toString(),
    title: d.title,
    message: d.message,
    type: d.notificationType,
    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : new Date(d.createdAt).toISOString(),
    actionUrl: d.actionUrl,
  }));
}

async function getUpcomingFollowups(
  userId: string,
  teamMemberIds?: mongoose.Types.ObjectId[],
): Promise<DashboardFollowUp[]> {
  const now = new Date();
  const eow = endOfWeek(now);

  const filter: Record<string, unknown> = {
    isCompleted: false,
    dueDate: { $lte: eow },
  };

  if (teamMemberIds && teamMemberIds.length > 0) {
    filter.assignedTo = { $in: teamMemberIds };
  } else {
    filter.assignedTo = new mongoose.Types.ObjectId(userId);
  }

  const docs = await FollowUp.find(filter)
    .sort({ dueDate: 1 })
    .limit(5)
    .lean()
    .exec();

  return docs.map((d: any) => ({
    id: d._id.toString(),
    title: d.title,
    dueDate: d.dueDate instanceof Date ? d.dueDate.toISOString() : new Date(d.dueDate).toISOString(),
    priority: d.priority,
    leadName: undefined,
  }));
}

async function getTrends(
  matchFilter: Record<string, unknown>,
  weeksBack: Date,
): Promise<DashboardTrend[]> {
  const pipeline: any[] = [
    {
      $match: {
        ...matchFilter,
        createdAt: { $gte: weeksBack },
      },
    },
    {
      $addFields: {
        weekYear: {
          $dateToString: { format: "%G-W%V", date: "$createdAt" },
        },
      },
    },
    {
      $group: {
        _id: "$weekYear",
        margin: { $sum: "$grossMargin" },
        revenue: { $sum: "$revenue" },
        loads: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ];

  const results = (await Load.aggregate(pipeline).exec()) as Array<{
    _id: string;
    margin: number;
    revenue: number;
    loads: number;
  }>;

  // Fill missing weeks with zeros
  const weekMap = new Map<string, DashboardTrend>();
  for (const r of results) {
    const parts = r._id.split("W");
    const weekNum = parts[1] ? `W${parts[1]}` : r._id;
    weekMap.set(r._id, {
      week: weekNum,
      margin: r.margin || 0,
      revenue: r.revenue || 0,
      loads: r.loads || 0,
    });
  }

  // Generate all 12 week keys
  const allWeeks: DashboardTrend[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const fullKey = isoWeekKey(d);
    const weekNum = fullKey.split("W")[1] ? `W${fullKey.split("W")[1]}` : fullKey;
    const existing = weekMap.get(fullKey);
    allWeeks.push(
      existing || { week: weekNum, margin: 0, revenue: 0, loads: 0 },
    );
  }

  return allWeeks;
}

async function getAgentPerformance(
  memberIds: mongoose.Types.ObjectId[],
): Promise<DashboardAgentPerf[]> {
  if (memberIds.length === 0) return [];

  const pipeline: any[] = [
    { $match: { agentId: { $in: memberIds } } },
    {
      $group: {
        _id: "$agentId",
        margin: { $sum: "$grossMarginAmount" },
        commissionTotal: { $sum: "$commissionAmount" },
      },
    },
  ];

  const commissionAgg = (await Commission.aggregate(pipeline).exec()) as Array<{
    _id: mongoose.Types.ObjectId;
    margin: number;
    commissionTotal: number;
  }>;

  // Get load counts per agent
  const loadAgg = (await Load.aggregate([
    { $match: { agentId: { $in: memberIds } } },
    { $group: { _id: "$agentId", loads: { $sum: 1 } } },
  ]).exec()) as Array<{ _id: mongoose.Types.ObjectId; loads: number }>;

  const loadMap = new Map<string, number>();
  for (const l of loadAgg) {
    loadMap.set(l._id.toString(), l.loads);
  }

  // Get user names
  const users = await User.find({ _id: { $in: memberIds } })
    .lean()
    .exec();
  const nameMap = new Map<string, string>();
  for (const u of users as any[]) {
    nameMap.set(u._id.toString(), u.name);
  }

  return commissionAgg.map((c) => ({
    name: nameMap.get(c._id.toString())?.split(" ")[0] ?? "Unknown",
    margin: c.margin || 0,
    loads: loadMap.get(c._id.toString()) || 0,
  }));
}

async function getTeamPerformance(): Promise<DashboardTeamPerf[]> {
  const teams = (await Team.find().lean().exec()) as any[];
  if (teams.length === 0) return [];

  const result: DashboardTeamPerf[] = [];

  for (const team of teams) {
    const memberIds = (team.memberIds || []).map(
      (id: any) => new mongoose.Types.ObjectId(id.toString()),
    );
    if (team.managerId) {
      memberIds.push(new mongoose.Types.ObjectId(team.managerId.toString()));
    }

    const loadAgg = (await Load.aggregate([
      { $match: { agentId: { $in: memberIds } } },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$revenue" },
          margin: { $sum: "$grossMargin" },
          loads: { $sum: 1 },
        },
      },
    ]).exec()) as Array<{ revenue: number; margin: number; loads: number }>;

    result.push({
      name: team.name,
      revenue: loadAgg[0]?.revenue || 0,
      loads: loadAgg[0]?.loads || 0,
      margin: loadAgg[0]?.margin || 0,
    });
  }

  return result;
}

async function getInvoiceSummary(
  matchFilter: Record<string, unknown> = {},
): Promise<DashboardInvoiceSummary> {
  const baseFilter = { ...matchFilter, status: { $ne: "cancelled" } };

  const [pending, paid, outstanding, overdue] = await Promise.all([
    Invoice.countDocuments({ ...baseFilter, status: "sent" }).exec(),
    Invoice.countDocuments({ ...baseFilter, status: "paid" }).exec(),
    Invoice.countDocuments({
      ...baseFilter,
      status: { $in: ["sent", "partially_paid", "overdue"] },
    }).exec(),
    Invoice.countDocuments({ ...baseFilter, status: "overdue" }).exec(),
  ]);

  const [pendingTotal, paidTotal, outstandingTotal, overdueTotal] = await Promise.all([
    (await Invoice.aggregate([
      { $match: { ...baseFilter, status: "sent" } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]).exec()) as Array<{ total: number }>,
    (await Invoice.aggregate([
      { $match: { ...baseFilter, status: "paid" } },
      { $group: { _id: null, total: { $sum: "$amountPaid" } } },
    ]).exec()) as Array<{ total: number }>,
    (await Invoice.aggregate([
      { $match: { ...baseFilter, status: { $in: ["sent", "partially_paid", "overdue"] } } },
      { $group: { _id: null, total: { $sum: "$balanceDue" } } },
    ]).exec()) as Array<{ total: number }>,
    (await Invoice.aggregate([
      { $match: { ...baseFilter, status: "overdue" } },
      { $group: { _id: null, total: { $sum: "$balanceDue" } } },
    ]).exec()) as Array<{ total: number }>,
  ]);

  return {
    pending,
    pendingTotal: pendingTotal[0]?.total || 0,
    paid,
    paidTotal: paidTotal[0]?.total || 0,
    outstanding,
    outstandingTotal: outstandingTotal[0]?.total || 0,
    overdue,
    overdueTotal: overdueTotal[0]?.total || 0,
  };
}

async function getCommissionSummary(
  matchFilter: Record<string, unknown> = {},
): Promise<DashboardCommissionSummary> {
  const baseFilter = matchFilter;

  const [pending, processing, paid] = await Promise.all([
    (await Commission.aggregate([
      { $match: { ...baseFilter, payoutStatus: "pending" } },
      { $group: { _id: null, total: { $sum: "$commissionAmount" } } },
    ]).exec()) as Array<{ total: number; _id: null }>,
    (await Commission.aggregate([
      { $match: { ...baseFilter, payoutStatus: "processing" } },
      { $group: { _id: null, total: { $sum: "$commissionAmount" } } },
    ]).exec()) as Array<{ total: number; _id: null }>,
    (await Commission.aggregate([
      { $match: { ...baseFilter, payoutStatus: "paid" } },
      { $group: { _id: null, total: { $sum: "$commissionAmount" } } },
    ]).exec()) as Array<{ total: number; _id: null }>,
  ]);

  const [pendingCount, processingCount, paidCount] = await Promise.all([
    Commission.countDocuments({ ...baseFilter, payoutStatus: "pending" }).exec(),
    Commission.countDocuments({ ...baseFilter, payoutStatus: "processing" }).exec(),
    Commission.countDocuments({ ...baseFilter, payoutStatus: "paid" }).exec(),
  ]);

  return {
    pending: pendingCount,
    pendingTotal: pending[0]?.total || 0,
    processing: processingCount,
    processingTotal: processing[0]?.total || 0,
    paid: paidCount,
    paidTotal: paid[0]?.total || 0,
  };
}

async function getRecentLoads(
  matchFilter: Record<string, unknown>,
): Promise<DashboardRecentLoad[]> {
  const docs = await Load.find(matchFilter)
    .sort({ createdAt: -1 })
    .limit(5)
    .lean()
    .exec();

  return (docs as any[]).map((d) => ({
    id: d._id.toString(),
    loadNumber: d.loadNumber,
    status: d.status,
    origin: d.pickupCity
      ? `${d.pickupCity}${d.pickupState ? ", " + d.pickupState : ""}`
      : d.pickupAddress || "—",
    destination: d.deliveryCity
      ? `${d.deliveryCity}${d.deliveryState ? ", " + d.deliveryState : ""}`
      : d.deliveryAddress || "—",
    revenue: d.revenue || 0,
    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : new Date(d.createdAt).toISOString(),
  }));
}

async function getPendingApprovals(
  teamId?: string,
): Promise<DashboardApproval[]> {
  const filter: Record<string, unknown> = { status: "pending" };
  if (teamId) {
    filter.teamId = new mongoose.Types.ObjectId(teamId);
  }

  const docs = await ApprovalRequest.find(filter)
    .sort({ createdAt: -1 })
    .limit(5)
    .lean()
    .exec();

  return (docs as any[]).map((d) => ({
    id: d._id.toString(),
    module: d.module,
    actionType: d.actionType,
    requestedByName: d.requestedByName,
    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : new Date(d.createdAt).toISOString(),
    newValues: d.newValues || {},
  }));
}

async function getTrainingProgress(userId: string, userStatus: string): Promise<DashboardTrainingProgress> {
  const [requirements, documents] = await Promise.all([
    OnboardingRequirement.find({ active: true, required: true }).lean().exec(),
    OnboardingDocument.find({ userId: new mongoose.Types.ObjectId(userId), deleted: false }).lean().exec(),
  ]);

  const docMap = new Map<string, string>();
  for (const doc of documents as any[]) {
    // Keep the most recent status per requirement key
    docMap.set(doc.requirementKey, doc.status);
  }

  let completed = 0;
  let pending = 0;
  let overdue = 0;
  const reqList: { key: string; label: string; status: string }[] = [];

  for (const req of requirements as any[]) {
    const status = docMap.get(req.key) || "missing";
    if (status === "approved") {
      completed++;
    } else if (status === "missing" || status === "submitted" || status === "under_review") {
      pending++;
    } else if (status === "rejected") {
      overdue++;
    }
    reqList.push({ key: req.key, label: req.label, status });
  }

  const activationStatus =
    userStatus === "active"
      ? "Active"
      : userStatus === "pending" || userStatus === "pending_invitation"
        ? "Pending Activation"
        : userStatus === "suspended"
          ? "Suspended"
          : "Inactive";

  return {
    completed,
    total: requirements.length,
    pending,
    overdue,
    activationStatus,
    requirements: reqList,
  };
}

async function resolveTeamMembers(teamId: string): Promise<{ team: any; memberIds: mongoose.Types.ObjectId[] }> {
  const team = (await Team.findById(teamId).lean().exec()) as any;
  if (!team) {
    return { team: null, memberIds: [] };
  }

  const memberIds = (team.memberIds || []).map(
    (id: any) => new mongoose.Types.ObjectId(id.toString()),
  );
  // Include the manager in team queries
  if (team.managerId) {
    memberIds.push(new mongoose.Types.ObjectId(team.managerId.toString()));
  }

  return { team, memberIds };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function dashboardHandler(request: Request) {
  const user = requireAuth(await getSessionUserFromRequest(request));
  await connectDb();

  const now = new Date();
  const som = startOfMonth(now);
  const sow = startOfWeek(now);
  const eow = endOfWeek(now);
  const twelveWeeks = twelveWeeksAgo(now);
  const userId = new mongoose.Types.ObjectId(user.id);

  try {
    let data: DashboardData;

    switch (user.role) {
      case "owner":
      case "admin":
        data = await computeOwnerAdmin(user, userId, som, sow, eow, twelveWeeks, now);
        break;
      case "ops_manager":
        data = await computeOpsManager(user, userId, som, sow, eow, twelveWeeks, now);
        break;
      case "team_manager":
        data = await computeTeamManager(user, userId, som, sow, eow, twelveWeeks, now);
        break;
      case "leadagent":
        data = await computeLeadAgent(user, userId, som, sow, eow, twelveWeeks, now);
        break;
      case "agent":
        data = await computeAgent(user, userId, som, sow, eow, twelveWeeks, now);
        break;
      case "trainee":
        data = await computeTrainee(user, userId, som, sow, eow, twelveWeeks, now);
        break;
      case "accounting":
        data = await computeAccounting(user, userId, som, sow, eow, now);
        break;
      default:
        data = EMPTY_DATA;
    }

    return jsonResponse(data);
  } catch (error) {
    console.error("[dashboard] error:", error);
    return jsonResponse(EMPTY_DATA);
  }
}

// ---------------------------------------------------------------------------
// Role: Owner / Admin
// ---------------------------------------------------------------------------

async function computeOwnerAdmin(
  user: { id: string; role: string; name: string },
  userId: mongoose.Types.ObjectId,
  som: Date,
  sow: Date,
  eow: Date,
  twelveWeeks: Date,
  now: Date,
): Promise<DashboardData> {
  const [
    activeLeads,
    pendingQuotes,
    activeLoads,
    deliveredMtd,
    customersMtd,
    pendingApprovalsCount,
    commissionPendingTotal,
    commissionPaidTotal,
    invoiceOutstanding,
    invoiceOverdue,
    revenueMtdResult,
    marginMtdResult,
    recentActivity,
    pendingApprovals,
    upcomingFollowups,
    teamPerformance,
    agentPerformance,
    trends,
  ] = await Promise.all([
    Lead.countDocuments({ status: { $nin: ["lost", "customer"] } }).exec(),
    QuoteRequest.countDocuments({ status: "pending_approval" }).exec(),
    Load.countDocuments({ status: { $nin: ["delivered", "invoiced", "paid", "cancelled"] } }).exec(),
    Load.countDocuments({ status: { $in: ["delivered", "invoiced", "paid"] }, createdAt: { $gte: som } }).exec(),
    Customer.countDocuments({ createdAt: { $gte: som } }).exec(),
    ApprovalRequest.countDocuments({ status: "pending" }).exec(),
    (Commission.aggregate([
      { $match: { payoutStatus: "pending" } },
      { $group: { _id: null, total: { $sum: "$commissionAmount" } } },
    ]).exec()) as Promise<Array<{ total: number }>>,
    (Commission.aggregate([
      { $match: { payoutStatus: "paid", month: now.getMonth() + 1, year: now.getFullYear() } },
      { $group: { _id: null, total: { $sum: "$commissionAmount" } } },
    ]).exec()) as Promise<Array<{ total: number }>>,
    Invoice.countDocuments({ status: { $in: ["sent", "partially_paid", "overdue"] } }).exec(),
    Invoice.countDocuments({ status: "overdue" }).exec(),
    (Load.aggregate([
      { $match: { createdAt: { $gte: som } } },
      { $group: { _id: null, total: { $sum: "$revenue" } } },
    ]).exec()) as Promise<Array<{ total: number }>>,
    (Load.aggregate([
      { $match: { createdAt: { $gte: som } } },
      { $group: { _id: null, total: { $sum: "$grossMargin" } } },
    ]).exec()) as Promise<Array<{ total: number }>>,
    getRecentActivity(user.id),
    getPendingApprovals(),
    getUpcomingFollowups(user.id),
    getTeamPerformance(),
    (async () => {
      const agents = (await User.find({ role: { $in: ["agent", "leadagent", "team_manager"] } })
        .lean()
        .exec()) as any[];
      const agentIds = agents.map((a) => new mongoose.Types.ObjectId(a._id.toString()));
      return getAgentPerformance(agentIds);
    })(),
    getTrends({}, twelveWeeks),
  ]);

  const usd = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return {
    kpis: [
      { label: "Active Leads", value: activeLeads, icon: "users" },
      { label: "Pending Quotes", value: pendingQuotes, icon: "file" },
      { label: "Active Loads", value: activeLoads, icon: "package" },
      { label: "Delivered (MTD)", value: deliveredMtd, icon: "check" },
      { label: "Revenue (MTD)", value: usd(revenueMtdResult[0]?.total || 0), icon: "dollar" },
      { label: "Gross Margin (MTD)", value: usd(marginMtdResult[0]?.total || 0), icon: "trending" },
      { label: "Pending Approvals", value: pendingApprovalsCount, icon: "clipboard" },
      { label: "Outstanding Invoices", value: invoiceOutstanding, icon: "alert" },
    ],
    trends,
    agentPerformance,
    teamPerformance,
    recentActivity,
    pendingApprovals,
    upcomingFollowups,
    recentLoads: [],
    invoiceSummary: null,
    commissionSummary: null,
    trainingProgress: null,
    teamInfo: null,
    quickActions: [
      { label: "Approvals", href: "/approvals", icon: "clipboard" },
      { label: "New User", href: "/users", icon: "user-plus" },
      { label: "Team Management", href: "/teams", icon: "users" },
      { label: "System Admin", href: "/admin", icon: "settings" },
    ],
  };
}

// ---------------------------------------------------------------------------
// Role: Ops Manager
// ---------------------------------------------------------------------------

async function computeOpsManager(
  user: { id: string; role: string; name: string },
  userId: mongoose.Types.ObjectId,
  som: Date,
  sow: Date,
  eow: Date,
  twelveWeeks: Date,
  now: Date,
): Promise<DashboardData> {
  const [
    pendingQuotes,
    carrierApprovals,
    activeLoads,
    dispatchedLoads,
    inTransitLoads,
    deliveriesThisWeek,
    customerRequests,
    followupsDue,
    recentActivity,
    pendingApprovals,
    upcomingFollowups,
    trends,
  ] = await Promise.all([
    QuoteRequest.countDocuments({ status: "pending_approval" }).exec(),
    Carrier.countDocuments({ status: "pending" }).exec(),
    Load.countDocuments({ status: { $nin: ["delivered", "invoiced", "paid", "cancelled"] } }).exec(),
    Load.countDocuments({ status: "dispatched" }).exec(),
    Load.countDocuments({ status: "in_transit" }).exec(),
    Load.countDocuments({ status: "delivered", createdAt: { $gte: sow } }).exec(),
    Customer.countDocuments({ status: "submitted" }).exec(),
    FollowUp.countDocuments({ isCompleted: false, dueDate: { $lte: eow } }).exec(),
    getRecentActivity(user.id),
    getPendingApprovals(),
    getUpcomingFollowups(user.id),
    getTrends({}, twelveWeeks),
  ]);

  return {
    kpis: [
      { label: "Pending Quotes", value: pendingQuotes, icon: "file" },
      { label: "Carrier Approvals", value: carrierApprovals, icon: "truck" },
      { label: "Active Loads", value: activeLoads, icon: "package" },
      { label: "Dispatched", value: dispatchedLoads, icon: "package" },
      { label: "In Transit", value: inTransitLoads, icon: "package" },
      { label: "Delivered (This Week)", value: deliveriesThisWeek, icon: "check" },
    ],
    trends,
    agentPerformance: [],
    teamPerformance: [],
    recentActivity,
    pendingApprovals,
    upcomingFollowups,
    recentLoads: [],
    invoiceSummary: null,
    commissionSummary: null,
    trainingProgress: null,
    teamInfo: null,
    quickActions: [
      { label: "Approvals", href: "/approvals", icon: "clipboard" },
      { label: "Loads Board", href: "/loads", icon: "package" },
      { label: "Carrier Review", href: "/carriers", icon: "truck" },
    ],
  };
}

// ---------------------------------------------------------------------------
// Role: Team Manager
// ---------------------------------------------------------------------------

async function computeTeamManager(
  user: { id: string; role: string; name: string; teamId?: string },
  userId: mongoose.Types.ObjectId,
  som: Date,
  sow: Date,
  eow: Date,
  twelveWeeks: Date,
  now: Date,
): Promise<DashboardData> {
  if (!user.teamId) {
    return { ...EMPTY_DATA, recentActivity: await getRecentActivity(user.id) };
  }

  const { team, memberIds } = await resolveTeamMembers(user.teamId);
  if (!team || memberIds.length === 0) {
    return { ...EMPTY_DATA, recentActivity: await getRecentActivity(user.id) };
  }

  const agentFilter = { agentId: { $in: memberIds } };
  const teamFilter = { teamId: new mongoose.Types.ObjectId(user.teamId) };

  const [
    teamLeads,
    teamQuotesPending,
    teamActiveLoads,
    teamDeliveredMtd,
    teamRevenueResult,
    teamMarginResult,
    teamPendingApprovalsCount,
    teamFollowupsDue,
    recentActivity,
    pendingApprovals,
    upcomingFollowups,
    agentPerformance,
    trends,
  ] = await Promise.all([
    Lead.countDocuments({ ownerId: { $in: memberIds }, status: { $nin: ["lost", "customer"] } }).exec(),
    QuoteRequest.countDocuments({ ...agentFilter, status: "pending_approval" }).exec(),
    Load.countDocuments({ ...agentFilter, status: { $nin: ["delivered", "invoiced", "paid", "cancelled"] } }).exec(),
    Load.countDocuments({ ...agentFilter, status: { $in: ["delivered", "invoiced", "paid"] }, createdAt: { $gte: som } }).exec(),
    (Load.aggregate([
      { $match: { ...agentFilter, createdAt: { $gte: som } } },
      { $group: { _id: null, total: { $sum: "$revenue" } } },
    ]).exec()) as Promise<Array<{ total: number }>>,
    (Load.aggregate([
      { $match: { ...agentFilter, createdAt: { $gte: som } } },
      { $group: { _id: null, total: { $sum: "$grossMargin" } } },
    ]).exec()) as Promise<Array<{ total: number }>>,
    ApprovalRequest.countDocuments({ ...teamFilter, status: "pending" }).exec(),
    FollowUp.countDocuments({ assignedTo: { $in: memberIds }, isCompleted: false, dueDate: { $lte: eow } }).exec(),
    getRecentActivity(user.id),
    getPendingApprovals(user.teamId),
    getUpcomingFollowups(user.id, memberIds),
    getAgentPerformance(memberIds),
    getTrends(agentFilter, twelveWeeks),
  ]);

  const usd = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return {
    kpis: [
      { label: "Team Leads", value: teamLeads, icon: "users" },
      { label: "Team Quotes Pending", value: teamQuotesPending, icon: "file" },
      { label: "Team Active Loads", value: teamActiveLoads, icon: "package" },
      { label: "Team Delivered (MTD)", value: teamDeliveredMtd, icon: "check" },
      { label: "Team Revenue (MTD)", value: usd(teamRevenueResult[0]?.total || 0), icon: "dollar" },
      { label: "Team Pending Approvals", value: teamPendingApprovalsCount, icon: "clipboard" },
    ],
    trends,
    agentPerformance,
    teamPerformance: [],
    recentActivity,
    pendingApprovals,
    upcomingFollowups,
    recentLoads: [],
    invoiceSummary: null,
    commissionSummary: null,
    trainingProgress: null,
    teamInfo: { teamName: team.name, memberCount: memberIds.length },
    quickActions: [
      { label: "Team Approvals", href: "/approvals", icon: "clipboard" },
      { label: "Team Loads", href: "/loads", icon: "package" },
      { label: "Team Reports", href: "/dashboard", icon: "chart" },
    ],
  };
}

// ---------------------------------------------------------------------------
// Role: Lead Agent
// ---------------------------------------------------------------------------

async function computeLeadAgent(
  user: { id: string; role: string; name: string; teamId?: string },
  userId: mongoose.Types.ObjectId,
  som: Date,
  sow: Date,
  eow: Date,
  twelveWeeks: Date,
  now: Date,
): Promise<DashboardData> {
  const myFilter = { agentId: userId };

  let teamMemberIds: mongoose.Types.ObjectId[] = [userId];
  let teamInfo: DashboardTeamInfo = null;

  if (user.teamId) {
    const { team, memberIds } = await resolveTeamMembers(user.teamId);
    if (team && memberIds.length > 0) {
      teamMemberIds = memberIds;
      teamInfo = { teamName: team.name, memberCount: memberIds.length };
    }
  }

  const teamFilter = { agentId: { $in: teamMemberIds } };

  const [
    myQuotes,
    myActiveLoads,
    teamQuotes,
    teamLoads,
    pendingFollowups,
    approvalsPending,
    recentActivity,
    upcomingFollowups,
    agentPerformance,
    trends,
  ] = await Promise.all([
    QuoteRequest.countDocuments({ ...myFilter, status: "pending_approval" }).exec(),
    Load.countDocuments({ ...myFilter, status: { $nin: ["delivered", "invoiced", "paid", "cancelled"] } }).exec(),
    QuoteRequest.countDocuments({ ...teamFilter, status: "pending_approval" }).exec(),
    Load.countDocuments({ ...teamFilter, status: { $nin: ["delivered", "invoiced", "paid", "cancelled"] } }).exec(),
    FollowUp.countDocuments({ assignedTo: userId, isCompleted: false, dueDate: { $lte: eow } }).exec(),
    ApprovalRequest.countDocuments({ status: "pending", teamId: user.teamId ? new mongoose.Types.ObjectId(user.teamId) : undefined }).exec(),
    getRecentActivity(user.id),
    getUpcomingFollowups(user.id, teamMemberIds),
    getAgentPerformance(teamMemberIds),
    getTrends(teamFilter, twelveWeeks),
  ]);

  return {
    kpis: [
      { label: "My Quotes", value: myQuotes, icon: "file" },
      { label: "My Active Loads", value: myActiveLoads, icon: "package" },
      { label: "Team Quotes", value: teamQuotes, icon: "file" },
      { label: "Team Loads", value: teamLoads, icon: "package" },
      { label: "Pending Follow-ups", value: pendingFollowups, icon: "calendar" },
      { label: "Approvals Pending", value: approvalsPending, icon: "clipboard" },
    ],
    trends,
    agentPerformance,
    teamPerformance: [],
    recentActivity,
    pendingApprovals: [],
    upcomingFollowups,
    recentLoads: [],
    invoiceSummary: null,
    commissionSummary: null,
    trainingProgress: null,
    teamInfo,
    quickActions: [
      { label: "New Quote", href: "/quotes", icon: "file" },
      { label: "New Load", href: "/loads", icon: "package" },
      { label: "Team View", href: "/teams", icon: "users" },
    ],
  };
}

// ---------------------------------------------------------------------------
// Role: Agent
// ---------------------------------------------------------------------------

async function computeAgent(
  user: { id: string; role: string; name: string; status: string },
  userId: mongoose.Types.ObjectId,
  som: Date,
  sow: Date,
  eow: Date,
  twelveWeeks: Date,
  now: Date,
): Promise<DashboardData> {
  const myFilter = { agentId: userId };

  const [
    myLeads,
    myQuotesPending,
    myActiveLoads,
    myDeliveredMtd,
    myCustomers,
    myCommissionPending,
    myCommissionPaid,
    myRevenueMtd,
    myFollowupsDue,
    recentActivity,
    upcomingFollowups,
    recentLoads,
    commissionSummary,
    trends,
  ] = await Promise.all([
    Lead.countDocuments({ ownerId: userId, status: { $nin: ["lost", "customer"] } }).exec(),
    QuoteRequest.countDocuments({ ...myFilter, status: "pending_approval" }).exec(),
    Load.countDocuments({ ...myFilter, status: { $nin: ["delivered", "invoiced", "paid", "cancelled"] } }).exec(),
    Load.countDocuments({ ...myFilter, status: { $in: ["delivered", "invoiced", "paid"] }, createdAt: { $gte: som } }).exec(),
    Customer.countDocuments({ ...myFilter }).exec(),
    (Commission.aggregate([
      { $match: { agentId: userId, payoutStatus: "pending" } },
      { $group: { _id: null, total: { $sum: "$commissionAmount" } } },
    ]).exec()) as Promise<Array<{ total: number }>>,
    (Commission.aggregate([
      { $match: { agentId: userId, payoutStatus: "paid", month: now.getMonth() + 1, year: now.getFullYear() } },
      { $group: { _id: null, total: { $sum: "$commissionAmount" } } },
    ]).exec()) as Promise<Array<{ total: number }>>,
    (Load.aggregate([
      { $match: { ...myFilter, createdAt: { $gte: som } } },
      { $group: { _id: null, total: { $sum: "$revenue" } } },
    ]).exec()) as Promise<Array<{ total: number }>>,
    FollowUp.countDocuments({ assignedTo: userId, isCompleted: false, dueDate: { $lte: eow } }).exec(),
    getRecentActivity(user.id),
    getUpcomingFollowups(user.id),
    getRecentLoads(myFilter),
    getCommissionSummary({ agentId: userId }),
    getTrends(myFilter, twelveWeeks),
  ]);

  const usd = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return {
    kpis: [
      { label: "My Leads", value: myLeads, icon: "users" },
      { label: "My Quotes Pending", value: myQuotesPending, icon: "file" },
      { label: "My Active Loads", value: myActiveLoads, icon: "package" },
      { label: "My Delivered (MTD)", value: myDeliveredMtd, icon: "check" },
      { label: "My Revenue (MTD)", value: usd(myRevenueMtd[0]?.total || 0), icon: "dollar" },
      { label: "My Commission Pending", value: usd(myCommissionPending[0]?.total || 0), icon: "dollar" },
    ],
    trends,
    agentPerformance: [],
    teamPerformance: [],
    recentActivity,
    pendingApprovals: [],
    upcomingFollowups,
    recentLoads,
    invoiceSummary: null,
    commissionSummary,
    trainingProgress: null,
    teamInfo: null,
    quickActions: [
      { label: "New Quote", href: "/quotes", icon: "file" },
      { label: "New Lead", href: "/leads", icon: "users" },
      { label: "New Follow-up", href: "/followups", icon: "calendar" },
      // { label: "My Documents", href: "/onboarding", icon: "folder" },
    ],
  };
}

// ---------------------------------------------------------------------------
// Role: Trainee
// ---------------------------------------------------------------------------

async function computeTrainee(
  user: { id: string; role: string; name: string; status: string },
  userId: mongoose.Types.ObjectId,
  som: Date,
  sow: Date,
  eow: Date,
  twelveWeeks: Date,
  now: Date,
): Promise<DashboardData> {
  const myFilter = { agentId: userId };

  const [
    myLeads,
    myFollowupsDue,
    trainingProgress,
    recentActivity,
    upcomingFollowups,
  ] = await Promise.all([
    Lead.countDocuments({ ownerId: userId, status: { $nin: ["lost", "customer"] } }).exec(),
    FollowUp.countDocuments({ assignedTo: userId, isCompleted: false, dueDate: { $lte: eow } }).exec(),
    getTrainingProgress(user.id, user.status),
    getRecentActivity(user.id),
    getUpcomingFollowups(user.id),
  ]);

  const isActive = user.status === "active";

  return {
    kpis: [
      { label: "My Leads", value: myLeads, icon: "users" },
      { label: "Follow-ups Due", value: myFollowupsDue, icon: "calendar" },
      {
        label: "Documents Approved",
        value: trainingProgress?.completed ?? 0,
        icon: "check",
      },
      {
        label: "Documents Pending",
        value: trainingProgress?.pending ?? 0,
        icon: "alert",
      },
    ],
    trends: [],
    agentPerformance: [],
    teamPerformance: [],
    recentActivity,
    pendingApprovals: [],
    upcomingFollowups,
    recentLoads: [],
    invoiceSummary: null,
    commissionSummary: null,
    trainingProgress,
    teamInfo: null,
    quickActions: isActive
      ? [
          { label: "New Quote", href: "/quotes", icon: "file" },
          { label: "New Lead", href: "/leads", icon: "users" },
        ]
      : [
          // { label: "Upload Document", href: "/onboarding", icon: "folder" },
          // { label: "View Training", href: "/onboarding", icon: "graduation" },
          { label: "New Lead", href: "/leads", icon: "users" },
        ],
  };
}

// ---------------------------------------------------------------------------
// Role: Accounting
// ---------------------------------------------------------------------------

async function computeAccounting(
  user: { id: string; role: string; name: string },
  userId: mongoose.Types.ObjectId,
  som: Date,
  sow: Date,
  eow: Date,
  now: Date,
): Promise<DashboardData> {
  const [invoiceSummary, commissionSummary, recentActivity, upcomingFollowups] =
    await Promise.all([
      getInvoiceSummary(),
      getCommissionSummary(),
      getRecentActivity(user.id),
      getUpcomingFollowups(user.id),
    ]);

  const usd = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return {
    kpis: [
      { label: "Pending Invoices", value: invoiceSummary.pending, icon: "file" },
      { label: "Paid (MTD)", value: invoiceSummary.paid, icon: "check" },
      {
        label: "Outstanding Total",
        value: usd(invoiceSummary.outstandingTotal),
        icon: "dollar",
      },
      { label: "Overdue Invoices", value: invoiceSummary.overdue, icon: "alert" },
      {
        label: "Commission Pending",
        value: commissionSummary.pending,
        icon: "dollar",
      },
      {
        label: "Commission Paid (MTD)",
        value: commissionSummary.paid,
        icon: "check",
      },
    ],
    trends: [],
    agentPerformance: [],
    teamPerformance: [],
    recentActivity,
    pendingApprovals: [],
    upcomingFollowups,
    recentLoads: [],
    invoiceSummary,
    commissionSummary,
    trainingProgress: null,
    teamInfo: null,
    quickActions: [
      { label: "Create Invoice", href: "/invoices", icon: "file" },
      { label: "Payment Reports", href: "/invoices", icon: "chart" },
      { label: "Commission Payouts", href: "/commissions", icon: "dollar" },
    ],
  };
}
