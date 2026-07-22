// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { createPortal, flushSync } from "react-dom";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { usd, fmtDate } from "@/lib/format";
import {
  Plus,
  Edit,
  Trash,
  FileText,
  Printer,
  Receipt,
  User,
  Download,
  CalendarDays,
  Percent,
  StickyNote,
  Loader2,
  Inbox,
  Send,
  CreditCard,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportRowsToFile, formatExportFilename } from "@/lib/export";

export const Route = createFileRoute("/_app/invoices")({ component: InvoicesPage });

type Payment = {
  _id: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
  notes?: string;
};

type InvoiceItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

type Invoice = {
  _id: string;
  invoiceNumber: string;
  customerId: string;
  loadIds?: string[];
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerBillingContact?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  status: "draft" | "sent" | "partially_paid" | "paid" | "overdue" | "cancelled";
  invoiceDate: string;
  dueDate: string;
  paidAt?: string;
  paymentTerms?: string;
  referenceNumber?: string;
  currency?: string;
  notes?: string;
  internalNotes?: string;
  payments: Payment[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type Load = {
  id: string;
  loadNumber: string;
  customerName: string;
  customerId: string;
  pickupCompany?: string;
  deliveryCompany?: string;
  commodity?: string;
  revenue: number;
  deliveryDate?: string;
  status: string;
};

type Customer = {
  _id: string;
  companyName: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
};

function InvoicesPage() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loads, setLoads] = useState<Load[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showView, setShowView] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  // Invoice currently being rendered into the print portal (separate from the on-screen view dialog).
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const [createMode, setCreateMode] = useState<"manual" | "load">("manual");
  const [selectedLoads, setSelectedLoads] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    companyName: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
  });

  // Form state
  const [form, setForm] = useState({
    invoiceNumber: "",
    customerId: "",
    loadIds: [] as string[],
    items: [{ description: "", quantity: 1, unitPrice: 0 }],
    discount: 0,
    taxRate: 0,
    status: "draft" as const,
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    paymentTerms: "",
    referenceNumber: "",
    notes: "",
    internalNotes: "",
  });

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    paymentDate: new Date().toISOString().slice(0, 10),
    amount: 0,
    paymentMethod: "",
    referenceNumber: "",
    notes: "",
  });

  // Calculate totals
  const totals = useMemo(() => {
    const subtotal = form.items.reduce(
      (sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0),
      0,
    );
    const afterDiscount = subtotal - form.discount;
    const taxAmount = afterDiscount * (form.taxRate / 100);
    const total = afterDiscount + taxAmount;
    return { subtotal, afterDiscount, taxAmount, total };
  }, [form]);

  // Load initial data
  const loadData = async () => {
    setLoading(true);
    try {
      const [invoiceRes, loadsRes] = await Promise.all([
        apiFetch<{ invoices: Invoice[]; customers: Customer[]; users: any[] }>("/api/invoices", {
          method: "GET",
        }),
        apiFetch<{ loads: Load[]; customers: any[]; carriers: any[] }>("/api/loads", {
          method: "GET",
        }),
      ]);
      setInvoices(invoiceRes.data.invoices);
      setCustomers(invoiceRes.data.customers);
      setUsers(invoiceRes.data.users);
      setLoads(loadsRes.data.loads);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Reset the print portal once the browser's print dialog has been dismissed either way.
  useEffect(() => {
    const clearPrintInvoice = () => setPrintInvoice(null);
    window.addEventListener("afterprint", clearPrintInvoice);
    return () => window.removeEventListener("afterprint", clearPrintInvoice);
  }, []);

  // Derive the next sequential invoice number
  const getNextInvoiceNumber = () => {
    const highest = invoices.reduce((max, inv) => {
      const match = inv.invoiceNumber.match(/(\d+)$/);
      const n = match ? parseInt(match[1], 10) : 0;
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);
    return `INV-${String(highest + 1).padStart(6, "0")}`;
  };

  // Open create dialog
  const openCreate = () => {
    setForm({
      invoiceNumber: getNextInvoiceNumber(),
      customerId: "",
      loadIds: [],
      items: [{ description: "", quantity: 1, unitPrice: 0 }],
      discount: 0,
      taxRate: 0,
      status: "draft",
      invoiceDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      paymentTerms: "",
      referenceNumber: "",
      notes: "",
      internalNotes: "",
    });
    setSelectedLoads([]);
    setCreateMode("manual");
    setShowCreate(true);
  };

  // When customer selected in load mode, auto-fill
  const handleCustomerSelect = (customerId: string) => {
    setForm({ ...form, customerId });
  };

  // When loads selected, auto-fill items
  const handleLoadSelect = (loadId: string) => {
    let newSelectedLoads: string[];
    if (selectedLoads.includes(loadId)) {
      newSelectedLoads = selectedLoads.filter((id) => id !== loadId);
    } else {
      newSelectedLoads = [...selectedLoads, loadId];
    }
    setSelectedLoads(newSelectedLoads);

    // Auto-fill items
    const selectedLoadObjs = loads.filter((l) => newSelectedLoads.includes(l.id));
    const newItems = selectedLoadObjs.map((load) => ({
      description: `Load ${load.loadNumber}: ${load.commodity || "Freight"}`,
      quantity: 1,
      unitPrice: load.revenue,
    }));
    setForm({
      ...form,
      loadIds: newSelectedLoads,
      items: newItems.length > 0 ? newItems : [{ description: "", quantity: 1, unitPrice: 0 }],
    });
  };

  // Handle create new customer
  const handleCreateCustomer = async () => {
    if (!newCustomerForm.companyName || !newCustomerForm.contactName) {
      toast.error("Company name and contact name are required");
      return;
    }

    setSaving(true);
    try {
      const response = await apiFetch<{
        customer: { id: string; company: string; contact: string; email: string; phone: string };
      }>("/api/customers", {
        method: "POST",
        body: JSON.stringify(newCustomerForm),
      });
      toast.success("Customer created");
      setShowNewCustomer(false);

      // Add new customer to state and select it
      const newCustomer = {
        _id: response.data.customer.id,
        companyName: response.data.customer.company,
        contactName: response.data.customer.contact,
        contactEmail: response.data.customer.email,
        contactPhone: response.data.customer.phone,
      };
      setCustomers((prev) => [...prev, newCustomer]);
      setForm((prev) => ({ ...prev, customerId: newCustomer._id }));

      // Reset form
      setNewCustomerForm({
        companyName: "",
        contactName: "",
        contactEmail: "",
        contactPhone: "",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create customer");
    } finally {
      setSaving(false);
    }
  };

  // Handle create invoice
  const handleCreate = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/invoices", {
        method: "POST",
        body: JSON.stringify(form),
      });
      toast.success("Invoice created");
      setShowCreate(false);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create invoice");
    } finally {
      setSaving(false);
    }
  };

  // Handle edit invoice
  const openEdit = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setForm({
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customerId,
      loadIds: invoice.loadIds || [],
      items: invoice.items,
      discount: invoice.discount,
      taxRate: invoice.taxRate,
      status: invoice.status,
      invoiceDate: invoice.invoiceDate.slice(0, 10),
      dueDate: invoice.dueDate.slice(0, 10),
      paymentTerms: invoice.paymentTerms || "",
      referenceNumber: invoice.referenceNumber || "",
      notes: invoice.notes || "",
      internalNotes: invoice.internalNotes || "",
    });
    setShowEdit(true);
  };

  const handleEdit = async () => {
    if (!selectedInvoice) return;
    setSaving(true);
    try {
      await apiFetch("/api/invoices", {
        method: "PATCH",
        body: JSON.stringify({ invoiceId: selectedInvoice._id, ...form }),
      });
      toast.success("Invoice updated");
      setShowEdit(false);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update invoice");
    } finally {
      setSaving(false);
    }
  };

  // Handle delete invoice
  const handleDelete = async (invoiceId: string) => {
    try {
      await apiFetch("/api/invoices", {
        method: "DELETE",
        body: JSON.stringify({ invoiceId }),
      });
      toast.success("Invoice deleted");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete invoice");
    }
  };

  // Handle payment
  const openPayment = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setPaymentForm({
      paymentDate: new Date().toISOString().slice(0, 10),
      amount: invoice.balanceDue,
      paymentMethod: "",
      referenceNumber: "",
      notes: "",
    });
    setShowPayment(true);
  };

  const handleRecordPayment = async () => {
    if (!selectedInvoice) return;
    setSaving(true);
    try {
      await apiFetch("/api/invoices", {
        method: "PATCH",
        body: JSON.stringify({
          invoiceId: selectedInvoice._id,
          action: "add_payment",
          ...paymentForm,
        }),
      });
      toast.success("Payment recorded");
      setShowPayment(false);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  // Open the invoice view dialog — also used as the row click handler.
  const openView = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowView(true);
  };

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const matchesSearch =
        invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [invoices, searchTerm, statusFilter]);

  function exportInvoices(format: "csv" | "xlsx") {
    const rows = filteredInvoices.length > 0 ? filteredInvoices : invoices;
    const exported = exportRowsToFile(
      rows,
      [
        { label: "Invoice #", getValue: (invoice) => invoice.invoiceNumber },
        { label: "Customer", getValue: (invoice) => invoice.customerName },
        { label: "Status", getValue: (invoice) => invoice.status },
        { label: "Invoice Date", getValue: (invoice) => (invoice.invoiceDate ? fmtDate(invoice.invoiceDate) : "") },
        { label: "Due Date", getValue: (invoice) => (invoice.dueDate ? fmtDate(invoice.dueDate) : "") },
        { label: "Total", getValue: (invoice) => invoice.total },
        { label: "Balance Due", getValue: (invoice) => invoice.balanceDue },
        { label: "Amount Paid", getValue: (invoice) => invoice.amountPaid },
      ],
      formatExportFilename("invoices", format),
      format,
      "Invoices",
    );

    if (exported) {
      toast.success("Invoices exported");
    }
  }

  // KPI calculations
  const kpis = useMemo(() => {
    const total = invoices.reduce((sum, i) => sum + i.total, 0);
    const paid = invoices.reduce((sum, i) => sum + i.amountPaid, 0);
    const draft = invoices.filter((i) => i.status === "draft").length;
    const sent = invoices.filter((i) => i.status === "sent").length;
    const partiallyPaid = invoices.filter((i) => i.status === "partially_paid").length;
    const overdue = invoices.filter((i) => i.status === "overdue").length;
    const paidInvoices = invoices.filter((i) => i.status === "paid").length;
    const overdueAmount = invoices
      .filter((i) => i.status === "overdue")
      .reduce((sum, i) => sum + i.balanceDue, 0);
    const thisMonth = invoices.filter(
      (i) => new Date(i.invoiceDate).getMonth() === new Date().getMonth(),
    );
    const thisMonthRevenue = thisMonth.reduce((sum, i) => sum + i.total, 0);
    return {
      total,
      paid,
      draft,
      sent,
      partiallyPaid,
      paidInvoices,
      overdue,
      overdueAmount,
      thisMonthRevenue,
    };
  }, [invoices]);

  // Line item handlers
  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { description: "", quantity: 1, unitPrice: 0 }],
    }));
  };

  const removeItem = (index: number) => {
    if (form.items.length === 1) return;
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }));
  };

  const renderForm = () => (
    <div className="space-y-6">
      <Tabs defaultValue={createMode} onValueChange={(v) => setCreateMode(v as "manual" | "load")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manual">Create Manual Invoice</TabsTrigger>
          <TabsTrigger value="load">Generate from Loads</TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="space-y-4">
          {renderManualForm()}
        </TabsContent>

        <TabsContent value="load" className="space-y-4">
          {renderLoadSelectForm()}
        </TabsContent>
      </Tabs>
    </div>
  );

  const renderManualForm = () => (
    <div className="space-y-6 pt-2">
      {/* Invoice details */}
      <div className="grid gap-4 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Invoice Number</Label>
          <Input
            value={form.invoiceNumber}
            onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as any })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="partially_paid">Partially Paid</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5 text-muted-foreground" /> Invoice Date
          </Label>
          <Input
            type="date"
            value={form.invoiceDate}
            onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5 text-muted-foreground" /> Due Date
          </Label>
          <Input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          />
        </div>
      </div>

      {/* Customer */}
      <div className="grid gap-4 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label className="flex items-center gap-1.5">
            <User className="size-3.5 text-muted-foreground" /> Customer
          </Label>
          <div className="flex gap-2">
            <Select value={form.customerId} onValueChange={(v) => handleCustomerSelect(v)}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer._id} value={customer._id}>
                    {customer.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setShowNewCustomer(true)}>
              <Plus className="size-4 mr-1" /> New
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Payment Terms</Label>
          <Input
            value={form.paymentTerms}
            onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
            placeholder="Net 30, Net 60, etc."
          />
        </div>
        <div className="space-y-2">
          <Label>Reference #</Label>
          <Input
            value={form.referenceNumber}
            onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
          />
        </div>
      </div>

      {/* Items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Receipt className="size-3.5" /> Line Items
          </div>
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus className="size-3 mr-1" /> Add Item
          </Button>
        </div>
        <div className="space-y-2">
          {form.items.map((item, index) => (
            <div
              key={index}
              className="grid grid-cols-2 items-end gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-[1fr_80px_100px_100px_auto]"
            >
              <div className="col-span-2 space-y-1 sm:col-span-1">
                <Label className="text-xs text-muted-foreground">Description</Label>
                <Input
                  placeholder="Line haul, fuel surcharge, etc."
                  value={item.description}
                  onChange={(e) => updateItem(index, "description", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Qty</Label>
                <Input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                  min="1"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Unit Price</Label>
                <Input
                  type="number"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Total</Label>
                <div className="flex h-9 items-center rounded-md px-1 text-sm font-medium tabular-nums">
                  {usd(item.quantity * item.unitPrice)}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={form.items.length === 1}
                onClick={() => removeItem(index)}
              >
                <Trash className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Discount, Tax, Notes */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Discount</Label>
          <Input
            type="number"
            value={form.discount}
            onChange={(e) => setForm({ ...form, discount: parseFloat(e.target.value) || 0 })}
            min="0"
            step="0.01"
          />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Percent className="size-3.5 text-muted-foreground" /> Tax Rate (%)
          </Label>
          <Input
            type="number"
            value={form.taxRate}
            onChange={(e) => setForm({ ...form, taxRate: parseFloat(e.target.value) || 0 })}
            min="0"
            max="100"
            step="0.01"
          />
        </div>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-full space-y-2 rounded-lg border border-border bg-muted/30 p-4 sm:w-80">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{usd(totals.subtotal)}</span>
          </div>
          {form.discount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount</span>
              <span className="tabular-nums">-{usd(form.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax ({form.taxRate}%)</span>
            <span className="tabular-nums">{usd(totals.taxAmount)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{usd(totals.total)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <StickyNote className="size-3.5 text-muted-foreground" /> Notes
          </Label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full min-h-[80px] resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <StickyNote className="size-3.5 text-muted-foreground" /> Internal Notes
          </Label>
          <textarea
            value={form.internalNotes}
            onChange={(e) => setForm({ ...form, internalNotes: e.target.value })}
            className="w-full min-h-[80px] resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
      </div>
    </div>
  );

  const renderLoadSelectForm = () => (
    <div className="space-y-6 pt-2">
      {/* Customer selection first */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <User className="size-3.5 text-muted-foreground" /> Customer
        </Label>
        <div className="flex gap-2">
          <Select value={form.customerId} onValueChange={(v) => handleCustomerSelect(v)}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select customer" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((customer) => (
                <SelectItem key={customer._id} value={customer._id}>
                  {customer.companyName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setShowNewCustomer(true)}>
            <Plus className="size-4 mr-1" /> New
          </Button>
        </div>
      </div>

      {/* Loads */}
      {form.customerId && (
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Truck className="size-3.5" /> Select Loads
          </div>
          <div className="border border-border rounded-lg divide-y max-h-64 overflow-auto">
            {loads
              .filter(
                (l) =>
                  l.customerId === form.customerId &&
                  ["delivered", "invoiced"].includes(l.status) === false,
              )
              .map((load) => (
                <div
                  key={load.id}
                  className={`p-3 cursor-pointer hover:bg-muted/50 ${selectedLoads.includes(load.id) ? "bg-muted" : ""}`}
                  onClick={() => handleLoadSelect(load.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{load.loadNumber}</div>
                    <div className="font-medium">{usd(load.revenue)}</div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {load.pickupCompany} → {load.deliveryCompany} • {load.commodity} •{" "}
                    {load.deliveryDate ? fmtDate(load.deliveryDate) : ""}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Rest of form */}
      {selectedLoads.length > 0 && renderManualForm()}
    </div>
  );

  // Render invoice view — takes an explicit invoice so it can be reused for both
  // the on-screen view dialog (defaults to selectedInvoice) and the print portal.
  const renderInvoiceView = (invoice: Invoice | null = selectedInvoice) => {
    if (!invoice) return null;
    return (
      <div id="invoice-print-area" className="space-y-6 p-6 text-sm">
        <div className="flex items-start justify-between border-b border-border pb-6">
          <div>
            <div className="text-2xl font-bold tracking-tight">INVOICE</div>
            <div className="mt-1 text-muted-foreground">{invoice.invoiceNumber}</div>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge value={invoice.status} />
            </div>
          </div>
          <div className="text-right">
            <div className="text-muted-foreground">
              Issued{" "}
              <span className="font-medium text-foreground">{fmtDate(invoice.invoiceDate)}</span>
            </div>
            <div className="text-muted-foreground">
              Due <span className="font-medium text-foreground">{fmtDate(invoice.dueDate)}</span>
            </div>
            {invoice.paymentTerms && (
              <div className="mt-1 text-muted-foreground">
                Terms <span className="font-medium text-foreground">{invoice.paymentTerms}</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Bill To
            </div>
            <div className="font-medium text-lg">{invoice.customerName}</div>
            {invoice.customerBillingContact && (
              <div className="text-muted-foreground">{invoice.customerBillingContact}</div>
            )}
            {invoice.customerAddress && (
              <div className="text-muted-foreground mt-1 whitespace-pre-wrap">
                {invoice.customerAddress}
              </div>
            )}
            {invoice.customerEmail && (
              <div className="text-muted-foreground">{invoice.customerEmail}</div>
            )}
            {invoice.customerPhone && (
              <div className="text-muted-foreground">{invoice.customerPhone}</div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Items
          </div>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[50%]" />
                <col className="w-[15%]" />
                <col className="w-[17%]" />
                <col className="w-[18%]" />
              </colgroup>
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Description</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Unit Price</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoice.items.map((item, i) => (
                  <tr key={i} className={i % 2 === 1 ? "bg-muted/20" : undefined}>
                    <td className="break-words px-3 py-2">{item.description}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{usd(item.unitPrice)}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {usd(item.quantity * item.unitPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end">
          <div className="w-full space-y-2 rounded-lg border border-border bg-muted/30 p-4 sm:w-80">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{usd(invoice.subtotal)}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span>
                <span className="tabular-nums">-{usd(invoice.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax ({invoice.taxRate}%)</span>
              <span className="tabular-nums">{usd(invoice.taxAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-lg font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{usd(invoice.total)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-sm">
              <span className="text-muted-foreground">Paid</span>
              <span className="tabular-nums text-green-600">{usd(invoice.amountPaid)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-red-600">
              <span>Balance Due</span>
              <span className="tabular-nums">{usd(invoice.balanceDue)}</span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div className="rounded-lg border border-border p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Notes
            </div>
            <div className="whitespace-pre-wrap text-muted-foreground">{invoice.notes}</div>
          </div>
        )}

        {/* Payments */}
        {invoice.payments.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Payments
            </div>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                    <th className="px-3 py-2 text-left font-medium">Method</th>
                    <th className="px-3 py-2 text-left font-medium">Ref #</th>
                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoice.payments.map((p) => (
                    <tr key={p._id}>
                      <td className="px-3 py-2">{fmtDate(p.paymentDate)}</td>
                      <td className="px-3 py-2">{p.paymentMethod}</td>
                      <td className="px-3 py-2">{p.referenceNumber}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-green-600">
                        {usd(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="border-t border-border pt-4 text-center text-xs text-muted-foreground">
          Thank you for your business!
        </div>
      </div>
    );
  };

  // Print a specific invoice. Renders it into a portal attached directly to
  // document.body (a real DOM sibling of the app root, not nested inside any
  // Dialog/Sheet), then hides everything else via the @media print rule below.
  // flushSync forces the portal content to commit before we call window.print(),
  // so the browser doesn't screenshot an empty/stale DOM.
  const handlePrint = (invoice: Invoice) => {
    flushSync(() => setPrintInvoice(invoice));
    window.print();
  };

  const handleDownload = () => {
    if (selectedInvoice) handlePrint(selectedInvoice);
  };

  // Opens the user's default mail client (Outlook, Apple Mail, Gmail desktop app,
  // etc. — whatever they have set as their system/browser mailto handler) with
  // the invoice details pre-filled. A mailto: link cannot attach a file, so if you
  // need the invoice attached automatically, that requires a backend email-send
  // endpoint (outside frontend-only changes) — for now the recipient can use
  // Print → Save as PDF and attach it manually.
  const handleSend = (invoice: Invoice) => {
    const subject = `Invoice ${invoice.invoiceNumber}`;
    const bodyLines = [
      invoice.customerBillingContact ? `Hi ${invoice.customerBillingContact},` : "Hi,",
      "",
      `Please find invoice ${invoice.invoiceNumber} for ${usd(invoice.total)}, due ${fmtDate(invoice.dueDate)}.`,
      invoice.balanceDue > 0
        ? `Balance due: ${usd(invoice.balanceDue)}`
        : "This invoice is paid in full.",
      "",
      "Thank you for your business.",
    ];
    const mailto = `mailto:${encodeURIComponent(invoice.customerEmail || "")}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(bodyLines.join("\n"))}`;
    window.location.href = mailto;
  };

  return (
    <div className="space-y-6 print:hidden">
      <style>{`
        @media print {
          body > *:not(#invoice-print-root) { display: none !important; }
          #invoice-print-root { display: block !important; }
          #invoice-print-root, #invoice-print-root * { visibility: visible !important; }
          @page { size: auto; margin: 0.5in; }
        }
      `}</style>

      <PageHeader
        title="Invoices"
        description="Create, manage, and track invoices"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="size-4" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => exportInvoices("csv")}>CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportInvoices("xlsx")}>XLSX</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" onClick={openCreate} className="shadow-sm">
              <Plus className="size-4 mr-2" /> New Invoice
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      {!loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{invoices.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Outstanding
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {usd(invoices.reduce((sum, i) => sum + i.balanceDue, 0))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{usd(kpis.thisMonthRevenue)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Overdue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{kpis.overdue}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            placeholder="Search invoices"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="partially_paid">Partially Paid</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card p-12 text-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading invoices…</span>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Inbox className="size-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">No invoices yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first invoice to start billing customers
            </p>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4 mr-2" /> New Invoice
          </Button>
        </div>
      ) : (
        <div className="-mx-4 overflow-x-auto rounded-xl border border-border bg-card px-4 shadow-sm sm:mx-0 sm:px-0">
          <DataTable
            rows={filteredInvoices}
            columns={[
              {
                head: "Invoice #",
                // Every non-action cell opens the view dialog on click, so the row
                // reads as "whole row clickable" without fighting DataTable internals
                // we don't control. Action buttons below stop propagation so they
                // don't also trigger this.
                cell: (inv) => (
                  <div onClick={() => openView(inv)} className="cursor-pointer font-medium">
                    {inv.invoiceNumber}
                  </div>
                ),
              },
              {
                head: "Customer",
                cell: (inv) => (
                  <div onClick={() => openView(inv)} className="cursor-pointer font-medium">
                    {inv.customerName}
                  </div>
                ),
              },
              {
                head: "Total",
                cell: (inv) => (
                  <div
                    onClick={() => openView(inv)}
                    className="cursor-pointer font-medium tabular-nums"
                  >
                    {usd(inv.total)}
                  </div>
                ),
              },
              {
                head: "Paid",
                cell: (inv) => (
                  <div
                    onClick={() => openView(inv)}
                    className="cursor-pointer text-green-600 tabular-nums"
                  >
                    {usd(inv.amountPaid)}
                  </div>
                ),
              },
              {
                head: "Balance",
                cell: (inv) => (
                  <div
                    onClick={() => openView(inv)}
                    className={`cursor-pointer tabular-nums ${inv.balanceDue > 0 ? "text-red-600 font-medium" : "text-green-600"}`}
                  >
                    {usd(inv.balanceDue)}
                  </div>
                ),
              },
              {
                head: "Status",
                cell: (inv) => (
                  <div onClick={() => openView(inv)} className="cursor-pointer">
                    <StatusBadge value={inv.status} />
                  </div>
                ),
              },
              {
                head: "Due Date",
                cell: (inv) => (
                  <div
                    onClick={() => openView(inv)}
                    className="cursor-pointer text-muted-foreground"
                  >
                    {fmtDate(inv.dueDate)}
                  </div>
                ),
              },
              {
                head: "Actions",
                cell: (inv) => (
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(inv);
                      }}
                    >
                      <Edit className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Record Payment"
                      onClick={(e) => {
                        e.stopPropagation();
                        openPayment(inv);
                      }}
                    >
                      <CreditCard className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Print"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePrint(inv);
                      }}
                    >
                      <Printer className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Send"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSend(inv);
                      }}
                    >
                      <Send className="size-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:text-red-600"
                          title="Delete"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash className="size-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Invoice?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will delete invoice {inv.invoiceNumber}. This action cannot be
                            undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(inv._id)}
                            className="bg-destructive text-destructive-foreground"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* Create Invoice Sheet */}
      <Sheet open={showCreate} onOpenChange={setShowCreate}>
        <SheetContent className="flex w-full flex-col p-0 sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="sticky top-0 z-10 border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
            <SheetTitle className="flex items-center gap-2">
              <Receipt className="size-5 text-muted-foreground" /> Create Invoice
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5">{renderForm()}</div>
          <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-border bg-background/95 px-6 py-4 backdrop-blur sm:flex-row sm:justify-end sm:gap-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" /> Saving…
                </>
              ) : (
                "Create Invoice"
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit Invoice Sheet */}
      <Sheet open={showEdit} onOpenChange={setShowEdit}>
        <SheetContent className="flex w-full flex-col p-0 sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="sticky top-0 z-10 border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
            <SheetTitle className="flex items-center gap-2">
              <Edit className="size-5 text-muted-foreground" /> Edit Invoice
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5">{renderManualForm()}</div>
          <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-border bg-background/95 px-6 py-4 backdrop-blur sm:flex-row sm:justify-end sm:gap-2">
            <Button variant="outline" onClick={() => setShowEdit(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" /> Saving…
                </>
              ) : (
                "Update Invoice"
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* View Invoice Dialog */}
      <Dialog open={showView} onOpenChange={setShowView}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b border-border flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-5" /> Invoice {selectedInvoice?.invoiceNumber}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  openEdit(selectedInvoice!);
                  setShowView(false);
                }}
              >
                <Edit className="size-4 mr-2" /> Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectedInvoice && handlePrint(selectedInvoice)}
              >
                <Printer className="size-4 mr-2" /> Print
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectedInvoice && handleSend(selectedInvoice)}
              >
                <Send className="size-4 mr-2" /> Send
              </Button>
            </div>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[75vh]">{renderInvoiceView()}</div>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="size-5" /> Record Payment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Payment Date</Label>
                <Input
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })
                  }
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select
                value={paymentForm.paymentMethod}
                onValueChange={(v) => setPaymentForm({ ...paymentForm, paymentMethod: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="ach">ACH</SelectItem>
                  <SelectItem value="wire">Wire</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reference #</Label>
              <Input
                value={paymentForm.referenceNumber}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })
                }
                placeholder="Check #, transaction ID, etc."
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <textarea
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                className="w-full min-h-[80px] resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setShowPayment(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRecordPayment}
              disabled={saving || !paymentForm.amount || !paymentForm.paymentMethod}
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" /> Saving…
                </>
              ) : (
                "Record Payment"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Customer Dialog */}
      <Dialog open={showNewCustomer} onOpenChange={setShowNewCustomer}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="size-5" /> New Customer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Company Name *</Label>
              <Input
                value={newCustomerForm.companyName}
                onChange={(e) =>
                  setNewCustomerForm({ ...newCustomerForm, companyName: e.target.value })
                }
                placeholder="Enter company name"
              />
            </div>
            <div className="space-y-2">
              <Label>Contact Name *</Label>
              <Input
                value={newCustomerForm.contactName}
                onChange={(e) =>
                  setNewCustomerForm({ ...newCustomerForm, contactName: e.target.value })
                }
                placeholder="Enter contact name"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={newCustomerForm.contactEmail}
                  onChange={(e) =>
                    setNewCustomerForm({ ...newCustomerForm, contactEmail: e.target.value })
                  }
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={newCustomerForm.contactPhone}
                  onChange={(e) =>
                    setNewCustomerForm({ ...newCustomerForm, contactPhone: e.target.value })
                  }
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setShowNewCustomer(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateCustomer}
              disabled={saving || !newCustomerForm.companyName || !newCustomerForm.contactName}
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" /> Creating…
                </>
              ) : (
                "Create Customer"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print portal — rendered as a direct child of document.body, outside any
          Dialog/Sheet, so it's never clipped by a transformed or overflow-hidden
          ancestor. The @media print rule above hides everything else on the page. */}
      {printInvoice &&
        createPortal(
          <div id="invoice-print-root">{renderInvoiceView(printInvoice)}</div>,
          document.body,
        )}
    </div>
  );
}
