import { connectDb } from "../../lib/db";
import { getSessionUserFromRequest, requireRole } from "../../lib/auth";
import { jsonResponse } from "../../lib/api";
import { User } from "../../models/user";
import { Team } from "../../models/team";
import mongoose from "mongoose";

export async function usersListHandler(request: Request) {
  const user = await getSessionUserFromRequest(request);
  requireRole(user, ["admin", "ops_manager", "team_manager"]);

  await connectDb();
  const [users, teams] = await Promise.all([
    User.find().lean().exec() as Promise<
      Array<{
        _id: mongoose.Types.ObjectId;
        name: string;
        email: string;
        role: string;
        status: string;
        teamId?: mongoose.Types.ObjectId;
        lastLoginAt?: Date;
        createdAt: Date;
      }>
    >,
    Team.find().lean().exec() as Promise<Array<{ _id: mongoose.Types.ObjectId; name: string }>>,
  ]);

  const teamMap = Object.fromEntries(teams.map((team) => [team._id.toString(), team.name]));

  return jsonResponse({
    users: users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status === "pending_access_request" ? "inactive" : u.status,
      team: u.teamId ? (teamMap[u.teamId.toString()] ?? null) : null,
      commissionPct: 0,
      lastLogin: u.lastLoginAt?.toISOString() ?? u.createdAt.toISOString(),
    })),
  });
}
