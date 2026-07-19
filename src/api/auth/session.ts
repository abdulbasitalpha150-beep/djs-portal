// @ts-nocheck
import { jsonResponse, errorResponse } from "../../lib/api";
import { getSessionUserFromRequest } from "../../lib/auth";
import { connectDb } from "../../lib/db";
import { User } from "../../models/user";

export async function sessionHandler(request: Request) {
  const user = await getSessionUserFromRequest(request);
  if (!user) {
    return errorResponse("Not authenticated", 401);
  }

  // Fetch the user from the database to get the latest isTemporaryPassword
  await connectDb();
  const dbUser = await User.findById(user.id).lean().exec();
  if (!dbUser) {
    return errorResponse("User not found", 404);
  }

  return jsonResponse({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      isTemporaryPassword: dbUser.isTemporaryPassword,
    },
  });
}
