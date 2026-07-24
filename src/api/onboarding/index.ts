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
  type SenderContext,
} from "../../lib/notification";
import {
  OnboardingDocument,
  OnboardingRequirement,
  OnboardingReview,
  type OnboardingDocumentStatus,
} from "../../models/onboarding";
import { User } from "../../models/user";

function isManager(role: string) {
  return ["admin", "ops_manager"].includes(role);
}

function normalizeStatus(status: string): OnboardingDocumentStatus {
  switch (status) {
    case "approved":
    case "rejected":
    case "under_review":
    case "submitted":
      return status;
    default:
      return "missing";
  }
}

function canAccessUser(actor: { role: string; id: string }, targetUserId: string) {
  if (actor.id === targetUserId) return true;
  return isManager(actor.role);
}

function getDefaultRequirements() {
  return [
    { key: "w9", label: "W-9", description: "Federal tax form", required: true, displayOrder: 1 },
    {
      key: "agreement",
      label: "Agreement",
      description: "Signed onboarding agreement",
      required: true,
      displayOrder: 2,
    },
    { key: "id", label: "Government ID", description: "Photo ID", required: true, displayOrder: 3 },
    {
      key: "tax_form",
      label: "Tax Form",
      description: "Additional tax documentation",
      required: true,
      displayOrder: 4,
    },
    {
      key: "other",
      label: "Other",
      description: "Any additional supporting document",
      required: false,
      displayOrder: 5,
    },
  ];
}

export async function onboardingHandler(request: Request) {
  const user = requireAuth(await getSessionUserFromRequest(request));
  const url = new URL(request.url);
  const action = url.searchParams.get("action") ?? "";

  await connectDb();

  if (request.method === "GET") {
    const targetUserId = url.searchParams.get("userId")?.trim();
    const isListView = !targetUserId && (user.role === "admin" || user.role === "ops_manager");

    if (isListView) {
      const search = url.searchParams.get("search")?.trim() ?? "";
      const page = Math.max(1, Number(url.searchParams.get("page") || 1));
      const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") || 20)));
      const roleFilter = url.searchParams.get("role")?.trim();
      const statusFilter = url.searchParams.get("status")?.trim();
      const completionFilter = url.searchParams.get("completion")?.trim();

      const query: Record<string, unknown> = {
        role: { $in: ["admin", "ops_manager", "team_manager", "agent", "trainee", "accounting"] },
      };
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ];
      }
      if (roleFilter) {
        query.role = roleFilter;
      }
      if (statusFilter) {
        query.status = statusFilter;
      }

      const users = await User.find(query)
        .select("_id name email role status createdAt")
        .lean()
        .exec();
      const userIds = users.map((item) => item._id);
      const documents = await OnboardingDocument.find({ userId: { $in: userIds }, deleted: false })
        .lean()
        .exec();
      const requirements = await OnboardingRequirement.find({ active: true })
        .sort({ displayOrder: 1 })
        .lean()
        .exec();

      const rows = users.map((item) => {
        const userDocuments = documents.filter(
          (doc) => doc.userId.toString() === item._id.toString(),
        );
        const approved = userDocuments.filter((doc) => doc.status === "approved").length;
        const total = requirements.length || 1;
        const completion = Math.round((approved / total) * 100);
        const missingDocs = userDocuments.filter((doc) => doc.status === "missing").length;
        return {
          id: item._id.toString(),
          name: item.name,
          email: item.email,
          role: item.role,
          completion,
          status:
            completion >= 100 ? "complete" : missingDocs > 0 ? "missing_documents" : "in_progress",
          lastUpdated: userDocuments.length
            ? new Date(
                Math.max(...userDocuments.map((doc) => new Date(doc.updatedAt).getTime())),
              ).toISOString()
            : (item.createdAt?.toISOString() ?? null),
          missingDocumentsCount: missingDocs,
        };
      });

      let filteredRows = rows;
      if (completionFilter) {
        const threshold = Number(completionFilter);
        filteredRows = filteredRows.filter((row) => row.completion >= threshold);
      }

      const total = filteredRows.length;
      const startIndex = (page - 1) * pageSize;
      const pagedRows = filteredRows.slice(startIndex, startIndex + pageSize);

      return jsonResponse({ users: pagedRows, total, page, pageSize, requirements });
    }

    const requestedUserId = targetUserId ?? user.id;
    if (!canAccessUser(user, requestedUserId)) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }

    const [targetUser, requirements, documents, reviews] = await Promise.all([
      User.findById(requestedUserId).select("_id name email role status createdAt").lean().exec(),
      OnboardingRequirement.find({ active: true }).sort({ displayOrder: 1 }).lean().exec(),
      OnboardingDocument.find({ userId: requestedUserId, deleted: false })
        .sort({ createdAt: 1 })
        .lean()
        .exec(),
      OnboardingReview.find({ userId: requestedUserId }).sort({ createdAt: -1 }).lean().exec(),
    ]);

    if (!targetUser) {
      throw Object.assign(new Error("User not found"), { status: 404 });
    }

    const documentMap = new Map(documents.map((doc) => [doc.requirementKey, doc]));
    const items = requirements.map((requirement) => {
      const document = documentMap.get(requirement.key);
      return {
        id: document?._id.toString() ?? null,
        key: requirement.key,
        label: requirement.label,
        description: requirement.description,
        status: document?.status ?? "missing",
        uploadedAt: document?.createdAt ? new Date(document.createdAt).toISOString() : null,
        uploadedBy: document?.uploadedBy ? document.uploadedBy.toString() : null,
        reviewer: document?.reviewerId ? document.reviewerId.toString() : null,
        reviewedAt: document?.reviewedAt ? new Date(document.reviewedAt).toISOString() : null,
        comments: document?.comments ?? null,
        rejectionReason: document?.rejectionReason ?? null,
        mimeType: document?.mimeType ?? null,
        fileName: document?.fileName ?? null,
        storagePath: document?.storagePath ?? null,
        version: document?.version ?? 1,
      };
    });

    return jsonResponse({ user: targetUser, requirements, items, reviews });
  }

  if (request.method === "POST") {
    const payload = await parseJson(request);
    const fileData = typeof payload.fileData === "string" ? payload.fileData : "";
    const originalFileName =
      typeof payload.originalFileName === "string" ? payload.originalFileName.trim() : "";
    const mimeType =
      typeof payload.mimeType === "string" ? payload.mimeType.trim() : "application/octet-stream";
    const requirementKey =
      typeof payload.requirementKey === "string" ? payload.requirementKey.trim() : "";
    const targetUserId = typeof payload.userId === "string" ? payload.userId.trim() : user.id;

    if (!fileData || !originalFileName || !requirementKey) {
      throw Object.assign(
        new Error("fileData, originalFileName, and requirementKey are required"),
        { status: 400 },
      );
    }

    if (!canAccessUser(user, targetUserId)) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }

    const targetUser = await User.findById(targetUserId).lean().exec();
    if (!targetUser) {
      throw Object.assign(new Error("User not found"), { status: 404 });
    }

    const requirement = await OnboardingRequirement.findOne({ key: requirementKey, active: true })
      .lean()
      .exec();
    if (!requirement) {
      throw Object.assign(new Error("Requirement not found"), { status: 404 });
    }

    const existing = await OnboardingDocument.findOne({
      userId: targetUserId,
      requirementKey,
      deleted: false,
    })
      .lean()
      .exec();
    if (existing) {
      const updated = await OnboardingDocument.findByIdAndUpdate(
        existing._id,
        {
          $set: {
            fileName: `${Date.now()}-${originalFileName}`,
            originalFileName,
            mimeType,
            fileData,
            storagePath: `db:base64:${Date.now()}`,
            uploadedBy: user.id,
            status: "submitted",
            reviewerId: undefined,
            reviewerRole: undefined,
            reviewedAt: undefined,
            comments: undefined,
            rejectionReason: undefined,
            version: (existing.version || 1) + 1,
            updatedAt: new Date(),
          },
        },
        { new: true },
      ).exec();

      await OnboardingReview.create({
        documentId: updated?._id,
        userId: targetUserId,
        actionType: "uploaded",
        actorId: new mongoose.Types.ObjectId(user.id),
        actorRole: user.role,
        status: "submitted",
        comments: "Document updated",
      });

      await recordAudit({
        actorId: user.id,
        actionType: "onboarding_upload",
        targetType: "onboarding_document",
        targetId: updated?._id.toString(),
        metadata: { userId: targetUserId, requirementKey, fileName: originalFileName },
      });

      // Notify reviewers about the document submission
      const uploadSender: SenderContext = {
        userId: user.id,
        name: user.name,
        role: user.role,
        teamId: user.teamId,
      };
      const updatedDocId = updated?._id.toString() ?? "";
      void notifyAdmins(
        {
          title: "Document submitted for review",
          message: `${targetUser.name} uploaded "${originalFileName}" (${requirement.label}).`,
          notificationType: "document_submitted",
          relatedModule: "training",
          recordType: "OnboardingDocument",
          recordId: updatedDocId,
          actionUrl: `/onboarding?userId=${targetUserId}`,
          priority: "low",
          metadata: { userId: targetUserId, requirementKey },
        },
        uploadSender,
      );
      void notifyOpsManagers(
        {
          title: "Document submitted for review",
          message: `${targetUser.name} uploaded "${originalFileName}" (${requirement.label}).`,
          notificationType: "document_submitted",
          relatedModule: "training",
          recordType: "OnboardingDocument",
          recordId: updatedDocId,
          actionUrl: `/onboarding?userId=${targetUserId}`,
          priority: "low",
          metadata: { userId: targetUserId, requirementKey },
        },
        uploadSender,
      );

      return jsonResponse({ ok: true, document: updated });
    }

    const created = await OnboardingDocument.create({
      userId: targetUserId,
      requirementKey,
      requirementLabel: requirement.label,
      fileName: `${Date.now()}-${originalFileName}`,
      originalFileName,
      mimeType,
      fileData,
      storagePath: `db:base64:${Date.now()}`,
      uploadedBy: user.id,
      status: "submitted",
      version: 1,
    });

    await OnboardingReview.create({
      documentId: created._id,
      userId: targetUserId,
      actionType: "uploaded",
      actorId: new mongoose.Types.ObjectId(user.id),
      actorRole: user.role,
      status: "submitted",
      comments: "Document uploaded",
    });

    await recordAudit({
      actorId: user.id,
      actionType: "onboarding_upload",
      targetType: "onboarding_document",
      targetId: created._id.toString(),
      metadata: { userId: targetUserId, requirementKey, fileName: originalFileName },
    });

    // Notify reviewers about the new document submission
    const newDocSender: SenderContext = {
      userId: user.id,
      name: user.name,
      role: user.role,
      teamId: user.teamId,
    };
    const newDocId = created._id.toString();
    void notifyAdmins(
      {
        title: "Document submitted for review",
        message: `${targetUser.name} uploaded "${originalFileName}" (${requirement.label}).`,
        notificationType: "document_submitted",
        relatedModule: "training",
        recordType: "OnboardingDocument",
        recordId: newDocId,
        actionUrl: `/onboarding?userId=${targetUserId}`,
        priority: "low",
        metadata: { userId: targetUserId, requirementKey },
      },
      newDocSender,
    );
    void notifyOpsManagers(
      {
        title: "Document submitted for review",
        message: `${targetUser.name} uploaded "${originalFileName}" (${requirement.label}).`,
        notificationType: "document_submitted",
        relatedModule: "training",
        recordType: "OnboardingDocument",
        recordId: newDocId,
        actionUrl: `/onboarding?userId=${targetUserId}`,
        priority: "low",
        metadata: { userId: targetUserId, requirementKey },
      },
      newDocSender,
    );

    return jsonResponse({ ok: true, document: created });
  }

  if (request.method === "PATCH") {
    const payload = await parseJson(request);
    const actionType = typeof payload.actionType === "string" ? payload.actionType : "";
    const documentId = typeof payload.documentId === "string" ? payload.documentId.trim() : "";
    const comments = typeof payload.comments === "string" ? payload.comments.trim() : "";
    const targetUserId = typeof payload.userId === "string" ? payload.userId.trim() : user.id;
    const status = normalizeStatus(typeof payload.status === "string" ? payload.status : "");

    if (!documentId || !actionType) {
      throw Object.assign(new Error("documentId and actionType are required"), { status: 400 });
    }

    if (!canAccessUser(user, targetUserId)) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }

    const document = await OnboardingDocument.findById(documentId).exec();
    if (!document || document.deleted) {
      throw Object.assign(new Error("Document not found"), { status: 404 });
    }

    if (!isManager(user.role) && actionType !== "request_reupload") {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }

    const update: Record<string, unknown> = {
      status,
      reviewerId: user.id,
      reviewerRole: user.role,
      reviewedAt: new Date(),
      comments,
      rejectionReason: undefined,
    };

    if (actionType === "request_reupload") {
      update.status = "rejected";
      update.rejectionReason = comments || "Please re-upload the required document.";
      update.comments = comments || "Please re-upload the required document.";
    }

    if (actionType === "approve") {
      update.status = "approved";
      update.rejectionReason = undefined;
    }

    if (actionType === "reject") {
      update.status = "rejected";
      update.rejectionReason = comments || "Document rejected";
    }

    const updated = await OnboardingDocument.findByIdAndUpdate(
      documentId,
      { $set: update },
      { new: true },
    ).exec();

    await OnboardingReview.create({
      documentId: updated?._id,
      userId: targetUserId,
      actionType,
      actorId: new mongoose.Types.ObjectId(user.id),
      actorRole: user.role,
      status: updated?.status,
      comments,
      metadata: { targetUserId },
    });

    await recordAudit({
      actorId: user.id,
      actionType: `onboarding_${actionType}`,
      targetType: "onboarding_document",
      targetId: updated?._id.toString(),
      metadata: { userId: targetUserId, comments },
    });

    // Notify the document owner about the review decision
    if (targetUserId !== user.id && updated) {
      const reviewSender: SenderContext = {
        userId: user.id,
        name: user.name,
        role: user.role,
        teamId: user.teamId,
      };
      const reviewDocId = updated._id.toString();
      const reviewUrl = `/onboarding?userId=${targetUserId}`;
      const reviewStatus = updated.status;
      if (reviewStatus === "approved") {
        void notifyUser(
          targetUserId,
          {
            title: "Document approved",
            message: `Your document "${updated.originalFileName ?? updated.requirementLabel ?? ""}" has been approved.`,
            notificationType: "document_approved",
            relatedModule: "training",
            recordType: "OnboardingDocument",
            recordId: reviewDocId,
            actionUrl: reviewUrl,
            priority: "low",
            metadata: { requirementKey: updated.requirementKey },
          },
          reviewSender,
        );
      } else if (reviewStatus === "rejected") {
        void notifyUser(
          targetUserId,
          {
            title: "Document rejected",
            message: `Your document "${updated.originalFileName ?? updated.requirementLabel ?? ""}" has been rejected. ${comments || updated.rejectionReason || ""}`,
            notificationType: "document_rejected",
            relatedModule: "training",
            recordType: "OnboardingDocument",
            recordId: reviewDocId,
            actionUrl: reviewUrl,
            priority: "high",
            metadata: { requirementKey: updated.requirementKey, comments },
          },
          reviewSender,
        );
      }
    }

    return jsonResponse({ ok: true, document: updated });
  }

  if (request.method === "DELETE") {
    const payload = await parseJson(request);
    const documentId = typeof payload.documentId === "string" ? payload.documentId.trim() : "";
    const targetUserId = typeof payload.userId === "string" ? payload.userId.trim() : user.id;
    if (!documentId) {
      throw Object.assign(new Error("documentId is required"), { status: 400 });
    }
    if (!canAccessUser(user, targetUserId)) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }
    const document = await OnboardingDocument.findById(documentId).exec();
    if (!document || document.deleted) {
      throw Object.assign(new Error("Document not found"), { status: 404 });
    }
    if (!isManager(user.role) && user.id !== document.uploadedBy.toString()) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }
    document.deleted = true;
    document.deletedAt = new Date();
    await document.save();
    await OnboardingReview.create({
      documentId: document._id,
      userId: targetUserId,
      actionType: "deleted",
      actorId: new mongoose.Types.ObjectId(user.id),
      actorRole: user.role,
      status: "missing",
      comments: "Document removed",
    });
    await recordAudit({
      actorId: user.id,
      actionType: "onboarding_delete",
      targetType: "onboarding_document",
      targetId: document._id.toString(),
      metadata: { userId: targetUserId },
    });
    return jsonResponse({ ok: true });
  }

  throw Object.assign(new Error("Method not allowed"), { status: 405 });
}
