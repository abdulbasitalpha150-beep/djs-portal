import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/roles";
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
import {
  Check,
  Download,
  Edit,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Truck,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/carriers")({
  component: CarriersPage,
});

const CARRIER_STATUSES = ["pending", "under_review", "approved", "rejected", "suspended"] as const;

type CarrierStatus = (typeof CARRIER_STATUSES)[number];

type CarrierItem = {
  id: string;
  legalName: string;
  dba: string;
  companyName: string;
  mcNumber: string;
  dotNumber: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  taxId: string;
  equipmentTypes: string[];
  serviceAreas: string[];
  insuranceCarrier: string;
  insurancePolicyNumber: string;
  insuranceExpiresAt: string | null;
  notes: string;
  status: CarrierStatus;
  vettingChecks: {
    authorityVerified: boolean;
    insuranceVerified: boolean;
    safetyVerified: boolean;
    fraudChecked: boolean;
    complianceVerified: boolean;
  };
  reviewHistory: Array<{
    status: CarrierStatus;
    reviewerId: string;
    reviewerName: string;
    reviewDate: string;
    comments: string;
  }>;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type CarrierApiResponse = {
  carriers: CarrierItem[];
  total: number;
  page: number;
  limit: number;
};

const SORTABLE_FIELDS = [
  "legalName",
  "mcNumber",
  "dotNumber",
  "contactName",
  "status",
  "createdAt",
  "updatedAt",
] as const;

function CarriersPage() {
  const { session } = useAuth();
  const role = session?.role ?? "agent";
  const canApprove = can(role, "approval_actions");
  const canManage = ["owner", "admin", "ops_manager", "team_manager", "leadagent", "agent"].includes(role);
  const canDelete = ["owner", "admin", "ops_manager", "team_manager"].includes(role);

  const [items, setItems] = useState<CarrierItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState<NonNullable<(typeof SORTABLE_FIELDS)[number]>>("updatedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState("");

  const [form, setForm] = useState({
    legalName: "",
    dba: "",
    companyName: "",
    mcNumber: "",
    dotNumber: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
    taxId: "",
    equipmentTypes: "",
    serviceAreas: "",
    insuranceCarrier: "",
    insurancePolicyNumber: "",
    insuranceExpiresAt: "",
    notes: "",
    status: "pending" as CarrierStatus,
  });

  const [editForm, setEditForm] = useState({
    legalName: "",
    dba: "",
    companyName: "",
    mcNumber: "",
    dotNumber: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
    taxId: "",
    equipmentTypes: "",
    serviceAreas: "",
    insuranceCarrier: "",
    insurancePolicyNumber: "",
    insuranceExpiresAt: "",
    notes: "",
    status: "pending" as CarrierStatus,
    authorityVerified: false,
    insuranceVerified: false,
    safetyVerified: false,
    fraudChecked: false,
    complianceVerified: false,
  });

  const open = items.find((item) => item.id === openId) ?? null;

  const loadCarriers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      if (q.trim()) params.set("q", q.trim());
      if (status !== "all") params.set("status", status);

      const payload = await apiFetch<CarrierApiResponse>(`/api/carriers?${params.toString()}`);
      setItems(payload.data.carriers);
      setTotal(payload.data.total);
    } catch (error) {
      console.error(error);
      setItems([]);
      setTotal(0);
      toast.error("Unable to load carriers");
    } finally {
      setLoading(false);
    }
  }, [page, limit, q, status, sortBy, sortOrder]);

  useEffect(() => {
    void loadCarriers();
  }, [loadCarriers]);

  const openCarrier = useCallback((id: string) => {
    setOpenId(id);
    setEditing(false);
    setReviewComment("");
  }, []);

  const resetForm = () => {
    setForm({
      legalName: "",
      dba: "",
      companyName: "",
      mcNumber: "",
      dotNumber: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      address: "",
      taxId: "",
      equipmentTypes: "",
      serviceAreas: "",
      insuranceCarrier: "",
      insurancePolicyNumber: "",
      insuranceExpiresAt: "",
      notes: "",
      status: "pending",
    });
  };

  const startEdit = () => {
    if (!open) return;
    setEditForm({
      legalName: open.legalName,
      dba: open.dba,
      companyName: open.companyName,
      mcNumber: open.mcNumber,
      dotNumber: open.dotNumber,
      contactName: open.contactName,
      contactEmail: open.contactEmail,
      contactPhone: open.contactPhone,
      address: open.address,
      taxId: open.taxId,
      equipmentTypes: open.equipmentTypes.join(", "),
      serviceAreas: open.serviceAreas.join(", "),
      insuranceCarrier: open.insuranceCarrier,
      insurancePolicyNumber: open.insurancePolicyNumber,
      insuranceExpiresAt: open.insuranceExpiresAt ?? "",
      notes: open.notes,
      status: open.status,
      authorityVerified: open.vettingChecks.authorityVerified,
      insuranceVerified: open.vettingChecks.insuranceVerified,
      safetyVerified: open.vettingChecks.safetyVerified,
      fraudChecked: open.vettingChecks.fraudChecked,
      complianceVerified: open.vettingChecks.complianceVerified,
    });
    setEditing(true);
  };

  const createCarrier = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.legalName.trim() || !form.contactName.trim()) {
      toast.error("Carrier name and contact name are required");
      return;
    }

    setCreating(true);
    try {
      await apiFetch<{ carrier: CarrierItem }>("/api/carriers", {
        method: "POST",
        body: JSON.stringify({
          legalName: form.legalName.trim(),
          dba: form.dba.trim(),
          companyName: form.companyName.trim(),
          mcNumber: form.mcNumber.trim(),
          dotNumber: form.dotNumber.trim(),
          contactName: form.contactName.trim(),
          contactEmail: form.contactEmail.trim(),
          contactPhone: form.contactPhone.trim(),
          address: form.address.trim(),
          taxId: form.taxId.trim(),
          equipmentTypes: form.equipmentTypes,
          serviceAreas: form.serviceAreas,
          insuranceCarrier: form.insuranceCarrier.trim(),
          insurancePolicyNumber: form.insurancePolicyNumber.trim(),
          insuranceExpiresAt: form.insuranceExpiresAt || null,
          notes: form.notes.trim(),
          status: form.status,
        }),
      });
      resetForm();
      setShowCreate(false);
      setPage(1);
      await loadCarriers();
      toast.success("Carrier added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create carrier");
    } finally {
      setCreating(false);
    }
  };

  const saveCarrier = async (event: FormEvent) => {
    event.preventDefault();
    if (!open) return;
    if (!editForm.legalName.trim() || !editForm.contactName.trim()) {
      toast.error("Carrier name and contact name are required");
      return;
    }

    setSaving(true);
    try {
      const payload = await apiFetch<{ carrier: CarrierItem }>("/api/carriers", {
        method: "PATCH",
        body: JSON.stringify({
          carrierId: open.id,
          legalName: editForm.legalName.trim(),
          dba: editForm.dba.trim(),
          companyName: editForm.companyName.trim(),
          mcNumber: editForm.mcNumber.trim(),
          dotNumber: editForm.dotNumber.trim(),
          contactName: editForm.contactName.trim(),
          contactEmail: editForm.contactEmail.trim(),
          contactPhone: editForm.contactPhone.trim(),
          address: editForm.address.trim(),
          taxId: editForm.taxId.trim(),
          equipmentTypes: editForm.equipmentTypes,
          serviceAreas: editForm.serviceAreas,
          insuranceCarrier: editForm.insuranceCarrier.trim(),
          insurancePolicyNumber: editForm.insurancePolicyNumber.trim(),
          insuranceExpiresAt: editForm.insuranceExpiresAt || null,
          notes: editForm.notes.trim(),
          status: editForm.status,
          vettingChecks: {
            authorityVerified: editForm.authorityVerified,
            insuranceVerified: editForm.insuranceVerified,
            safetyVerified: editForm.safetyVerified,
            fraudChecked: editForm.fraudChecked,
            complianceVerified: editForm.complianceVerified,
          },
          reviewComment: reviewComment.trim(),
        }),
      });
      setItems((prev) => prev.map((item) => (item.id === open.id ? payload.data.carrier : item)));
      setOpenId(payload.data.carrier.id);
      setEditing(false);
      setReviewComment("");
      toast.success("Carrier saved");
      await loadCarriers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save carrier");
    } finally {
      setSaving(false);
    }
  };

  const deleteCarrier = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch("/api/carriers", {
        method: "DELETE",
        body: JSON.stringify({ carrierId: deleteTarget }),
      });
      setItems((prev) => prev.filter((item) => item.id !== deleteTarget));
      setOpenId((prev) => (prev === deleteTarget ? null : prev));
      setDeleteTarget(null);
      toast.success("Carrier deleted");
      await loadCarriers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete carrier");
    } finally {
      setDeleting(false);
    }
  };

  const exportCarriers = async (format: "csv" | "xls") => {
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status !== "all") params.set("status", status);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      params.set("export", format);
      params.set("limit", String(limit));
      params.set("page", String(page));

      const response = await fetch(`/api/carriers?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? response.statusText);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `carriers.${format === "xls" ? "xls" : "csv"}`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Carrier export downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to export carriers");
    }
  };

  const handleSort = (field: (typeof SORTABLE_FIELDS)[number]) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const vettingProgress = useMemo(
    () => (item: CarrierItem) => {
      const total = Object.values(item.vettingChecks).length;
      const complete = Object.values(item.vettingChecks).filter(Boolean).length;
      return `${complete}/${total}`;
    },
    [],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Carriers"
        description="Vet, approve, and manage motor carriers cleared for assignment."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => exportCarriers("csv")}>
              <Download className="size-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportCarriers("xls")}>
              <Download className="size-4" /> Excel
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)} disabled={!canManage}>
              <Plus className="size-4" /> Add carrier
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr]">
        <div className="space-y-1">
          <Label htmlFor="carrier-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="carrier-search"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search carrier, MC, DOT, contact..."
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="carrier-status">Status</Label>
          <Select value={status} onValueChange={(value) => setStatus(value)}>
            <SelectTrigger id="carrier-status" className="w-full">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {CARRIER_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {value.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Results</Label>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {total} carrier{total === 1 ? "" : "s"}
            </span>
            <span className="h-1 w-1 rounded-full bg-muted" />
            <span>Page {page}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading carriers…
        </div>
      ) : (
        <DataTable
          empty={
            <EmptyState
              icon={<Truck className="size-6" />}
              title="No carriers yet"
              description="Add a carrier to start vetting and tracking."
            />
          }
          rows={items}
          onRowClick={(carrier) => openCarrier(carrier.id)}
          columns={[
            {
              head: (
                <button
                  type="button"
                  className="flex items-center gap-1"
                  onClick={() => handleSort("legalName")}
                >
                  Carrier
                  {sortBy === "legalName" ? (
                    sortOrder === "asc" ? (
                      <ChevronUp className="size-3" />
                    ) : (
                      <ChevronDown className="size-3" />
                    )
                  ) : null}
                </button>
              ),
              cell: (carrier) => <div className="font-medium">{carrier.legalName}</div>,
            },
            {
              head: (
                <button
                  type="button"
                  className="flex items-center gap-1"
                  onClick={() => handleSort("mcNumber")}
                >
                  MC Number
                  {sortBy === "mcNumber" ? (
                    sortOrder === "asc" ? (
                      <ChevronUp className="size-3" />
                    ) : (
                      <ChevronDown className="size-3" />
                    )
                  ) : null}
                </button>
              ),
              cell: (carrier) => (
                <span className="font-mono text-xs">{carrier.mcNumber || "—"}</span>
              ),
            },
            {
              head: (
                <button
                  type="button"
                  className="flex items-center gap-1"
                  onClick={() => handleSort("dotNumber")}
                >
                  DOT Number
                  {sortBy === "dotNumber" ? (
                    sortOrder === "asc" ? (
                      <ChevronUp className="size-3" />
                    ) : (
                      <ChevronDown className="size-3" />
                    )
                  ) : null}
                </button>
              ),
              cell: (carrier) => (
                <span className="font-mono text-xs">{carrier.dotNumber || "—"}</span>
              ),
            },
            {
              head: "Contact",
              cell: (carrier) => (
                <div>
                  <div className="text-sm font-medium">{carrier.contactName || "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {carrier.contactPhone || carrier.contactEmail || "No contact"}
                  </div>
                </div>
              ),
            },
            {
              head: "Vetting",
              cell: (carrier) => (
                <span className="font-mono text-xs">{vettingProgress(carrier)}</span>
              ),
            },
            {
              head: (
                <button
                  type="button"
                  className="flex items-center gap-1"
                  onClick={() => handleSort("status")}
                >
                  Carrier Status
                  {sortBy === "status" ? (
                    sortOrder === "asc" ? (
                      <ChevronUp className="size-3" />
                    ) : (
                      <ChevronDown className="size-3" />
                    )
                  ) : null}
                </button>
              ),
              cell: (carrier) => <StatusBadge value={carrier.status} />,
            },
          ]}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
        <div>
          {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page * limit >= total || loading}
            onClick={() => setPage((prev) => prev + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <Sheet open={showCreate} onOpenChange={(openState) => !openState && setShowCreate(false)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Add carrier</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6 pt-2">
            <form className="grid gap-3" onSubmit={createCarrier}>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Carrier name">
                  <Input
                    value={form.legalName}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, legalName: event.target.value }))
                    }
                    required
                  />
                </Field>
                <Field label="DBA">
                  <Input
                    value={form.dba}
                    onChange={(event) => setForm((prev) => ({ ...prev, dba: event.target.value }))}
                  />
                </Field>
                <Field label="Company">
                  <Input
                    value={form.companyName}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, companyName: event.target.value }))
                    }
                  />
                </Field>
                <Field label="MC number">
                  <Input
                    value={form.mcNumber}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, mcNumber: event.target.value }))
                    }
                  />
                </Field>
                <Field label="DOT number">
                  <Input
                    value={form.dotNumber}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, dotNumber: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Contact name">
                  <Input
                    value={form.contactName}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, contactName: event.target.value }))
                    }
                    required
                  />
                </Field>
                <Field label="Contact email">
                  <Input
                    type="email"
                    value={form.contactEmail}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, contactEmail: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Contact phone">
                  <Input
                    value={form.contactPhone}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, contactPhone: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Address" className="md:col-span-2">
                  <Textarea
                    value={form.address}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, address: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Tax ID / EIN">
                  <Input
                    value={form.taxId}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, taxId: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Equipment types">
                  <Input
                    value={form.equipmentTypes}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, equipmentTypes: event.target.value }))
                    }
                    placeholder="Dry van, refrigerated"
                  />
                </Field>
                <Field label="Service areas">
                  <Input
                    value={form.serviceAreas}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, serviceAreas: event.target.value }))
                    }
                    placeholder="East coast, Midwest"
                  />
                </Field>
                <Field label="Insurance carrier">
                  <Input
                    value={form.insuranceCarrier}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, insuranceCarrier: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Insurance policy #">
                  <Input
                    value={form.insurancePolicyNumber}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, insurancePolicyNumber: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Insurance expires">
                  <Input
                    type="date"
                    value={form.insuranceExpiresAt}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, insuranceExpiresAt: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Status">
                  <Select
                    value={form.status}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, status: value as CarrierStatus }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Carrier status" />
                    </SelectTrigger>
                    <SelectContent>
                      {CARRIER_STATUSES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Notes" className="md:col-span-2">
                  <Textarea
                    value={form.notes}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, notes: event.target.value }))
                    }
                    rows={4}
                  />
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-3">
                <Button type="submit" disabled={creating}>
                  {creating ? "Saving…" : "Save carrier"}
                </Button>
                <Button variant="ghost" type="button" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={Boolean(open)} onOpenChange={(openState) => !openState && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>{open ? open.legalName : "Carrier details"}</SheetTitle>
          </SheetHeader>
          {open ? (
            <div className="space-y-4 px-4 pb-6 pt-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Carrier
                  </div>
                  <div className="text-lg font-semibold">{open.legalName}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canDelete && (
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
                          <AlertDialogTitle>Delete carrier</AlertDialogTitle>
                        </AlertDialogHeader>
                        <AlertDialogDescription>
                          This will permanently remove the carrier from the portal. This action
                          cannot be undone.
                        </AlertDialogDescription>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={deleteCarrier} disabled={deleting}>
                            {deleting ? "Deleting…" : "Delete carrier"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  {canManage && !editing && (
                    <Button size="sm" onClick={startEdit}>
                      <Edit className="size-4" /> Edit
                    </Button>
                  )}
                </div>
              </div>

              {editing ? (
                <form className="grid gap-3" onSubmit={saveCarrier}>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Carrier name">
                      <Input
                        value={editForm.legalName}
                        onChange={(event) =>
                          setEditForm((prev) => ({ ...prev, legalName: event.target.value }))
                        }
                        required
                      />
                    </Field>
                    <Field label="DBA">
                      <Input
                        value={editForm.dba}
                        onChange={(event) =>
                          setEditForm((prev) => ({ ...prev, dba: event.target.value }))
                        }
                      />
                    </Field>
                    <Field label="Company">
                      <Input
                        value={editForm.companyName}
                        onChange={(event) =>
                          setEditForm((prev) => ({ ...prev, companyName: event.target.value }))
                        }
                      />
                    </Field>
                    <Field label="MC number">
                      <Input
                        value={editForm.mcNumber}
                        onChange={(event) =>
                          setEditForm((prev) => ({ ...prev, mcNumber: event.target.value }))
                        }
                      />
                    </Field>
                    <Field label="DOT number">
                      <Input
                        value={editForm.dotNumber}
                        onChange={(event) =>
                          setEditForm((prev) => ({ ...prev, dotNumber: event.target.value }))
                        }
                      />
                    </Field>
                    <Field label="Contact name">
                      <Input
                        value={editForm.contactName}
                        onChange={(event) =>
                          setEditForm((prev) => ({ ...prev, contactName: event.target.value }))
                        }
                        required
                      />
                    </Field>
                    <Field label="Contact email">
                      <Input
                        type="email"
                        value={editForm.contactEmail}
                        onChange={(event) =>
                          setEditForm((prev) => ({ ...prev, contactEmail: event.target.value }))
                        }
                      />
                    </Field>
                    <Field label="Contact phone">
                      <Input
                        value={editForm.contactPhone}
                        onChange={(event) =>
                          setEditForm((prev) => ({ ...prev, contactPhone: event.target.value }))
                        }
                      />
                    </Field>
                    <Field label="Address" className="md:col-span-2">
                      <Textarea
                        value={editForm.address}
                        onChange={(event) =>
                          setEditForm((prev) => ({ ...prev, address: event.target.value }))
                        }
                      />
                    </Field>
                    <Field label="Tax ID / EIN">
                      <Input
                        value={editForm.taxId}
                        onChange={(event) =>
                          setEditForm((prev) => ({ ...prev, taxId: event.target.value }))
                        }
                      />
                    </Field>
                    <Field label="Equipment types">
                      <Input
                        value={editForm.equipmentTypes}
                        onChange={(event) =>
                          setEditForm((prev) => ({ ...prev, equipmentTypes: event.target.value }))
                        }
                        placeholder="Dry van, refrigerated"
                      />
                    </Field>
                    <Field label="Service areas">
                      <Input
                        value={editForm.serviceAreas}
                        onChange={(event) =>
                          setEditForm((prev) => ({ ...prev, serviceAreas: event.target.value }))
                        }
                        placeholder="East coast, Midwest"
                      />
                    </Field>
                    <Field label="Insurance carrier">
                      <Input
                        value={editForm.insuranceCarrier}
                        onChange={(event) =>
                          setEditForm((prev) => ({ ...prev, insuranceCarrier: event.target.value }))
                        }
                      />
                    </Field>
                    <Field label="Insurance policy #">
                      <Input
                        value={editForm.insurancePolicyNumber}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            insurancePolicyNumber: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Insurance expires">
                      <Input
                        type="date"
                        value={editForm.insuranceExpiresAt ?? ""}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            insuranceExpiresAt: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Status">
                      <Select
                        value={editForm.status}
                        onValueChange={(value) =>
                          setEditForm((prev) => ({ ...prev, status: value as CarrierStatus }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Carrier status" />
                        </SelectTrigger>
                        <SelectContent>
                          {CARRIER_STATUSES.map((value) => (
                            <SelectItem key={value} value={value}>
                              {value.replace("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Review notes" className="md:col-span-2">
                      <Textarea
                        value={reviewComment}
                        onChange={(event) => setReviewComment(event.target.value)}
                        rows={3}
                        placeholder="Record reviewer comments"
                      />
                    </Field>
                    <Field label="Vetting checks" className="md:col-span-2">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {[
                          { label: "Authority verified", key: "authorityVerified" as const },
                          { label: "Insurance verified", key: "insuranceVerified" as const },
                          { label: "Safety verified", key: "safetyVerified" as const },
                          { label: "Fraud checked", key: "fraudChecked" as const },
                          { label: "Compliance verified", key: "complianceVerified" as const },
                        ].map((check) => (
                          <label
                            key={check.key}
                            className="flex items-center gap-2 rounded-md border border-border bg-card/50 px-3 py-2 text-sm"
                          >
                            <Switch
                              checked={editForm[check.key]}
                              onCheckedChange={(value) =>
                                setEditForm((prev) => ({ ...prev, [check.key]: value }))
                              }
                            />
                            {check.label}
                          </label>
                        ))}
                      </div>
                    </Field>
                    <Field label="Additional notes" className="md:col-span-2">
                      <Textarea
                        value={editForm.notes}
                        onChange={(event) =>
                          setEditForm((prev) => ({ ...prev, notes: event.target.value }))
                        }
                        rows={4}
                      />
                    </Field>
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
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="MC number" value={open.mcNumber || "—"} mono />
                    <Field label="DOT number" value={open.dotNumber || "—"} mono />
                    <Field label="Company" value={open.companyName || "—"} />
                    <Field label="Contact" value={open.contactName || "—"} />
                    <Field label="Email" value={open.contactEmail || "—"} />
                    <Field label="Phone" value={open.contactPhone || "—"} />
                    <Field label="Address" value={open.address || "—"} />
                    <Field label="Tax ID / EIN" value={open.taxId || "—"} mono />
                    <Field label="Equipment types" value={open.equipmentTypes.join(", ") || "—"} />
                    <Field label="Service areas" value={open.serviceAreas.join(", ") || "—"} />
                    <Field label="Insurance" value={open.insuranceCarrier || "—"} />
                    <Field label="Policy number" value={open.insurancePolicyNumber || "—"} mono />
                    <Field
                      label="Insurance expires"
                      value={
                        open.insuranceExpiresAt
                          ? new Date(open.insuranceExpiresAt).toLocaleDateString()
                          : "—"
                      }
                      mono
                    />
                    <Field label="Status" value={<StatusBadge value={open.status} />} />
                    <Field
                      label="Vetting progress"
                      value={<span className="font-mono text-xs">{vettingProgress(open)}</span>}
                    />
                    <Field label="Notes" value={open.notes || "—"} className="md:col-span-2" />
                  </div>

                  <div className="rounded-lg border border-border bg-card p-4">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Review history
                    </div>
                    {open.reviewHistory.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No review history yet.</div>
                    ) : (
                      <div className="space-y-3">
                        {open.reviewHistory.map((entry, index) => (
                          <div
                            key={`${entry.reviewerId}-${index}`}
                            className="rounded-md border border-border bg-background p-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
                              <span>{entry.reviewerName}</span>
                              <span className="text-muted-foreground">
                                {new Date(entry.reviewDate).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="mt-1 text-sm">
                              {entry.comments || "No comments provided."}
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">
                              Status: {entry.status.replace("_", " ")}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {canApprove && (
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Button
                        variant="secondary"
                        onClick={async () => {
                          if (!open) return;
                          setEditForm((prev) => ({ ...prev, status: "approved" }));
                          setReviewComment("Approved by reviewer");
                          await saveCarrier(new Event("submit") as unknown as FormEvent);
                        }}
                        disabled={saving}
                      >
                        <Check className="size-4" /> Approve
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={async () => {
                          if (!open) return;
                          setEditForm((prev) => ({ ...prev, status: "rejected" }));
                          setReviewComment("Rejected by reviewer");
                          await saveCarrier(new Event("submit") as unknown as FormEvent);
                        }}
                        disabled={saving}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setEditing(true)}
                        disabled={!canManage}
                      >
                        Edit details
                      </Button>
                    </div>
                  )}

                  {open.status !== "approved" && (
                    <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                      <ShieldAlert className="size-4 shrink-0" />
                      This carrier is not approved and cannot be assigned to loads.
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  className,
  children,
}: {
  label: string;
  value?: React.ReactNode;
  mono?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={className}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children ?? <div className={`mt-0.5 ${mono ? "font-mono text-xs" : ""}`}>{value}</div>}
    </div>
  );
}
