import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmtDate, fmtDateTime } from "@/lib/format";
import {
  Clock,
  Play,
  Square,
  Phone,
  MessageSquareText,
  StickyNote,
  CalendarClock,
  History as HistoryIcon,
  Plus,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/activity")({ component: ActivityPage });

type DailySessionRow = {
  checkedInAt?: string;
  checkedOutAt?: string;
  clockStatus?: "checked_in" | "checked_out";
  endReason?: string;
  calls?: number;
  followups?: number;
  notes?: string;
};

type DailyLogRow = {
  id: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  date: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  calls: number;
  followups: number;
  notes: string;
  clockStatus?: "checked_in" | "checked_out";
  endReason?: string;
  sessions?: DailySessionRow[];
};

function ActivityPage() {
  const { session, clockedIn, setClockedIn } = useAuth();
  const [checkedInAt, setCheckedInAt] = useState<string | null>(null);
  const [checkedOutAt, setCheckedOutAt] = useState<string | null>(null);
  const [callsInput, setCallsInput] = useState("0");
  const [followupsInput, setFollowupsInput] = useState("0");
  const [notes, setNotes] = useState("");
  const [history, setHistory] = useState<DailyLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkinModalOpen, setCheckinModalOpen] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  // Which history days are expanded to show full per-session detail. Collapsed
  // by default so a long history doesn't dump every session for every day at once.
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const hasHydratedFromServerRef = useRef(false);
  const hasUserEditedRef = useRef(false);
  const isCheckedIn = Boolean(checkedInAt) || clockedIn;
  const canSeeTeammateNames = Boolean(
    session?.role && ["admin", "ops_manager", "team_manager"].includes(session.role),
  );
  const parsedCalls = Number(callsInput) || 0;
  const parsedFollowups = Number(followupsInput) || 0;
  const hasMissingCheckoutInfo = parsedCalls <= 0 || parsedFollowups <= 0 || !notes.trim();

  useEffect(() => {
    if (!isCheckedIn) {
      setElapsedSeconds(0);
      return;
    }

    const startTime = checkedInAt ? new Date(checkedInAt).getTime() : Date.now();
    const updateElapsed = () => {
      const now = Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((now - startTime) / 1000)));
    };

    updateElapsed();
    const intervalId = window.setInterval(updateElapsed, 1000);

    return () => window.clearInterval(intervalId);
  }, [checkedInAt, isCheckedIn]);

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      try {
        const payload = await apiFetch<{ logs: DailyLogRow[] }>("/api/activity/logs", {
          method: "GET",
        });
        if (!active) return;

        setHistory(payload.data.logs);
        const today = new Date().toISOString().slice(0, 10);
        const currentLog =
          payload.data.logs.find((log) => log.date === today) ?? payload.data.logs[0];
        const activeSession = currentLog?.sessions
          ?.slice()
          .reverse()
          .find((session) => session.clockStatus === "checked_in");

        if (!hasHydratedFromServerRef.current || !hasUserEditedRef.current) {
          if (currentLog?.clockStatus === "checked_in") {
            setCheckedInAt(currentLog.checkedInAt ?? null);
            setCheckedOutAt(null);
            setCallsInput(String(activeSession?.calls ?? currentLog.calls ?? 0));
            setFollowupsInput(String(activeSession?.followups ?? currentLog.followups ?? 0));
            setNotes(activeSession?.notes ?? currentLog.notes ?? "");
            setClockedIn(true);
          } else {
            setCheckedInAt(null);
            setCheckedOutAt(currentLog?.checkedOutAt ?? null);
            setCallsInput(String(currentLog?.calls ?? 0));
            setFollowupsInput(String(currentLog?.followups ?? 0));
            setNotes(currentLog?.notes ?? "");
            setClockedIn(false);
          }
        }

        hasHydratedFromServerRef.current = true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load activity history.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadHistory();
    return () => {
      active = false;
    };
  }, [session?.id]);

  async function saveLog() {
    try {
      const payload = await apiFetch<{ log: DailyLogRow }>("/api/activity/log", {
        method: "POST",
        body: JSON.stringify({
          checkedInAt: checkedInAt ?? undefined,
          checkedOutAt: checkedOutAt ?? undefined,
          calls: parsedCalls,
          followups: parsedFollowups,
          notes,
          date: new Date().toISOString().slice(0, 10),
        }),
      });
      hasUserEditedRef.current = true;
      setHistory((prev) => [
        payload.data.log,
        ...prev.filter((item) => item.date !== payload.data.log.date),
      ]);
      toast.success("Daily log saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save daily log.");
    }
  }

  function handleClockIn() {
    setCheckinModalOpen(true);
  }

  async function confirmCheckIn() {
    try {
      const payload = await apiFetch<{ log: DailyLogRow; clockedIn: boolean }>(
        "/api/activity/clock-in",
        { method: "POST" },
      );
      setCheckedInAt(payload.data.log.checkedInAt ?? null);
      setCheckedOutAt(null);
      setCallsInput("0");
      setFollowupsInput("0");
      setNotes("");
      setClockedIn(true);
      hasHydratedFromServerRef.current = true;
      hasUserEditedRef.current = false;
      setHistory((prev) => [
        payload.data.log,
        ...prev.filter((item) => item.date !== payload.data.log.date),
      ]);
      setCheckinModalOpen(false);
      toast.success("Checked in");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to check in.");
    }
  }

  async function handleClockOut() {
    setCheckoutModalOpen(true);
  }

  async function confirmCheckout() {
    try {
      const payload = await apiFetch<{ log: DailyLogRow; clockedIn: boolean }>(
        "/api/activity/clock-out",
        {
          method: "POST",
          body: JSON.stringify({
            reason: "manual",
            calls: parsedCalls,
            followups: parsedFollowups,
            notes,
            date: new Date().toISOString().slice(0, 10),
          }),
        },
      );
      setCheckedInAt(null);
      setCheckedOutAt(payload.data.log.checkedOutAt ?? null);
      setClockedIn(false);
      hasHydratedFromServerRef.current = true;
      hasUserEditedRef.current = false;
      setHistory((prev) => [
        payload.data.log,
        ...prev.filter((item) => item.date !== payload.data.log.date),
      ]);
      setCheckoutModalOpen(false);
      toast.success("Checked out");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to check out.");
    }
  }

  function toggleDay(id: string) {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function formatElapsedTime(totalSeconds: number) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds]
      .map((value) => String(value).padStart(2, "0"))
      .join(":");
  }

  return (
    <div className="space-y-6">
      <Dialog open={checkinModalOpen} onOpenChange={setCheckinModalOpen}>
        <DialogContent className="sm:max-w-md border-border/70 bg-background/95 shadow-2xl">
          <DialogHeader className="space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Clock className="size-6" />
            </div>
            <DialogTitle className="text-xl font-semibold">Start a fresh session?</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-muted-foreground">
              You&apos;re about to begin a new check-in session with a clean slate for calls,
              follow-ups, and notes.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-border/70 bg-card/70 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Today</span>
              <span className="font-medium text-foreground">{fmtDate(new Date())}</span>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              Your previous session will be closed and a new one will start from zero.
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setCheckinModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => { void confirmCheckIn(); }}>
              Start session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={checkoutModalOpen} onOpenChange={setCheckoutModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>End this session?</DialogTitle>
            <DialogDescription>
              You&apos;re about to end this session. Here&apos;s what you&apos;ve logged:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div
              className={`rounded-lg border p-3 ${parsedCalls <= 0 ? "border-warning/40 bg-warning/10" : "border-border"}`}
            >
              <div className="text-sm font-medium">Calls: {parsedCalls}</div>
              {parsedCalls <= 0 ? (
                <p className="mt-1 text-xs text-warning">You have not added any calls yet.</p>
              ) : null}
            </div>
            <div
              className={`rounded-lg border p-3 ${parsedFollowups <= 0 ? "border-warning/40 bg-warning/10" : "border-border"}`}
            >
              <div className="text-sm font-medium">Follow-ups: {parsedFollowups}</div>
              {parsedFollowups <= 0 ? (
                <p className="mt-1 text-xs text-warning">You have not added any follow-ups yet.</p>
              ) : null}
            </div>
            <div
              className={`rounded-lg border p-3 ${!notes.trim() ? "border-warning/40 bg-warning/10" : "border-border"}`}
            >
              <div className="text-sm font-medium">Notes</div>
              <p className="mt-1 text-sm text-muted-foreground">{notes.trim() ? notes : "None"}</p>
              {!notes.trim() ? (
                <p className="mt-1 text-xs text-warning">You have not added any notes yet.</p>
              ) : null}
            </div>

            <p className="text-sm text-muted-foreground">
              Would you like to make any changes before ending this session?
            </p>
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => setCheckoutModalOpen(false)} className="w-full sm:w-auto">
              Continue Editing
            </Button>
            <Button
              onClick={() => {
                setCheckoutModalOpen(false);
                void confirmCheckout();
              }}
              className="w-full sm:w-auto"
            >
              Check Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PageHeader
        title="Daily Activity"
        description="Check in, log your calls and follow-ups, and review past days."
      />

      {/* ---------- Check-in / Today's log ---------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Check-in card */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="size-4 text-muted-foreground" />
              Check-in status
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                isCheckedIn ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
              }`}
            >
              <span className={`size-1.5 rounded-full ${isCheckedIn ? "animate-pulse bg-success" : "bg-muted-foreground/50"}`} />
              {isCheckedIn ? "Checked in" : "Checked out"}
            </span>
          </div>

          {isCheckedIn ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Session started</div>
                <div className="mt-0.5 text-sm font-medium">{checkedInAt ? fmtDateTime(checkedInAt) : "Active session"}</div>
              </div>
            <div className="relative overflow-hidden rounded-2xl border bg-card p-5">
  <div className="absolute inset-x-0 top-0 h-1 bg-primary" />

  <div className="flex items-center justify-between">
    <div>
      <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Time Worked
      </span>

      <div className="mt-3 text-4xl font-bold font-mono">
        {formatElapsedTime(elapsedSeconds)}
      </div>

      <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-600">
        <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        Live Tracking
      </div>
    </div>

    <div className="rounded-2xl bg-primary/10 p-4">
      <Clock className="h-8 w-8 text-primary" />
    </div>
  </div>
</div>

              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  void handleClockOut();
                }}
              >
                <Square className="size-4" /> Check out
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {checkedOutAt
                  ? `You checked out at ${fmtDateTime(checkedOutAt)}. Check in when you're ready to start again.`
                  : "You're not checked in yet. Start your session to begin tracking today."}
              </p>
              <Button
                className="w-full sm:w-auto"
                onClick={() => {
                  void handleClockIn();
                }}
              >
                <Play className="size-4" /> Check in
              </Button>
            </div>
          )}
        </section>

        {/* Today's log card */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <StickyNote className="size-4 text-muted-foreground" />
            Today's log
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Phone className="size-3" /> Calls
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={callsInput}
                  onChange={(e) => {
                    hasUserEditedRef.current = true;
                    setCallsInput(e.target.value.replace(/\D/g, ""));
                  }}
                  inputMode="numeric"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => setCallsInput(String(parsedCalls + 1))}
                >
                  <Plus className="mr-1 size-3" /> +1
                </Button>
              </div>
              <div>
                <Label className="mb-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <MessageSquareText className="size-3" /> Follow-ups
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={followupsInput}
                  onChange={(e) => {
                    hasUserEditedRef.current = true;
                    setFollowupsInput(e.target.value.replace(/\D/g, ""));
                  }}
                  inputMode="numeric"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => setFollowupsInput(String(parsedFollowups + 1))}
                >
                  <Plus className="mr-1 size-3" /> +1
                </Button>
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => {
                  hasUserEditedRef.current = true;
                  setNotes(e.target.value);
                }}
                rows={3}
                placeholder="Anything worth remembering about today…"
              />
            </div>

            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                void saveLog();
              }}
            >
              Save log
            </Button>
          </div>
        </section>
      </div>

      {/* ---------- History ---------- */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <HistoryIcon className="size-4 text-muted-foreground" />
            History
          </div>
          {!loading && history.length > 0 && (
            <span className="text-xs text-muted-foreground">{history.length} {history.length === 1 ? "day" : "days"}</span>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-muted/40" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <CalendarClock className="size-6 text-muted-foreground" />
            <div className="text-sm font-medium">No activity logs yet</div>
            <p className="max-w-xs text-xs text-muted-foreground">
              Check in and save a daily log to start building your activity history.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {history.map((l) => {
              const sessions =
                l.sessions && l.sessions.length > 0
                  ? l.sessions
                  : [
                      {
                        checkedInAt: l.checkedInAt,
                        checkedOutAt: l.checkedOutAt,
                        clockStatus: l.clockStatus,
                        calls: l.calls ?? 0,
                        followups: l.followups ?? 0,
                        notes: l.notes ?? "",
                      },
                    ];
              const isExpanded = expandedDays.has(l.id);

              return (
                <li key={l.id} className="rounded-xl border border-border bg-card shadow-sm">
                  {/* Compact summary row — click to expand full session detail */}
                  <button
                    type="button"
                    onClick={() => toggleDay(l.id)}
                    className="flex w-full flex-col gap-2 p-4 text-left sm:flex-row sm:items-center sm:gap-4"
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? (
                      <ChevronDown className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
                    ) : (
                      <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
                    )}

                    <div className="flex min-w-[7rem] shrink-0 items-center gap-2 sm:flex-col sm:items-start sm:gap-1">
                      <span className="text-sm font-semibold">{fmtDate(l.date)}</span>
                      {l.userName && canSeeTeammateNames ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{l.userName}</span>
                      ) : null}
                    </div>

                    <div className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        <span className="font-semibold text-foreground">{l.calls}</span> calls
                      </span>
                      <span>
                        <span className="font-semibold text-foreground">{l.followups}</span> follow-ups
                      </span>
                      <span>
                        {sessions.length} {sessions.length === 1 ? "session" : "sessions"}
                      </span>
                      {l.notes && <span className="hidden truncate sm:inline">"{l.notes}"</span>}
                    </div>

                    <span className="text-xs font-medium text-muted-foreground sm:hidden">
                      {isExpanded ? "Hide detail" : "Show detail"}
                    </span>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-border p-4 pt-3">
                      <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">Sessions</div>
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {sessions.map((sessionItem, index) => (
                          <div
                            key={`${l.id}-${index}`}
                            className="rounded-lg border border-border/70 bg-background/60 p-2.5 text-xs"
                          >
                            <div className="mb-1 font-medium text-foreground">Session {index + 1}</div>
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>In</span>
                              <span className="text-foreground">{sessionItem.checkedInAt ? fmtDateTime(sessionItem.checkedInAt) : "—"}</span>
                            </div>
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>Out</span>
                              <span className="text-foreground">{sessionItem.checkedOutAt ? fmtDateTime(sessionItem.checkedOutAt) : "—"}</span>
                            </div>
                            <div className="mt-2 space-y-1 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                              <div className="flex items-center justify-between">
                                <span>Calls</span>
                                <span className="text-foreground">{sessionItem.calls ?? 0}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>Follow-ups</span>
                                <span className="text-foreground">{sessionItem.followups ?? 0}</span>
                              </div>
                              {sessionItem.notes ? (
                                <div className="pt-1 text-[10px] text-muted-foreground">{sessionItem.notes}</div>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>

                      {l.notes && (
                        <div className="mt-3">
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Day notes</div>
                          <p className="mt-1 text-xs text-muted-foreground">{l.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}