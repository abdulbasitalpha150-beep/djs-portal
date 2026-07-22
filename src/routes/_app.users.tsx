import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtDate } from "@/lib/format";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { apiFetch } from "@/lib/api-client";
import {
  Plus,
  Search,
  KeyRound,
  Trash2,
  Download,
  Save,
  Edit2,
  Lock,
  Loader2,
  UserX,
  Mail,
  Phone as PhoneIcon,
  Building2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportRowsToFile, formatExportFilename } from "@/lib/export";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/users")({ component: UsersPage });

type UserRow = {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  email: string;
  phone?: string;
  role: string;
  team: string | null;
  teamId?: string | null;
  status: string;
  lastLogin: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  accountState: string;
  commissionPercentage?: number;
  employmentType?: string;
  isTemporaryPassword?: boolean;
};

type TeamOption = { id: string; name: string };

type UserFormState = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string;
  role: string;
  teamId: string;
  status: string;
  temporaryPassword: string;
  commissionPercentage: string;
  employmentType: string;
};

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
  { value: "locked", label: "Locked" },
  { value: "pending", label: "Pending" },
  { value: "pending_invitation", label: "Pending Invitation" },
  { value: "on_leave", label: "On Leave" },
];

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "full-time", label: "Full-time" },
  { value: "part-time", label: "Part-time" },
  { value: "contractor", label: "Contractor" },
  { value: "intern", label: "Intern" },
];

const EMPTY_FORM: UserFormState = {
  firstName: "",
  lastName: "",
  username: "",
  email: "",
  phone: "",
  role: "agent",
  teamId: "",
  status: "active",
  temporaryPassword: "Welcome123!",
  commissionPercentage: "",
  employmentType: "",
};

function getInitials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const initials = parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0]?.slice(0, 2) ?? "?";
  return initials.toUpperCase();
}

function Avatar({ name, size = "size-8" }: { name?: string | null; size?: string }) {
  return (
    <div className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground`}>
      {getInitials(name)}
    </div>
  );
}

/** Shared field set for the Create and Edit dialogs, so the two forms can't drift apart. */
function UserFormFields({
  form,
  setForm,
  teams,
  mode,
}: {
  form: UserFormState;
  setForm: React.Dispatch<React.SetStateAction<UserFormState>>;
  teams: TeamOption[];
  mode: "create" | "edit";
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact info</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              value={form.firstName}
              onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName">Last name</Label>
            <Input
              id="lastName"
              value={form.lastName}
              onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={form.username}
              onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role & employment</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(value) => setForm((prev) => ({ ...prev, role: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_LABELS).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Team</Label>
            <Select value={form.teamId} onValueChange={(value) => setForm((prev) => ({ ...prev, teamId: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Employment Type</Label>
            <Select
              value={form.employmentType}
              onValueChange={(value) => setForm((prev) => ({ ...prev, employmentType: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="commissionPercentage">Commission %</Label>
            <Input
              id="commissionPercentage"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.commissionPercentage}
              onChange={(event) => setForm((prev) => ({ ...prev, commissionPercentage: event.target.value }))}
              placeholder="0-100"
              className="sm:max-w-[calc(50%-0.375rem)]"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Security</div>
        <div className="space-y-1.5">
          <Label htmlFor="temporaryPassword">
            {mode === "create" ? "Temporary password" : "Temporary password (leave blank to keep current)"}
          </Label>
          <Input
            id="temporaryPassword"
            value={form.temporaryPassword}
            onChange={(event) => setForm((prev) => ({ ...prev, temporaryPassword: event.target.value }))}
          />
        </div>
      </div>
    </div>
  );
}

function UsersPage() {
  const { session } = useAuth();
  const [items, setItems] = useState<UserRow[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const open = items.find((item) => item.id === openId) ?? null;

  const canEditUsers = session ? ["owner", "admin", "ops_manager"].includes(session.role) : false;

  const loadUsers = async () => {
    setLoading(true);
    try {
      const payload = await apiFetch<{
        users: UserRow[];
        total: number;
        page: number;
        pageSize: number;
      }>(
        "/api/users?search=" +
          encodeURIComponent(q) +
          "&role=" +
          encodeURIComponent(role === "all" ? "" : role) +
          "&status=" +
          encodeURIComponent(status === "all" ? "" : status),
        { method: "GET" },
      );
      setItems(payload.data.users ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  // Debounce the raw search input before it drives the API call, so typing
  // doesn't fire a request on every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => setQ(searchTerm), 350);
    return () => clearTimeout(handle);
  }, [searchTerm]);

  useEffect(() => {
    void loadUsers();
  }, [q, role, status]);

  useEffect(() => {
    async function loadTeams() {
      try {
        const payload = await apiFetch<{ teams: TeamOption[] }>("/api/teams", { method: "GET" });
        setTeams(payload.data.teams ?? []);
      } catch {
        setTeams([]);
      }
    }
    void loadTeams();
  }, []);

  async function saveUser() {
    setSaving(true);
    try {
      const body = {
        ...form,
        commissionPercentage: form.commissionPercentage ? parseFloat(form.commissionPercentage) : undefined,
      };
      await apiFetch("/api/users", { method: "POST", body: JSON.stringify(body) });
      toast.success("User created");
      setShowCreate(false);
      setForm(EMPTY_FORM);
      await loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create user");
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(userId: string, updates: Partial<UserFormState>) {
    setSaving(true);
    try {
      const body = {
        ...updates,
        commissionPercentage: updates.commissionPercentage ? parseFloat(updates.commissionPercentage) : undefined,
      };
      await apiFetch("/api/users", { method: "PATCH", body: JSON.stringify({ userId, ...body }) });
      toast.success("User updated");
      await loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update user");
    } finally {
      setSaving(false);
    }
  }

  async function saveEditedUser() {
    if (!editingUser) return;
    setSaving(true);
    try {
      const body = {
        ...form,
        commissionPercentage: form.commissionPercentage ? parseFloat(form.commissionPercentage) : undefined,
      };
      await apiFetch("/api/users", {
        method: "PATCH",
        body: JSON.stringify({ userId: editingUser.id, ...body }),
      });
      toast.success("User updated");
      setShowEdit(false);
      setEditingUser(null);
      await loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update user");
    } finally {
      setSaving(false);
    }
  }

  const startEdit = (user: UserRow) => {
    setEditingUser(user);
    setForm({
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      username: user.username ?? "",
      email: user.email,
      phone: user.phone ?? "",
      role: user.role,
      teamId: user.teamId ?? "",
      status: user.status,
      temporaryPassword: "",
      commissionPercentage: user.commissionPercentage?.toString() ?? "",
      employmentType: user.employmentType ?? "",
    });
    setShowEdit(true);
  };

  async function remove(id: string) {
    setSaving(true);
    try {
      await apiFetch("/api/users", { method: "DELETE", body: JSON.stringify({ userId: id }) });
      toast.success("User deleted");
      setOpenId(null);
      await loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete user");
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(id: string) {
    try {
      await apiFetch("/api/users", {
        method: "PATCH",
        body: JSON.stringify({ userId: id, temporaryPassword: "Welcome123!" }),
      });
      toast.success("Password reset");
      await loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Password reset failed");
    }
  }

  function exportUsers(format: "csv" | "xlsx") {
    const rows = items.length > 0 ? items : [];
    const exported = exportRowsToFile(
      rows,
      [
        { label: "Name", getValue: (user) => user.name },
        { label: "Email", getValue: (user) => user.email },
        { label: "Role", getValue: (user) => user.role },
        { label: "Commission %", getValue: (user) => user.commissionPercentage ?? "" },
        { label: "Employment Type", getValue: (user) => user.employmentType ?? "" },
        { label: "Team", getValue: (user) => user.team ?? "" },
        { label: "Status", getValue: (user) => user.status },
        { label: "Last Login", getValue: (user) => (user.lastLogin ? fmtDate(user.lastLogin) : "") },
      ],
      formatExportFilename("users", format),
      format,
      "Users",
    );

    if (exported) {
      toast.success("Users exported");
    }
  }

  const hasActiveFilters = q !== "" || role !== "all" || status !== "all";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        description="Manage agents, managers, and admin access."
        actions={
          canEditUsers ? (
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="size-4" /> Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => exportUsers("csv")}>CSV</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportUsers("xlsx")}>XLSX</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" className="w-full sm:w-auto" onClick={() => setShowCreate(true)}>
                <Plus className="size-4" /> New user
              </Button>
            </div>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="size-4" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => exportUsers("csv")}>CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportUsers("xlsx")}>XLSX</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search users…"
            className="pl-8"
          />
        </div>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {Object.entries(ROLE_LABELS).map(([key, value]) => (
              <SelectItem key={key} value={key}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!loading && items.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {items.length} {items.length === 1 ? "user" : "users"}
        </p>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <div className="size-8 shrink-0 animate-pulse rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/4 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/6 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <UserX className="size-5" />
          </span>
          <div>
            <div className="text-sm font-medium">No users found</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {hasActiveFilters
                ? "Try adjusting your search or filters."
                : canEditUsers
                  ? "Create your first user to get started."
                  : "Users will appear here once they're added."}
            </p>
          </div>
          {hasActiveFilters ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSearchTerm("");
                setRole("all");
                setStatus("all");
              }}
            >
              Clear filters
            </Button>
          ) : (
            canEditUsers && (
              <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
                <Plus className="size-4 mr-2" /> New user
              </Button>
            )
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <DataTable
            rows={items}
            onRowClick={(user) => setOpenId(user.id)}
            columns={[
              {
                head: "Name",
                cell: (user) => (
                  <div className="flex items-center gap-2.5">
                    <Avatar name={user.name} size="size-7" />
                    <span className="font-medium">{user.name}</span>
                    {user.isTemporaryPassword && (
                      <Lock className="size-3.5 text-warning" aria-label="Temporary password" />
                    )}
                  </div>
                ),
              },
              {
                head: "Email",
                cell: (user) => <span className="text-xs text-muted-foreground">{user.email}</span>,
              },
              {
                head: "Role",
                cell: (user) => <span className="text-sm">{ROLE_LABELS[user.role as Role]}</span>,
              },
              {
                head: "Commission %",
                cell: (user) => <span className="text-sm">{user.commissionPercentage ?? "—"}</span>,
              },
              {
                head: "Employment Type",
                cell: (user) => <span className="text-sm">{user.employmentType ?? "—"}</span>,
              },
              { head: "Team", cell: (user) => <span className="text-sm">{user.team ?? "—"}</span> },
              { head: "Status", cell: (user) => <StatusBadge value={user.status} /> },
              {
                head: "Last login",
                cell: (user) => (
                  <span className="text-xs text-muted-foreground">{user.lastLogin ? fmtDate(user.lastLogin) : "—"}</span>
                ),
              },
              {
                head: "Created",
                cell: (user) => (
                  <span className="text-xs text-muted-foreground">{user.createdAt ? fmtDate(user.createdAt) : "—"}</span>
                ),
              },
              {
                head: "Actions",
                cell: (user) =>
                  canEditUsers ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Edit ${user.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(user);
                      }}
                    >
                      <Edit2 className="size-4" />
                    </Button>
                  ) : null,
              },
            ]}
          />
        </div>
      )}

      <Sheet open={!!open} onOpenChange={(value) => !value && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {open && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <Avatar name={open.name} size="size-11" />
                  <div className="min-w-0">
                    <SheetTitle className="truncate">{open.name}</SheetTitle>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {ROLE_LABELS[open.role as Role]}
                      </span>
                      <StatusBadge value={open.status} />
                    </div>
                  </div>
                </div>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-6 pt-2 text-sm">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Email</div>
                    <div className="mt-0.5 flex items-center gap-1.5 break-all">
                      <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                      {open.email}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Phone</div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <PhoneIcon className="size-3.5 shrink-0 text-muted-foreground" />
                      {open.phone ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Team</div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                      {open.team ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Last login</div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <Clock className="size-3.5 shrink-0 text-muted-foreground" />
                      {open.lastLogin ? fmtDate(open.lastLogin) : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Commission %</div>
                    <div className="mt-0.5">{open.commissionPercentage ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Employment Type</div>
                    <div className="mt-0.5">{open.employmentType ?? "—"}</div>
                  </div>
                </div>
                {canEditUsers && (
                  <div className="space-y-2 rounded-md border border-border p-3">
                    <Label>Role</Label>
                    <Select value={open.role} onValueChange={(value) => void updateUser(open.id, { role: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ROLE_LABELS).map(([key, value]) => (
                          <SelectItem key={key} value={key}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Label>Status</Label>
                    <Select value={open.status} onValueChange={(value) => void updateUser(open.id, { status: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {canEditUsers && (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button variant="outline" className="w-full sm:w-auto" onClick={() => void resetPassword(open.id)}>
                      <KeyRound className="size-4" /> Reset password
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="w-full text-destructive hover:sm:w-auto sm:w-auto">
                          <Trash2 className="size-4" /> Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {open.name}?</AlertDialogTitle>
                          <AlertDialogDescription>This action removes the user record from the database.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                          <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
                            onClick={() => void remove(open.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create user</DialogTitle>
          </DialogHeader>
          <UserFormFields form={form} setForm={setForm} teams={teams} mode="create" />
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button className="w-full sm:w-auto" onClick={() => void saveUser()} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} {saving ? "Saving…" : "Create user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
          </DialogHeader>
          <UserFormFields form={form} setForm={setForm} teams={teams} mode="edit" />
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setShowEdit(false)}>
              Cancel
            </Button>
            <Button className="w-full sm:w-auto" onClick={() => void saveEditedUser()} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}