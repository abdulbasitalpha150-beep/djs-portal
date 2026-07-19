import mongoose from "mongoose";
import { connectDb } from "../../lib/db";
import { getSessionUserFromRequest, requireAuth } from "../../lib/auth";
import { jsonResponse } from "../../lib/api";
import { Notification } from "../../models/notification";
import { Load } from "../../models/load";
import { Customer } from "../../models/customer";
import { QuoteRequest } from "../../models/quoteRequest";
import { Invoice } from "../../models/invoice";
import { FollowUp } from "../../models/followUp";
import { ApprovalRequest } from "../../models/approvalRequest";
import { createNotification } from "../../lib/notification";

/**
 * On-demand KPI / follow-up / overdue notification generator.
 *
 * Called by the frontend whenever the notifications page or bell is rendered.
 * Generates idempotent daily notifications:
 *  - kpi_summary: one per user per day with role-appropriate KPIs
 *  - followup_due / followup_overdue: one per follow-up per day per user
 *  - invoice_overdue: one per overdue invoice per day for accounting/admin users
 *  - quote_expiring: one per expiring quote per day for the agent + approvers
 *
 * All generation is wrapped in try/catch so the endpoint never breaks.
 */
export async function kpiSummaryHandler(request: Request) {
  const user = requireAuth(await getSessionUserFromRequest(request));
  await connectDb();

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const startOfToday = new Date(today + "T00:00:00.000Z");
  const endOfToday = new Date(today + "T23:59:59.999Z");

  try {
    // 1. KPI Summary (one per user per day)
    await generateKpiSummary(user, today, startOfToday, endOfToday);

    // 2. Follow-up reminders (due today / overdue)
    await generateFollowUpReminders(user, today, now);

    // 3. Overdue invoice alerts (accounting / admin / owner only)
    if (["accounting", "admin", "owner"].includes(user.role)) {
      await generateOverdueInvoiceAlerts(user, today, now);
    }

    // 4. Expiring quote alerts (agent + approvers)
    await generateQuoteExpiringAlerts(user, today, now);
  } catch (error) {
    console.error("[kpi-summary] generation failed:", error);
  }

  return jsonResponse({ ok: true, date: today });
}

// ---------------------------------------------------------------------------
// KPI Summary
// ---------------------------------------------------------------------------

async function generateKpiSummary(
  user: { id: string; role: string; name: string; teamId?: string },
  today: string,
  startOfToday: Date,
  endOfToday: Date,
): Promise<void> {
  const existing = await Notification.findOne({
    recipientUserId: new mongoose.Types.ObjectId(user.id),
    notificationType: "kpi_summary",
    "metadata.date": today,
  })
    .lean()
    .exec();

  if (existing) return;

  const kpis = await computeKPIs(user, startOfToday, endOfToday);
  const message = formatKpiMessage(kpis);

  await createNotification({
    recipientUserId: user.id,
    recipientRole: user.role,
    title: "Your daily summary",
    message,
    notificationType: "kpi_summary",
    relatedModule: "kpi",
    priority: "low",
    metadata: { date: today, ...kpis },
  });
}

async function computeKPIs(
  user: { id: string; role: string; teamId?: string },
  startOfToday: Date,
  endOfToday: Date,
): Promise<Record<string, number>> {
  const isAdmin = ["owner", "admin", "ops_manager"].includes(user.role);
  const isAccounting = user.role === "accounting";
  const isAgent = ["agent", "trainee"].includes(user.role);
  const isTeamLead = ["team_manager", "leadagent"].includes(user.role);

  const userFilter = isAgent
    ? { agentId: new mongoose.Types.ObjectId(user.id) }
    : {};

  const todayRange = { createdAt: { $gte: startOfToday, $lte: endOfToday } };

  try {
    if (isAccounting) {
      const [overdueInvoices, outstandingInvoices] = await Promise.all([
        Invoice.countDocuments({ status: "overdue" }).exec(),
        Invoice.countDocuments({ status: { $in: ["sent", "partially_paid", "overdue"] } }).exec(),
      ]);
      return { overdueInvoices, outstandingInvoices };
    }

    const [todayLoads, todayCustomers, pendingApprovals, outstandingInvoices] =
      await Promise.all([
        Load.countDocuments({ ...todayRange, ...userFilter }).exec(),
        Customer.countDocuments({ ...todayRange, ...userFilter }).exec(),
        isAdmin || isTeamLead
          ? ApprovalRequest.countDocuments({ status: "pending" }).exec()
          : Promise.resolve(0),
        isAdmin
          ? Invoice.countDocuments({
              status: { $in: ["sent", "partially_paid", "overdue"] },
            }).exec()
          : Promise.resolve(0),
      ]);

    // Today's revenue from loads
    let todayRevenue = 0;
    if (!isAccounting) {
      const revenueResult = (await Load.aggregate([
        { $match: { ...todayRange, ...userFilter } },
        { $group: { _id: null, total: { $sum: "$revenue" } } },
      ]).exec()) as Array<{ total: number }>;
      todayRevenue = revenueResult[0]?.total ?? 0;
    }

    return {
      todayLoads,
      todayRevenue,
      todayCustomers,
      pendingApprovals,
      outstandingInvoices,
    };
  } catch {
    return {};
  }
}

function formatKpiMessage(kpis: Record<string, number>): string {
  const parts: string[] = [];
  if ("todayLoads" in kpis) parts.push(`Loads today: ${kpis.todayLoads}`);
  if ("todayRevenue" in kpis)
    parts.push(`Revenue today: $${(kpis.todayRevenue ?? 0).toFixed(2)}`);
  if ("todayCustomers" in kpis)
    parts.push(`New customers: ${kpis.todayCustomers}`);
  if ("pendingApprovals" in kpis && kpis.pendingApprovals > 0)
    parts.push(`Pending approvals: ${kpis.pendingApprovals}`);
  if ("outstandingInvoices" in kpis && kpis.outstandingInvoices > 0)
    parts.push(`Outstanding invoices: ${kpis.outstandingInvoices}`);
  if ("overdueInvoices" in kpis && kpis.overdueInvoices > 0)
    parts.push(`Overdue invoices: ${kpis.overdueInvoices}`);

  return parts.length ? parts.join(" • ") : "No notable activity today.";
}

// ---------------------------------------------------------------------------
// Follow-up reminders
// ---------------------------------------------------------------------------

async function generateFollowUpReminders(
  user: { id: string; role: string; name: string; teamId?: string },
  today: string,
  now: Date,
): Promise<void> {
  const startOfToday = new Date(today + "T00:00:00.000Z");
  const endOfToday = new Date(today + "T23:59:59.999Z");

  const followUps = (await FollowUp.find({
    assignedTo: new mongoose.Types.ObjectId(user.id),
    isCompleted: false,
    $or: [
      { dueDate: { $gte: startOfToday, $lte: endOfToday } },
      { dueDate: { $lt: now } },
    ],
  })
    .lean()
    .exec()) as Array<{
    _id: mongoose.Types.ObjectId;
    title: string;
    dueDate: Date;
  }>;

  for (const fu of followUps) {
    const fuId = fu._id.toString();
    const isOverdue = new Date(fu.dueDate).getTime() < now.getTime();
    const notificationType = isOverdue ? "followup_overdue" : "followup_due";

    // Idempotency check
    const existing = await Notification.findOne({
      recipientUserId: new mongoose.Types.ObjectId(user.id),
      notificationType,
      recordId: fu._id,
      "metadata.date": today,
    })
      .lean()
      .exec();

    if (existing) continue;

    await createNotification({
      recipientUserId: user.id,
      recipientRole: user.role,
      title: isOverdue ? "Follow-up overdue" : "Follow-up due today",
      message: `"${fu.title}" is ${isOverdue ? "overdue" : "due today"}.`,
      notificationType,
      relatedModule: "followups",
      recordType: "FollowUp",
      recordId: fuId,
      actionUrl: `/followups?focus=${fuId}`,
      priority: isOverdue ? "high" : "medium",
      metadata: { date: today, followUpId: fuId },
    });
  }
}

// ---------------------------------------------------------------------------
// Overdue invoice alerts
// ---------------------------------------------------------------------------

async function generateOverdueInvoiceAlerts(
  user: { id: string; role: string; name: string; teamId?: string },
  today: string,
  now: Date,
): Promise<void> {
  const overdueInvoices = (await Invoice.find({
    status: { $in: ["overdue", "sent"] },
    dueDate: { $lt: now },
  })
    .lean()
    .exec()) as Array<{
    _id: mongoose.Types.ObjectId;
    invoiceNumber: string;
    total: number;
  }>;

  for (const inv of overdueInvoices) {
    const invId = inv._id.toString();

    const existing = await Notification.findOne({
      recipientUserId: new mongoose.Types.ObjectId(user.id),
      notificationType: "invoice_overdue",
      recordId: inv._id,
      "metadata.date": today,
    })
      .lean()
      .exec();

    if (existing) continue;

    await createNotification({
      recipientUserId: user.id,
      recipientRole: user.role,
      title: "Invoice overdue",
      message: `Invoice ${inv.invoiceNumber} ($${(inv.total ?? 0).toFixed(2)}) is overdue.`,
      notificationType: "invoice_overdue",
      relatedModule: "invoices",
      recordType: "Invoice",
      recordId: invId,
      actionUrl: `/invoices?focus=${invId}`,
      priority: "high",
      metadata: { date: today, invoiceId: invId, invoiceNumber: inv.invoiceNumber },
    });
  }
}

// ---------------------------------------------------------------------------
// Expiring quote alerts
// ---------------------------------------------------------------------------

async function generateQuoteExpiringAlerts(
  user: { id: string; role: string; name: string; teamId?: string },
  today: string,
  now: Date,
): Promise<void> {
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Only agents/trainees get their own expiring quotes
  // Admins/ops get all expiring quotes
  const quoteFilter: Record<string, unknown> = {
    status: "pending_approval",
    createdAt: { $lt: sevenDaysAgo },
  };

  if (user.role === "agent" || user.role === "trainee") {
    quoteFilter.agentId = new mongoose.Types.ObjectId(user.id);
  } else if (user.role === "team_manager" || user.role === "leadagent") {
    // Team-scoped: can't easily filter by team here, so skip for non-admin
    return;
  } else if (!["owner", "admin", "ops_manager"].includes(user.role)) {
    return;
  }

  const expiringQuotes = (await QuoteRequest.find(quoteFilter)
    .limit(20)
    .lean()
    .exec()) as Array<{
    _id: mongoose.Types.ObjectId;
    agentId?: mongoose.Types.ObjectId;
  }>;

  for (const quote of expiringQuotes) {
    const quoteId = quote._id.toString();

    // Only notify if the quote belongs to this agent (for agent/trainee)
    // or if this is an admin/ops (who see all)
    const shouldNotify =
      user.role === "agent" || user.role === "trainee"
        ? quote.agentId?.toString() === user.id
        : true;

    if (!shouldNotify) continue;

    const existing = await Notification.findOne({
      recipientUserId: new mongoose.Types.ObjectId(user.id),
      notificationType: "quote_expiring",
      recordId: quote._id,
      "metadata.date": today,
    })
      .lean()
      .exec();

    if (existing) continue;

    await createNotification({
      recipientUserId: user.id,
      recipientRole: user.role,
      title: "Quote expiring soon",
      message: `A pending quote has been awaiting approval for over 7 days.`,
      notificationType: "quote_expiring",
      relatedModule: "quotes",
      recordType: "QuoteRequest",
      recordId: quoteId,
      actionUrl: `/quotes?focus=${quoteId}`,
      priority: "medium",
      metadata: { date: today, quoteId },
    });
  }
}
