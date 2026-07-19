import mongoose from "mongoose";
import { connectDb } from "../lib/db";
import { getSessionUserFromRequest, requireAuth, requireRole } from "../lib/auth";
import { jsonResponse, parseJson } from "../lib/api";
import {
  notifyAdmins,
  notifyUser,
  notifyTeamMembers,
  type SenderContext,
} from "../lib/notification";
import { Team } from "../models/team";
import { User } from "../models/user";

function buildTeamPayload(team: any, users: any[]) {
  const userMap = Object.fromEntries(users.map((entry) => [entry._id.toString(), entry]));
  const manager = team.managerId ? userMap[team.managerId.toString()] : null;

  // Get all members with details
  const members = (team.memberIds ?? [])
    .map((memberId: any) => {
      const member = userMap[memberId.toString()];
      if (!member) return null;
      return {
        id: member._id.toString(),
        name: member.name,
        role: member.role,
        status: member.status,
        email: member.email,
      };
    })
    .filter(Boolean);

  return {
    id: team._id.toString(),
    name: team.name,
    managerId: team.managerId?.toString() ?? null,
    managerName: manager?.name ?? null,
    manager: manager
      ? {
          id: manager._id.toString(),
          name: manager.name,
          role: manager.role,
          status: manager.status,
          email: manager.email,
        }
      : null,
    memberIds: (team.memberIds ?? []).map((item: any) => item.toString()),
    members: members,
    memberNames: members.map((m: any) => m.name),
    totalMembers: members.length,
    createdAt: team.createdAt?.toISOString() ?? null,
  };
}

export async function teamsHandler(request: Request) {
  const user = requireAuth(await getSessionUserFromRequest(request));
  await connectDb();

  const url = new URL(request.url);
  const teamIdParam = url.searchParams.get("id");

  if (request.method === "GET") {
    const [teams, users] = await Promise.all([
      teamIdParam
        ? [await Team.findById(teamIdParam).lean().exec()].filter(Boolean)
        : Team.find().sort({ name: 1 }).lean().exec(),
      User.find().select("_id name role status email teamId").lean().exec(),
    ]);

    const enrichedTeams = teams.map((team) => buildTeamPayload(team, users));

    if (teamIdParam) {
      if (!enrichedTeams.length) throw Object.assign(new Error("Team not found"), { status: 404 });
      return jsonResponse({ team: enrichedTeams[0] });
    }

    return jsonResponse({ teams: enrichedTeams });
  }

  if (request.method === "POST") {
    requireRole(user, ["owner", "admin", "ops_manager"]);
    const payload = await parseJson(request);
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    const managerId = typeof payload.managerId === "string" ? payload.managerId.trim() : "";
    if (!name || !managerId)
      throw Object.assign(new Error("Name and manager are required"), { status: 400 });

    const manager = await User.findById(managerId).exec();
    if (!manager) throw Object.assign(new Error("Manager not found"), { status: 404 });
    if (manager.status !== "active")
      throw Object.assign(new Error("Manager must be an active user"), { status: 400 });

    const created = await Team.create({
      name,
      managerId: new mongoose.Types.ObjectId(managerId),
      memberIds: [new mongoose.Types.ObjectId(managerId)],
    });

    // Update manager's teamId
    await User.findByIdAndUpdate(managerId, { $set: { teamId: created._id } });

    // Get the full team with users to build payload
    const users = await User.find().select("_id name role status email teamId").lean().exec();
    const fullTeam = await Team.findById(created._id).lean().exec();
    if (!fullTeam) throw Object.assign(new Error("Failed to create team"), { status: 500 });

    // Notifications
    const sender: SenderContext = {
      userId: user.id,
      name: user.name,
      role: user.role,
      teamId: user.teamId,
    };
    const teamIdStr = created._id.toString();
    const actionUrl = `/teams?focus=${teamIdStr}`;
    await Promise.all([
      notifyAdmins(
        {
          title: "New team created",
          message: `Team "${name}" has been created with manager ${manager.name}.`,
          notificationType: "team_created",
          relatedModule: "team_management",
          recordType: "Team",
          recordId: teamIdStr,
          actionUrl,
          priority: "low",
          metadata: { teamName: name, managerId },
        },
        sender,
      ),
      notifyUser(
        managerId,
        {
          title: "You've been assigned as team manager",
          message: `You are now the manager of team "${name}".`,
          notificationType: "team_manager_assigned",
          relatedModule: "team_management",
          recordType: "Team",
          recordId: teamIdStr,
          actionUrl,
          priority: "medium",
          metadata: { teamName: name },
        },
        sender,
        { recipientRole: "team_manager", teamId: teamIdStr },
      ),
    ]);

    return jsonResponse({ team: buildTeamPayload(fullTeam, users) });
  }

  if (request.method === "PATCH") {
    requireRole(user, ["owner", "admin", "ops_manager"]);
    const payload = await parseJson(request);
    const teamId = typeof payload.teamId === "string" ? payload.teamId.trim() : "";
    const team = await Team.findById(teamId).exec();
    if (!team) throw Object.assign(new Error("Team not found"), { status: 404 });

    const prevName = team.name;
    const prevManagerId = team.managerId?.toString() ?? null;

    if (typeof payload.name === "string") team.name = payload.name.trim();

    if (typeof payload.managerId === "string") {
      const newManagerId = payload.managerId;
      const newManager = await User.findById(newManagerId).exec();
      if (!newManager) throw Object.assign(new Error("Manager not found"), { status: 404 });
      if (newManager.status !== "active")
        throw Object.assign(new Error("Manager must be an active user"), { status: 400 });

      // Only update manager if changed
      if (team.managerId?.toString() !== newManagerId) {
        // Add new manager to memberIds
        await Team.findByIdAndUpdate(teamId, {
          $addToSet: { memberIds: new mongoose.Types.ObjectId(newManagerId) },
        });
        // Update new manager's teamId
        await User.findByIdAndUpdate(newManagerId, { $set: { teamId: team._id } });
        team.managerId = new mongoose.Types.ObjectId(newManagerId);
      }
    }

    await team.save();

    // Get the full team with users to build payload
    const users = await User.find().select("_id name role status email teamId").lean().exec();
    const fullTeam = await Team.findById(team._id).lean().exec();
    if (!fullTeam) throw Object.assign(new Error("Failed to fetch updated team"), { status: 500 });

    // Notifications for team update
    const sender: SenderContext = {
      userId: user.id,
      name: user.name,
      role: user.role,
      teamId: user.teamId,
    };
    const teamIdStr = team._id.toString();
    const actionUrl = `/teams?focus=${teamIdStr}`;
    const newManagerId = team.managerId?.toString() ?? null;
    const newName = team.name;
    const notifPromises: Promise<void>[] = [];

    if (prevManagerId && prevManagerId !== newManagerId) {
      notifPromises.push(
        notifyUser(
          prevManagerId,
          {
            title: "Team assignment changed",
            message: `You are no longer the manager of team "${newName}".`,
            notificationType: "team_assignment_changed",
            relatedModule: "team_management",
            recordType: "Team",
            recordId: teamIdStr,
            actionUrl,
            priority: "medium",
          },
          sender,
        ),
      );
    }
    if (newManagerId && prevManagerId !== newManagerId) {
      notifPromises.push(
        notifyUser(
          newManagerId,
          {
            title: "You've been assigned as team manager",
            message: `You are now the manager of team "${newName}".`,
            notificationType: "team_manager_assigned",
            relatedModule: "team_management",
            recordType: "Team",
            recordId: teamIdStr,
            actionUrl,
            priority: "medium",
          },
          sender,
          { recipientRole: "team_manager", teamId: teamIdStr },
        ),
      );
    }
    if (prevName !== newName) {
      notifPromises.push(
        notifyTeamMembers(
          teamIdStr,
          {
            title: "Team updated",
            message: `Your team has been renamed from "${prevName}" to "${newName}".`,
            notificationType: "team_updated",
            relatedModule: "team_management",
            recordType: "Team",
            recordId: teamIdStr,
            actionUrl,
            priority: "low",
            metadata: { prevName, newName },
          },
          sender,
        ),
        notifyAdmins(
          {
            title: "Team updated",
            message: `Team "${prevName}" has been renamed to "${newName}".`,
            notificationType: "team_updated",
            relatedModule: "team_management",
            recordType: "Team",
            recordId: teamIdStr,
            actionUrl,
            priority: "low",
          },
          sender,
        ),
      );
    }
    if (notifPromises.length) await Promise.all(notifPromises);

    return jsonResponse({ team: buildTeamPayload(fullTeam, users) });
  }

  if (request.method === "DELETE") {
    requireRole(user, ["owner", "admin", "ops_manager"]);
    const payload = await parseJson(request);
    const teamId = typeof payload.teamId === "string" ? payload.teamId.trim() : "";
    if (!teamId) throw Object.assign(new Error("teamId is required"), { status: 400 });
    const team = await Team.findById(teamId).exec();
    if (!team) throw Object.assign(new Error("Team not found"), { status: 404 });
    const teamName = team.name;
    const memberIds = (team.memberIds ?? []).map((id: any) => id.toString());
    await team.deleteOne();
    await User.updateMany({ teamId: team._id }, { $unset: { teamId: "" } });

    // Notifications
    const sender: SenderContext = {
      userId: user.id,
      name: user.name,
      role: user.role,
      teamId: user.teamId,
    };
    await Promise.all([
      notifyAdmins(
        {
          title: "Team deleted",
          message: `Team "${teamName}" has been deleted.`,
          notificationType: "team_deleted",
          relatedModule: "team_management",
          recordType: "Team",
          recordId: teamId,
          actionUrl: "/teams",
          priority: "medium",
        },
        sender,
      ),
      ...memberIds.map((memberId: string) =>
        notifyUser(
          memberId,
          {
            title: "Your team has been deleted",
            message: `Team "${teamName}" has been deleted by administration.`,
            notificationType: "team_deleted",
            relatedModule: "team_management",
            recordType: "Team",
            recordId: teamId,
            actionUrl: "/teams",
            priority: "medium",
          },
          sender,
        ),
      ),
    ]);

    return jsonResponse({ ok: true });
  }

  throw Object.assign(new Error("Method not allowed"), { status: 405 });
}
