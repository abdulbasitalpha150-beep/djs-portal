import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Check, X, FileDiff, Clock, User, Calendar, MessageSquare } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/roles";
import { relative } from "@/lib/format";

export const Route = createFileRoute("/_app/approvals")({ component: ApprovalsPage });

type ApprovalRequest = {
  id: string;
  module: string;
  recordId?: string;
  actionType: string;
  requestedBy: string;
  requestedByName: string;
  teamId?: string;
  previousValues?: Record<string, any>;
  newValues: Record<string, any>;
  status: "pending" | "approved" | "rejected" | "changes_requested";
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedByName?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  comments: any[];
  auditHistory: any[];
  createdAt: string;
  updatedAt: string;
};

const MODULES = ["leads", "followups", "customers", "quotes", "carriers", "loads"];

const DOC_LABELS: Record<string, string> = {
  rate_confirmation: "Rate Confirmation",
  bol: "BOL",
  pod: "POD",
  carrier_invoice: "Carrier Invoice",
  customer_invoice: "Customer Invoice",
};

/** "customerReference" / "changed_by" -> "Customer Reference" / "Changed By" */
function humanizeKey(key: string) {
  const withSpaces = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ");
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function isIsoDateString(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v);
}

/** Raw Mongo-style ObjectIds aren't meaningful to a non-technical reader without a name lookup we don't have here. */
function looksLikeId(v: unknown): v is string {
  return typeof v === "string" && /^[a-f0-9]{24}$/i.test(v);
}

function formatPrimitive(v: unknown): string {
  if (v === null || v === undefined || v === "") return "(empty)";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (isIsoDateString(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }
  return String(v);
}

/**
 * Renders a changed field's value in plain language instead of dumping raw JSON.
 * Handles the shapes this app actually produces (documents checklists, *History
 * timelines) specifically, and falls back to a readable key/value list for any
 * other object or array so new fields don't regress to raw JSON either.
 */
function renderChangeValue(key: string, value: unknown): ReactNode {
  if (value === null || value === undefined) return <span className="text-muted-foreground">(empty)</span>;

  // documents: array of { kind, uploaded, uploadedAt }
  if (key === "documents" && Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">(none)</span>;
    return (
      <ul className="space-y-1">
        {value.map((doc: any, i: number) => (
          <li key={i} className="flex items-center justify-between gap-3">
            <span>{DOC_LABELS[doc.kind] || humanizeKey(doc.kind || "Document")}</span>
            <span className={doc.uploaded ? "text-success" : "text-muted-foreground"}>
              {doc.uploaded ? `Uploaded${doc.uploadedAt ? ` · ${formatPrimitive(doc.uploadedAt)}` : ""}` : "Not uploaded"}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  // *History arrays: e.g. statusHistory -> { status, changedBy, changedAt }
  if (/history$/i.test(key) && Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">(none)</span>;
    return (
      <ul className="space-y-1">
        {value.map((entry: any, i: number) => {
          const when = entry.changedAt || entry.at;
          const label = entry.status ? String(entry.status).replace(/_/g, " ") : humanizeKey(key);
          return (
            <li key={i} className="flex items-center justify-between gap-3">
              <span className="capitalize">{label}</span>
              {when && <span className="text-muted-foreground">{formatPrimitive(when)}</span>}
            </li>
          );
        })}
      </ul>
    );
  }

  // Generic array
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">(none)</span>;
    if (typeof value[0] === "object" && value[0] !== null) {
      return (
        <ul className="space-y-2">
          {value.map((entry: any, i: number) => (
            <li key={i} className="rounded border border-border/60 p-2">
              {Object.entries(entry)
                .filter(([k, v]) => !(/by$/i.test(k) && looksLikeId(v)))
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 text-xs">
                    <span className="text-muted-foreground">{humanizeKey(k)}</span>
                    <span>{formatPrimitive(v)}</span>
                  </div>
                ))}
            </li>
          ))}
        </ul>
      );
    }
    return <span>{value.map((v) => formatPrimitive(v)).join(", ")}</span>;
  }

  // Generic object
  if (typeof value === "object") {
    return (
      <div className="space-y-1">
        {Object.entries(value as Record<string, unknown>)
          .filter(([k, v]) => !(/by$/i.test(k) && looksLikeId(v)))
          .map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 text-xs">
              <span className="text-muted-foreground">{humanizeKey(k)}</span>
              <span>{formatPrimitive(v)}</span>
            </div>
          ))}
      </div>
    );
  }

  // Primitive (string / number / boolean / ISO date)
  return <span>{formatPrimitive(value)}</span>;
}

function StatusPill({ status }: { status: ApprovalRequest["status"] }) {
  const styles: Record<ApprovalRequest["status"], string> = {
    pending: "border-warning/30 bg-warning/10 text-warning",
    approved: "border-success/30 bg-success/10 text-success",
    changes_requested: "border-warning/30 bg-warning/10 text-warning",
    rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  };
  const labels: Record<ApprovalRequest["status"], string> = {
    pending: "Pending",
    approved: "Approved",
    changes_requested: "Changes Requested",
    rejected: "Rejected",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function ApprovalCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
          </div>
          <div className="h-3 w-48 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-8 w-24 animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
}

/** Shared reason-collecting dialog for Reject / Request Changes — same shape, different copy and requiredness. */
function ReasonDialog({
  trigger,
  title,
  placeholder,
  required,
  submitLabel,
  submitVariant = "outline",
  onSubmit,
}: {
  trigger: ReactNode;
  title: string;
  placeholder: string;
  required?: boolean;
  submitLabel: string;
  submitVariant?: "outline" | "destructive";
  onSubmit: (reason: string) => void;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            onSubmit((formData.get("reason") as string) || "");
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label>{required ? "Reason (required)" : "Reason (optional)"}</Label>
            <Textarea name="reason" placeholder={placeholder} required={required} />
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <DialogTrigger asChild>
              <Button type="button" variant="outline" className="w-full sm:w-auto">
                Cancel
              </Button>
            </DialogTrigger>
            <Button type="submit" variant={submitVariant} className="w-full sm:w-auto">
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ApprovalsPage() {
  const { session } = useAuth();
  const role = session?.role ?? "agent";
  const canAct = can(role, "approval_actions");
  const [items, setItems] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  // Store just the id, not a frozen snapshot — the dialog's data then stays
  // live as `items` refreshes (e.g. after posting a comment) instead of
  // going stale until the next full remount.
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastRefreshRef = useRef<number>(0);

  const loadData = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const res = await apiFetch<{ approvals: ApprovalRequest[] }>("/api/approvals", {
        method: "GET",
      });
      setItems(res.data.approvals);
    } catch (error) {
      console.error("Failed to load approvals:", error);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto refresh on focus, route change, or every 30 seconds
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) loadData();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastRefreshRef.current > 30000) {
        loadData();
        lastRefreshRef.current = now;
      }
    }, 30000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(interval);
    };
  }, [loadData]);

  const selectedItem = selectedItemId ? (items.find((i) => i.id === selectedItemId) ?? null) : null;

  const handleDecide = async (
    approvalRequestId: string,
    action: "approve" | "reject" | "request_changes",
    reason?: string
  ) => {
    try {
      await apiFetch("/api/approvals", {
        method: "PATCH",
        body: JSON.stringify({ approvalRequestId, action, rejectionReason: reason }),
      });
      const actionText = action === "approve" ? "approved" : action === "reject" ? "rejected" : "changes requested";
      toast.success(`Request ${actionText}`);
      setShowDetailsDialog(false);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process request");
    }
  };

  const handleUpdateRequest = async (approvalRequestId: string, newValues: Record<string, any>) => {
    try {
      await apiFetch("/api/approvals", {
        method: "PATCH",
        body: JSON.stringify({ approvalRequestId, action: "update", newValues }),
      });
      toast.success("Request updated and re-submitted");
      setShowDetailsDialog(false);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update request");
    }
  };

  const filteredItems = items
    .filter((item) => {
      const matchesSearch =
        item.requestedByName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.module.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.actionType.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesModule = moduleFilter === "all" || item.module === moduleFilter;
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      return matchesSearch && matchesModule && matchesStatus;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-6 print:hidden">
      <PageHeader
        title="Approvals"
        description="Unified queue for everything awaiting your decision"
        actions={
          <Button variant="outline" onClick={loadData} disabled={isRefreshing} size="sm">
            {isRefreshing ? <Loader2 className="size-4 animate-spin" /> : null}
            Refresh
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search approvals…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1"
        />
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Module" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modules</SelectItem>
            {MODULES.map((mod) => (
              <SelectItem key={mod} value={mod}>
                {mod.charAt(0).toUpperCase() + mod.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="changes_requested">Changes Requested</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!loading && items.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {filteredItems.length} of {items.length} {items.length === 1 ? "request" : "requests"}
        </p>
      )}

      {loading ? (
        <div className="grid gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ApprovalCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <EmptyState icon={<FileDiff className="size-6" />} title="All caught up" description="No pending approvals in this queue" />
      ) : (
        <div className="grid gap-4">
          {filteredItems.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {item.module.charAt(0).toUpperCase() + item.module.slice(1)}
                      </span>
                      <StatusPill status={item.status} />
                      <span className="text-xs text-muted-foreground">
                        {item.actionType.charAt(0).toUpperCase() + item.actionType.slice(1)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <User className="size-3.5" /> {item.requestedByName}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="size-3.5" /> {relative(item.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Dialog
                      open={showDetailsDialog && selectedItemId === item.id}
                      onOpenChange={(o) => {
                        setShowDetailsDialog(o);
                        if (!o) setSelectedItemId(null);
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedItemId(item.id)}>
                          View details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Approval Request Details</DialogTitle>
                          <DialogDescription>Review the changes before making a decision</DialogDescription>
                        </DialogHeader>
                        {selectedItem && (
                          <ApprovalDetails
                            approval={selectedItem}
                            canAct={canAct}
                            onDecide={handleDecide}
                            onUpdate={handleUpdateRequest}
                            onRefresh={loadData}
                          />
                        )}
                      </DialogContent>
                    </Dialog>

                    {canAct && ["pending", "changes_requested"].includes(item.status) && (
                      <>
                        <Button size="sm" onClick={() => handleDecide(item.id, "approve")}>
                          <Check className="size-4" />
                          <span className="hidden sm:inline">Approve</span>
                        </Button>
                        <ReasonDialog
                          trigger={
                            <Button size="sm" variant="outline">
                              <MessageSquare className="size-4" />
                              <span className="hidden sm:inline">Request Changes</span>
                            </Button>
                          }
                          title="Request Changes"
                          placeholder="Tell the requester what needs to be changed"
                          required
                          submitLabel="Request Changes"
                          onSubmit={(reason) => handleDecide(item.id, "request_changes", reason)}
                        />
                        <ReasonDialog
                          trigger={
                            <Button size="sm" variant="outline">
                              <X className="size-4" />
                              <span className="hidden sm:inline">Reject</span>
                            </Button>
                          }
                          title="Reject Request"
                          placeholder="Enter a reason for rejection"
                          submitLabel="Reject"
                          submitVariant="destructive"
                          onSubmit={(reason) => handleDecide(item.id, "reject", reason)}
                        />
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ApprovalDetails({
  approval,
  canAct,
  onDecide,
  onUpdate,
  onRefresh,
}: {
  approval: ApprovalRequest;
  canAct: boolean;
  onDecide: (id: string, action: "approve" | "reject" | "request_changes", reason?: string) => void;
  onUpdate: (id: string, newValues: Record<string, any>) => void;
  onRefresh: () => Promise<void>;
}) {
  const { session } = useAuth();
  const isRequester = session?.id === approval.requestedBy;
  const canEdit = isRequester && ["rejected", "changes_requested"].includes(approval.status);
  const [editing, setEditing] = useState(false);
  const [newValues, setNewValues] = useState<string>(JSON.stringify(approval.newValues, null, 2));
  const [rejectionReason, setRejectionReason] = useState("");
  const [newComment, setNewComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);

  const getChangedFields = () => {
    if (!approval.previousValues)
      return Object.entries(approval.newValues).map(([key, value]) => ({
        key,
        oldValue: null,
        newValue: value,
      }));
    const allKeys = new Set([...Object.keys(approval.previousValues), ...Object.keys(approval.newValues)]);
    return Array.from(allKeys)
      .map((key) => ({
        key,
        oldValue: approval.previousValues?.[key],
        newValue: approval.newValues?.[key],
      }))
      .filter(({ oldValue, newValue }) => JSON.stringify(oldValue) !== JSON.stringify(newValue));
  };

  const changedFields = getChangedFields();

  const handleSaveEdit = () => {
    try {
      const parsed = JSON.parse(newValues);
      onUpdate(approval.id, parsed);
      setEditing(false);
    } catch (err) {
      toast.error("Invalid JSON in new values");
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setAddingComment(true);
    try {
      await apiFetch("/api/approvals", {
        method: "PATCH",
        body: JSON.stringify({
          approvalRequestId: approval.id,
          action: "add_comment",
          comment: newComment,
        }),
      });
      toast.success("Comment added");
      setNewComment("");
      // Re-fetch so this comment (and `approval`, which is now derived from
      // the live items list in the parent) reflects immediately instead of
      // waiting for the 30s auto-refresh or a tab-focus event.
      await onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add comment");
    } finally {
      setAddingComment(false);
    }
  };

  const statusTextClass: Record<ApprovalRequest["status"], string> = {
    pending: "text-warning",
    approved: "text-success",
    changes_requested: "text-warning",
    rejected: "text-destructive",
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Request Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Module:</span> <span className="font-medium">{approval.module}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Action:</span> <span className="font-medium">{approval.actionType}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Requested by:</span>{" "}
              <span className="font-medium">{approval.requestedByName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Requested at:</span>{" "}
              <span className="font-medium">{new Date(approval.createdAt).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>{" "}
              <span className={`font-medium ${statusTextClass[approval.status]}`}>
                {approval.status === "changes_requested" ? "Changes Requested" : approval.status}
              </span>
            </div>
          </CardContent>
        </Card>

        {(approval.status === "approved" || approval.status === "rejected" || approval.status === "changes_requested") && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {approval.status === "approved"
                  ? "Approval Info"
                  : approval.status === "changes_requested"
                    ? "Changes Requested Info"
                    : "Rejection Info"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">
                  {approval.status === "approved" ? "Approved by" : approval.status === "changes_requested" ? "Requested by" : "Rejected by"}:
                </span>{" "}
                <span className="font-medium">
                  {approval.status === "approved" ? approval.approvedByName : approval.rejectedByName}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">{approval.status === "approved" ? "Approved at" : "Processed at"}:</span>{" "}
                <span className="font-medium">
                  {new Date((approval.status === "approved" ? approval.approvedAt : approval.rejectedAt) as string).toLocaleString()}
                </span>
              </div>
              {approval.rejectionReason && (
                <div>
                  <span className="text-muted-foreground">Reason:</span> <span className="font-medium">{approval.rejectionReason}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Changes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <FileDiff className="size-4" />
            Changes
            {canEdit && (
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setEditing(!editing)}>
                {editing ? "Cancel" : "Edit"}
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {editing ? (
            <div className="space-y-3">
              <Label>Edit New Values (JSON)</Label>
              <Textarea value={newValues} onChange={(e) => setNewValues(e.target.value)} rows={10} className="font-mono text-xs" />
              <Button onClick={handleSaveEdit} className="w-full sm:w-auto">
                Save Changes & Re-submit
              </Button>
            </div>
          ) : changedFields.length === 0 ? (
            <div className="text-sm text-muted-foreground">No changes detected</div>
          ) : (
            <div className="space-y-3">
              {changedFields.map(({ key, oldValue, newValue }) => (
                <div key={key} className="space-y-1.5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{humanizeKey(key)}</div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-normal text-muted-foreground">Previous</Label>
                      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-sm text-foreground">
                        {renderChangeValue(key, oldValue)}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-normal text-muted-foreground">New</Label>
                      <div className="rounded-md border border-success/30 bg-success/5 p-2.5 text-sm text-foreground">
                        {renderChangeValue(key, newValue)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comments */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <MessageSquare className="size-4" />
            Comments
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {approval.comments && approval.comments.length > 0 ? (
            <div className="space-y-3">
              {approval.comments.map((comment: any) => (
                <div key={comment.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold">{comment.userName}</span>
                    <span className="text-xs text-muted-foreground">{relative(comment.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm">{comment.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No comments yet</div>
          )}

          {/* Add Comment */}
          <div className="border-t border-border pt-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment…"
                rows={2}
                className="flex-1"
              />
              <Button onClick={handleAddComment} disabled={!newComment.trim() || addingComment} className="sm:self-end">
                {addingComment ? <Loader2 className="size-4 animate-spin" /> : "Add"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Decide buttons */}
      {canAct && ["pending", "changes_requested"].includes(approval.status) && (
        <div className="space-y-3 border-t border-border pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="rejectionReason">Reason (required for Request Changes, optional otherwise)</Label>
            <Textarea
              id="rejectionReason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter a reason if requesting changes or rejecting"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => onDecide(approval.id, "reject", rejectionReason)}>
              <X className="size-4" /> Reject
            </Button>
            <Button
              variant="outline"
              onClick={() => onDecide(approval.id, "request_changes", rejectionReason)}
              disabled={!rejectionReason.trim()}
            >
              <MessageSquare className="size-4" /> Request Changes
            </Button>
            <Button onClick={() => onDecide(approval.id, "approve")}>
              <Check className="size-4" /> Approve
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}