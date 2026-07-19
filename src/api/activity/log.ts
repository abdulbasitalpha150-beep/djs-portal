import { connectDb } from "../../lib/db";
import { getSessionUserFromRequest, requireAuth } from "../../lib/auth";
import { errorResponse, jsonResponse, parseJson, parseZod } from "../../lib/api";
import { DailyActivityLog } from "../../models/dailyActivityLog";
import { z } from "zod";

const activityLogSchema = z.object({
  checkedInAt: z.string().optional(),
  checkedOutAt: z.string().optional(),
  calls: z.number().int().nonnegative(),
  followups: z.number().int().nonnegative(),
  notes: z.string().optional(),
  date: z.string().optional(),
});

export async function activityLogHandler(request: Request) {
  const user = await getSessionUserFromRequest(request);
  const sessionUser = requireAuth(user);
  const body = await parseJson(request);
  const payload = parseZod(activityLogSchema, body);

  await connectDb();

  const date = payload.date ?? new Date().toISOString().slice(0, 10);

  let log = await DailyActivityLog.findOne({ userId: sessionUser.id, date });

  if (!log) {
    log = await DailyActivityLog.create({
      userId: sessionUser.id,
      date,
      checkedInAt: payload.checkedInAt,
      checkedOutAt: payload.checkedOutAt,
      calls: payload.calls,
      followups: payload.followups,
      notes: payload.notes ?? "",
      clockStatus: "checked_out",
      sessions: [],
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
      .find(
        (session: {
          checkedInAt?: string;
          checkedOutAt?: string;
          clockStatus?: string;
          endReason?: string;
          calls?: number;
          followups?: number;
          notes?: string;
        }) => session.clockStatus === "checked_in",
      );
    const targetSession = activeSession ?? sessionList[sessionList.length - 1];

    if (targetSession) {
      targetSession.calls = payload.calls;
      targetSession.followups = payload.followups;
      targetSession.notes = payload.notes ?? "";
      if (payload.checkedInAt) {
        targetSession.checkedInAt = payload.checkedInAt;
      }
      if (payload.checkedOutAt) {
        targetSession.checkedOutAt = payload.checkedOutAt;
      }
      targetSession.clockStatus = payload.checkedOutAt ? "checked_out" : "checked_in";
    } else if ((log.sessions ?? []).length === 0) {
      log.sessions = [
        {
          checkedInAt: payload.checkedInAt,
          checkedOutAt: payload.checkedOutAt,
          clockStatus: payload.checkedOutAt ? "checked_out" : "checked_in",
          calls: payload.calls,
          followups: payload.followups,
          notes: payload.notes ?? "",
        },
      ];
    }

    log.checkedInAt = payload.checkedInAt ?? log.checkedInAt;
    log.checkedOutAt = payload.checkedOutAt ?? log.checkedOutAt;
    log.calls = payload.calls;
    log.followups = payload.followups;
    log.notes = payload.notes ?? "";

    if (payload.checkedInAt && !log.checkedOutAt) {
      log.clockStatus = "checked_in";
    } else if (payload.checkedOutAt) {
      log.clockStatus = "checked_out";
    }

    await log.save();
  }

  return jsonResponse({
    log: {
      id: log._id.toString(),
      date: log.date,
      checkedInAt: log.checkedInAt,
      checkedOutAt: log.checkedOutAt,
      calls: log.calls,
      followups: log.followups,
      notes: log.notes,
      clockStatus: log.clockStatus,
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
