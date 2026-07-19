import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api-client";
import { Check, Download, Eye, Search, Upload, X } from "lucide-react";
import { toast } from "sonner";

type OnboardingItem = {
  id: string | null;
  key: string;
  label: string;
  description?: string | null;
  status: string;
  uploadedAt: string | null;
  uploadedBy: string | null;
  reviewer: string | null;
  reviewedAt: string | null;
  comments: string | null;
  rejectionReason: string | null;
  mimeType: string | null;
  fileName: string | null;
  storagePath: string | null;
  version: number;
};

type OnboardingUserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  completion: number;
  status: string;
  lastUpdated: string | null;
  missingDocumentsCount: number;
};

type OnboardingReview = {
  id: string;
  actionType: string;
  actorRole?: string;
  comments?: string | null;
  createdAt: string;
  status?: string;
};

export const Route = createFileRoute("/_app/onboarding")({ component: OnboardingPage });

function OnboardingPage() {
  const { session } = useAuth();
  const role = session?.role ?? "agent";
  const isManager = role === "admin" || role === "ops_manager";
  const [users, setUsers] = useState<OnboardingUserRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [items, setItems] = useState<OnboardingItem[]>([]);
  const [reviews, setReviews] = useState<OnboardingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [pendingRequirementKey, setPendingRequirementKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canApprove = role === "admin" || role === "ops_manager";
  const done = items.filter((item) => item.status === "approved").length;
  const totalDocs = items.length || 1;
  const completion = Math.round((done / totalDocs) * 100);

  const loadData = async (
    userIdOverride?: string | null,
    queryOverride = query,
    statusOverride = statusFilter,
    pageOverride = page,
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (userIdOverride) params.set("userId", userIdOverride);
      if (!isManager) params.set("userId", session?.id ?? "");
      if (queryOverride) params.set("search", queryOverride);
      if (statusOverride) params.set("status", statusOverride);
      params.set("page", String(pageOverride));
      params.set("pageSize", String(pageSize));
      const payload = await apiFetch<{
        users: OnboardingUserRow[];
        total: number;
        user?: { id: string; name: string; email: string; role: string; status: string };
        requirements: Array<{ key: string; label: string; description?: string | null }>;
        items: OnboardingItem[];
        reviews: OnboardingReview[];
      }>("/api/onboarding?" + params.toString());
      if (isManager && !userIdOverride) {
        setUsers(payload.data.users ?? []);
        setTotal(payload.data.total ?? 0);
        if ((payload.data.users?.length ?? 0) > 0 && !selectedUserId) {
          setSelectedUserId(payload.data.users[0].id);
        }
      }
      if (payload.data.items) {
        setItems(payload.data.items);
        setReviews(payload.data.reviews ?? []);
      }
      if (payload.data.user) {
        setSelectedUserId(payload.data.user.id);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load onboarding data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData(isManager ? selectedUserId : (session?.id ?? null));
  }, [session?.id, isManager, selectedUserId]);

  const handleUpload = async (requirementKey: string, file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be 10MB or less");
      return;
    }
    const allowedTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(pdf|png|jpg|jpeg|doc|docx)$/i)) {
      toast.error("Only PDF, image, and Word files are supported");
      return;
    }
    setSubmitting(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        await apiFetch("/api/onboarding", {
          method: "POST",
          body: JSON.stringify({
            requirementKey,
            fileData: dataUrl,
            originalFileName: file.name,
            mimeType: file.type || "application/octet-stream",
            userId: selectedUserId ?? session?.id,
          }),
        });
        toast.success("Document uploaded");
        await loadData(selectedUserId ?? session?.id ?? null, query, statusFilter, page);
        setPendingRequirementKey(null);
      };
      reader.onerror = () => {
        toast.error("Unable to read the selected file");
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewAction = async (
    documentId: string | null,
    actionType: "approve" | "reject" | "request_reupload",
  ) => {
    if (!documentId) return;
    const comments =
      window.prompt(
        actionType === "reject"
          ? "Add a rejection note"
          : actionType === "request_reupload"
            ? "Ask for a re-upload"
            : "Add a review comment",
      ) ?? "";
    setSubmitting(true);
    try {
      await apiFetch("/api/onboarding", {
        method: "PATCH",
        body: JSON.stringify({
          documentId,
          actionType,
          comments,
          userId: selectedUserId ?? session?.id,
        }),
      });
      toast.success(
        actionType === "approve"
          ? "Document approved"
          : actionType === "reject"
            ? "Document rejected"
            : "Re-upload requested",
      );
      await loadData(selectedUserId ?? session?.id ?? null, query, statusFilter, page);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Review action failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (documentId: string | null) => {
    if (!documentId) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/onboarding", {
        method: "DELETE",
        body: JSON.stringify({ documentId, userId: selectedUserId ?? session?.id }),
      });
      toast.success("Document removed");
      await loadData(selectedUserId ?? session?.id ?? null, query, statusFilter, page);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = (format: "csv" | "excel") => {
    const rows = users.map((user) => [
      user.name,
      user.email,
      user.role,
      `${user.completion}%`,
      user.status,
      user.lastUpdated ?? "",
      user.missingDocumentsCount,
    ]);
    const csv = [
      "User,Email,Role,Completion,Status,Last Updated,Missing Documents",
      ...rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob(
      [
        format === "csv"
          ? csv
          : `<?xml version="1.0" encoding="UTF-8"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Onboarding"><Table><Row><Cell><Data ss:Type="String">User</Data></Cell><Cell><Data ss:Type="String">Email</Data></Cell><Cell><Data ss:Type="String">Role</Data></Cell><Cell><Data ss:Type="String">Completion</Data></Cell><Cell><Data ss:Type="String">Status</Data></Cell><Cell><Data ss:Type="String">Last Updated</Data></Cell><Cell><Data ss:Type="String">Missing Documents</Data></Cell></Row>${rows.map((row) => `<Row>${row.map((value) => `<Cell><Data ss:Type="String">${String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</Data></Cell>`).join("")}</Row>`).join("")}</Table></Worksheet></Workbook>`,
      ],
      { type: format === "csv" ? "text/csv;charset=utf-8" : "application/xml" },
    );
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `onboarding-export.${format}`;
    link.click();
    window.URL.revokeObjectURL(url);
    toast.success(`Exported ${format.toUpperCase()} file`);
  };

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId),
    [selectedUserId, users],
  );

  const statusLabel = (status: string) => status.replace(/_/g, " ");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Onboarding"
        description={
          isManager
            ? "Manage onboarding progress for team members."
            : "Track your onboarding requirements and document progress."
        }
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const file = event.target.files?.[0];
          if (file && pendingRequirementKey) {
            void handleUpload(pendingRequirementKey, file);
          }
          event.target.value = "";
        }}
      />

      {isManager ? (
        <div className="space-y-4 rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">User onboarding overview</h3>
              <p className="text-sm text-muted-foreground">
                Search and review onboarding progress for your team.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                <Search className="size-3.5 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name or email"
                  className="w-44 bg-transparent text-sm outline-none"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">All statuses</option>
                <option value="complete">Complete</option>
                <option value="in_progress">In progress</option>
                <option value="missing_documents">Missing documents</option>
              </select>
              <Button size="sm" variant="outline" onClick={() => handleExport("csv")}>
                Export CSV
              </Button>
              <Button size="sm" onClick={() => handleExport("excel")}>
                Export Excel
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/60 text-left">
                <tr>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Completion</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Last updated</th>
                  <th className="px-3 py-2">Missing</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className={`cursor-pointer border-t border-border ${selectedUserId === user.id ? "bg-muted/50" : "bg-background"}`}
                    onClick={() => setSelectedUserId(user.id)}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">{user.name}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </td>
                    <td className="px-3 py-2">{user.role}</td>
                    <td className="px-3 py-2">{user.completion}%</td>
                    <td className="px-3 py-2">
                      <StatusBadge value={user.status} />
                    </td>
                    <td className="px-3 py-2">
                      {user.lastUpdated ? fmtDate(user.lastUpdated) : "—"}
                    </td>
                    <td className="px-3 py-2">{user.missingDocumentsCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {users.length} of {total}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((value) => value + 1)}
                disabled={page * pageSize >= total}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">
              {isManager
                ? `Onboarding for ${selectedUser?.name ?? "selected user"}`
                : "My onboarding"}
            </h3>
            <p className="text-sm text-muted-foreground">
              Documents and review status are stored in the database and update instantly.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Completion</span>
            <span className="rounded-full bg-muted px-2 py-1 text-sm font-mono">
              {done}/{totalDocs}
            </span>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary" style={{ width: `${completion}%` }} />
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading onboarding data…</div>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.key} className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium">{item.label}</div>
                {item.description ? (
                  <div className="text-sm text-muted-foreground">{item.description}</div>
                ) : null}
                <div className="mt-2 text-xs text-muted-foreground">
                  {item.uploadedAt ? `Uploaded ${fmtDate(item.uploadedAt)}` : "Not uploaded yet"}
                  {item.fileName ? ` • ${item.fileName}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge value={item.status} />
                {item.fileName ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const dataUrl = item.storagePath || "";
                        if (!dataUrl) return;
                        const link = document.createElement("a");
                        link.href = dataUrl;
                        link.download = item.fileName ?? item.label;
                        link.click();
                      }}
                    >
                      <Download className="size-3.5" /> Download
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const dataUrl = item.storagePath || "";
                        if (!dataUrl) return;
                        window.open(dataUrl, "_blank");
                      }}
                    >
                      <Eye className="size-3.5" /> Preview
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {!item.fileName && !submitting && (canApprove || !isManager) ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setPendingRequirementKey(item.key);
                    fileInputRef.current?.click();
                  }}
                >
                  <Upload className="size-3.5" /> Upload
                </Button>
              ) : null}
              {isManager && item.fileName && (
                <>
                  <Button size="sm" onClick={() => void handleReviewAction(item.id, "approve")}>
                    <Check className="size-3.5" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleReviewAction(item.id, "reject")}
                  >
                    <X className="size-3.5" /> Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleReviewAction(item.id, "request_reupload")}
                  >
                    Re-upload
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void handleDelete(item.id)}>
                    Remove
                  </Button>
                </>
              )}
            </div>
            {item.comments || item.rejectionReason ? (
              <div className="mt-3 rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
                {item.comments ? (
                  <div>
                    <span className="font-medium text-foreground">Comment:</span> {item.comments}
                  </div>
                ) : null}
                {item.rejectionReason ? (
                  <div>
                    <span className="font-medium text-foreground">Rejection:</span>{" "}
                    {item.rejectionReason}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {reviews.length ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">Review history</h3>
          <div className="mt-3 space-y-2">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="rounded-md border border-border bg-background p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{review.actionType.replace(/_/g, " ")}</span>
                  <span className="text-xs text-muted-foreground">{fmtDate(review.createdAt)}</span>
                </div>
                {review.comments ? (
                  <div className="mt-1 text-muted-foreground">{review.comments}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
