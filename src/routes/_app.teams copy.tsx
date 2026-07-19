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
import { Plus, Save, Trash2, Edit2, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/teams copy")({ component: TeamsPage });

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
          canEditTeams ? (
            <Button
              size="sm"
              onClick={() => {
                setForm({ name: "", managerId: "" });
                setShowCreate(true);
              }}
            >
              <Plus className="size-4 mr-2" /> New team
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading teams...
        </div>
      ) : (
        <DataTable
          rows={items}
          onRowClick={(team) => openTeamDetails(team)}
          columns={[
            { head: "Name", cell: (team) => <span className="font-medium">{team.name}</span> },
            {
              head: "Manager",
              cell: (team) => <span className="text-sm">{team.managerName ?? "—"}</span>,
            },
            {
              head: "Members",
              cell: (team) => <span className="text-sm">{team.totalMembers}</span>,
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
                    <Button variant="ghost" size="sm" onClick={() => startEdit(team)}>
                      <Edit2 className="size-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="size-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {team.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action will delete the team and remove all members from it.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteTeam(team.id)}>
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
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={showCreate || showEdit}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreate(false);
            setShowEdit(false);
            setEditingTeam(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{showCreate ? "Create team" : "Edit team"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Team name</Label>
              <Input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div>
              <Label>Manager</Label>
              <Select
                value={form.managerId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, managerId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  {activeUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role}
                      )
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreate(false);
                setShowEdit(false);
                setEditingTeam(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => handleSubmit()} disabled={saving}>
              <Save className="size-4 mr-2" />{" "}
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
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowConfirm(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingAction) pendingAction();
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
                    <div>{selectedTeam.managerName ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Created</div>
                    <div>{selectedTeam.createdAt ? fmtDate(selectedTeam.createdAt) : "—"}</div>
                  </div>
                </div>

                {/* Manager Details */}
                {selectedTeam.manager && (
                  <div className="space-y-2 rounded-md border border-border p-3">
                    <div className="text-[10px] uppercase text-muted-foreground mb-2">Manager</div>
                    <div className="space-y-1">
                      <div className="font-medium">{selectedTeam.manager.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {selectedTeam.manager.email}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
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
                    <div className="text-[10px] uppercase text-muted-foreground">Team Members</div>
                    <div className="text-xs text-muted-foreground">
                      <Users className="inline size-3 mr-1" />
                      {selectedTeam.totalMembers}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {selectedTeam.members.map((member) => (
                      <div key={member.id} className="rounded-md border border-border p-3">
                        <div className="font-medium">{member.name}</div>
                        <div className="text-xs text-muted-foreground">{member.email}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs">
                            {ROLE_LABELS[member.role as keyof typeof ROLE_LABELS] || member.role}
                          </span>
                          <StatusBadge value={member.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
