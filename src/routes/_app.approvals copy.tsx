import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
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

export const Route = createFileRoute("/_app/approvals copy")({ component: ApprovalsPage });

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

function ApprovalsPage() {
  const { session } = useAuth();
  const role = session?.role ?? "agent";
  const canAct = can(role, "approval_actions");
  const [items, setItems] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<ApprovalRequest | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
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

  const handleDecide = async (
    approvalRequestId: string,
    action: "approve" | "reject" | "request_changes",
    reason?: string,
  ) => {
    try {
      await apiFetch("/api/approvals", {
        method: "PATCH",
        body: JSON.stringify({ approvalRequestId, action, rejectionReason: reason }),
      });
      const actionText =
        action === "approve" ? "approved" : action === "reject" ? "rejected" : "changes requested";
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
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={loadData} disabled={isRefreshing} size="sm">
              {isRefreshing ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
              Refresh
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="Search approvals..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1"
        />
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Module" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modules</SelectItem>
            {["leads", "followups", "customers", "quotes", "carriers", "loads"].map((mod) => (
              <SelectItem key={mod} value={mod}>
                {mod.charAt(0).toUpperCase() + mod.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
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

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card p-12 text-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading approvals…</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={<FileDiff className="size-6" />}
          title="All caught up"
          description="No pending approvals in this queue"
        />
      ) : (
        <div className="grid gap-4">
          {filteredItems.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {item.module.charAt(0).toUpperCase() + item.module.slice(1)}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          item.status === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : item.status === "approved"
                              ? "bg-green-100 text-green-800"
                              : item.status === "changes_requested"
                                ? "bg-orange-100 text-orange-800"
                                : "bg-red-100 text-red-800"
                        }`}
                      >
                        {item.status === "changes_requested"
                          ? "Changes Requested"
                          : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {item.actionType.charAt(0).toUpperCase() + item.actionType.slice(1)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="size-4" />
                      <span>Requested by {item.requestedByName}</span>
                      <span>•</span>
                      <Calendar className="size-4" />
                      <span>{relative(item.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Dialog
                      open={showDetailsDialog && selectedItem?.id === item.id}
                      onOpenChange={(o) => {
                        setShowDetailsDialog(o);
                        if (!o) setSelectedItem(null);
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedItem(item)}>
                          View details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl">
                        <DialogHeader>
                          <DialogTitle>Approval Request Details</DialogTitle>
                          <DialogDescription>
                            Review the changes before making a decision
                          </DialogDescription>
                        </DialogHeader>
                        {selectedItem && (
                          <ApprovalDetails
                            approval={selectedItem}
                            canAct={canAct}
                            onDecide={handleDecide}
                            onUpdate={handleUpdateRequest}
                          />
                        )}
                      </DialogContent>
                    </Dialog>
                    {canAct && ["pending", "changes_requested"].includes(item.status) && (
                      <>
                        <Button size="sm" onClick={() => handleDecide(item.id, "approve")}>
                          <Check className="size-4 mr-1.5" />
                          Approve
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              <MessageSquare className="size-4 mr-1.5" />
                              Request Changes
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Request Changes</DialogTitle>
                            </DialogHeader>
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                const formData = new FormData(e.currentTarget);
                                handleDecide(
                                  item.id,
                                  "request_changes",
                                  formData.get("reason") as string,
                                );
                              }}
                              className="space-y-4"
                            >
                              <div>
                                <Label>Reason for Changes (required)</Label>
                                <Textarea
                                  name="reason"
                                  placeholder="Tell the requester what needs to be changed"
                                  required
                                />
                              </div>
                              <DialogFooter>
                                <DialogTrigger asChild>
                                  <Button variant="outline">Cancel</Button>
                                </DialogTrigger>
                                <Button type="submit">Request Changes</Button>
                              </DialogFooter>
                            </form>
                          </DialogContent>
                        </Dialog>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              <X className="size-4 mr-1.5" />
                              Reject
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Reject Request</DialogTitle>
                            </DialogHeader>
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                const formData = new FormData(e.currentTarget);
                                handleDecide(item.id, "reject", formData.get("reason") as string);
                              }}
                              className="space-y-4"
                            >
                              <div>
                                <Label>Rejection Reason (optional)</Label>
                                <Textarea
                                  name="reason"
                                  placeholder="Enter a reason for rejection"
                                />
                              </div>
                              <DialogFooter>
                                <DialogTrigger asChild>
                                  <Button variant="outline">Cancel</Button>
                                </DialogTrigger>
                                <Button type="submit" variant="destructive">
                                  Reject
                                </Button>
                              </DialogFooter>
                            </form>
                          </DialogContent>
                        </Dialog>
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
}: {
  approval: ApprovalRequest;
  canAct: boolean;
  onDecide: (id: string, action: "approve" | "reject" | "request_changes", reason?: string) => void;
  onUpdate: (id: string, newValues: Record<string, any>) => void;
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
    const allKeys = new Set([
      ...Object.keys(approval.previousValues),
      ...Object.keys(approval.newValues),
    ]);
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
      // Refresh data (call the parent's loadData, but wait, parent doesn't pass it! Let's wait for the user to refresh, or, since we have auto-refresh on focus, that should work!)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add comment");
    } finally {
      setAddingComment(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Request Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Module:</span>{" "}
              <span className="font-medium">{approval.module}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Action:</span>{" "}
              <span className="font-medium">{approval.actionType}</span>
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
              <span
                className={`font-medium ${
                  approval.status === "pending"
                    ? "text-yellow-600"
                    : approval.status === "approved"
                      ? "text-green-600"
                      : approval.status === "changes_requested"
                        ? "text-orange-600"
                        : "text-red-600"
                }`}
              >
                {approval.status === "changes_requested" ? "Changes Requested" : approval.status}
              </span>
            </div>
          </CardContent>
        </Card>

        {(approval.status === "approved" ||
          approval.status === "rejected" ||
          approval.status === "changes_requested") && (
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
                  {approval.status === "approved"
                    ? "Approved by"
                    : approval.status === "changes_requested"
                      ? "Requested by"
                      : "Rejected by"}
                  :
                </span>{" "}
                <span className="font-medium">
                  {approval.status === "approved"
                    ? approval.approvedByName
                    : approval.rejectedByName}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {approval.status === "approved" ? "Approved at" : "Processed at"}:
                </span>{" "}
                <span className="font-medium">
                  {new Date(
                    (approval.status === "approved"
                      ? approval.approvedAt
                      : approval.rejectedAt) as string,
                  ).toLocaleString()}
                </span>
              </div>
              {approval.rejectionReason && (
                <div>
                  <span className="text-muted-foreground">Reason:</span>{" "}
                  <span className="font-medium">{approval.rejectionReason}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Changes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileDiff className="size-4" />
            Changes
            {canEdit && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(!editing)}>
                {editing ? "Cancel" : "Edit"}
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {editing ? (
            <div className="space-y-4">
              <Label>Edit New Values (JSON)</Label>
              <Textarea
                value={newValues}
                onChange={(e) => setNewValues(e.target.value)}
                rows={10}
              />
              <Button onClick={handleSaveEdit} className="w-full sm:w-auto">
                Save Changes & Re-submit
              </Button>
            </div>
          ) : changedFields.length === 0 ? (
            <div className="text-sm text-muted-foreground">No changes detected</div>
          ) : (
            <div className="space-y-3">
              {changedFields.map(({ key, oldValue, newValue }) => (
                <div key={key} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Previous Value
                    </Label>
                    <div className="rounded-md border bg-red-50/10 border-red-100 p-3 text-sm font-mono text-red-700 whitespace-pre-wrap">
                      {oldValue === null || oldValue === undefined
                        ? "(empty)"
                        : typeof oldValue === "object"
                          ? JSON.stringify(oldValue, null, 2)
                          : String(oldValue)}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">New Value</Label>
                    <div className="rounded-md border bg-green-50/10 border-green-100 p-3 text-sm font-mono text-green-700 whitespace-pre-wrap">
                      {newValue === null || newValue === undefined
                        ? "(empty)"
                        : typeof newValue === "object"
                          ? JSON.stringify(newValue, null, 2)
                          : String(newValue)}
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
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MessageSquare className="size-4" />
            Comments
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {approval.comments && approval.comments.length > 0 ? (
            <div className="space-y-3">
              {approval.comments.map((comment: any) => (
                <div key={comment.id} className="border border-border rounded-md p-3">
                  <div className="flex items-center justify-between">
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
          <div className="pt-3 border-t border-border">
            <div className="flex gap-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                rows={2}
                className="flex-1"
              />
              <Button onClick={handleAddComment} disabled={!newComment.trim() || addingComment}>
                {addingComment ? <Loader2 className="size-4 animate-spin" /> : "Add"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Decide buttons */}
      {canAct && ["pending", "changes_requested"].includes(approval.status) && (
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
          <div className="flex-1">
            <Label htmlFor="rejectionReason">
              Reason (required for Request Changes, optional otherwise)
            </Label>
            <Textarea
              id="rejectionReason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter a reason if requesting changes or rejecting"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <Button
              variant="outline"
              onClick={() => onDecide(approval.id, "reject", rejectionReason)}
            >
              <X className="size-4 mr-2" />
              Reject
            </Button>
            <Button
              variant="outline"
              onClick={() => onDecide(approval.id, "request_changes", rejectionReason)}
              disabled={!rejectionReason.trim()}
            >
              <MessageSquare className="size-4 mr-2" />
              Request Changes
            </Button>
            <Button onClick={() => onDecide(approval.id, "approve")}>
              <Check className="size-4 mr-2" />
              Approve
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
