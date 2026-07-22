// @ts-nocheck
import mongoose from "mongoose";
import { connectDb } from "../../lib/db";
import { getSessionUserFromRequest, requireAuth, requireRole } from "../../lib/auth";
import { jsonResponse, parseJson } from "../../lib/api";
import { recordAudit } from "../../lib/audit";
import {
  notifyUser,
  notifyAdmins,
  notifyOpsManagers,
  notifyTeamManager,
  type SenderContext,
} from "../../lib/notification";
import { Team } from "../../models/team";
import { LoginHistory } from "../../models/loginHistory";
import { User, type EmploymentType, type UserStatus } from "../../models/user";
import { ROLE_LABELS } from "../../lib/roles";

const ROLE_ORDER = [
  "owner",
  "admin",
  "ops_manager",
  "team_manager",
  "agent",
  "trainee",
  "accounting",
];
const STATUS_ORDER: UserStatus[] = [
  "active",
  "inactive",
  "suspended",
  "locked",
  "pending",
  "pending_invitation",
  "on_leave",
];
const EMPLOYMENT_TYPES: EmploymentType[] = ["full-time", "part-time", "contractor", "intern"];

function hasManagerAccess(role: string) {
  return ["owner", "admin", "ops_manager"].includes(role);
}

function canManageUser(actorRole: string, targetRole: string) {
  if (actorRole === "owner") return true;
  if (actorRole === "admin") return targetRole !== "owner";
  if (actorRole === "ops_manager") return !["owner", "admin"].includes(targetRole);
  return false;
}

function normalizeStatus(status: string): UserStatus {
  return STATUS_ORDER.includes(status as UserStatus) ? (status as UserStatus) : "active";
}

function normalizeRole(role: string) {
  return ROLE_ORDER.includes(role) ? role : "agent";
}

function normalizeEmploymentType(
  employmentType: string | undefined | null,
): EmploymentType | undefined {
  if (EMPLOYMENT_TYPES.includes(employmentType as EmploymentType))
    return employmentType as EmploymentType;
  return undefined;
}

function buildUserPayload(
  user: any,
  teamMap: Record<string, string>,
  managerMap: Record<string, string>,
) {
  return {
    id: user._id.toString(),
    name: user.name,
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    username: user.username ?? "",
    email: user.email,
    phone: user.phone ?? "",
    role: user.role,
    status: user.status,
    teamId: user.teamId?.toString() ?? null,
    team: user.teamId ? (teamMap[user.teamId.toString()] ?? null) : null,
    teamManager: user.teamId ? (managerMap[user.teamId.toString()] ?? null) : null,
    createdAt: user.createdAt?.toISOString() ?? null,
    updatedAt: user.updatedAt?.toISOString() ?? null,
    lastLogin: user.lastLoginAt?.toISOString() ?? null,
    commissionPercentage: user.commissionPercentage,
    employmentType: user.employmentType,
    isTemporaryPassword: user.isTemporaryPassword,
    accountState:
      user.status === "suspended"
        ? "suspended"
        : user.status === "locked"
          ? "locked"
          : user.status === "pending"
            ? "pending"
            : "active",
  };
}

export async function usersHandler(request: Request) {
  const user = requireAuth(await getSessionUserFromRequest(request));
  await connectDb();

  if (request.method === "GET") {
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim() ?? "";
    const roleFilter = url.searchParams.get("role")?.trim();
    const statusFilter = url.searchParams.get("status")?.trim();
    const teamFilter = url.searchParams.get("team")?.trim();
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") || 20)));
    const sortBy = url.searchParams.get("sortBy")?.trim() || "createdAt";
    const sortDir = url.searchParams.get("sortDir")?.trim() === "asc" ? 1 : -1;

    if (user.role === "agent" || user.role === "trainee" || user.role === "accounting") {
      const targetUser = await User.findById(user.id)
        .select(
          "_id name email role status teamId createdAt updatedAt lastLoginAt commissionPercentage employmentType isTemporaryPassword",
        )
        .lean()
        .exec();
      if (!targetUser) throw Object.assign(new Error("User not found"), { status: 404 });
      return jsonResponse({
        users: [buildUserPayload(targetUser, {}, {})],
        total: 1,
        page,
        pageSize,
      });
    }

    const query: Record<string, unknown> = {};
    if (roleFilter) query.role = roleFilter;
    if (statusFilter) query.status = statusFilter;
    if (teamFilter) query.teamId = new mongoose.Types.ObjectId(teamFilter);
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
      ];
    }

    if (user.role === "team_manager") {
      const team = await Team.findOne({ managerId: new mongoose.Types.ObjectId(user.id) })
        .lean()
        .exec();
      if (!team) {
        return jsonResponse({ users: [], total: 0, page, pageSize });
      }
      query.teamId = team._id as any;
    }

    const [users, teams, total] = await Promise.all([
      User.find(query)
        .sort({ [sortBy]: sortDir })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .select(
          "_id name firstName lastName username email phone role status teamId createdAt updatedAt lastLoginAt commissionPercentage employmentType isTemporaryPassword",
        )
        .lean()
        .exec(),
      Team.find().select("_id name managerId").lean().exec(),
      User.countDocuments(query),
    ]);

    const teamMap = Object.fromEntries(
      teams.map((team: { _id: { toString(): string }; name: string }) => [team._id.toString(), team.name]),
    );
    const managerMap = Object.fromEntries(
      teams.map((team: { _id: { toString(): string }; managerId?: { toString(): string } | null }) => [team._id.toString(), team.managerId?.toString() ?? ""]),
    );

    return jsonResponse({
      users: users.map((item) => buildUserPayload(item, teamMap, managerMap)),
      total,
      page,
      pageSize,
    });
  }

  if (request.method === "POST") {
    requireRole(user, ["owner", "admin", "ops_manager"]);
    const payload = await parseJson(request);
    const firstName = typeof payload.firstName === "string" ? payload.firstName.trim() : "";
    const lastName = typeof payload.lastName === "string" ? payload.lastName.trim() : "";
    const username = typeof payload.username === "string" ? payload.username.trim() : "";
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const phone = typeof payload.phone === "string" ? payload.phone.trim() : "";
    const role = normalizeRole(typeof payload.role === "string" ? payload.role : "agent");
    const status = normalizeStatus(typeof payload.status === "string" ? payload.status : "active");
    const teamId = typeof payload.teamId === "string" && payload.teamId ? payload.teamId : null;
    const temporaryPassword =
      typeof payload.temporaryPassword === "string" ? payload.temporaryPassword : "Welcome123!";
    const commissionPercentage =
      typeof payload.commissionPercentage === "number" && !isNaN(payload.commissionPercentage)
        ? Math.max(0, Math.min(100, payload.commissionPercentage))
        : undefined;
    const employmentType = normalizeEmploymentType(
      typeof payload.employmentType === "string" ? payload.employmentType : undefined,
    );

    if (!firstName || !lastName || !username || !email)
      throw Object.assign(new Error("First name, last name, username, and email are required"), {
        status: 400,
      });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw Object.assign(new Error("Email is invalid"), { status: 400 });
    const existingEmail = await User.findOne({ email }).lean().exec();
    if (existingEmail) throw Object.assign(new Error("Email is already in use"), { status: 400 });
    const existingUsername = await User.findOne({ username }).lean().exec();
    if (existingUsername)
      throw Object.assign(new Error("Username is already in use"), { status: 400 });
    if (!canManageUser(user.role, role))
      throw Object.assign(new Error("Forbidden"), { status: 403 });

    const created = await User.create({
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
      username,
      email,
      phone,
      role,
      status,
      teamId: teamId ? new mongoose.Types.ObjectId(teamId) : undefined,
      password: temporaryPassword,
      isTemporaryPassword: true,
      commissionPercentage,
      employmentType,
      createdBy: new mongoose.Types.ObjectId(user.id),
    });

    await recordAudit({
      actorId: user.id,
      actionType: "user_created",
      targetType: "user",
      targetId: created._id.toString(),
      metadata: { email, role, status },
    });

    // Role-based notification emission
    const sender: SenderContext = {
      userId: user.id,
      name: user.name,
      role: user.role,
      teamId: user.teamId,
    };
    const userSummary = `${firstName} ${lastName} (${email})`;
    await Promise.all([
      notifyAdmins(
        {
          title: "New user created",
          message: `${userSummary} was created with role ${role}.`,
          notificationType: "user_created",
          relatedModule: "user_management",
          recordType: "User",
          recordId: created._id.toString(),
          actionUrl: `/users?focus=${created._id.toString()}`,
          priority: "low",
          metadata: { email, role, status },
        },
        sender,
      ),
      notifyOpsManagers(
        {
          title: "New user created",
          message: `${userSummary} was created with role ${role}.`,
          notificationType: "user_created",
          relatedModule: "user_management",
          recordType: "User",
          recordId: created._id.toString(),
          actionUrl: `/users?focus=${created._id.toString()}`,
          priority: "low",
          metadata: { email, role, status },
        },
        sender,
      ),
      notifyUser(
        created._id.toString(),
        {
          title: "Welcome to Freight Agent Hub",
          message: `Your account has been created. Your role is ${role}.`,
          notificationType: "welcome",
          relatedModule: "user_management",
          recordType: "User",
          recordId: created._id.toString(),
          actionUrl: "/profile",
          priority: "medium",
          metadata: { role, status },
        },
        sender,
        { recipientRole: role },
      ),
      ...(teamId
        ? [
            notifyTeamManager(
              teamId,
              {
                title: "New team member assigned",
                message: `${firstName} ${lastName} has been assigned to your team.`,
                notificationType: "team_member_added",
                relatedModule: "team_management",
                recordType: "User",
                recordId: created._id.toString(),
                actionUrl: `/users?focus=${created._id.toString()}`,
                priority: "medium",
              },
              sender,
            ),
          ]
        : []),
    ]);

    return jsonResponse({
      user: buildUserPayload(created.toObject ? created.toObject() : created, {}, {}),
    });
  }

  if (request.method === "PATCH") {
    requireRole(user, ["owner", "admin", "ops_manager", "team_manager"]);
    const payload = await parseJson(request);
    const userId = typeof payload.userId === "string" ? payload.userId.trim() : "";
    const targetUser = await User.findById(userId).exec();
    if (!targetUser) throw Object.assign(new Error("User not found"), { status: 404 });
    if (!hasManagerAccess(user.role) && user.id !== targetUser._id.toString())
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    if (!canManageUser(user.role, targetUser.role))
      throw Object.assign(new Error("Forbidden"), { status: 403 });

    // Capture previous state for change detection + notifications
    const prevRole = targetUser.role;
    const prevStatus = targetUser.status;
    const prevTeamId = targetUser.teamId?.toString() ?? null;

    const updates: Record<string, unknown> = {};
    if (typeof payload.firstName === "string") {
      targetUser.firstName = payload.firstName.trim();
      updates.firstName = targetUser.firstName;
    }
    if (typeof payload.lastName === "string") {
      targetUser.lastName = payload.lastName.trim();
      updates.lastName = targetUser.lastName;
    }
    if (typeof payload.username === "string") {
      targetUser.username = payload.username.trim();
      updates.username = targetUser.username;
    }
    if (typeof payload.email === "string") {
      targetUser.email = payload.email.trim().toLowerCase();
      updates.email = targetUser.email;
    }
    if (typeof payload.phone === "string") {
      targetUser.phone = payload.phone.trim();
      updates.phone = targetUser.phone;
    }
    if (typeof payload.role === "string") {
      targetUser.role = normalizeRole(payload.role);
      updates.role = targetUser.role;
    }
    if (typeof payload.status === "string") {
      targetUser.status = normalizeStatus(payload.status);
      updates.status = targetUser.status;
    }
    if (typeof payload.teamId === "string") {
      const oldTeamId = targetUser.teamId;
      const newTeamId = payload.teamId ? new mongoose.Types.ObjectId(payload.teamId) : undefined;
      targetUser.teamId = newTeamId;
      updates.teamId = targetUser.teamId;

      // Update old team's memberIds
      if (oldTeamId) {
        await Team.findByIdAndUpdate(oldTeamId, {
          $pull: { memberIds: targetUser._id },
        }).exec();
      }

      // Update new team's memberIds
      if (newTeamId) {
        await Team.findByIdAndUpdate(newTeamId, {
          $addToSet: { memberIds: targetUser._id },
        }).exec();
      }
    }
    if (typeof payload.commissionPercentage === "number" && !isNaN(payload.commissionPercentage)) {
      const value = Math.max(0, Math.min(100, payload.commissionPercentage));
      targetUser.commissionPercentage = value;
      updates.commissionPercentage = value;
    }
    if (typeof payload.employmentType === "string") {
      const et = normalizeEmploymentType(payload.employmentType);
      targetUser.employmentType = et;
      updates.employmentType = et;
    }
    if (typeof payload.temporaryPassword === "string" && payload.temporaryPassword.trim()) {
      targetUser.password = payload.temporaryPassword.trim();
      targetUser.isTemporaryPassword = true;
      updates.temporaryPassword = true;
      updates.isTemporaryPassword = true;
    }
    targetUser.name = `${targetUser.firstName ?? ""} ${targetUser.lastName ?? ""}`.trim();
    await targetUser.save();
    await recordAudit({
      actorId: user.id,
      actionType: "user_updated",
      targetType: "user",
      targetId: targetUser._id.toString(),
      metadata: { updates },
    });

    // Role-based notification emission for user updates
    const sender: SenderContext = {
      userId: user.id,
      name: user.name,
      role: user.role,
      teamId: user.teamId,
    };
    const targetId = targetUser._id.toString();
    const targetName = targetUser.name;
    const newRole = targetUser.role;
    const newStatus = targetUser.status;
    const newTeamId = targetUser.teamId?.toString() ?? null;
    const userActionUrl = `/users?focus=${targetId}`;

    const notifPromises: Promise<void>[] = [];

    // Status change notifications
    if (prevStatus !== newStatus) {
      if (newStatus === "suspended") {
        notifPromises.push(
          notifyUser(
            targetId,
            {
              title: "Account suspended",
              message: "Your account has been suspended. Please contact your administrator.",
              notificationType: "user_suspended",
              relatedModule: "user_management",
              recordType: "User",
              recordId: targetId,
              actionUrl: "/profile",
              priority: "high",
            },
            sender,
          ),
          notifyAdmins(
            {
              title: "User suspended",
              message: `${targetName} has been suspended.`,
              notificationType: "user_suspended",
              relatedModule: "user_management",
              recordType: "User",
              recordId: targetId,
              actionUrl: userActionUrl,
              priority: "high",
            },
            sender,
          ),
          notifyOpsManagers(
            {
              title: "User suspended",
              message: `${targetName} has been suspended.`,
              notificationType: "user_suspended",
              relatedModule: "user_management",
              recordType: "User",
              recordId: targetId,
              actionUrl: userActionUrl,
              priority: "medium",
            },
            sender,
          ),
        );
        if (prevTeamId) {
          notifPromises.push(
            notifyTeamManager(prevTeamId, {
              title: "Team member suspended",
              message: `${targetName} has been suspended.`,
              notificationType: "user_suspended",
              relatedModule: "team_management",
              recordType: "User",
              recordId: targetId,
              actionUrl: userActionUrl,
              priority: "high",
            }, sender),
          );
        }
      } else if (newStatus === "active" && (prevStatus === "suspended" || prevStatus === "pending" || prevStatus === "locked")) {
        notifPromises.push(
          notifyUser(
            targetId,
            {
              title: "Account activated",
              message: "Congratulations! Your account has been activated.",
              notificationType: "account_activated",
              relatedModule: "user_management",
              recordType: "User",
              recordId: targetId,
              actionUrl: "/dashboard",
              priority: "medium",
            },
            sender,
          ),
        );
        if (newTeamId) {
          notifPromises.push(
            notifyTeamManager(newTeamId, {
              title: "Team member activated",
              message: `${targetName} has been activated.`,
              notificationType: "user_reactivated",
              relatedModule: "team_management",
              recordType: "User",
              recordId: targetId,
              actionUrl: userActionUrl,
              priority: "low",
            }, sender),
          );
        }
      } else if (newStatus === "locked") {
        notifPromises.push(
          notifyAdmins(
            {
              title: "User locked",
              message: `${targetName} has been locked.`,
              notificationType: "user_locked",
              relatedModule: "user_management",
              recordType: "User",
              recordId: targetId,
              actionUrl: userActionUrl,
              priority: "high",
            },
            sender,
          ),
        );
      }
    }

    // Role change notifications
    if (prevRole !== newRole) {
      const prevRoleIndex = ROLE_ORDER.indexOf(prevRole as (typeof ROLE_ORDER)[number]);
      const newRoleIndex = ROLE_ORDER.indexOf(newRole as (typeof ROLE_ORDER)[number]);
      const isPromotion = newRoleIndex < prevRoleIndex;
      const prettyPrevRole = ROLE_LABELS[prevRole as keyof typeof ROLE_LABELS] ?? prevRole.replace(/_/g, " ");
      const prettyNewRole = ROLE_LABELS[newRole as keyof typeof ROLE_LABELS] ?? newRole.replace(/_/g, " ");
      const prettyTitle = isPromotion ? "User promoted" : "User demoted";
      const prettyMessage = `${targetName}'s role changed from ${prettyPrevRole} to ${prettyNewRole}.`;

      notifPromises.push(
        notifyUser(
          targetId,
          {
            title: "Your role has changed",
            message: `Your role changed from ${prettyPrevRole} to ${prettyNewRole}.`,
            notificationType: "role_changed",
            relatedModule: "user_management",
            recordType: "User",
            recordId: targetId,
            actionUrl: "/profile",
            priority: "high",
            metadata: { prevRole, newRole },
          },
          sender,
        ),
        notifyAdmins(
          {
            title: prettyTitle,
            message: prettyMessage,
            notificationType: isPromotion ? "user_promoted" : "user_demoted",
            relatedModule: "user_management",
            recordType: "User",
            recordId: targetId,
            actionUrl: userActionUrl,
            priority: "medium",
            metadata: { prevRole, newRole },
          },
          sender,
        ),
      );
    }

    // Team assignment change notifications
    if (prevTeamId !== newTeamId) {
      if (prevTeamId) {
        notifPromises.push(
          notifyTeamManager(prevTeamId, {
            title: "Team member removed",
            message: `${targetName} has been removed from your team.`,
            notificationType: "team_member_removed",
            relatedModule: "team_management",
            recordType: "User",
            recordId: targetId,
            actionUrl: userActionUrl,
            priority: "medium",
          }, sender),
        );
      }
      if (newTeamId) {
        notifPromises.push(
          notifyTeamManager(newTeamId, {
            title: "New team member assigned",
            message: `${targetName} has been assigned to your team.`,
            notificationType: "team_member_added",
            relatedModule: "team_management",
            recordType: "User",
            recordId: targetId,
            actionUrl: userActionUrl,
            priority: "medium",
          }, sender),
          notifyUser(
            targetId,
            {
              title: "Team assignment updated",
              message: `You have been assigned to a new team.`,
              notificationType: "team_assigned",
              relatedModule: "team_management",
              recordType: "User",
              recordId: targetId,
              actionUrl: "/profile",
              priority: "medium",
            },
            sender,
          ),
        );
      }
      notifPromises.push(
        notifyOpsManagers(
          {
            title: "Team assignment changed",
            message: `${targetName}'s team assignment has been updated.`,
            notificationType: "team_assignment_changed",
            relatedModule: "team_management",
            recordType: "User",
            recordId: targetId,
            actionUrl: userActionUrl,
            priority: "low",
          },
          sender,
        ),
      );
    }

    if (notifPromises.length) {
      await Promise.all(notifPromises);
    }

    return jsonResponse({
      user: buildUserPayload(targetUser.toObject ? targetUser.toObject() : targetUser, {}, {}),
    });
  }

  if (request.method === "DELETE") {
    requireRole(user, ["owner", "admin", "ops_manager"]);
    const payload = await parseJson(request);
    const userId = typeof payload.userId === "string" ? payload.userId.trim() : "";
    if (!userId) throw Object.assign(new Error("userId is required"), { status: 400 });
    const targetUser = await User.findById(userId).exec();
    if (!targetUser) throw Object.assign(new Error("User not found"), { status: 404 });
    if (!canManageUser(user.role, targetUser.role))
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    await targetUser.deleteOne();
    await recordAudit({
      actorId: user.id,
      actionType: "user_deleted",
      targetType: "user",
      targetId: userId,
      metadata: { deletedUser: targetUser.email },
    });

    // Notify admins of user deletion
    await notifyAdmins(
      {
        title: "User deleted",
        message: `${targetUser.name} (${targetUser.email}) has been deleted.`,
        notificationType: "user_deleted",
        relatedModule: "user_management",
        recordType: "User",
        recordId: userId,
        actionUrl: "/users",
        priority: "medium",
        metadata: { deletedUser: targetUser.email },
      },
      { userId: user.id, name: user.name, role: user.role, teamId: user.teamId },
    );

    return jsonResponse({ ok: true });
  }

  throw Object.assign(new Error("Method not allowed"), { status: 405 });
}
