import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { DataTable } from "@/components/data-table";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usd, fmtDate } from "@/lib/format";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/roles";
import { DollarSign, Download, Pencil, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/commissions")({ component: CommissionsPage });

type CommissionStatus = "pending" | "processing" | "paid";

type CommissionItem = {
  id: string;
  loadId: string;
  loadRef: string;
  agentId: string;
  agentName: string;
  grossMarginAmount: number;
  commissionTier: string;
  commissionPercent: number;
  commissionAmount: number;
  payoutStatus: CommissionStatus;
  payoutDate?: string;
  month: number;
  year: number;
  createdAt: string;
  updatedAt: string;
};

type LoadOption = {
  id: string;
  ref: string;
};

const STATUS_OPTIONS: Array<{ label: string; value: CommissionStatus | "all" }> = [
  { label: "All statuses", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Processing", value: "processing" },
  { label: "Paid", value: "paid" },
];

function CommissionsPage() {
  const { session } = useAuth();
  const role = session?.role ?? "agent";
  const canUpdate = role === "admin" || role === "accounting";
  const [items, setItems] = useState<CommissionItem[]>([]);
  const [loadOptions, setLoadOptions] = useState<LoadOption[]>([]);
  const [status, setStatus] = useState<CommissionStatus | "all">("all");
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [form, setForm] = useState({
    loadId: "",
    agentId: session?.id ?? "",
    grossMarginAmount: "0",
    commissionTier: "Standard",
    commissionPercent: "10",
    payoutStatus: "pending" as CommissionStatus,
    payoutDate: "",
    month: String(new Date().getMonth() + 1),
    year: String(new Date().getFullYear()),
  });
  const [editForm, setEditForm] = useState({
    loadId: "",
    agentId: "",
    grossMarginAmount: "0",
    commissionTier: "Standard",
    commissionPercent: "10",
    payoutStatus: "pending" as CommissionStatus,
    payoutDate: "",
    month: String(new Date().getMonth() + 1),
    year: String(new Date().getFullYear()),
  });

  const filtered = useMemo(
    () => items.filter((item) => status === "all" || item.payoutStatus === status),
    [items, status],
  );
  const open = items.find((i) => i.id === openId) ?? null;

  const totals = useMemo(() => {
    return {
      pending: items
        .filter((c) => c.payoutStatus === "pending")
        .reduce((sum, c) => sum + c.commissionAmount, 0),
      processing: items
        .filter((c) => c.payoutStatus === "processing")
        .reduce((sum, c) => sum + c.commissionAmount, 0),
      paid: items
        .filter((c) => c.payoutStatus === "paid")
        .reduce((sum, c) => sum + c.commissionAmount, 0),
      accrued: items
        .filter((c) => c.payoutStatus !== "paid")
        .reduce((sum, c) => sum + c.commissionAmount, 0),
    };
  }, [items]);

  const loadCommissions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== "all") {
        params.set("status", status);
      }
      const payload = await apiFetch<{ commissions: CommissionItem[] }>(
        `/api/commissions${params.toString() ? `?${params.toString()}` : ""}`,
      );
      setItems(payload.data.commissions);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Unable to load commissions");
    } finally {
      setLoading(false);
    }
  };

  const loadReferenceData = async () => {
    try {
      const payload = await apiFetch<{ loads: LoadOption[] }>("/api/loads");
      setLoadOptions(payload.data.loads);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Unable to load loads");
    }
  };

  useEffect(() => {
    loadReferenceData();
  }, []);

  useEffect(() => {
    loadCommissions();
  }, [status]);

  useEffect(() => {
    if (!open) {
      setEditing(false);
      setDeleteTarget(null);
      return;
    }
    setEditForm({
      loadId: open.loadId,
      agentId: open.agentId,
      grossMarginAmount: String(open.grossMarginAmount),
      commissionTier: open.commissionTier,
      commissionPercent: String(open.commissionPercent),
      payoutStatus: open.payoutStatus,
      payoutDate: open.payoutDate ? open.payoutDate.slice(0, 10) : "",
      month: String(open.month),
      year: String(open.year),
    });
  }, [open]);

  async function createCommission(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    try {
      const payload = await apiFetch<{ commission: CommissionItem }>("/api/commissions", {
        method: "POST",
        body: JSON.stringify({
          loadId: form.loadId,
          agentId: form.agentId,
          grossMarginAmount: Number(form.grossMarginAmount),
          commissionTier: form.commissionTier,
          commissionPercent: Number(form.commissionPercent),
          payoutStatus: form.payoutStatus,
          payoutDate: form.payoutDate || undefined,
          month: Number(form.month),
          year: Number(form.year),
        }),
      });
      setItems((prev) => [payload.data.commission, ...prev]);
      setForm({
        loadId: "",
        agentId: session?.id ?? "",
        grossMarginAmount: "0",
        commissionTier: "Standard",
        commissionPercent: "10",
        payoutStatus: "pending",
        payoutDate: "",
        month: String(new Date().getMonth() + 1),
        year: String(new Date().getFullYear()),
      });
      setShowCreate(false);
      toast.success("Commission created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create commission");
    } finally {
      setCreating(false);
    }
  }

  async function saveCommission(event: React.FormEvent) {
    event.preventDefault();
    if (!open) return;
    setSaving(true);
    try {
      const payload = await apiFetch<{ commission: CommissionItem }>("/api/commissions", {
        method: "PATCH",
        body: JSON.stringify({
          commissionId: open.id,
          loadId: editForm.loadId,
          agentId: editForm.agentId,
          grossMarginAmount: Number(editForm.grossMarginAmount),
          commissionTier: editForm.commissionTier,
          commissionPercent: Number(editForm.commissionPercent),
          payoutStatus: editForm.payoutStatus,
          payoutDate: editForm.payoutDate || undefined,
          month: Number(editForm.month),
          year: Number(editForm.year),
        }),
      });
      setItems((prev) =>
        prev.map((item) => (item.id === open.id ? payload.data.commission : item)),
      );
      setOpenId(payload.data.commission.id);
      setEditing(false);
      toast.success("Commission saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save commission");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCommission() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch("/api/commissions", {
        method: "DELETE",
        body: JSON.stringify({ commissionId: deleteTarget }),
      });
      setItems((prev) => prev.filter((item) => item.id !== deleteTarget));
      setOpenId((prev) => (prev === deleteTarget ? null : prev));
      setDeleteTarget(null);
      toast.success("Commission deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete commission");
    } finally {
      setDeleting(false);
    }
  }

  function exportCommissions(format: "csv" | "xlsx") {
    const rows = filtered;
    if (rows.length === 0) {
      toast.error("No commissions to export");
      return;
    }

    const data = rows.map((item) => ({
      Commission: item.id,
      Load: item.loadRef,
      Agent: item.agentName,
      "Gross margin": usd(item.grossMarginAmount),
      Tier: item.commissionTier,
      Rate: `${item.commissionPercent}%`,
      Amount: usd(item.commissionAmount),
      "Payout status": item.payoutStatus,
      "Payout date": item.payoutDate ? fmtDate(item.payoutDate) : "—",
      Month: item.month,
      Year: item.year,
      Created: fmtDate(item.createdAt),
    }));

    if (format === "csv") {
      const header = Object.keys(data[0]);
      const csvContent = [
        header.join(","),
        ...data.map((row) =>
          header
            .map((fieldName) => escapeCsv(String(row[fieldName as keyof typeof row])))
            .join(","),
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "commissions.csv";
      link.click();
      URL.revokeObjectURL(url);
    } else {
      import("xlsx").then((XLSX) => {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Commissions");
        XLSX.writeFile(workbook, "commissions.xlsx");
      });
    }
    toast.success("Commissions exported");
  }

  function escapeCsv(value: string) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  function startEdit() {
    if (!open) return;
    setEditing(true);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Commissions"
        description="Live commission records and payout status from the database."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="size-4" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => exportCommissions("csv")}>CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportCommissions("xlsx")}>XLSX</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {canUpdate && (
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="size-4" /> Add
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => void loadCommissions()}
              disabled={loading}
            >
              <RefreshCcw className="size-4" /> Refresh
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatCard
          label="Pending"
          value={usd(totals.pending)}
          icon={<DollarSign className="size-4" />}
        />
        <StatCard
          label="Processing"
          value={usd(totals.processing)}
          icon={<DollarSign className="size-4" />}
        />
        <StatCard
          label="Paid (lifetime)"
          value={usd(totals.paid)}
          icon={<DollarSign className="size-4" />}
        />
        <StatCard
          label="Unpaid accruals"
          value={usd(totals.accrued)}
          icon={<DollarSign className="size-4" />}
        />
      </div>

      {showCreate && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Add a commission</div>
              <div className="text-xs text-muted-foreground">
                Save a new commission into the database.
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={createCommission}>
            <div className="space-y-1.5">
              <Label htmlFor="create-loadId">Load</Label>
              <Select
                value={form.loadId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, loadId: value }))}
              >
                <SelectTrigger id="create-loadId">
                  <SelectValue placeholder="Select a load" />
                </SelectTrigger>
                <SelectContent>
                  {loadOptions.map((load) => (
                    <SelectItem key={load.id} value={load.id}>
                      {load.ref}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-agentId">Agent ID</Label>
              <Input
                id="create-agentId"
                value={form.agentId}
                onChange={(e) => setForm((prev) => ({ ...prev, agentId: e.target.value }))}
                placeholder="Agent object ID"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-grossMarginAmount">Gross margin</Label>
              <Input
                id="create-grossMarginAmount"
                type="number"
                value={form.grossMarginAmount}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, grossMarginAmount: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-commissionPercent">Rate %</Label>
              <Input
                id="create-commissionPercent"
                type="number"
                value={form.commissionPercent}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, commissionPercent: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-commissionTier">Tier</Label>
              <Input
                id="create-commissionTier"
                value={form.commissionTier}
                onChange={(e) => setForm((prev) => ({ ...prev, commissionTier: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-payoutStatus">Payout status</Label>
              <Select
                value={form.payoutStatus}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, payoutStatus: value as CommissionStatus }))
                }
              >
                <SelectTrigger id="create-payoutStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-payoutDate">Payout date</Label>
              <Input
                id="create-payoutDate"
                type="date"
                value={form.payoutDate}
                onChange={(e) => setForm((prev) => ({ ...prev, payoutDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-month">Month</Label>
              <Input
                id="create-month"
                type="number"
                value={form.month}
                onChange={(e) => setForm((prev) => ({ ...prev, month: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-year">Year</Label>
              <Input
                id="create-year"
                type="number"
                value={form.year}
                onChange={(e) => setForm((prev) => ({ ...prev, year: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={creating}>
                {creating ? "Saving…" : "Save commission"}
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as CommissionStatus | "all")}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        rows={filtered}
        empty={
          <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No commission records found.
          </div>
        }
        onRowClick={(item) => setOpenId(item.id)}
        columns={[
          {
            head: "Commission",
            cell: (item) => <span className="font-mono text-xs">{item.id}</span>,
          },
          {
            head: "Load",
            cell: (item) => <span className="font-mono text-xs">{item.loadRef}</span>,
          },
          { head: "Agent", cell: (item) => item.agentName },
          {
            head: "Gross margin",
            cell: (item) => (
              <span className="font-mono text-sm">{usd(item.grossMarginAmount)}</span>
            ),
          },
          { head: "Tier", cell: (item) => item.commissionTier },
          {
            head: "Rate",
            cell: (item) => <span className="font-mono text-xs">{item.commissionPercent}%</span>,
          },
          {
            head: "Commission",
            cell: (item) => <span className="font-mono text-sm">{usd(item.commissionAmount)}</span>,
          },
          { head: "Status", cell: (item) => <StatusBadge value={item.payoutStatus} /> },
        ]}
      />

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {open && (
            <>
              <SheetHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <SheetTitle>Commission {open.id}</SheetTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    {canUpdate && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteTarget(open.id)}
                          >
                            <Trash2 className="size-4" /> Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete commission?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove the commission from the portal. This
                              action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={deleteCommission} disabled={deleting}>
                              {deleting ? "Deleting…" : "Delete commission"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    {canUpdate && !editing && (
                      <Button size="sm" onClick={startEdit}>
                        <Pencil className="size-4" /> Edit
                      </Button>
                    )}
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-4 px-4 pb-6 pt-2">
                {editing ? (
                  <form className="grid gap-3" onSubmit={saveCommission}>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-loadId">Load</Label>
                        <Select
                          value={editForm.loadId}
                          onValueChange={(value) =>
                            setEditForm((prev) => ({ ...prev, loadId: value }))
                          }
                        >
                          <SelectTrigger id="edit-loadId">
                            <SelectValue placeholder="Select a load" />
                          </SelectTrigger>
                          <SelectContent>
                            {loadOptions.map((load) => (
                              <SelectItem key={load.id} value={load.id}>
                                {load.ref}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-agentId">Agent ID</Label>
                        <Input
                          id="edit-agentId"
                          value={editForm.agentId}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, agentId: e.target.value }))
                          }
                          placeholder="Agent object ID"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-grossMarginAmount">Gross margin</Label>
                        <Input
                          id="edit-grossMarginAmount"
                          type="number"
                          value={editForm.grossMarginAmount}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, grossMarginAmount: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-commissionPercent">Rate %</Label>
                        <Input
                          id="edit-commissionPercent"
                          type="number"
                          value={editForm.commissionPercent}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, commissionPercent: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-commissionTier">Tier</Label>
                        <Input
                          id="edit-commissionTier"
                          value={editForm.commissionTier}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, commissionTier: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-payoutStatus">Payout status</Label>
                        <Select
                          value={editForm.payoutStatus}
                          onValueChange={(value) =>
                            setEditForm((prev) => ({
                              ...prev,
                              payoutStatus: value as CommissionStatus,
                            }))
                          }
                        >
                          <SelectTrigger id="edit-payoutStatus">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="processing">Processing</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-payoutDate">Payout date</Label>
                        <Input
                          id="edit-payoutDate"
                          type="date"
                          value={editForm.payoutDate}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, payoutDate: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-month">Month</Label>
                        <Input
                          id="edit-month"
                          type="number"
                          value={editForm.month}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, month: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-year">Year</Label>
                        <Input
                          id="edit-year"
                          type="number"
                          value={editForm.year}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, year: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-3">
                      <Button type="submit" disabled={saving}>
                        {saving ? "Saving…" : "Save changes"}
                      </Button>
                      <Button variant="ghost" type="button" onClick={() => setEditing(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <Field label="Load" value={open.loadRef} />
                      <Field label="Agent" value={open.agentName} />
                      <Field label="Gross margin" value={usd(open.grossMarginAmount)} mono />
                      <Field label="Tier" value={open.commissionTier} />
                      <Field label="Rate" value={`${open.commissionPercent}%`} mono />
                      <Field label="Commission" value={usd(open.commissionAmount)} mono />
                      <Field label="Status" value={<StatusBadge value={open.payoutStatus} />} />
                      <Field
                        label="Payout date"
                        value={open.payoutDate ? fmtDate(open.payoutDate) : "—"}
                      />
                      <Field label="Month" value={String(open.month)} />
                      <Field label="Year" value={String(open.year)} />
                      <Field label="Created" value={fmtDate(open.createdAt)} />
                      <Field label="Updated" value={fmtDate(open.updatedAt)} />
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`mt-0.5 ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
    </div>
  );
}
