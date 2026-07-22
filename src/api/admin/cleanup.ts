import { connectDb } from "../../lib/db";
import { getSessionUserFromRequest, requireAuth } from "../../lib/auth";
import { jsonResponse } from "../../lib/api";
import { cleanupOldNotifications, cleanupOldSessionLogs } from "../../lib/notification";

/**
 * Admin endpoint for manual cleanup of old data.
 * Deletes:
 *  - Notifications read >24 hours ago
 *  - Notifications unread >2 weeks old
 *  - Login/session logs >2 months old
 * 
 * Requires admin or owner role for security.
 */
export async function cleanupHandler(request: Request) {
  const user = await getSessionUserFromRequest(request);
  const sessionUser = requireAuth(user);
  
  // Only admins/owners can trigger cleanup
  if (!["admin", "owner"].includes(sessionUser.role)) {
    throw Object.assign(new Error("Unauthorized: Admin access required"), { status: 403 });
  }

  await connectDb();

  try {
    const [notificationResult, sessionLogResult] = await Promise.all([
      cleanupOldNotifications(),
      cleanupOldSessionLogs(),
    ]);

    const totalDeleted = notificationResult.deletedCount + sessionLogResult.deletedCount;

    return jsonResponse({
      ok: true,
      message: `Cleanup complete. Deleted ${totalDeleted} total records.`,
      timestamp: new Date().toISOString(),
      results: {
        notifications: {
          total: notificationResult.deletedCount,
          readNotifications: notificationResult.details.readNotifications,
          unreadNotifications: notificationResult.details.unreadNotifications,
        },
        sessionLogs: {
          total: sessionLogResult.deletedCount,
        },
        grandTotal: totalDeleted,
      },
    });
  } catch (error) {
    console.error("[cleanup] cleanup failed:", error);
    throw Object.assign(new Error("Cleanup failed"), { status: 500 });
  }
}
