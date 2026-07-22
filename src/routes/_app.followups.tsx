import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/empty-state";
import { DataTable } from "@/components/data-table";
import { relative } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api-client";
import { Plus, Search, ClipboardList, CheckCircle2, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportRowsToFile, formatExportFilename } from "@/lib/export";

export const Route = createFileRoute("/_app/followups")({
  component: FollowupsPage,
});

type FollowUpItem = {
  id: string;
  leadId: string;
  leadName?: string;
  customerId?: string;
  assignedTo: string;
  assignedToName: string;
  title: string;
  notes?: string;
  priority: "low" | "medium" | "high";
  dueDate: string;
  isCompleted: boolean;
  completedAt?: string;
  completedBy?: string;
  completedByName?: string;
};

type FollowupsApiResponse = {
  followUps: FollowUpItem[];
};

type LeadOption = {
  id: string;
  company: string;
  contact: string;
};

type LeadsApiResponse = {
  leads: LeadOption[];
};

function FollowupsPage() {
  const { session } = useAuth();
  const role = session?.role ?? "agent";

  const [items, setItems] = useState<FollowUpItem[]>([]);
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [priority, setPriority] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    leadId: "",
    title: "",
    notes: "",
    priority: "medium" as "low" | "medium" | "high",
    dueDate: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const [followUpsPayload, leadsPayload] = await Promise.all([
          apiFetch<FollowupsApiResponse>("/api/followups"),
          apiFetch<LeadsApiResponse>("/api/leads"),
        ]);
        if (!active) return;
        setItems(followUpsPayload.data.followUps);
        setLeadOptions(leadsPayload.data.leads);
      } catch (error) {
        console.error(error);
        if (active) {
          setItems([]);
          setLeadOptions([]);
          toast.error("Unable to load follow-ups");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(
    () =>
      items.filter((f) => {
        if (status !== "all" && (status === "completed" ? !f.isCompleted : f.isCompleted))
          return false;
        if (priority !== "all" && f.priority !== priority) return false;
        if (q && !`${f.title} ${f.notes}`.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [items, q, priority, status],
  );

  async function createFollowUp(event: FormEvent) {
    event.preventDefault();
    if (!form.leadId.trim() || !form.title.trim() || !form.dueDate) {
      toast.error("Lead, title, and due date are required");
      return;
    }

    setCreating(true);
    try {
      const payload = await apiFetch<{ followUp: FollowUpItem }>("/api/followups", {
        method: "POST",
        body: JSON.stringify({
          leadId: form.leadId.trim(),
          title: form.title.trim(),
          notes: form.notes.trim(),
          priority: form.priority,
          dueDate: form.dueDate,
        }),
      });

      setItems((prev) => [payload.data.followUp, ...prev]);
      setForm({
        leadId: "",
        title: "",
        notes: "",
        priority: "medium",
        dueDate: new Date().toISOString().split("T")[0],
      });
      setShowCreate(false);
      toast.success("Follow-up created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create follow-up");
    } finally {
      setCreating(false);
    }
  }

  async function toggleComplete(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    try {
      const payload = await apiFetch<{ followUp: FollowUpItem }>("/api/followups", {
        method: "PATCH",
        body: JSON.stringify({
          followUpId: id,
          isCompleted: !item.isCompleted,
        }),
      });

      setItems((prev) => prev.map((i) => (i.id === id ? payload.data.followUp : i)));
      toast.success("Follow-up updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update follow-up");
    }
  }

  async function removeFollowUp(id: string) {
    try {
      await apiFetch("/api/followups", {
        method: "DELETE",
        body: JSON.stringify({ followUpId: id }),
      });
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success("Follow-up deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete follow-up");
    }
  }

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date() && !items.find((i) => i.dueDate === dueDate)?.isCompleted;
  };

  function exportFollowUps(format: "csv" | "xlsx") {
    const rows = filtered.length > 0 ? filtered : items;
    const exported = exportRowsToFile(
      rows,
      [
        { label: "Title", getValue: (item) => item.title },
        { label: "Lead", getValue: (item) => item.leadName ?? item.leadId },
        { label: "Priority", getValue: (item) => item.priority },
        { label: "Due Date", getValue: (item) => item.dueDate },
        { label: "Assigned To", getValue: (item) => item.assignedToName },
        { label: "Status", getValue: (item) => (item.isCompleted ? "Completed" : "Pending") },
        { label: "Notes", getValue: (item) => item.notes ?? "" },
      ],
      formatExportFilename("followups", format),
      format,
      "Follow-ups",
    );

    if (exported) {
      toast.success("Follow-ups exported");
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Follow-ups"
        description="Manage your follow-up tasks and track due dates."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="size-4" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => exportFollowUps("csv")}>CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportFollowUps("xlsx")}>XLSX</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" onClick={() => setShowCreate((prev) => !prev)}>
              <Plus className="size-4" /> New follow-up
            </Button>
          </div>
        }
      />

      {showCreate && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Add a follow-up</div>
              <div className="text-xs text-muted-foreground">
                This saves the follow-up into the database.
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={createFollowUp}>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="leadId">Lead ID</Label>
              <Select
                value={form.leadId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, leadId: value }))}
              >
                <SelectTrigger id="leadId">
                  <SelectValue placeholder="Select a lead" />
                </SelectTrigger>
                <SelectContent>
                  {leadOptions.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Follow-up title"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, priority: value as "low" | "medium" | "high" }))
                }
              >
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Notes about the follow-up"
                rows={3}
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={creating}>
                {creating ? "Saving…" : "Save follow-up"}
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
            placeholder="Search follow-ups…"
            className="pl-8"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        empty={
          <EmptyState
            icon={<ClipboardList className="size-6" />}
            title="No follow-ups match your filters"
            description="Try clearing filters or create a new follow-up."
          />
        }
        rows={filtered}
        columns={[
          { head: "Title", cell: (f) => <span className="font-medium">{f.title}</span> },
          { head: "Lead", cell: (f) => <span className="text-sm">{f.leadName ?? f.leadId}</span> },
          {
            head: "Priority",
            cell: (f) => (
              <StatusBadge
                value={f.priority}
                tone={
                  f.priority === "high" ? "critical" : f.priority === "medium" ? "warning" : "info"
                }
              />
            ),
          },
          {
            head: "Due Date",
            cell: (f) => (
              <span
                className={`text-sm ${isOverdue(f.dueDate) ? "text-red-500 font-semibold" : ""}`}
              >
                {new Date(f.dueDate).toLocaleDateString()}
              </span>
            ),
          },
          { head: "Assigned To", cell: (f) => <span className="text-sm">{f.assignedToName}</span> },
          {
            head: "Status",
            cell: (f) => (
              <StatusBadge
                value={f.isCompleted ? "completed" : "pending"}
                tone={f.isCompleted ? "success" : "info"}
              />
            ),
          },
          {
            head: "Actions",
            cell: (f) => (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => toggleComplete(f.id)}>
                  <CheckCircle2 className="size-4" /> {f.isCompleted ? "Undo" : "Complete"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => removeFollowUp(f.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
