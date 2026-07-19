// @ts-nocheck
import { connectDb } from "../../lib/db";
import { getSessionUserFromRequest, requireAuth, hasRole } from "../../lib/auth";
import { jsonResponse } from "../../lib/api";
import { DailyActivityLog } from "../../models/dailyActivityLog";
import { User } from "../../models/user";

export async function activityLogsHandler(request: Request) {
  const user = await getSessionUserFromRequest(request);
  const sessionUser = requireAuth(user);

  await connectDb();

  const canSeeAll = hasRole(sessionUser, ["admin", "ops_manager", "team_manager"]);
  const filter = canSeeAll ? {} : { userId: sessionUser.id };

  const logs = await DailyActivityLog.find(filter).sort({ date: -1 }).lean().exec();

  const userIds = [...new Set(logs.map((log: { userId: string | { toString(): string } }) => log.userId.toString()))];
  const users = await User.find({ _id: { $in: userIds } })
    .lean()
    .exec();
  const userIndex = new Map(
    users.map((user: { _id: { toString(): string }; name: string; email: string }) => [user._id.toString(), { name: user.name, email: user.email }]),
  );

  return jsonResponse({
    logs: logs.map((log: any) => ({
      id: log._id.toString(),
      userId: log.userId.toString(),
      userName: userIndex.get(log.userId.toString())?.name ?? "Unknown",
      userEmail: userIndex.get(log.userId.toString())?.email ?? "",
      date: log.date,
      checkedInAt: log.checkedInAt,
      checkedOutAt: log.checkedOutAt,
      calls: log.calls,
      followups: log.followups,
      notes: log.notes,
      clockStatus: log.clockStatus,
      endReason: log.endReason,
      sessions: ((log.sessions ?? []).length > 0
        ? (log.sessions ?? [])
        : [
            {
              checkedInAt: log.checkedInAt,
              checkedOutAt: log.checkedOutAt,
              clockStatus: log.clockStatus,
              endReason: log.endReason,
              calls: log.calls ?? 0,
              followups: log.followups ?? 0,
              notes: log.notes ?? "",
            },
          ]
      ).map((session) => ({
        checkedInAt: session.checkedInAt,
        checkedOutAt: session.checkedOutAt,
        clockStatus: session.clockStatus,
        endReason: session.endReason,
        calls: session.calls ?? 0,
        followups: session.followups ?? 0,
        notes: session.notes ?? "",
      })),
    })),
  });
}
