// @ts-nocheck
import mongoose from "mongoose";
import { connectDb } from "../lib/db";
import { getSessionUserFromRequest, requireAuth } from "../lib/auth";
import { jsonResponse, parseJson } from "../lib/api";
import { recordAudit } from "../lib/audit";
import { User } from "../models/user";
import { Team } from "../models/team";

export async function profileHandler(request: Request) {
  const user = requireAuth(await getSessionUserFromRequest(request));
  await connectDb();

  if (request.method === "GET") {
    const currentUser = await User.findById(user.id).lean().exec();
    if (!currentUser) {
      throw Object.assign(new Error("User not found"), { status: 404 });
    }

    let team = null;
    let ownerName = null;

    if (currentUser.teamId) {
      team = await Team.findById(currentUser.teamId).lean().exec();
    }

    if (currentUser.createdBy) {
      const creator = await User.findById(currentUser.createdBy).select("name").lean().exec();
      if (creator) {
        ownerName = creator.name;
      }
    }

    const currentMonth = new Date().toISOString().substring(0, 7);
    const passwordChangeCount =
      currentUser.passwordChangeMonth === currentMonth ? currentUser.passwordChangeCount : 0;

    return jsonResponse({
      profile: {
        id: currentUser._id.toString(),
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        name: currentUser.name,
        username: currentUser.username,
        email: currentUser.email,
        phone: currentUser.phone,
        role: currentUser.role,
        status: currentUser.status,
        teamId: currentUser.teamId,
        team: team?.name || null,
        employmentType: currentUser.employmentType,
        ownerName: ownerName,
        lastLoginAt: currentUser.lastLoginAt?.toISOString(),
        createdAt: currentUser.createdAt.toISOString(),
        updatedAt: currentUser.updatedAt.toISOString(),
        isTemporaryPassword: currentUser.isTemporaryPassword,
        passwordLastChangedAt: currentUser.passwordLastChangedAt?.toISOString(),
        passwordChangeCount,
        passwordChangeCountMax: 2,
      },
    });
  }

  if (request.method === "PATCH") {
    const payload = await parseJson(request);
    const targetUser = await User.findById(user.id).exec();
    if (!targetUser) {
      throw Object.assign(new Error("User not found"), { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (typeof payload.firstName === "string") {
      targetUser.firstName = payload.firstName.trim();
      updates.firstName = targetUser.firstName;
    }
    if (typeof payload.lastName === "string") {
      targetUser.lastName = payload.lastName.trim();
      updates.lastName = targetUser.lastName;
    }
    if (typeof payload.phone === "string") {
      targetUser.phone = payload.phone.trim();
      updates.phone = targetUser.phone;
    }
    if (typeof payload.username === "string") {
      if (payload.username.trim()) {
        const existingUsername = await User.findOne({
          username: payload.username.trim().toLowerCase(),
          _id: { $ne: targetUser._id },
        })
          .lean()
          .exec();
        if (existingUsername) {
          throw Object.assign(new Error("Username is already in use"), { status: 400 });
        }
        targetUser.username = payload.username.trim().toLowerCase();
        updates.username = targetUser.username;
      }
    }
    if (typeof payload.email === "string") {
      if (payload.email.trim()) {
        const existingEmail = await User.findOne({
          email: payload.email.trim().toLowerCase(),
          _id: { $ne: targetUser._id },
        })
          .lean()
          .exec();
        if (existingEmail) {
          throw Object.assign(new Error("Email is already in use"), { status: 400 });
        }
        targetUser.email = payload.email.trim().toLowerCase();
        updates.email = targetUser.email;
      }
    }

    targetUser.name = `${targetUser.firstName ?? ""} ${targetUser.lastName ?? ""}`.trim();
    await targetUser.save();

    await recordAudit({
      actorId: targetUser._id.toString(),
      actionType: "profile_updated",
      targetType: "user",
      targetId: targetUser._id.toString(),
      metadata: { updates },
    });

    const currentMonth = new Date().toISOString().substring(0, 7);
    const passwordChangeCount =
      targetUser.passwordChangeMonth === currentMonth ? targetUser.passwordChangeCount : 0;

    let team = null;
    let ownerName = null;

    if (targetUser.teamId) {
      team = await Team.findById(targetUser.teamId).lean().exec();
    }

    if (targetUser.createdBy) {
      const creator = await User.findById(targetUser.createdBy).select("name").lean().exec();
      if (creator) {
        ownerName = creator.name;
      }
    }

    return jsonResponse({
      success: true,
      profile: {
        id: targetUser._id.toString(),
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        name: targetUser.name,
        username: targetUser.username,
        email: targetUser.email,
        phone: targetUser.phone,
        role: targetUser.role,
        status: targetUser.status,
        teamId: targetUser.teamId,
        team: team?.name || null,
        employmentType: targetUser.employmentType,
        ownerName: ownerName,
        lastLoginAt: targetUser.lastLoginAt?.toISOString(),
        createdAt: targetUser.createdAt.toISOString(),
        updatedAt: targetUser.updatedAt.toISOString(),
        isTemporaryPassword: targetUser.isTemporaryPassword,
        passwordLastChangedAt: targetUser.passwordLastChangedAt?.toISOString(),
        passwordChangeCount,
        passwordChangeCountMax: 2,
      },
    });
  }

  throw Object.assign(new Error("Method not allowed"), { status: 405 });
}
