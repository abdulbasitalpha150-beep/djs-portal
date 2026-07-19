import { connectDb } from "../../lib/db";
import { getSessionUserFromRequest, requireAuth } from "../../lib/auth";
import { jsonResponse, parseJson, parseZod } from "../../lib/api";
import { DailyActivityLog } from "../../models/dailyActivityLog";
import { notifyTeamManager, type SenderContext } from "../../lib/notification";
import { z } from "zod";

const clockOutSchema = z.object({
  reason: z.string().optional(),
  calls: z.number().int().nonnegative().optional(),
  followups: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
  date: z.string().optional(),
});

export async function clockOutHandler(request: Request) {
  const user = await getSessionUserFromRequest(request);
  const sessionUser = requireAuth(user);
  const body = await parseJson(request);
  const payload = parseZod(clockOutSchema, body);

  await connectDb();

  const date = payload.date ?? new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  let log = await DailyActivityLog.findOne({ userId: sessionUser.id, date });

  if (!log) {
    log = await DailyActivityLog.create({
      userId: sessionUser.id,
      date,
      checkedOutAt: now,
      calls: payload.calls ?? 0,
      followups: payload.followups ?? 0,
      notes: payload.notes ?? "",
      clockStatus: "checked_out",
      endReason: payload.reason,
      sessions: [
        {
          checkedOutAt: now,
          clockStatus: "checked_out",
          calls: payload.calls ?? 0,
          followups: payload.followups ?? 0,
          notes: payload.notes ?? "",
        },
      ],
    });
  } else {
    const sessionList = (log.sessions ?? []) as Array<{
      checkedInAt?: string;
      checkedOutAt?: string;
      clockStatus?: string;
      endReason?: string;
      calls?: number;
      followups?: number;
      notes?: string;
    }>;
    const activeSession = [...sessionList]
      .reverse()
      .find((session) => session.clockStatus === "checked_in");
    const targetSession = activeSession ?? sessionList[sessionList.length - 1];

    if (targetSession) {
      targetSession.checkedOutAt = now;
      targetSession.clockStatus = "checked_out";
      targetSession.endReason = payload.reason;
      targetSession.calls = payload.calls ?? targetSession.calls ?? 0;
      targetSession.followups = payload.followups ?? targetSession.followups ?? 0;
      targetSession.notes = payload.notes ?? targetSession.notes ?? "";
    } else {
      log.sessions = [
        {
          checkedInAt: log.checkedInAt,
          checkedOutAt: now,
          clockStatus: "checked_out",
          endReason: payload.reason,
          calls: payload.calls ?? 0,
          followups: payload.followups ?? 0,
          notes: payload.notes ?? "",
        },
      ];
    }

    log.checkedOutAt = now;
    log.clockStatus = "checked_out";
    log.endReason = payload.reason;
    log.calls = payload.calls ?? log.calls ?? 0;
    log.followups = payload.followups ?? log.followups ?? 0;
    log.notes = payload.notes ?? log.notes ?? "";
    await log.save();
  }

  // Check for activity anomaly
  const anomalyKeywords = ["forgot", "missed", "error", "accident", "anomaly"];
  const reasonLower = (payload.reason ?? "").toLowerCase();
  const hasReasonAnomaly = anomalyKeywords.some((kw) => reasonLower.includes(kw));

  const allSessions = (log.sessions ?? []) as Array<{
    checkedInAt?: string;
    checkedOutAt?: string;
  }>;
  const hasLongSession = allSessions.some((s) => {
    if (!s.checkedInAt || !s.checkedOutAt) return false;
    const duration =
      new Date(s.checkedOutAt).getTime() - new Date(s.checkedInAt).getTime();
    return duration > 12 * 60 * 60 * 1000; // 12 hours
  });

  if ((hasReasonAnomaly || hasLongSession) && sessionUser.teamId) {
    const anomalySender: SenderContext = {
      userId: sessionUser.id,
      name: sessionUser.name,
      role: sessionUser.role,
      teamId: sessionUser.teamId,
    };
    void notifyTeamManager(
      sessionUser.teamId,
      {
        title: "Activity anomaly detected",
        message: `${sessionUser.name} clocked out with ${hasReasonAnomaly ? `reason: "${payload.reason}"` : "a session exceeding 12 hours"}.`,
        notificationType: "activity_anomaly",
        relatedModule: "daily_activity",
        recordType: "DailyActivityLog",
        recordId: log._id.toString(),
        actionUrl: `/activity?focus=${log._id.toString()}`,
        priority: "high",
        metadata: { reason: payload.reason, hasLongSession, date },
      },
      anomalySender,
    );
  }

  return jsonResponse({
    clockedIn: false,
    log: {
      id: log._id.toString(),
      date: log.date,
      checkedInAt: log.checkedInAt,
      checkedOutAt: log.checkedOutAt,
      calls: log.calls,
      followups: log.followups,
      notes: log.notes,
      clockStatus: log.clockStatus,
      endReason: log.endReason,
      sessions: (log.sessions ?? []).map(
        (session: {
          checkedInAt?: string;
          checkedOutAt?: string;
          clockStatus?: string;
          endReason?: string;
          calls?: number;
          followups?: number;
          notes?: string;
        }) => ({
          checkedInAt: session.checkedInAt,
          checkedOutAt: session.checkedOutAt,
          clockStatus: session.clockStatus,
          endReason: session.endReason,
          calls: session.calls ?? 0,
          followups: session.followups ?? 0,
          notes: session.notes ?? "",
        }),
      ),
    },
  });
}
