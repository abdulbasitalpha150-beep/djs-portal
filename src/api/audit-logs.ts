// @ts-nocheck
import mongoose from "mongoose";
import { connectDb } from "../lib/db";
import { getSessionUserFromRequest, requireAuth, hasRole } from "../lib/auth";
import { jsonResponse } from "../lib/api";
import { User } from "../models/user";

export async function auditLogsHandler(request: Request) {
  const user = await getSessionUserFromRequest(request);
  const sessionUser = requireAuth(user);

  // Only admins/owners/ops managers can see audit logs
  if (!hasRole(sessionUser, ["admin", "owner", "ops_manager"])) {
    throw Object.assign(new Error("Not authorized"), { status: 403 });
  }

  await connectDb();

  // Get all users and sort by the most recent of lastLoginAt or lastLogoutAt descending
  const users = await User.find({}).lean().exec();

  // Add a "lastActivity" field for sorting
  const usersWithActivity = users.map((u) => ({
    ...u,
    lastActivity: new Date(Math.max(u.lastLoginAt?.getTime() || 0, u.lastLogoutAt?.getTime() || 0)),
  }));

  // Sort by lastActivity descending
  usersWithActivity.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

  return jsonResponse({
    users: usersWithActivity.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      action: u.lastAuthAction ?? "—",
      ipAddress: u.lastIpAddress ?? "—",
      lastLogin: u.lastLoginAt?.toISOString(),
      lastLogout: u.lastLogoutAt?.toISOString(),
    })),
  });
}
