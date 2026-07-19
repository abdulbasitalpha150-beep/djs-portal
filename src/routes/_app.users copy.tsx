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
import { Plus, Search, KeyRound, Trash2, Save, Edit2, Lock } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/users copy")({ component: UsersPage });

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

function UsersPage() {
  const { session } = useAuth();
  const [items, setItems] = useState<UserRow[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState<UserFormState>({
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
  });
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
        commissionPercentage: form.commissionPercentage
          ? parseFloat(form.commissionPercentage)
          : undefined,
      };
      await apiFetch("/api/users", { method: "POST", body: JSON.stringify(body) });
      toast.success("User created");
      setShowCreate(false);
      setForm({
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
      });
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
        commissionPercentage: updates.commissionPercentage
          ? parseFloat(updates.commissionPercentage)
          : undefined,
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
        commissionPercentage: form.commissionPercentage
          ? parseFloat(form.commissionPercentage)
          : undefined,
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

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        description="Manage agents, managers, and admin access."
        actions={
          canEditUsers ? (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="size-4" /> New user
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search users…"
            className="pl-8"
          />
        </div>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-52">
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
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="locked">Locked</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="pending_invitation">Pending Invitation</SelectItem>
            <SelectItem value="on_leave">On Leave</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading users...
        </div>
      ) : (
        <DataTable
          rows={items}
          columns={[
            {
              head: "Name",
              cell: (user) => (
                <div className="flex items-center gap-2">
                  <span className="font-medium">{user.name}</span>
                  {user.isTemporaryPassword && <Lock className="size-4 text-yellow-500" />}
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
                <span className="text-xs text-muted-foreground">
                  {user.lastLogin ? fmtDate(user.lastLogin) : "—"}
                </span>
              ),
            },
            {
              head: "Created",
              cell: (user) => (
                <span className="text-xs text-muted-foreground">
                  {user.createdAt ? fmtDate(user.createdAt) : "—"}
                </span>
              ),
            },
            {
              head: "Actions",
              cell: (user) =>
                canEditUsers ? (
                  <Button
                    variant="ghost"
                    size="sm"
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
      )}

      <Sheet open={!!open} onOpenChange={(value) => !value && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle>{open.name}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-6 pt-2 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Email</div>
                    {open.email}
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Role</div>
                    {ROLE_LABELS[open.role as Role]}
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Team</div>
                    {open.team ?? "—"}
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Status</div>
                    <StatusBadge value={open.status} />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Commission %</div>
                    {open.commissionPercentage ?? "—"}
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">
                      Employment Type
                    </div>
                    {open.employmentType ?? "—"}
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Phone</div>
                    {open.phone ?? "—"}
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Last login</div>
                    {open.lastLogin ? fmtDate(open.lastLogin) : "—"}
                  </div>
                </div>
                {canEditUsers && (
                  <div className="space-y-2 rounded-md border border-border p-3">
                    <Label>Role</Label>
                    <Select
                      value={open.role}
                      onValueChange={(value) => void updateUser(open.id, { role: value })}
                    >
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
                    <Select
                      value={open.status}
                      onValueChange={(value) => void updateUser(open.id, { status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="locked">Locked</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="pending_invitation">Pending Invitation</SelectItem>
                        <SelectItem value="on_leave">On Leave</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex gap-2">
                  {canEditUsers && (
                    <>
                      <Button variant="outline" onClick={() => void resetPassword(open.id)}>
                        <KeyRound className="size-4" /> Reset password
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline">
                            <Trash2 className="size-4" /> Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {open.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action removes the user record from the database.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => void remove(open.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create user</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>First name</Label>
              <Input
                value={form.firstName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, firstName: event.target.value }))
                }
              />
            </div>
            <div>
              <Label>Last name</Label>
              <Input
                value={form.lastName}
                onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))}
              />
            </div>
            <div>
              <Label>Username</Label>
              <Input
                value={form.username}
                onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(value) => setForm((prev) => ({ ...prev, role: value }))}
              >
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
            <div>
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="locked">Locked</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="pending_invitation">Pending Invitation</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Team</Label>
              <Select
                value={form.teamId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, teamId: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
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
            <div>
              <Label>Commission %</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.commissionPercentage}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, commissionPercentage: event.target.value }))
                }
                placeholder="0-100"
              />
            </div>
            <div>
              <Label>Employment Type</Label>
              <Select
                value={form.employmentType}
                onValueChange={(value) => setForm((prev) => ({ ...prev, employmentType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full-time">Full-time</SelectItem>
                  <SelectItem value="part-time">Part-time</SelectItem>
                  <SelectItem value="contractor">Contractor</SelectItem>
                  <SelectItem value="intern">Intern</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Temporary password</Label>
              <Input
                value={form.temporaryPassword}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, temporaryPassword: event.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveUser()} disabled={saving}>
              <Save className="size-4" /> {saving ? "Saving…" : "Create user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>First name</Label>
              <Input
                value={form.firstName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, firstName: event.target.value }))
                }
              />
            </div>
            <div>
              <Label>Last name</Label>
              <Input
                value={form.lastName}
                onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))}
              />
            </div>
            <div>
              <Label>Username</Label>
              <Input
                value={form.username}
                onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(value) => setForm((prev) => ({ ...prev, role: value }))}
              >
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
            <div>
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="locked">Locked</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="pending_invitation">Pending Invitation</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Team</Label>
              <Select
                value={form.teamId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, teamId: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
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
            <div>
              <Label>Commission %</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.commissionPercentage}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, commissionPercentage: event.target.value }))
                }
                placeholder="0-100"
              />
            </div>
            <div>
              <Label>Employment Type</Label>
              <Select
                value={form.employmentType}
                onValueChange={(value) => setForm((prev) => ({ ...prev, employmentType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full-time">Full-time</SelectItem>
                  <SelectItem value="part-time">Part-time</SelectItem>
                  <SelectItem value="contractor">Contractor</SelectItem>
                  <SelectItem value="intern">Intern</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Temporary password (leave blank to keep current)</Label>
              <Input
                value={form.temporaryPassword}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, temporaryPassword: event.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveEditedUser()} disabled={saving}>
              <Save className="size-4" /> {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
