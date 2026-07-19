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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { usd, fmtDate } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api-client";
import { can } from "@/lib/roles";
import { Building2, Check, Download, Edit, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_app/customers")({
  component: CustomersPage,
});

type CustomerItem = {
  id: string;
  company: string;
  contact: string;
  email: string;
  phone: string;
  creditLimit: number;
  creditStatus: "pending" | "approved" | "rejected";
  status: "submitted" | "review" | "approved" | "rejected";
  agentId: string;
  agentName: string;
  notes: string;
  shippingNotes: string;
  createdAt: string;
  pendingApproval?: boolean;
  requestedBy?: string;
  approvalRequestId?: string;
  approvalStatus?: string;
  approvalComments?: any[];
};

type CustomerApiResponse = {
  customers: CustomerItem[];
};

const STEPS = ["submitted", "review", "approved"] as const;

function CustomersPage() {
  const { session } = useAuth();
  const role = session?.role ?? "agent";
  const canApprove = can(role, "approval_actions");
  const canEdit =
    role === "admin" || role === "ops_manager" || role === "team_manager" || role === "agent";
  const [items, setItems] = useState<CustomerItem[]>([]);
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [form, setForm] = useState({
    company: "",
    contact: "",
    email: "",
    phone: "",
    creditLimit: "",
    creditStatus: "pending" as CustomerItem["creditStatus"],
    status: "submitted" as CustomerItem["status"],
    notes: "",
    shippingNotes: "",
  });
  const [editForm, setEditForm] = useState({
    company: "",
    contact: "",
    email: "",
    phone: "",
    creditLimit: "",
    creditStatus: "pending" as CustomerItem["creditStatus"],
    status: "submitted" as CustomerItem["status"],
    notes: "",
    shippingNotes: "",
  });
  const [editingApprovalRequestId, setEditingApprovalRequestId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCustomers() {
      try {
        const payload = await apiFetch<CustomerApiResponse>("/api/customers");
        if (!active) return;
        setItems(payload.data.customers);
        setAgents(
          payload.data.customers.reduce<Array<{ id: string; name: string }>>((acc, customer) => {
            if (!acc.some((entry) => entry.id === customer.agentId)) {
              acc.push({ id: customer.agentId, name: customer.agentName });
            }
            return acc;
          }, []),
        );
      } catch (error) {
        console.error(error);
        if (active) {
          setItems([]);
          setAgents([]);
          toast.error("Unable to load customers");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadCustomers();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(
    () =>
      items.filter(
        (c) => !q || `${c.company} ${c.contact} ${c.email}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [items, q],
  );
  const open = items.find((i) => i.id === openId) ?? null;
  const canDeleteCustomer = (item: CustomerItem | null) =>
    Boolean(item && (role === "admin" || role === "ops_manager" || item.agentId === session?.id));

  async function createCustomer(event: FormEvent) {
    event.preventDefault();
    if (!form.company.trim() || !form.contact.trim()) {
      toast.error("Company and contact are required");
      return;
    }

    setCreating(true);
    try {
      const payload = await apiFetch<{ customer: CustomerItem }>("/api/customers", {
        method: "POST",
        body: JSON.stringify({
          companyName: form.company.trim(),
          contactName: form.contact.trim(),
          contactEmail: form.email.trim(),
          contactPhone: form.phone.trim(),
          creditLimit: Number(form.creditLimit || 0),
          creditStatus: form.creditStatus,
          status: form.status,
          notes: form.notes.trim(),
          shippingNotes: form.shippingNotes.trim(),
        }),
      });

      setItems((prev) => [payload.data.customer, ...prev]);
      setForm({
        company: "",
        contact: "",
        email: "",
        phone: "",
        creditLimit: "",
        creditStatus: "pending",
        status: "submitted",
        notes: "",
        shippingNotes: "",
      });
      setShowCreate(false);
      toast.success("Customer created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create customer");
    } finally {
      setCreating(false);
    }
  }

  async function updateCustomer(event: FormEvent) {
    event.preventDefault();
    if (!open || !editForm.company.trim() || !editForm.contact.trim()) {
      toast.error("Company and contact are required");
      return;
    }

    setUpdating(true);
    try {
      const payload = await apiFetch<{ customer: CustomerItem }>(`/api/customers`, {
        method: "PATCH",
        body: JSON.stringify({
          customerId: open.id,
          approvalRequestId: editingApprovalRequestId,
          companyName: editForm.company.trim(),
          contactName: editForm.contact.trim(),
          contactEmail: editForm.email.trim(),
          contactPhone: editForm.phone.trim(),
          creditLimit: Number(editForm.creditLimit || 0),
          creditStatus: editForm.creditStatus,
          status: editForm.status,
          notes: editForm.notes.trim(),
          shippingNotes: editForm.shippingNotes.trim(),
        }),
      });

      setItems((prev) =>
        prev.map((customer) => (customer.id === open.id ? payload.data.customer : customer)),
      );
      setOpenId(payload.data.customer.id);
      setEditing(false);
      setEditingApprovalRequestId(null);
      toast.success("Customer updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update customer");
    } finally {
      setUpdating(false);
    }
  }

  async function removeCustomer(id: string) {
    try {
      await apiFetch(`/api/customers`, {
        method: "DELETE",
        body: JSON.stringify({ customerId: id }),
      });
      setItems((prev) => prev.filter((customer) => customer.id !== id));
      setOpenId(null);
      toast.success("Customer deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete customer");
    }
  }

  function startEdit() {
    if (!open) return;
    setEditForm({
      company: open.company,
      contact: open.contact,
      email: open.email,
      phone: open.phone,
      creditLimit: String(open.creditLimit),
      creditStatus: open.creditStatus,
      status: open.status,
      notes: open.notes,
      shippingNotes: open.shippingNotes,
    });
    if (open.approvalRequestId) {
      setEditingApprovalRequestId(open.approvalRequestId);
    } else {
      setEditingApprovalRequestId(null);
    }
    setEditing(true);
  }

  async function decide(id: string, approve: boolean) {
    const customer = items.find((item) => item.id === id);
    if (!customer) return;
    try {
      const payload = await apiFetch<{ customer: CustomerItem }>("/api/customers", {
        method: "PATCH",
        body: JSON.stringify({
          customerId: id,
          companyName: customer.company,
          contactName: customer.contact,
          contactEmail: customer.email,
          contactPhone: customer.phone,
          creditLimit: customer.creditLimit,
          creditStatus: approve ? "approved" : "rejected",
          status: approve ? "approved" : "rejected",
          notes: customer.notes,
          shippingNotes: customer.shippingNotes,
        }),
      });
      setItems((prev) => prev.map((item) => (item.id === id ? payload.data.customer : item)));
      toast.success(approve ? "Customer approved" : "Customer rejected");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update customer");
    }
  }

  function exportCustomers(format: "csv" | "xlsx") {
    const rows = filtered.length > 0 ? filtered : items;
    if (rows.length === 0) {
      toast.error("No customers to export");
      return;
    }

    const data = rows.map((customer) => ({
      Company: customer.company,
      Contact: customer.contact,
      Email: customer.email,
      Phone: customer.phone,
      "Credit limit": usd(customer.creditLimit),
      "Credit status": customer.creditStatus,
      "Onboarding status": customer.status,
      Agent: customer.agentName,
      Created: fmtDate(customer.createdAt),
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
      link.download = "customers.csv";
      link.click();
      URL.revokeObjectURL(url);
    } else {
      import("xlsx").then((XLSX) => {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");
        XLSX.writeFile(workbook, "customers.xlsx");
      });
    }
    toast.success("Customers exported");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customers"
        description="Customer onboarding, credit approval, and ongoing relationships."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="size-4" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => exportCustomers("csv")}>CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportCustomers("xlsx")}>XLSX</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" onClick={() => setShowCreate((prev) => !prev)}>
              <Plus className="size-4" /> New customer
            </Button>
          </>
        }
      />

      {showCreate && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Add a customer</div>
              <div className="text-xs text-muted-foreground">
                This saves the record into the database.
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={createCustomer}>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="customer-company">Company</Label>
              <Input
                id="customer-company"
                value={form.company}
                onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))}
                placeholder="Company name"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customer-contact">Contact</Label>
              <Input
                id="customer-contact"
                value={form.contact}
                onChange={(e) => setForm((prev) => ({ ...prev, contact: e.target.value }))}
                placeholder="Contact name"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customer-email">Email</Label>
              <Input
                id="customer-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="name@email.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customer-phone">Phone</Label>
              <Input
                id="customer-phone"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="(555) 000-0000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customer-credit-limit">Credit limit</Label>
              <Input
                id="customer-credit-limit"
                type="number"
                value={form.creditLimit}
                onChange={(e) => setForm((prev) => ({ ...prev, creditLimit: e.target.value }))}
                placeholder="50000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customer-credit-status">Credit status</Label>
              <Select
                value={form.creditStatus}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    creditStatus: value as CustomerItem["creditStatus"],
                  }))
                }
              >
                <SelectTrigger id="customer-credit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">pending</SelectItem>
                  <SelectItem value="approved">approved</SelectItem>
                  <SelectItem value="rejected">rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customer-status">Onboarding status</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, status: value as CustomerItem["status"] }))
                }
              >
                <SelectTrigger id="customer-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="submitted">submitted</SelectItem>
                  <SelectItem value="review">review</SelectItem>
                  <SelectItem value="approved">approved</SelectItem>
                  <SelectItem value="rejected">rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="customer-notes">Notes</Label>
              <Textarea
                id="customer-notes"
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Notes for the team"
                rows={3}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="customer-shipping-notes">Shipping notes</Label>
              <Textarea
                id="customer-shipping-notes"
                value={form.shippingNotes}
                onChange={(e) => setForm((prev) => ({ ...prev, shippingNotes: e.target.value }))}
                placeholder="Lane or routing details"
                rows={2}
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={creating}>
                {creating ? "Saving…" : "Save customer"}
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search customer or contact…"
            className="pl-8"
          />
        </div>
      </div>

      <DataTable
        empty={
          <EmptyState
            icon={<Building2 className="size-6" />}
            title="No customers found"
            description="Try creating a customer or adjust your search."
          />
        }
        rows={filtered}
        onRowClick={(c) => setOpenId(c.id)}
        columns={[
          {
            head: "Company",
            cell: (c) => (
              <div>
                <span className="font-medium">{c.company}</span>
                {c.pendingApproval && (
                  <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    c.approvalStatus === "pending" ? "bg-yellow-100 text-yellow-800" :
                    c.approvalStatus === "changes_requested" ? "bg-orange-100 text-orange-800" :
                    "bg-red-100 text-red-800"
                  }`}>
                    {c.approvalStatus === "changes_requested" ? "Changes Requested" :
                     c.approvalStatus === "rejected" ? "Rejected" :
                     "Pending Approval"}
                  </span>
                )}
              </div>
            ),
          },
          {
            head: "Contact",
            cell: (c) => (
              <div>
                <div className="text-sm">{c.contact}</div>
                <div className="text-xs text-muted-foreground">{c.email}</div>
              </div>
            ),
          },
          {
            head: "Credit limit",
            cell: (c) => <span className="font-mono text-sm">{usd(c.creditLimit)}</span>,
          },
          { head: "Credit", cell: (c) => <StatusBadge value={c.creditStatus} /> },
          { head: "Onboarding", cell: (c) => <StatusBadge value={c.status} /> },
          { head: "Agent", cell: (c) => <span className="text-sm">{c.agentName}</span> },
          {
            head: "Created",
            cell: (c) => (
              <span className="text-xs text-muted-foreground">{fmtDate(c.createdAt)}</span>
            ),
          },
        ]}
      />

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {open && (
            <>
              <SheetHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SheetTitle>{editing ? "Edit customer" : open.company}</SheetTitle>
                    {open.pendingApproval && (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          open.approvalStatus === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : open.approvalStatus === "changes_requested"
                              ? "bg-orange-100 text-orange-800"
                              : open.approvalStatus === "rejected"
                                ? "bg-red-100 text-red-800"
                                : "bg-green-100 text-green-800"
                        }`}
                      >
                        {open.approvalStatus === "changes_requested"
                          ? "Changes Requested"
                          : open.approvalStatus
                            ? open.approvalStatus.charAt(0).toUpperCase() +
                              open.approvalStatus.slice(1)
                            : "Pending Approval"}
                      </span>
                    )}
                  </div>
                  {!editing && (
                    <div className="flex items-center gap-2">
                      {canDeleteCustomer(open) && !open.pendingApproval && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="size-4" /> Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {open.company}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => void removeCustomer(open.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      {canEdit &&
                        (open.pendingApproval
                          ? open.requestedBy === session?.name || open.agentId === session?.id
                          : true) && (
                          <Button variant="ghost" size="sm" onClick={startEdit}>
                            <Edit className="size-4" /> Edit
                          </Button>
                        )}
                    </div>
                  )}
                </div>
              </SheetHeader>
              <div className="space-y-5 px-4 pb-6">
                {editing ? (
                  <form className="space-y-3" onSubmit={updateCustomer}>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-customer-company">Company</Label>
                      <Input
                        id="edit-customer-company"
                        value={editForm.company}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, company: e.target.value }))
                        }
                        placeholder="Company name"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-customer-contact">Contact</Label>
                      <Input
                        id="edit-customer-contact"
                        value={editForm.contact}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, contact: e.target.value }))
                        }
                        placeholder="Contact name"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-customer-email">Email</Label>
                      <Input
                        id="edit-customer-email"
                        type="email"
                        value={editForm.email}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, email: e.target.value }))
                        }
                        placeholder="name@email.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-customer-phone">Phone</Label>
                      <Input
                        id="edit-customer-phone"
                        value={editForm.phone}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, phone: e.target.value }))
                        }
                        placeholder="(555) 000-0000"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-customer-credit-limit">Credit limit</Label>
                      <Input
                        id="edit-customer-credit-limit"
                        type="number"
                        value={editForm.creditLimit}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, creditLimit: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-customer-credit-status">Credit status</Label>
                      <Select
                        value={editForm.creditStatus}
                        onValueChange={(value) =>
                          setEditForm((prev) => ({
                            ...prev,
                            creditStatus: value as CustomerItem["creditStatus"],
                          }))
                        }
                      >
                        <SelectTrigger id="edit-customer-credit-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">pending</SelectItem>
                          <SelectItem value="approved">approved</SelectItem>
                          <SelectItem value="rejected">rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-customer-status">Onboarding status</Label>
                      <Select
                        value={editForm.status}
                        onValueChange={(value) =>
                          setEditForm((prev) => ({
                            ...prev,
                            status: value as CustomerItem["status"],
                          }))
                        }
                      >
                        <SelectTrigger id="edit-customer-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="submitted">submitted</SelectItem>
                          <SelectItem value="review">review</SelectItem>
                          <SelectItem value="approved">approved</SelectItem>
                          <SelectItem value="rejected">rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-customer-notes">Notes</Label>
                      <Textarea
                        id="edit-customer-notes"
                        value={editForm.notes}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, notes: e.target.value }))
                        }
                        rows={2}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-customer-shipping-notes">Shipping notes</Label>
                      <Textarea
                        id="edit-customer-shipping-notes"
                        value={editForm.shippingNotes}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, shippingNotes: e.target.value }))
                        }
                        rows={2}
                      />
                    </div>
                    <div className="flex justify-between gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditing(false);
                          setEditingApprovalRequestId(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={updating}>
                        {updating ? "Saving…" : "Save changes"}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3 pt-2 text-sm">
                      <Field label="Contact" value={open.contact} />
                      <Field label="Email" value={open.email} />
                      <Field label="Phone" value={open.phone} mono />
                      <Field label="Credit limit" value={usd(open.creditLimit)} mono />
                      <Field
                        label="Credit status"
                        value={<StatusBadge value={open.creditStatus} />}
                      />
                      <Field label="Agent" value={open.agentName} />
                    </div>

                    <div>
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Onboarding workflow
                      </div>
                      <div className="flex items-center">
                        {STEPS.map((s, i) => {
                          const reached =
                            open.status === "rejected"
                              ? i === 0
                              : STEPS.indexOf(open.status as any) >= i;
                          return (
                            <div key={s} className="flex flex-1 items-center">
                              <div
                                className={`grid size-7 place-items-center rounded-full border text-xs ${reached ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}
                              >
                                {i + 1}
                              </div>
                              <div className="ml-2 flex-1">
                                <div className="text-xs font-medium capitalize">{s}</div>
                              </div>
                              {i < STEPS.length - 1 && (
                                <div
                                  className={`mx-1 h-px flex-1 ${reached ? "bg-primary/50" : "bg-border"}`}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {open.status === "rejected" && (
                        <p className="mt-2 text-xs text-destructive">
                          Customer rejected. Available for re-submission.
                        </p>
                      )}
                    </div>

                    {(open.notes || open.shippingNotes) && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Notes
                        </div>
                        {open.notes && <p className="mt-1 text-sm">{open.notes}</p>}
                        {open.shippingNotes && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Shipping: {open.shippingNotes}
                          </p>
                        )}
                      </div>
                    )}

                    {open.pendingApproval &&
                      open.approvalComments &&
                      open.approvalComments.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Conversation
                          </div>
                          <div className="mt-2 space-y-2">
                            {open.approvalComments.map((comment: any) => (
                              <div key={comment.id} className="border border-border rounded-md p-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold">{comment.userName}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {fmtDate(comment.createdAt)}
                                  </span>
                                </div>
                                <p className="mt-1 text-sm">{comment.text}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {canApprove &&
                      (open.status === "submitted" || open.status === "review") &&
                      !open.pendingApproval && (
                        <div className="flex gap-2">
                          <Button onClick={() => decide(open.id, true)} className="flex-1">
                            <Check className="size-4" /> Approve
                          </Button>
                          <Button
                            onClick={() => decide(open.id, false)}
                            variant="outline"
                            className="flex-1"
                          >
                            <X className="size-4" /> Reject
                          </Button>
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
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`mt-0.5 ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
    </div>
  );
}

function escapeCsv(value: string) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}
