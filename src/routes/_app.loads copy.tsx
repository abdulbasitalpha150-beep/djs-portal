import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
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
import { CheckCircle2, Clock, Download, LayoutGrid, MessageSquare, Package, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/roles";
import { usd, fmtDate, fmtDateTime } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/loads copy")({ component: LoadsPage });

type LoadStatus =
  | "draft"
  | "quoted"
  | "booked"
  | "dispatched"
  | "in_transit"
  | "delivered"
  | "invoiced"
  | "paid"
  | "cancelled";
type LoadType = "ftl" | "ltl" | "partial";
type InvoiceStatus = "pending" | "sent" | "paid" | "overdue";
type PaymentStatus = "pending" | "partial" | "paid";

type DocumentItem = { kind: string; uploaded: boolean; uploadedAt?: string };
type StatusHistoryItem = { status: string; changedBy: string; at: string };

type LoadItem = {
  id: string;
  ref: string;
  loadNumber: string;
  customerReference?: string;
  status: LoadStatus;
  statusHistory: StatusHistoryItem[];
  customerId: string;
  customerName: string;
  customer?: any;
  carrierId: string;
  carrierName: string;
  carrier?: any;
  agentId: string;
  agentName: string;
  pickupCompany?: string;
  pickupContact?: string;
  pickupPhone?: string;
  pickupAddress?: string;
  pickupCity?: string;
  pickupState?: string;
  pickupZip?: string;
  pickupDate?: string;
  pickupTime?: string;
  deliveryCompany?: string;
  deliveryContact?: string;
  deliveryPhone?: string;
  deliveryAddress?: string;
  deliveryCity?: string;
  deliveryState?: string;
  deliveryZip?: string;
  deliveryDate?: string;
  deliveryTime?: string;
  commodity?: string;
  weight?: number;
  pieces?: number;
  pallets?: number;
  equipmentType?: string;
  trailerLength?: number;
  loadType?: LoadType;
  temperature?: number;
  hazmat?: boolean;
  stackable?: boolean;
  customerRate: number;
  carrierCost: number;
  accessorialCharges?: number;
  revenue: number;
  grossMargin: number;
  marginPercent: number;
  invoiceStatus: InvoiceStatus;
  paymentStatus: PaymentStatus;
  loadedMiles?: number;
  deadheadMiles?: number;
  documents?: DocumentItem[];
  internalNotes?: string;
  driverInstructions?: string;
  customerNotes?: string;
  createdAt: string;
  updatedAt: string;
  pendingApproval?: boolean;
  approvalRequestId?: string;
  approvalStatus?: string;
  comments?: Array<{ by: string; at: string; body: string }>;
  auditHistory?: Array<{ action: string; performedByName: string; at: string; notes?: string }>;
};

type CustomerOption = { id: string; company: string; contact: string };
type CarrierOption = { id: string; legalName: string };

type LoadApiResponse = {
  loads: LoadItem[];
  customers: CustomerOption[];
  carriers: CarrierOption[];
};

const DOCUMENT_LABELS: Record<string, string> = {
  rate_confirmation: "Rate Confirmation",
  bol: "BOL",
  pod: "POD",
  carrier_invoice: "Carrier Invoice",
  customer_invoice: "Customer Invoice",
};

const ALL_STATUSES: LoadStatus[] = [
  "draft",
  "quoted",
  "booked",
  "dispatched",
  "in_transit",
  "delivered",
  "invoiced",
  "paid",
  "cancelled",
];
const LOAD_TYPES: LoadType[] = ["ftl", "ltl", "partial"];

function dedupeLoads(loads: LoadItem[]) {
  const byId = new Map<string, LoadItem>();

  for (const load of loads) {
    const existing = byId.get(load.id);
    if (!existing) {
      byId.set(load.id, load);
      continue;
    }

    // Prefer the version with pendingApproval data
    if (load.pendingApproval && !existing.pendingApproval) {
      byId.set(load.id, load);
    }
  }

  return Array.from(byId.values());
}

/** Replace a load in the list by ID, or prepend if not found. Always dedupes. */
function replaceOrPrependLoad(prev: LoadItem[], updated: LoadItem): LoadItem[] {
  const idx = prev.findIndex((i) => i.id === updated.id);
  let next: LoadItem[];
  if (idx !== -1) {
    next = [...prev];
    next[idx] = updated;
  } else {
    next = [updated, ...prev];
  }
  return dedupeLoads(next);
}

function LoadsPage() {
  const { session } = useAuth();
  const role = session?.role ?? "trainee";
  const userId = session?.id ?? "";
  const canBook = can(role, "booking_actions");

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<LoadItem[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [carriers, setCarriers] = useState<CarrierOption[]>([]);

  const [status, setStatus] = useState<string>("all");
  const [view, setView] = useState<"table" | "board">("table");

  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingApprovalRequestId, setEditingApprovalRequestId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    customerId: "",
    carrierId: "",
    loadNumber: "",
    customerReference: "",
    status: "draft" as LoadStatus,
    pickupCompany: "",
    pickupContact: "",
    pickupPhone: "",
    pickupAddress: "",
    pickupCity: "",
    pickupState: "",
    pickupZip: "",
    pickupDate: "",
    pickupTime: "",
    deliveryCompany: "",
    deliveryContact: "",
    deliveryPhone: "",
    deliveryAddress: "",
    deliveryCity: "",
    deliveryState: "",
    deliveryZip: "",
    deliveryDate: "",
    deliveryTime: "",
    commodity: "",
    weight: "",
    pieces: "",
    pallets: "",
    equipmentType: "",
    trailerLength: "",
    loadType: "" as LoadType | "",
    temperature: "",
    hazmat: false,
    stackable: false,
    customerRate: "",
    carrierCost: "",
    accessorialCharges: "",
    loadedMiles: "",
    deadheadMiles: "",
    internalNotes: "",
    driverInstructions: "",
    customerNotes: "",
  });

  const [editForm, setEditForm] = useState({
    customerId: "",
    carrierId: "",
    loadNumber: "",
    customerReference: "",
    status: "draft" as LoadStatus,
    pickupCompany: "",
    pickupContact: "",
    pickupPhone: "",
    pickupAddress: "",
    pickupCity: "",
    pickupState: "",
    pickupZip: "",
    pickupDate: "",
    pickupTime: "",
    deliveryCompany: "",
    deliveryContact: "",
    deliveryPhone: "",
    deliveryAddress: "",
    deliveryCity: "",
    deliveryState: "",
    deliveryZip: "",
    deliveryDate: "",
    deliveryTime: "",
    commodity: "",
    weight: "",
    pieces: "",
    pallets: "",
    equipmentType: "",
    trailerLength: "",
    loadType: "" as LoadType | "",
    temperature: "",
    hazmat: false,
    stackable: false,
    customerRate: "",
    carrierCost: "",
    accessorialCharges: "",
    invoiceStatus: "pending" as InvoiceStatus,
    paymentStatus: "pending" as PaymentStatus,
    loadedMiles: "",
    deadheadMiles: "",
    internalNotes: "",
    driverInstructions: "",
    customerNotes: "",
    documents: [] as DocumentItem[],
  });

  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const payload = await apiFetch<LoadApiResponse>("/api/loads");
        if (!active) return;
        setItems(dedupeLoads(payload.data.loads));
        setCustomers(payload.data.customers);
        setCarriers(payload.data.carriers);
      } catch (err) {
        console.error(err);
        toast.error("Unable to load loads");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadData();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const dedupedItems = dedupeLoads(items);
    return dedupedItems.filter((l) => status === "all" || l.status === status);
  }, [items, status]);
  const open = openId ? (items.find((i) => i.id === openId) ?? null) : null;

  // Editing rules:
  // - Non-pending loads: anyone with booking_actions may edit
  // - Pending/changes_requested/rejected loads: only the original requester (agentId) may edit
  const canEdit = canBook && (
    !open ||
    !open.pendingApproval ||
    open.agentId === userId
  );

  useEffect(() => {
    if (!open) return;
    setEditForm({
      customerId: open.customerId,
      carrierId: open.carrierId,
      loadNumber: open.loadNumber,
      customerReference: open.customerReference || "",
      status: open.status,
      pickupCompany: open.pickupCompany || "",
      pickupContact: open.pickupContact || "",
      pickupPhone: open.pickupPhone || "",
      pickupAddress: open.pickupAddress || "",
      pickupCity: open.pickupCity || "",
      pickupState: open.pickupState || "",
      pickupZip: open.pickupZip || "",
      pickupDate: open.pickupDate ? open.pickupDate.substring(0, 10) : "",
      pickupTime: open.pickupTime || "",
      deliveryCompany: open.deliveryCompany || "",
      deliveryContact: open.deliveryContact || "",
      deliveryPhone: open.deliveryPhone || "",
      deliveryAddress: open.deliveryAddress || "",
      deliveryCity: open.deliveryCity || "",
      deliveryState: open.deliveryState || "",
      deliveryZip: open.deliveryZip || "",
      deliveryDate: open.deliveryDate ? open.deliveryDate.substring(0, 10) : "",
      deliveryTime: open.deliveryTime || "",
      commodity: open.commodity || "",
      weight: open.weight?.toString() || "",
      pieces: open.pieces?.toString() || "",
      pallets: open.pallets?.toString() || "",
      equipmentType: open.equipmentType || "",
      trailerLength: open.trailerLength?.toString() || "",
      loadType: open.loadType || "",
      temperature: open.temperature?.toString() || "",
      hazmat: open.hazmat || false,
      stackable: open.stackable || false,
      customerRate: open.customerRate?.toString() || "",
      carrierCost: open.carrierCost?.toString() || "",
      accessorialCharges: open.accessorialCharges?.toString() || "",
      invoiceStatus: open.invoiceStatus,
      paymentStatus: open.paymentStatus,
      loadedMiles: open.loadedMiles?.toString() || "",
      deadheadMiles: open.deadheadMiles?.toString() || "",
      internalNotes: open.internalNotes || "",
      driverInstructions: open.driverInstructions || "",
      customerNotes: open.customerNotes || "",
      documents: open.documents || [],
    });
    setEditingApprovalRequestId(open.approvalRequestId || null);
  }, [open]);

  async function createLoad(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    try {
      const payload = await apiFetch<LoadApiResponse & { load: LoadItem }>("/api/loads", {
        method: "POST",
        body: JSON.stringify({
          ...createForm,
          weight: createForm.weight ? Number(createForm.weight) : undefined,
          pieces: createForm.pieces ? Number(createForm.pieces) : undefined,
          pallets: createForm.pallets ? Number(createForm.pallets) : undefined,
          trailerLength: createForm.trailerLength ? Number(createForm.trailerLength) : undefined,
          temperature: createForm.temperature ? Number(createForm.temperature) : undefined,
          customerRate: createForm.customerRate ? Number(createForm.customerRate) : 0,
          carrierCost: createForm.carrierCost ? Number(createForm.carrierCost) : 0,
          accessorialCharges: createForm.accessorialCharges
            ? Number(createForm.accessorialCharges)
            : 0,
          loadedMiles: createForm.loadedMiles ? Number(createForm.loadedMiles) : undefined,
          deadheadMiles: createForm.deadheadMiles ? Number(createForm.deadheadMiles) : undefined,
        }),
      });

      setItems((prev) => replaceOrPrependLoad(prev, payload.data.load));
      setCustomers(payload.data.customers);
      setCarriers(payload.data.carriers);
      setCreateForm({
        customerId: "",
        carrierId: "",
        loadNumber: "",
        customerReference: "",
        status: "draft" as LoadStatus,
        pickupCompany: "",
        pickupContact: "",
        pickupPhone: "",
        pickupAddress: "",
        pickupCity: "",
        pickupState: "",
        pickupZip: "",
        pickupDate: "",
        pickupTime: "",
        deliveryCompany: "",
        deliveryContact: "",
        deliveryPhone: "",
        deliveryAddress: "",
        deliveryCity: "",
        deliveryState: "",
        deliveryZip: "",
        deliveryDate: "",
        deliveryTime: "",
        commodity: "",
        weight: "",
        pieces: "",
        pallets: "",
        equipmentType: "",
        trailerLength: "",
        loadType: "",
        temperature: "",
        hazmat: false,
        stackable: false,
        customerRate: "",
        carrierCost: "",
        accessorialCharges: "",
        loadedMiles: "",
        deadheadMiles: "",
        internalNotes: "",
        driverInstructions: "",
        customerNotes: "",
      });
      setShowCreate(false);
      toast.success("Load created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to create load");
    } finally {
      setCreating(false);
    }
  }

  async function saveLoad(event: FormEvent) {
    event.preventDefault();
    if (!openId) return;
    setSaving(true);
    try {
      const payload = await apiFetch<LoadApiResponse & { load: LoadItem }>("/api/loads", {
        method: "PATCH",
        body: JSON.stringify({
          loadId: openId,
          approvalRequestId: editingApprovalRequestId,
          ...editForm,
          weight: editForm.weight ? Number(editForm.weight) : undefined,
          pieces: editForm.pieces ? Number(editForm.pieces) : undefined,
          pallets: editForm.pallets ? Number(editForm.pallets) : undefined,
          trailerLength: editForm.trailerLength ? Number(editForm.trailerLength) : undefined,
          temperature: editForm.temperature ? Number(editForm.temperature) : undefined,
          customerRate: editForm.customerRate ? Number(editForm.customerRate) : 0,
          carrierCost: editForm.carrierCost ? Number(editForm.carrierCost) : 0,
          accessorialCharges: editForm.accessorialCharges ? Number(editForm.accessorialCharges) : 0,
          loadedMiles: editForm.loadedMiles ? Number(editForm.loadedMiles) : undefined,
          deadheadMiles: editForm.deadheadMiles ? Number(editForm.deadheadMiles) : undefined,
        }),
      });
      setItems((prev) => replaceOrPrependLoad(prev, payload.data.load));
      setCustomers(payload.data.customers);
      setCarriers(payload.data.carriers);
      setEditing(false);
      setEditingApprovalRequestId(payload.data.load.approvalRequestId || null);
      toast.success("Load saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save load");
    } finally {
      setSaving(false);
    }
  }

  async function deleteLoad() {
    if (!openId) return;
    try {
      const deleteId = open?.approvalRequestId || openId;
      await apiFetch("/api/loads", {
        method: "DELETE",
        body: JSON.stringify({ loadId: deleteId }),
      });
      setItems((prev) => prev.filter((item) => item.id !== openId));
      setOpenId(null);
      toast.success("Load deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to delete load");
    }
  }

  function toggleDoc(kind: string, uploaded: boolean) {
    if (!openId) return;
    const newDocs = (editForm.documents || []).map((d) =>
      d.kind === kind
        ? {
            ...d,
            uploaded: !uploaded,
            uploadedAt: !uploaded ? new Date().toISOString() : undefined,
          }
        : d,
    );
    setEditForm((prev) => ({ ...prev, documents: newDocs }));
  }

  const createFinancials = useMemo(() => {
    const cr = Number(createForm.customerRate || 0);
    const cc = Number(createForm.carrierCost || 0);
    const ac = Number(createForm.accessorialCharges || 0);
    const rev = cr + ac;
    const gm = rev > cc ? rev - cc : 0;
    const mp = rev > 0 ? (gm / rev) * 100 : 0;
    return { revenue: rev, grossMargin: gm, marginPercent: mp };
  }, [createForm.customerRate, createForm.carrierCost, createForm.accessorialCharges]);

  const editFinancials = useMemo(() => {
    const cr = Number(editForm.customerRate || 0);
    const cc = Number(editForm.carrierCost || 0);
    const ac = Number(editForm.accessorialCharges || 0);
    const rev = cr + ac;
    const gm = rev > cc ? rev - cc : 0;
    const mp = rev > 0 ? (gm / rev) * 100 : 0;
    return { revenue: rev, grossMargin: gm, marginPercent: mp };
  }, [editForm.customerRate, editForm.carrierCost, editForm.accessorialCharges]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Loads"
        description="Manage your full load booking pipeline from quote to commission ready"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => setShowCreate(true)} disabled={!canBook}>
              <Plus className="size-4" /> New Load
            </Button>
          </div>
        }
      />

      {showCreate && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Create New Load</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
          <form className="space-y-6" onSubmit={createLoad}>
            {/* Basic Info */}
            {/* <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm"> */}
              <div className="mb-4 flex items-center justify-between">
                <h4 className="text-sm font-semibold">Basic information</h4>
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Core details</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="create-customerId">Customer *</Label>
                <Select
                  value={createForm.customerId}
                  onValueChange={(v) => setCreateForm((p) => ({ ...p, customerId: v }))}
                  required
                >
                  <SelectTrigger id="create-customerId">
                    <SelectValue placeholder="Select a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.company}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-carrierId">Carrier *</Label>
                <Select
                  value={createForm.carrierId}
                  onValueChange={(v) => setCreateForm((p) => ({ ...p, carrierId: v }))}
                  required
                >
                  <SelectTrigger id="create-carrierId">
                    <SelectValue placeholder="Select a carrier" />
                  </SelectTrigger>
                  <SelectContent>
                    {carriers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.legalName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-loadNumber">Load Number</Label>
                <Input
                  id="create-loadNumber"
                  value={createForm.loadNumber}
                  onChange={(e) => setCreateForm((p) => ({ ...p, loadNumber: e.target.value }))}
                  placeholder="Auto-generated"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-customerReference">Customer Reference</Label>
                <Input
                  id="create-customerReference"
                  value={createForm.customerReference}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, customerReference: e.target.value }))
                  }
                  placeholder="PO number or reference"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-status">Status</Label>
                <Select
                  value={createForm.status}
                  onValueChange={(v) => setCreateForm((p) => ({ ...p, status: v as LoadStatus }))}
                >
                  <SelectTrigger id="create-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Pickup Info */}
            <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h4 className="text-sm font-semibold">Pickup details</h4>
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pickup</span>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5 md:col-span-3">
                  <Label htmlFor="create-pickupCompany">Company</Label>
                  <Input
                    id="create-pickupCompany"
                    value={createForm.pickupCompany}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, pickupCompany: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-pickupContact">Contact</Label>
                  <Input
                    id="create-pickupContact"
                    value={createForm.pickupContact}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, pickupContact: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-pickupPhone">Phone</Label>
                  <Input
                    id="create-pickupPhone"
                    value={createForm.pickupPhone}
                    onChange={(e) => setCreateForm((p) => ({ ...p, pickupPhone: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5 md:col-span-3">
                  <Label htmlFor="create-pickupAddress">Address</Label>
                  <Input
                    id="create-pickupAddress"
                    value={createForm.pickupAddress}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, pickupAddress: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-pickupCity">City</Label>
                  <Input
                    id="create-pickupCity"
                    value={createForm.pickupCity}
                    onChange={(e) => setCreateForm((p) => ({ ...p, pickupCity: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-pickupState">State</Label>
                  <Input
                    id="create-pickupState"
                    value={createForm.pickupState}
                    onChange={(e) => setCreateForm((p) => ({ ...p, pickupState: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-pickupZip">ZIP</Label>
                  <Input
                    id="create-pickupZip"
                    value={createForm.pickupZip}
                    onChange={(e) => setCreateForm((p) => ({ ...p, pickupZip: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-pickupDate">Date</Label>
                  <Input
                    id="create-pickupDate"
                    type="date"
                    value={createForm.pickupDate}
                    onChange={(e) => setCreateForm((p) => ({ ...p, pickupDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-pickupTime">Time</Label>
                  <Input
                    id="create-pickupTime"
                    type="time"
                    value={createForm.pickupTime}
                    onChange={(e) => setCreateForm((p) => ({ ...p, pickupTime: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Delivery Info */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Delivery Details
              </h4>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5 md:col-span-3">
                  <Label htmlFor="create-deliveryCompany">Company</Label>
                  <Input
                    id="create-deliveryCompany"
                    value={createForm.deliveryCompany}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, deliveryCompany: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-deliveryContact">Contact</Label>
                  <Input
                    id="create-deliveryContact"
                    value={createForm.deliveryContact}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, deliveryContact: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-deliveryPhone">Phone</Label>
                  <Input
                    id="create-deliveryPhone"
                    value={createForm.deliveryPhone}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, deliveryPhone: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5 md:col-span-3">
                  <Label htmlFor="create-deliveryAddress">Address</Label>
                  <Input
                    id="create-deliveryAddress"
                    value={createForm.deliveryAddress}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, deliveryAddress: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-deliveryCity">City</Label>
                  <Input
                    id="create-deliveryCity"
                    value={createForm.deliveryCity}
                    onChange={(e) => setCreateForm((p) => ({ ...p, deliveryCity: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-deliveryState">State</Label>
                  <Input
                    id="create-deliveryState"
                    value={createForm.deliveryState}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, deliveryState: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-deliveryZip">ZIP</Label>
                  <Input
                    id="create-deliveryZip"
                    value={createForm.deliveryZip}
                    onChange={(e) => setCreateForm((p) => ({ ...p, deliveryZip: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-deliveryDate">Date</Label>
                  <Input
                    id="create-deliveryDate"
                    type="date"
                    value={createForm.deliveryDate}
                    onChange={(e) => setCreateForm((p) => ({ ...p, deliveryDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-deliveryTime">Time</Label>
                  <Input
                    id="create-deliveryTime"
                    type="time"
                    value={createForm.deliveryTime}
                    onChange={(e) => setCreateForm((p) => ({ ...p, deliveryTime: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Freight Info */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Freight Details
              </h4>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5 md:col-span-3">
                  <Label htmlFor="create-commodity">Commodity</Label>
                  <Input
                    id="create-commodity"
                    value={createForm.commodity}
                    onChange={(e) => setCreateForm((p) => ({ ...p, commodity: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-weight">Weight</Label>
                  <Input
                    id="create-weight"
                    type="number"
                    min="0"
                    value={createForm.weight}
                    onChange={(e) => setCreateForm((p) => ({ ...p, weight: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-pieces">Pieces</Label>
                  <Input
                    id="create-pieces"
                    type="number"
                    min="0"
                    value={createForm.pieces}
                    onChange={(e) => setCreateForm((p) => ({ ...p, pieces: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-pallets">Pallets</Label>
                  <Input
                    id="create-pallets"
                    type="number"
                    min="0"
                    value={createForm.pallets}
                    onChange={(e) => setCreateForm((p) => ({ ...p, pallets: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-equipmentType">Equipment Type</Label>
                  <Input
                    id="create-equipmentType"
                    value={createForm.equipmentType}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, equipmentType: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-trailerLength">Trailer Length</Label>
                  <Input
                    id="create-trailerLength"
                    type="number"
                    min="0"
                    value={createForm.trailerLength}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, trailerLength: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-loadType">Load Type</Label>
                  <Select
                    value={createForm.loadType}
                    onValueChange={(v) => setCreateForm((p) => ({ ...p, loadType: v as LoadType }))}
                  >
                    <SelectTrigger id="create-loadType">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {LOAD_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-temperature">Temperature</Label>
                  <Input
                    id="create-temperature"
                    type="number"
                    value={createForm.temperature}
                    onChange={(e) => setCreateForm((p) => ({ ...p, temperature: e.target.value }))}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="create-hazmat"
                    checked={createForm.hazmat}
                    onChange={(e) => setCreateForm((p) => ({ ...p, hazmat: e.target.checked }))}
                    className="rounded border-border"
                  />
                  <Label htmlFor="create-hazmat">Hazmat</Label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="create-stackable"
                    checked={createForm.stackable}
                    onChange={(e) => setCreateForm((p) => ({ ...p, stackable: e.target.checked }))}
                    className="rounded border-border"
                  />
                  <Label htmlFor="create-stackable">Stackable</Label>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pricing
              </h4>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="create-customerRate">Customer Rate *</Label>
                  <Input
                    id="create-customerRate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={createForm.customerRate}
                    onChange={(e) => setCreateForm((p) => ({ ...p, customerRate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-carrierCost">Carrier Cost *</Label>
                  <Input
                    id="create-carrierCost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={createForm.carrierCost}
                    onChange={(e) => setCreateForm((p) => ({ ...p, carrierCost: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-accessorialCharges">Accessorials</Label>
                  <Input
                    id="create-accessorialCharges"
                    type="number"
                    min="0"
                    step="0.01"
                    value={createForm.accessorialCharges}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, accessorialCharges: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Calculated Values</Label>
                  <div className="border border-border rounded-md bg-muted p-2 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>Revenue</span>
                      <span>{usd(createFinancials.revenue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gross Margin</span>
                      <span className="text-green-600">{usd(createFinancials.grossMargin)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Margin %</span>
                      <span>{createFinancials.marginPercent.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mileage */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Mileage
              </h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="create-loadedMiles">Loaded Miles</Label>
                  <Input
                    id="create-loadedMiles"
                    type="number"
                    min="0"
                    value={createForm.loadedMiles}
                    onChange={(e) => setCreateForm((p) => ({ ...p, loadedMiles: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-deadheadMiles">Deadhead Miles</Label>
                  <Input
                    id="create-deadheadMiles"
                    type="number"
                    min="0"
                    value={createForm.deadheadMiles}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, deadheadMiles: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Notes
              </h4>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5 md:col-span-3">
                  <Label htmlFor="create-internalNotes">Internal Notes</Label>
                  <Textarea
                    id="create-internalNotes"
                    value={createForm.internalNotes}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, internalNotes: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5 md:col-span-3">
                  <Label htmlFor="create-driverInstructions">Driver Instructions</Label>
                  <Textarea
                    id="create-driverInstructions"
                    value={createForm.driverInstructions}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, driverInstructions: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5 md:col-span-3">
                  <Label htmlFor="create-customerNotes">Customer Notes</Label>
                  <Textarea
                    id="create-customerNotes"
                    value={createForm.customerNotes}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, customerNotes: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" type="button" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !canBook}>
                {creating ? "Creating..." : "Create Load"}
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto inline-flex rounded-md border border-border bg-card p-0.5">
          <Button
            size="sm"
            variant={view === "table" ? "secondary" : "ghost"}
            onClick={() => setView("table")}
          >
            <LayoutGrid className="size-4" /> Table
          </Button>
          <Button
            size="sm"
            variant={view === "board" ? "secondary" : "ghost"}
            onClick={() => setView("board")}
          >
            <LayoutGrid className="size-4" /> Board
          </Button>
        </div>
      </div>

      {view === "table" ? (
        <DataTable
          empty={<EmptyState icon={<Package className="size-6" />} title="No loads found" />}
          rows={filtered}
          onRowClick={(l) => setOpenId(l.id)}
          columns={[
            {
              head: "Load #",
              cell: (l) => <span className="font-mono text-xs">{l.loadNumber || l.ref}</span>,
            },
            {
              head: "Customer",
              cell: (l) => (
                <div>
                  <span className="font-medium">{l.customerName}</span>
                  {l.pendingApproval && (
                    <span
                      className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        l.approvalStatus === "pending"
                          ? "bg-yellow-100 text-yellow-800"
                          : l.approvalStatus === "changes_requested"
                            ? "bg-orange-100 text-orange-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {l.approvalStatus === "changes_requested"
                        ? "Changes Requested"
                        : l.approvalStatus === "rejected"
                          ? "Rejected"
                          : "Pending Approval"}
                    </span>
                  )}
                </div>
              ),
            },
            { head: "Carrier", cell: (l) => <span className="text-sm">{l.carrierName}</span> },
            { head: "Status", cell: (l) => <StatusBadge value={l.status} /> },
            {
              head: "Pickup",
              cell: (l) => (
                <span className="text-xs text-muted-foreground">
                  {l.pickupDate ? fmtDate(l.pickupDate) : "—"}
                </span>
              ),
            },
            {
              head: "Delivery",
              cell: (l) => (
                <span className="text-xs text-muted-foreground">
                  {l.deliveryDate ? fmtDate(l.deliveryDate) : "—"}
                </span>
              ),
            },
            {
              head: "Revenue",
              cell: (l) => <span className="font-mono text-sm">{usd(l.revenue)}</span>,
            },
            {
              head: "Gross Margin",
              cell: (l) => (
                <span className="font-mono text-sm text-green-600">{usd(l.grossMargin)}</span>
              ),
            },
          ]}
        />
      ) : (
        <div className="scrollbar-thin flex gap-3 overflow-x-auto pb-2">
          {ALL_STATUSES.map((status) => {
            const columnItems = filtered.filter((l) => l.status === status);
            return (
              <div
                key={status}
                className="w-72 shrink-0 rounded-lg border border-border bg-card/40"
              >
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    {status.replace("_", " ")}
                  </span>
                  <span className="text-xs text-muted-foreground">{columnItems.length}</span>
                </div>
                <div className="space-y-2 p-2">
                  {columnItems.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setOpenId(l.id)}
                      className="w-full rounded-md border border-border bg-background p-2.5 text-left hover:bg-accent/50"
                    >
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {l.loadNumber || l.ref}
                      </div>
                      <div className="text-sm font-medium">{l.customerName}</div>
                      {l.pendingApproval && (
                        <div
                          className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            l.approvalStatus === "pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : l.approvalStatus === "changes_requested"
                                ? "bg-orange-100 text-orange-800"
                                : "bg-red-100 text-red-800"
                          }`}
                        >
                          {l.approvalStatus === "changes_requested"
                            ? "Changes Requested"
                            : l.approvalStatus === "rejected"
                              ? "Rejected"
                              : "Pending Approval"}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">{l.carrierName}</div>
                      <div className="mt-1 font-mono text-xs text-green-600">
                        {usd(l.grossMargin)}
                      </div>
                    </button>
                  ))}
                  {columnItems.length === 0 && (
                    <div className="px-2 py-3 text-xs text-muted-foreground">—</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={!!openId} onOpenChange={(v) => !v && setOpenId(null)}>
        <SheetContent className="w-full max-w-3xl overflow-y-auto">
          {open && (
            <>
              <SheetHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <SheetTitle>Load {open.loadNumber || open.ref}</SheetTitle>
                    {open.pendingApproval && (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          open.approvalStatus === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : open.approvalStatus === "changes_requested"
                              ? "bg-orange-100 text-orange-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {open.approvalStatus === "changes_requested"
                          ? "Changes Requested"
                          : open.approvalStatus === "rejected"
                            ? "Rejected"
                            : "Pending Approval"}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {canBook && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" onClick={() => {}}>
                            <Trash2 className="size-4" /> Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Load?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove this load from the system and cannot be
                              undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={deleteLoad}
                              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    {canEdit && !editing && (
                      <Button size="sm" onClick={() => setEditing(true)}>
                        <LayoutGrid className="size-4" /> Edit
                      </Button>
                    )}
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-6 px-4 pb-6 pt-2">
                {editing ? (
                  <form className="space-y-5" onSubmit={saveLoad}>
                    {open.pendingApproval && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-100">
                        <div className="font-medium">
                          This load is currently tied to an approval request.
                        </div>
                        <div className="mt-1 text-xs opacity-90">
                          Saving will update the existing request so the approver can review the
                          latest changes.
                        </div>
                      </div>
                    )}

                    {/* Basic Info */}
                    <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm">
                      <div className="mb-4 flex items-center justify-between">
                        <h4 className="text-sm font-semibold">Basic information</h4>
                        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Core details
                        </span>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-customerId">Customer *</Label>
                          <Select
                            value={editForm.customerId}
                            onValueChange={(v) => setEditForm((p) => ({ ...p, customerId: v }))}
                            required
                          >
                            <SelectTrigger id="edit-customerId">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {customers.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.company}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-carrierId">Carrier *</Label>
                          <Select
                            value={editForm.carrierId}
                            onValueChange={(v) => setEditForm((p) => ({ ...p, carrierId: v }))}
                            required
                          >
                            <SelectTrigger id="edit-carrierId">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {carriers.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.legalName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-loadNumber">Load Number</Label>
                          <Input
                            id="edit-loadNumber"
                            value={editForm.loadNumber}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, loadNumber: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-customerReference">Customer Reference</Label>
                          <Input
                            id="edit-customerReference"
                            value={editForm.customerReference}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, customerReference: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-status">Status</Label>
                          <Select
                            value={editForm.status}
                            onValueChange={(v) =>
                              setEditForm((p) => ({ ...p, status: v as LoadStatus }))
                            }
                          >
                            <SelectTrigger id="edit-status">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ALL_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s.replace("_", " ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-invoiceStatus">Invoice Status</Label>
                          <Select
                            value={editForm.invoiceStatus}
                            onValueChange={(v) =>
                              setEditForm((p) => ({ ...p, invoiceStatus: v as InvoiceStatus }))
                            }
                          >
                            <SelectTrigger id="edit-invoiceStatus">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="sent">Sent</SelectItem>
                              <SelectItem value="paid">Paid</SelectItem>
                              <SelectItem value="overdue">Overdue</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-paymentStatus">Payment Status</Label>
                          <Select
                            value={editForm.paymentStatus}
                            onValueChange={(v) =>
                              setEditForm((p) => ({ ...p, paymentStatus: v as PaymentStatus }))
                            }
                          >
                            <SelectTrigger id="edit-paymentStatus">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="partial">Partial</SelectItem>
                              <SelectItem value="paid">Paid</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Pickup */}
                    <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm">
                      <div className="mb-4 flex items-center justify-between">
                        <h4 className="text-sm font-semibold">Pickup details</h4>
                        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Pickup
                        </span>
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-1.5 md:col-span-3">
                          <Label htmlFor="edit-pickupCompany">Company</Label>
                          <Input
                            id="edit-pickupCompany"
                            value={editForm.pickupCompany}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, pickupCompany: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-pickupContact">Contact</Label>
                          <Input
                            id="edit-pickupContact"
                            value={editForm.pickupContact}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, pickupContact: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-pickupPhone">Phone</Label>
                          <Input
                            id="edit-pickupPhone"
                            value={editForm.pickupPhone}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, pickupPhone: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5 md:col-span-3">
                          <Label htmlFor="edit-pickupAddress">Address</Label>
                          <Input
                            id="edit-pickupAddress"
                            value={editForm.pickupAddress}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, pickupAddress: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-pickupCity">City</Label>
                          <Input
                            id="edit-pickupCity"
                            value={editForm.pickupCity}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, pickupCity: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-pickupState">State</Label>
                          <Input
                            id="edit-pickupState"
                            value={editForm.pickupState}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, pickupState: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-pickupZip">ZIP</Label>
                          <Input
                            id="edit-pickupZip"
                            value={editForm.pickupZip}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, pickupZip: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-pickupDate">Date</Label>
                          <Input
                            id="edit-pickupDate"
                            type="date"
                            value={editForm.pickupDate}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, pickupDate: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-pickupTime">Time</Label>
                          <Input
                            id="edit-pickupTime"
                            type="time"
                            value={editForm.pickupTime}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, pickupTime: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                    </div>

                    {/* Delivery */}
                    <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm">
                      <div className="mb-4 flex items-center justify-between">
                        <h4 className="text-sm font-semibold">Delivery details</h4>
                        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Delivery
                        </span>
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-1.5 md:col-span-3">
                          <Label htmlFor="edit-deliveryCompany">Company</Label>
                          <Input
                            id="edit-deliveryCompany"
                            value={editForm.deliveryCompany}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, deliveryCompany: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-deliveryContact">Contact</Label>
                          <Input
                            id="edit-deliveryContact"
                            value={editForm.deliveryContact}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, deliveryContact: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-deliveryPhone">Phone</Label>
                          <Input
                            id="edit-deliveryPhone"
                            value={editForm.deliveryPhone}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, deliveryPhone: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5 md:col-span-3">
                          <Label htmlFor="edit-deliveryAddress">Address</Label>
                          <Input
                            id="edit-deliveryAddress"
                            value={editForm.deliveryAddress}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, deliveryAddress: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-deliveryCity">City</Label>
                          <Input
                            id="edit-deliveryCity"
                            value={editForm.deliveryCity}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, deliveryCity: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-deliveryState">State</Label>
                          <Input
                            id="edit-deliveryState"
                            value={editForm.deliveryState}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, deliveryState: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-deliveryZip">ZIP</Label>
                          <Input
                            id="edit-deliveryZip"
                            value={editForm.deliveryZip}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, deliveryZip: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-deliveryDate">Date</Label>
                          <Input
                            id="edit-deliveryDate"
                            type="date"
                            value={editForm.deliveryDate}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, deliveryDate: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-deliveryTime">Time</Label>
                          <Input
                            id="edit-deliveryTime"
                            type="time"
                            value={editForm.deliveryTime}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, deliveryTime: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                    </div>

                    {/* Freight */}
                    <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm">
                      <div className="mb-4 flex items-center justify-between">
                        <h4 className="text-sm font-semibold">Freight details</h4>
                        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Freight
                        </span>
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-1.5 md:col-span-3">
                          <Label htmlFor="edit-commodity">Commodity</Label>
                          <Input
                            id="edit-commodity"
                            value={editForm.commodity}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, commodity: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-weight">Weight</Label>
                          <Input
                            id="edit-weight"
                            type="number"
                            min="0"
                            value={editForm.weight}
                            onChange={(e) => setEditForm((p) => ({ ...p, weight: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-pieces">Pieces</Label>
                          <Input
                            id="edit-pieces"
                            type="number"
                            min="0"
                            value={editForm.pieces}
                            onChange={(e) => setEditForm((p) => ({ ...p, pieces: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-pallets">Pallets</Label>
                          <Input
                            id="edit-pallets"
                            type="number"
                            min="0"
                            value={editForm.pallets}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, pallets: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-equipmentType">Equipment Type</Label>
                          <Input
                            id="edit-equipmentType"
                            value={editForm.equipmentType}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, equipmentType: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-trailerLength">Trailer Length</Label>
                          <Input
                            id="edit-trailerLength"
                            type="number"
                            min="0"
                            value={editForm.trailerLength}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, trailerLength: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-loadType">Load Type</Label>
                          <Select
                            value={editForm.loadType}
                            onValueChange={(v) =>
                              setEditForm((p) => ({ ...p, loadType: v as LoadType }))
                            }
                          >
                            <SelectTrigger id="edit-loadType">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              {LOAD_TYPES.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {t.toUpperCase()}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-temperature">Temperature</Label>
                          <Input
                            id="edit-temperature"
                            type="number"
                            value={editForm.temperature}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, temperature: e.target.value }))
                            }
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id="edit-hazmat"
                            checked={editForm.hazmat}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, hazmat: e.target.checked }))
                            }
                            className="rounded border-border"
                          />
                          <Label htmlFor="edit-hazmat">Hazmat</Label>
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id="edit-stackable"
                            checked={editForm.stackable}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, stackable: e.target.checked }))
                            }
                            className="rounded border-border"
                          />
                          <Label htmlFor="edit-stackable">Stackable</Label>
                        </div>
                      </div>
                    </div>

                    {/* Pricing */}
                    <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm">
                      <div className="mb-4 flex items-center justify-between">
                        <h4 className="text-sm font-semibold">Pricing</h4>
                        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Revenue
                        </span>
                      </div>
                      <div className="grid gap-4 md:grid-cols-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-customerRate">Customer Rate</Label>
                          <Input
                            id="edit-customerRate"
                            type="number"
                            min="0"
                            step="0.01"
                            value={editForm.customerRate}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, customerRate: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-carrierCost">Carrier Cost</Label>
                          <Input
                            id="edit-carrierCost"
                            type="number"
                            min="0"
                            step="0.01"
                            value={editForm.carrierCost}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, carrierCost: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-accessorialCharges">Accessorials</Label>
                          <Input
                            id="edit-accessorialCharges"
                            type="number"
                            min="0"
                            step="0.01"
                            value={editForm.accessorialCharges}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, accessorialCharges: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Calculated Values</Label>
                          <div className="border border-border rounded-md bg-muted p-2 text-xs space-y-1">
                            <div className="flex justify-between">
                              <span>Revenue</span>
                              <span>{usd(editFinancials.revenue)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Gross Margin</span>
                              <span className="text-green-600">
                                {usd(editFinancials.grossMargin)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Margin %</span>
                              <span>{editFinancials.marginPercent.toFixed(2)}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Mileage */}
                    <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm">
                      <div className="mb-4 flex items-center justify-between">
                        <h4 className="text-sm font-semibold">Mileage</h4>
                        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Route data
                        </span>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-loadedMiles">Loaded Miles</Label>
                          <Input
                            id="edit-loadedMiles"
                            type="number"
                            min="0"
                            value={editForm.loadedMiles}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, loadedMiles: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-deadheadMiles">Deadhead Miles</Label>
                          <Input
                            id="edit-deadheadMiles"
                            type="number"
                            min="0"
                            value={editForm.deadheadMiles}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, deadheadMiles: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                    </div>

                    {/* Documents */}
                    <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm">
                      <div className="mb-4 flex items-center justify-between">
                        <h4 className="text-sm font-semibold">Documents</h4>
                        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Files
                        </span>
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        {(editForm.documents || []).map((doc) => (
                          <div
                            key={doc.kind}
                            className="flex items-center justify-between rounded-md border border-border bg-card/50 p-2"
                          >
                            <div className="text-sm">{DOCUMENT_LABELS[doc.kind]}</div>
                            <Button
                              size="sm"
                              variant={doc.uploaded ? "outline" : "default"}
                              onClick={() => toggleDoc(doc.kind, doc.uploaded)}
                            >
                              {doc.uploaded ? (
                                <>
                                  <CheckCircle2 className="size-3.5" /> Uploaded
                                </>
                              ) : (
                                <>
                                  <LayoutGrid className="size-3.5" /> Upload
                                </>
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm">
                      <div className="mb-4 flex items-center justify-between">
                        <h4 className="text-sm font-semibold">Notes & instructions</h4>
                        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Communication
                        </span>
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-1.5 md:col-span-3">
                          <Label htmlFor="edit-internalNotes">Internal Notes</Label>
                          <Textarea
                            id="edit-internalNotes"
                            value={editForm.internalNotes}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, internalNotes: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5 md:col-span-3">
                          <Label htmlFor="edit-driverInstructions">Driver Instructions</Label>
                          <Textarea
                            id="edit-driverInstructions"
                            value={editForm.driverInstructions}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, driverInstructions: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5 md:col-span-3">
                          <Label htmlFor="edit-customerNotes">Customer Notes</Label>
                          <Textarea
                            id="edit-customerNotes"
                            value={editForm.customerNotes}
                            onChange={(e) =>
                              setEditForm((p) => ({ ...p, customerNotes: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-3">
                      <Button type="submit" disabled={saving}>
                        {saving ? "Saving..." : "Save Changes"}
                      </Button>
                      <Button variant="ghost" type="button" onClick={() => setEditing(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    {/* Summary */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Customer" value={open.customerName} />
                      <Field label="Carrier" value={open.carrierName} />
                      <Field label="Agent" value={open.agentName} />
                      <Field label="Status" value={<StatusBadge value={open.status} />} />
                      <Field label="Customer Reference" value={open.customerReference} />
                      <Field label="Load Number" value={open.loadNumber} mono />
                      <Field
                        label="Invoice Status"
                        value={<StatusBadge value={open.invoiceStatus} />}
                      />
                      <Field
                        label="Payment Status"
                        value={<StatusBadge value={open.paymentStatus} />}
                      />
                    </div>

                    {/* Customer Info */}
                    {open.customer && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Customer Info
                        </h4>
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label="Company" value={open.customer.company} />
                          <Field label="Contact" value={open.customer.contact} />
                          <Field label="Phone" value={open.customer.phone} />
                          <Field label="Email" value={open.customer.email} />
                        </div>
                      </div>
                    )}

                    {/* Carrier Info */}
                    {open.carrier && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Carrier Info
                        </h4>
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label="Legal Name" value={open.carrier.legalName} />
                          <Field label="DBA" value={open.carrier.dba} />
                          <Field label="MC #" value={open.carrier.mcNumber} mono />
                          <Field label="DOT #" value={open.carrier.dotNumber} mono />
                          <Field label="Contact" value={open.carrier.contactName} />
                          <Field label="Phone" value={open.carrier.contactPhone} />
                          <Field label="Email" value={open.carrier.contactEmail} />
                          <Field label="Address" value={open.carrier.address} />
                          <Field
                            label="Equipment Types"
                            value={open.carrier.equipmentTypes?.join(", ")}
                          />
                          <Field
                            label="Service Areas"
                            value={open.carrier.serviceAreas?.join(", ")}
                          />
                          <Field label="Insurance Carrier" value={open.carrier.insuranceCarrier} />
                          <Field
                            label="Insurance Expires At"
                            value={
                              open.carrier.insuranceExpiresAt
                                ? fmtDate(open.carrier.insuranceExpiresAt)
                                : ""
                            }
                          />
                          <Field
                            label="Status"
                            value={<StatusBadge value={open.carrier.status} />}
                          />
                        </div>
                      </div>
                    )}

                    {/* Pickup & Delivery */}
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Pickup Details
                        </h4>
                        <div className="grid gap-3">
                          <Field label="Company" value={open.pickupCompany} />
                          <Field label="Contact" value={open.pickupContact} />
                          <Field label="Phone" value={open.pickupPhone} />
                          <Field label="Address" value={open.pickupAddress} />
                          <Field
                            label="City / State"
                            value={[open.pickupCity, open.pickupState, open.pickupZip]
                              .filter(Boolean)
                              .join(", ")}
                          />
                          <Field
                            label="Date & Time"
                            value={
                              open.pickupDate
                                ? fmtDateTime(
                                    open.pickupDate +
                                      (open.pickupTime ? `T${open.pickupTime}` : ""),
                                  )
                                : ""
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Delivery Details
                        </h4>
                        <div className="grid gap-3">
                          <Field label="Company" value={open.deliveryCompany} />
                          <Field label="Contact" value={open.deliveryContact} />
                          <Field label="Phone" value={open.deliveryPhone} />
                          <Field label="Address" value={open.deliveryAddress} />
                          <Field
                            label="City / State"
                            value={[open.deliveryCity, open.deliveryState, open.deliveryZip]
                              .filter(Boolean)
                              .join(", ")}
                          />
                          <Field
                            label="Date & Time"
                            value={
                              open.deliveryDate
                                ? fmtDateTime(
                                    open.deliveryDate +
                                      (open.deliveryTime ? `T${open.deliveryTime}` : ""),
                                  )
                                : ""
                            }
                          />
                        </div>
                      </div>
                    </div>

                    {/* Freight */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Freight Details
                      </h4>
                      <div className="grid gap-3 md:grid-cols-3">
                        <Field label="Commodity" value={open.commodity} />
                        <Field label="Weight" value={open.weight?.toString()} />
                        <Field label="Pieces" value={open.pieces?.toString()} />
                        <Field label="Pallets" value={open.pallets?.toString()} />
                        <Field label="Equipment Type" value={open.equipmentType} />
                        <Field label="Trailer Length" value={open.trailerLength?.toString()} />
                        <Field label="Load Type" value={open.loadType?.toUpperCase()} />
                        <Field label="Temperature" value={open.temperature?.toString()} />
                        <div>
                          <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                            Hazmat
                          </div>
                          <div
                            className={
                              open.hazmat ? "text-destructive font-medium" : "text-muted-foreground"
                            }
                          >
                            {open.hazmat ? "Yes" : "No"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                            Stackable
                          </div>
                          <div className="text-muted-foreground">
                            {open.stackable ? "Yes" : "No"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Pricing */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Pricing
                      </h4>
                      <div className="grid gap-3 md:grid-cols-4">
                        <Field label="Customer Rate" value={usd(open.customerRate)} mono />
                        <Field label="Carrier Cost" value={usd(open.carrierCost)} mono />
                        <Field
                          label="Accessorials"
                          value={open.accessorialCharges ? usd(open.accessorialCharges) : "—"}
                          mono
                        />
                        <div className="border border-border rounded-md bg-muted p-2">
                          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                            Calculated
                          </div>
                          <div className="grid gap-1 text-xs">
                            <div className="flex justify-between">
                              <span>Revenue</span>
                              <span>{usd(open.revenue)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Gross Margin</span>
                              <span className="text-green-600">{usd(open.grossMargin)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Margin %</span>
                              <span>{open.marginPercent.toFixed(2)}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Mileage */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Mileage
                      </h4>
                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Loaded Miles" value={open.loadedMiles?.toString()} />
                        <Field label="Deadhead Miles" value={open.deadheadMiles?.toString()} />
                      </div>
                    </div>

                    {/* Documents */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Documents
                      </h4>
                      <ul className="space-y-1.5">
                        {(open.documents || []).map((d) => (
                          <li
                            key={d.kind}
                            className="flex items-center justify-between rounded-md border border-border bg-card/50 p-2"
                          >
                            <div className="text-sm">{DOCUMENT_LABELS[d.kind]}</div>
                            {d.uploaded ? (
                              <span className="text-xs text-green-600">Uploaded</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Not uploaded</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Notes
                      </h4>
                      {open.internalNotes && (
                        <div>
                          <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                            Internal Notes
                          </div>
                          <div className="text-sm whitespace-pre-wrap p-2 border border-border rounded-md bg-muted/50">
                            {open.internalNotes}
                          </div>
                        </div>
                      )}
                      {open.driverInstructions && (
                        <div>
                          <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                            Driver Instructions
                          </div>
                          <div className="text-sm whitespace-pre-wrap p-2 border border-border rounded-md bg-muted/50">
                            {open.driverInstructions}
                          </div>
                        </div>
                      )}
                      {open.customerNotes && (
                        <div>
                          <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                            Customer Notes
                          </div>
                          <div className="text-sm whitespace-pre-wrap p-2 border border-border rounded-md bg-muted/50">
                            {open.customerNotes}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Status History */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Status History
                      </h4>
                      <ul className="space-y-1.5">
                        {open.statusHistory?.length ? (
                          open.statusHistory.map((h, i) => (
                            <li
                              key={i}
                              className="flex items-center justify-between rounded-md border border-border bg-card/50 px-2.5 py-1.5"
                            >
                              <StatusBadge value={h.status} />
                              <div className="text-xs text-muted-foreground">
                                {h.changedBy} · {h.at ? fmtDateTime(h.at) : ""}
                              </div>
                            </li>
                          ))
                        ) : (
                          <li className="text-xs text-muted-foreground">No history</li>
                        )}
                      </ul>
                    </div>

                    {/* Approval Conversation & Audit */}
                    {open.pendingApproval && (
                      <div className="space-y-4">
                        {open.comments && open.comments.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              <MessageSquare className="size-3.5" /> Conversation
                            </h4>
                            <ul className="space-y-2">
                              {open.comments.map((c, i) => (
                                <li
                                  key={i}
                                  className="rounded-md border border-border bg-muted/40 p-2.5"
                                >
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="text-xs font-semibold">{c.by}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {fmtDateTime(c.at)}
                                    </span>
                                  </div>
                                  <p className="text-sm whitespace-pre-wrap">{c.body}</p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {open.auditHistory && open.auditHistory.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              <Clock className="size-3.5" /> Audit Trail
                            </h4>
                            <ul className="space-y-1.5">
                              {(open.auditHistory as any[]).map((h, i) => (
                                <li
                                  key={i}
                                  className="flex items-start justify-between gap-2 rounded-md border border-border bg-card/50 px-2.5 py-1.5"
                                >
                                  <div>
                                    <span className="text-xs font-medium capitalize">
                                      {h.action?.replace(/_/g, " ")}
                                    </span>
                                    {h.notes && (
                                      <p className="mt-0.5 text-xs text-muted-foreground">
                                        {h.notes}
                                      </p>
                                    )}
                                  </div>
                                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                                    <div>{h.performedByName}</div>
                                    <div>{h.at ? fmtDateTime(h.at) : ""}</div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
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
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`mt-0.5 text-sm ${mono ? "font-mono text-xs" : ""}`}>{value || "—"}</div>
    </div>
  );
}
