import { connectDb } from "../../lib/db";
import { getSessionUserFromRequest, requireAuth } from "../../lib/auth";
import { jsonResponse } from "../../lib/api";
import { DailyActivityLog } from "../../models/dailyActivityLog";

type ActivitySession = {
  checkedInAt?: string;
  checkedOutAt?: string;
  clockStatus?: string;
  endReason?: string;
  calls?: number;
  followups?: number;
  notes?: string;
};

export async function clockInHandler(request: Request) {
  const user = await getSessionUserFromRequest(request);
  const sessionUser = requireAuth(user);

  await connectDb();

  const date = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  let log = await DailyActivityLog.findOne({ userId: sessionUser.id, date });

  if (!log) {
    log = await DailyActivityLog.create({
      userId: sessionUser.id,
      date,
      checkedInAt: now,
      checkedOutAt: undefined,
      calls: 0,
      followups: 0,
      notes: "",
      clockStatus: "checked_in",
      endReason: undefined,
      sessions: [
        { checkedInAt: now, clockStatus: "checked_in", calls: 0, followups: 0, notes: "" },
      ],
    });
  } else {
    const hasOpenSession = (log.sessions ?? []).some(
      (session: ActivitySession) => session.clockStatus === "checked_in",
    );
    if (!hasOpenSession) {
      log.sessions = [
        ...(log.sessions ?? []),
        { checkedInAt: now, clockStatus: "checked_in", calls: 0, followups: 0, notes: "" },
      ];
      log.checkedInAt = now;
      log.checkedOutAt = undefined;
      log.calls = 0;
      log.followups = 0;
      log.notes = "";
      log.clockStatus = "checked_in";
      log.endReason = undefined;
      await log.save();
    }
  }

  return jsonResponse({
    clockedIn: true,
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
      sessions: (log.sessions ?? []).map((session: ActivitySession) => ({
        checkedInAt: session.checkedInAt,
        checkedOutAt: session.checkedOutAt,
        clockStatus: session.clockStatus,
        endReason: session.endReason,
        calls: session.calls ?? 0,
        followups: session.followups ?? 0,
        notes: session.notes ?? "",
      })),
    },
  });
}
