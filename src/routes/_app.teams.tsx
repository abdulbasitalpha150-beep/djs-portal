import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { StatusBadge } from "@/components/status-badge";
import { apiFetch } from "@/lib/api-client";
import { fmtDate } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/roles";
import { Plus, Save, Trash2, Edit2, Users, UsersRound, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportRowsToFile, formatExportFilename } from "@/lib/export";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/teams")({ component: TeamsPage });

type TeamMember = {
  id: string;
  name: string;
  role: string;
  status: string;
  email: string;
};

type Team = {
  id: string;
  name: string;
  managerId: string | null;
  managerName: string | null;
  manager: TeamMember | null;
  memberIds: string[];
  members: TeamMember[];
  memberNames: string[];
  totalMembers: number;
  createdAt: string | null;
};

type UserOption = { id: string; name: string; role: string; status: string };

type TeamFormState = {
  name: string;
  managerId: string;
};

// Role hierarchy (lower index = higher role)
const ROLE_HIERARCHY = ["owner", "admin", "ops_manager", "team_manager", "agent", "trainee"];
const TEAM_MANAGER_INDEX = ROLE_HIERARCHY.indexOf("team_manager");

const getRoleIndex = (role: string) => {
  const idx = ROLE_HIERARCHY.indexOf(role);
  return idx === -1 ? ROLE_HIERARCHY.length : idx; // Accounting, etc. go after
};

const requiresPromotion = (currentRole: string) => getRoleIndex(currentRole) > TEAM_MANAGER_INDEX;

function TeamsPage() {
  const { session } = useAuth();
  const [items, setItems] = useState<Team[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<TeamFormState>({ name: "", managerId: "" });

  const canEditTeams = session ? ["owner", "admin", "ops_manager"].includes(session.role) : false;
  const activeUsers = users.filter((u) => u.status === "active");

  const loadTeams = async () => {
    setLoading(true);
    try {
      const payload = await apiFetch<{ teams: Team[] }>("/api/teams", { method: "GET" });
      setItems(payload.data.teams ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load teams");
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const payload = await apiFetch<{
        users: Array<{ id: string; name: string; role: string; status: string }>;
      }>("/api/users", { method: "GET" });
      setUsers(payload.data.users ?? []);
    } catch {
      setUsers([]);
    }
  };

  useEffect(() => {
    loadTeams();
    loadUsers();
  }, []);

  const handleSubmit = async () => {
    const selectedUser = users.find((u) => u.id === form.managerId);

    if (selectedUser && requiresPromotion(selectedUser.role)) {
      setPendingAction(async () => {
        // First promote the user
        await apiFetch("/api/users", {
          method: "PATCH",
          body: JSON.stringify({ userId: selectedUser.id, role: "team_manager" }),
        });

        if (showCreate) {
          await apiFetch("/api/teams", { method: "POST", body: JSON.stringify(form) });
          toast.success("Team created and user promoted to Team Manager");
          setShowCreate(false);
        } else if (editingTeam) {
          await apiFetch("/api/teams", {
            method: "PATCH",
            body: JSON.stringify({ teamId: editingTeam.id, ...form }),
          });
          toast.success("Team updated and user promoted to Team Manager");
          setShowEdit(false);
          setEditingTeam(null);
        }

        setForm({ name: "", managerId: "" });
        setShowConfirm(false);
        await loadTeams();
        await loadUsers();
      });
      setShowConfirm(true);
    } else {
      await executeTeamAction(async () => {
        if (showCreate) {
          await apiFetch("/api/teams", { method: "POST", body: JSON.stringify(form) });
          toast.success("Team created");
          setShowCreate(false);
        } else if (editingTeam) {
          await apiFetch("/api/teams", {
            method: "PATCH",
            body: JSON.stringify({ teamId: editingTeam.id, ...form }),
          });
          toast.success("Team updated");
          setShowEdit(false);
          setEditingTeam(null);
        }
        setForm({ name: "", managerId: "" });
        await loadTeams();
        await loadUsers();
      });
    }
  };

  const executeTeamAction = async (action: () => Promise<void>) => {
    setSaving(true);
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setSaving(false);
    }
  };

  const deleteTeam = async (teamId: string) => {
    await executeTeamAction(async () => {
      await apiFetch("/api/teams", { method: "DELETE", body: JSON.stringify({ teamId }) });
      toast.success("Team deleted");
      await loadTeams();
    });
  };

  const startEdit = (team: Team) => {
    setEditingTeam(team);
    setForm({
      name: team.name,
      managerId: team.managerId ?? "",
    });
    setShowEdit(true);
  };

  const openTeamDetails = async (team: Team) => {
    try {
      const payload = await apiFetch<{ team: Team }>(
        `/api/teams?id=${encodeURIComponent(team.id)}`,
        { method: "GET" },
      );
      setSelectedTeam(payload.data.team);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load team details");
    }
  };

  function exportTeams(format: "csv" | "xlsx") {
    const exported = exportRowsToFile(
      items,
      [
        { label: "Name", getValue: (team) => team.name },
        { label: "Manager", getValue: (team) => team.managerName ?? "" },
        { label: "Members", getValue: (team) => team.totalMembers },
        { label: "Created", getValue: (team) => (team.createdAt ? fmtDate(team.createdAt) : "") },
      ],
      formatExportFilename("teams", format),
      format,
      "Teams",
    );

    if (exported) {
      toast.success("Teams exported");
    }
  }

  const getConfirmationMessage = () => {
    const selectedUser = users.find((u) => u.id === form.managerId);
    if (!selectedUser) return "";
    const userRoleLabel =
      ROLE_LABELS[selectedUser.role as keyof typeof ROLE_LABELS] || selectedUser.role;
    return `The selected user currently has the ${userRoleLabel} role. Managing a team requires at least the Team Manager role. Would you like to update the user's role to Team Manager and continue?`;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Teams"
        description="Coordinate managers and assigned users."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="size-4" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => exportTeams("csv")}>CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportTeams("xlsx")}>XLSX</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {canEditTeams ? (
              <Button
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => {
                  setForm({ name: "", managerId: "" });
                  setShowCreate(true);
                }}
              >
                <Plus className="size-4 mr-2" /> New team
              </Button>
            ) : undefined}
          </div>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading teams…
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <UsersRound className="size-5" />
          </span>
          <div>
            <div className="text-sm font-medium">No teams yet</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {canEditTeams
                ? "Create a team to start assigning a manager and members."
                : "Teams will appear here once they're created."}
            </p>
          </div>
          {canEditTeams && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setForm({ name: "", managerId: "" });
                setShowCreate(true);
              }}
            >
              <Plus className="size-4 mr-2" /> New team
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <DataTable
            rows={items}
            onRowClick={(team) => openTeamDetails(team)}
            columns={[
              { head: "Name", cell: (team) => <span className="font-medium">{team.name}</span> },
              {
                head: "Manager",
                cell: (team) => (
                  <span className="text-sm text-muted-foreground">
                    {team.managerName ?? "—"}
                  </span>
                ),
              },
              {
                head: "Members",
                cell: (team) => (
                  <span className="inline-flex items-center gap-1.5 text-sm">
                    <Users className="size-3.5 text-muted-foreground" />
                    {team.totalMembers}
                  </span>
                ),
              },
              {
                head: "Created",
                cell: (team) => (
                  <span className="text-xs text-muted-foreground">
                    {team.createdAt ? fmtDate(team.createdAt) : "—"}
                  </span>
                ),
              },
              {
                head: "Actions",
                cell: (team) =>
                  canEditTeams ? (
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Edit ${team.name}`}
                        onClick={() => startEdit(team)}
                      >
                        <Edit2 className="size-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" aria-label={`Delete ${team.name}`}>
                            <Trash2 className="size-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {team.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action will delete the team and remove all members from it.
                              This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                            <AlertDialogCancel className="w-full sm:w-auto">
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              className="w-full sm:w-auto"
                              onClick={() => {
                                void deleteTeam(team.id);
                              }}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ) : null,
              },
            ]}
          />
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={showCreate || showEdit}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreate(false);
            setShowEdit(false);
            setEditingTeam(null);
            setForm({ name: "", managerId: "" });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{showCreate ? "Create team" : "Edit team"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="team-name">Team name</Label>
              <Input
                id="team-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="e.g. Midwest Ops"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-manager">Manager</Label>
              <Select
                value={form.managerId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, managerId: value }))}
              >
                <SelectTrigger id="team-manager">
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  {activeUsers.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      No active users available
                    </div>
                  ) : (
                    activeUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} (
                        {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {form.managerId &&
                (() => {
                  const selectedUser = users.find((u) => u.id === form.managerId);
                  return selectedUser && requiresPromotion(selectedUser.role) ? (
                    <p className="text-xs text-warning">
                      This user will be promoted to Team Manager on save.
                    </p>
                  ) : null;
                })()}
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                setShowCreate(false);
                setShowEdit(false);
                setEditingTeam(null);
                setForm({ name: "", managerId: "" });
              }}
            >
              Cancel
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                void handleSubmit();
              }}
              disabled={saving || !form.name.trim()}
            >
              {saving ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Save className="size-4 mr-2" />
              )}
              {saving ? "Saving…" : showCreate ? "Create team" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Promotion Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Promote user to Team Manager?</AlertDialogTitle>
            <AlertDialogDescription>{getConfirmationMessage()}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <AlertDialogCancel className="w-full sm:w-auto" onClick={() => setShowConfirm(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="w-full sm:w-auto"
              onClick={() => {
                if (pendingAction) void pendingAction();
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Team Details Sheet */}
      <Sheet open={!!selectedTeam} onOpenChange={(value) => !value && setSelectedTeam(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selectedTeam && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedTeam.name}</SheetTitle>
              </SheetHeader>
              <div className="space-y-6 px-4 pb-6 pt-2 text-sm">
                {/* Team Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Manager</div>
                    <div className="mt-0.5">{selectedTeam.managerName ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Created</div>
                    <div className="mt-0.5">
                      {selectedTeam.createdAt ? fmtDate(selectedTeam.createdAt) : "—"}
                    </div>
                  </div>
                </div>

                {/* Manager Details */}
                {selectedTeam.manager && (
                  <div className="space-y-2 rounded-md border border-border p-3">
                    <div className="mb-2 text-[10px] uppercase text-muted-foreground">Manager</div>
                    <div className="space-y-1">
                      <div className="font-medium">{selectedTeam.manager.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {selectedTeam.manager.email}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs">
                          {ROLE_LABELS[selectedTeam.manager.role as keyof typeof ROLE_LABELS] ||
                            selectedTeam.manager.role}
                        </span>
                        <StatusBadge value={selectedTeam.manager.status} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Members List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] uppercase text-muted-foreground">Team members</div>
                    <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="size-3" />
                      {selectedTeam.totalMembers}
                    </div>
                  </div>
                  {selectedTeam.members.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                      No members assigned yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedTeam.members.map((member) => (
                        <div key={member.id} className="rounded-md border border-border p-3">
                          <div className="font-medium">{member.name}</div>
                          <div className="text-xs text-muted-foreground">{member.email}</div>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-xs">
                              {ROLE_LABELS[member.role as keyof typeof ROLE_LABELS] || member.role}
                            </span>
                            <StatusBadge value={member.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}