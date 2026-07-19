import { connectDb } from "../../lib/db";
import { getSessionUserFromRequest, requireAuth } from "../../lib/auth";
import { jsonResponse, parseJson } from "../../lib/api";
import { User } from "../../models/user";
import { recordAudit } from "../../lib/audit";

export async function changePasswordHandler(request: Request) {
  const user = requireAuth(await getSessionUserFromRequest(request));
  await connectDb();
  const payload = await parseJson(request);

  const currentPassword =
    typeof payload.currentPassword === "string" ? payload.currentPassword : "";
  const newPassword = typeof payload.newPassword === "string" ? payload.newPassword : "";
  const confirmPassword =
    typeof payload.confirmPassword === "string" ? payload.confirmPassword : "";

  if (!currentPassword || !newPassword || !confirmPassword) {
    throw Object.assign(
      new Error("Current password, new password, and confirm password are required"),
      { status: 400 },
    );
  }
  if (newPassword !== confirmPassword) {
    throw Object.assign(new Error("New password and confirm password must match"), { status: 400 });
  }
  if (newPassword.length < 6) {
    throw Object.assign(new Error("New password must be at least 6 characters long"), {
      status: 400,
    });
  }

  const targetUser = await User.findById(user.id).exec();
  if (!targetUser) {
    throw Object.assign(new Error("User not found"), { status: 404 });
  }

  // Verify current password
  const isPasswordValid = await targetUser.comparePassword(currentPassword);
  if (!isPasswordValid) {
    throw Object.assign(new Error("Current password is incorrect"), { status: 400 });
  }

  // Check monthly password change limit
  const currentMonth = new Date().toISOString().substring(0, 7);
  if (targetUser.passwordChangeMonth !== currentMonth) {
    targetUser.passwordChangeCount = 0;
    targetUser.passwordChangeMonth = currentMonth;
  }

  if (targetUser.passwordChangeCount >= 2) {
    throw Object.assign(
      new Error(
        "You have reached the monthly password change limit. Please contact your account owner or administrator.",
      ),
      { status: 429 },
    );
  }

  targetUser.password = newPassword;
  targetUser.isTemporaryPassword = false;
  targetUser.passwordChangeCount += 1;
  targetUser.passwordLastChangedAt = new Date();
  await targetUser.save();

  await recordAudit({
    actorId: targetUser._id.toString(),
    actionType: "password_changed",
    targetType: "user",
    targetId: targetUser._id.toString(),
    metadata: { email: targetUser.email },
  });

  return jsonResponse({
    success: true,
    user: {
      id: targetUser._id.toString(),
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
      status: targetUser.status,
      isTemporaryPassword: targetUser.isTemporaryPassword,
      passwordChangeCount: targetUser.passwordChangeCount,
      passwordChangeMonth: targetUser.passwordChangeMonth,
      passwordLastChangedAt: targetUser.passwordLastChangedAt,
    },
  });
}
