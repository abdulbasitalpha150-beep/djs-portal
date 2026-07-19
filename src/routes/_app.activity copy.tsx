// import { createFileRoute } from "@tanstack/react-router";
// import { useEffect, useState } from "react";
// import { PageHeader } from "@/components/page-header";
// import { Button } from "@/components/ui/button";
// import { Textarea } from "@/components/ui/textarea";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { fmtDate, fmtDateTime } from "@/lib/format";
// import { Clock, Play, Square } from "lucide-react";
// import { toast } from "sonner";
// import { apiFetch } from "@/lib/api-client";
// import { useAuth } from "@/lib/auth-context";

// export const Route = createFileRoute("/_app/activity")({ component: ActivityPage });

// type DailySessionRow = {
//   checkedInAt?: string;
//   checkedOutAt?: string;
//   clockStatus?: "checked_in" | "checked_out";
//   endReason?: string;
// };

// type DailyLogRow = {
//   id: string;
//   userId?: string;
//   userName?: string;
//   userEmail?: string;
//   date: string;
//   checkedInAt?: string;
//   checkedOutAt?: string;
//   calls: number;
//   followups: number;
//   notes: string;
//   clockStatus?: "checked_in" | "checked_out";
//   endReason?: string;
//   sessions?: DailySessionRow[];
// };

// function ActivityPage() {
//   const { session, clockedIn, setClockedIn } = useAuth();
//   const [checkedInAt, setCheckedInAt] = useState<string | null>(null);
//   const [checkedOutAt, setCheckedOutAt] = useState<string | null>(null);
//   const [calls, setCalls] = useState(0);
//   const [followups, setFollowups] = useState(0);
//   const [notes, setNotes] = useState("");
//   const [history, setHistory] = useState<DailyLogRow[]>([]);
//   const [loading, setLoading] = useState(true);
//   const isCheckedIn = Boolean(checkedInAt) || clockedIn;

//   useEffect(() => {
//     async function loadHistory() {
//       try {
//         const payload = await apiFetch<{ logs: DailyLogRow[] }>('/api/activity/logs', { method: 'GET' });
//         setHistory(payload.data.logs);
//         const today = new Date().toISOString().slice(0, 10);
//         const currentLog = payload.data.logs.find((log) => log.date === today) ?? payload.data.logs[0];

//         if (currentLog?.clockStatus === "checked_in") {
//           setCheckedInAt(currentLog.checkedInAt ?? null);
//           setCheckedOutAt(null);
//           setClockedIn(true);
//         } else {
//           setCheckedInAt(null);
//           setCheckedOutAt(currentLog?.checkedOutAt ?? null);
//           setClockedIn(false);
//         }
//       } catch (error) {
//         toast.error(error instanceof Error ? error.message : 'Failed to load activity history.');
//       } finally {
//         setLoading(false);
//       }
//     }

//     void loadHistory();
//   }, [setClockedIn]);

//   async function saveLog() {
//     try {
//       const payload = await apiFetch<{ log: DailyLogRow }>('/api/activity/log', {
//         method: 'POST',
//         body: JSON.stringify({
//           checkedInAt: checkedInAt ?? undefined,
//           checkedOutAt: checkedOutAt ?? undefined,
//           calls,
//           followups,
//           notes,
//           date: new Date().toISOString().slice(0, 10),
//         }),
//       });
//       setHistory((prev) => [payload.data.log, ...prev.filter((item) => item.date !== payload.data.log.date)]);
//       toast.success('Daily log saved');
//     } catch (error) {
//       toast.error(error instanceof Error ? error.message : 'Failed to save daily log.');
//     }
//   }

//   async function handleClockIn() {
//     try {
//       const payload = await apiFetch<{ log: DailyLogRow; clockedIn: boolean }>('/api/activity/clock-in', { method: 'POST' });
//       setCheckedInAt(payload.data.log.checkedInAt ?? null);
//       setCheckedOutAt(null);
//       setClockedIn(true);
//       setHistory((prev) => [payload.data.log, ...prev.filter((item) => item.date !== payload.data.log.date)]);
//       toast.success('Checked in');
//     } catch (error) {
//       toast.error(error instanceof Error ? error.message : 'Failed to check in.');
//     }
//   }

//   async function handleClockOut() {
//     try {
//       const payload = await apiFetch<{ log: DailyLogRow; clockedIn: boolean }>('/api/activity/clock-out', {
//         method: 'POST',
//         body: JSON.stringify({ reason: 'manual' }),
//       });
//       setCheckedInAt(null);
//       setCheckedOutAt(payload.data.log.checkedOutAt ?? null);
//       setClockedIn(false);
//       setHistory((prev) => [payload.data.log, ...prev.filter((item) => item.date !== payload.data.log.date)]);
//       toast.success('Checked out');
//     } catch (error) {
//       toast.error(error instanceof Error ? error.message : 'Failed to check out.');
//     }
//   }

//   return (
//     <div className="space-y-5">
//       <PageHeader title="Daily Activity" description="Check in, log your calls and follow-ups, and review past days." />

//       <div className="grid gap-3 md:grid-cols-2">
//         <div className="rounded-lg border border-border bg-card p-4">
//           <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Clock className="size-4" /> Check-in</div>
//           {isCheckedIn ? (
//             <div className="space-y-2">
//               <div className="text-sm">Checked in at <span>{checkedInAt ? fmtDateTime(checkedInAt) : 'active session'}</span></div>
//               <Button variant="outline" onClick={() => { void handleClockOut(); }}><Square className="size-4" /> Check out</Button>
//             </div>
//           ) : (
//             <Button onClick={() => { void handleClockIn(); }}><Play className="size-4" /> Check in</Button>
//           )}
//         </div>
//         <div className="rounded-lg border border-border bg-card p-4 space-y-3">
//           <div className="text-sm font-semibold">Today's log</div>
//           <div className="grid grid-cols-2 gap-2">
//             <div><Label className="text-xs">Calls</Label><Input type="number" value={calls} onChange={(e) => setCalls(+e.target.value)} /></div>
//             <div><Label className="text-xs">Follow-ups</Label><Input type="number" value={followups} onChange={(e) => setFollowups(+e.target.value)} /></div>
//           </div>
//           <div><Label className="text-xs">Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></div>
//           <Button onClick={() => { void saveLog(); }}>Save log</Button>
//         </div>
//       </div>

//       <div>
//         <h2 className="mb-2 text-sm font-semibold">History</h2>
//         {loading ? (
//           <div className="rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">Loading activity history…</div>
//         ) : history.length === 0 ? (
//           <div className="rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">No activity logs yet.</div>
//         ) : (
//           <ul className="space-y-2">
//             {history.map((l) => (
//               <li key={l.id} className="rounded-md border border-border bg-card p-3 text-sm">
//                 <div className="grid gap-2 md:grid-cols-[1.2fr_1.5fr_0.6fr_0.6fr_1fr]">
//                   <div>
//                     <div className="text-[10px] uppercase text-muted-foreground">Date</div>
//                     <div>{fmtDate(l.date)}</div>
//                     {l.userName && session?.role && ["admin", "ops_manager", "team_manager"].includes(session.role) ? (
//                       <div className="mt-1 text-xs text-muted-foreground">{l.userName}</div>
//                     ) : null}
//                   </div>
//                   <div>
//                     <div className="text-[10px] uppercase text-muted-foreground">Sessions</div>
//                     <div className="space-y-2 text-xs">
//                       {(l.sessions && l.sessions.length > 0 ? l.sessions : [{ checkedInAt: l.checkedInAt, checkedOutAt: l.checkedOutAt, clockStatus: l.clockStatus }]).map((sessionItem, index) => (
//                         <div key={`${l.id}-${index}`} className="rounded border border-border/70 bg-background/50 p-2">
//                           <div className="font-medium">Session {index + 1}</div>
//                           <div>In: {sessionItem.checkedInAt ? fmtDateTime(sessionItem.checkedInAt) : "—"}</div>
//                           <div>Out: {sessionItem.checkedOutAt ? fmtDateTime(sessionItem.checkedOutAt) : "—"}</div>
//                         </div>
//                       ))}
//                     </div>
//                   </div>
//                   <div><div className="text-[10px] uppercase text-muted-foreground">Calls</div>{l.calls}</div>
//                   <div><div className="text-[10px] uppercase text-muted-foreground">Follow-ups</div>{l.followups}</div>
//                   <div><div className="text-[10px] uppercase text-muted-foreground">Notes</div><span className="text-xs">{l.notes || "—"}</span></div>
//                 </div>
//               </li>
//             ))}
//           </ul>
//         )}
//       </div>
//     </div>
//   );
// }

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

export const Route = createFileRoute("/_app/activity copy")({ component: ActivityPage });

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
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
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

  async function handleClockIn() {
    const shouldStartNewSession = window.confirm(
      "Start a new session? Add fresh calls, follow-ups, and notes for this session.",
    );
    if (!shouldStartNewSession) {
      return;
    }

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
      toast.success("Checked out");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to check out.");
    }
  }

  return (
    <div className="space-y-6">
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
              className={`rounded-lg border p-3 ${parsedCalls <= 0 ? "border-amber-400 bg-amber-50/80 dark:bg-amber-950/20" : "border-border"}`}
            >
              <div className="text-sm font-medium">Calls: {parsedCalls}</div>
              {parsedCalls <= 0 ? (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  You have not added any calls yet.
                </p>
              ) : null}
            </div>
            <div
              className={`rounded-lg border p-3 ${parsedFollowups <= 0 ? "border-amber-400 bg-amber-50/80 dark:bg-amber-950/20" : "border-border"}`}
            >
              <div className="text-sm font-medium">Follow-ups: {parsedFollowups}</div>
              {parsedFollowups <= 0 ? (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  You have not added any follow-ups yet.
                </p>
              ) : null}
            </div>
            <div
              className={`rounded-lg border p-3 ${!notes.trim() ? "border-amber-400 bg-amber-50/80 dark:bg-amber-950/20" : "border-border"}`}
            >
              <div className="text-sm font-medium">Notes</div>
              <p className="mt-1 text-sm text-muted-foreground">{notes.trim() ? notes : "None"}</p>
              {!notes.trim() ? (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  You have not added any notes yet.
                </p>
              ) : null}
            </div>

            <p className="text-sm text-muted-foreground">
              Would you like to make any changes before ending this session?
            </p>
          </div>

          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={() => setCheckoutModalOpen(false)}>
              Continue Editing
            </Button>
            <Button
              onClick={() => {
                setCheckoutModalOpen(false);
                void confirmCheckout();
              }}
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
                isCheckedIn
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${
                  isCheckedIn ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/50"
                }`}
              />
              {isCheckedIn ? "Checked in" : "Checked out"}
            </span>
          </div>

          {isCheckedIn ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Session started
                </div>
                <div className="mt-0.5 text-sm font-medium">
                  {checkedInAt ? fmtDateTime(checkedInAt) : "Active session"}
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
        <div className="flex items-center gap-2 text-sm font-semibold">
          <HistoryIcon className="size-4 text-muted-foreground" />
          History
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-lg border border-border bg-muted/40"
              />
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
          <ul className="space-y-3">
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

              return (
                <li key={l.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                    {/* Date + name */}
                    <div className="flex shrink-0 flex-row items-center gap-3 lg:w-40 lg:flex-col lg:items-start lg:gap-1">
                      <div className="text-sm font-semibold">{fmtDate(l.date)}</div>
                      {l.userName && canSeeTeammateNames ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {l.userName}
                        </span>
                      ) : null}
                    </div>

                    <div className="hidden w-px self-stretch bg-border lg:block" />

                    {/* Sessions */}
                    <div className="flex-1 min-w-0">
                      <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                        Sessions
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {sessions.map((sessionItem, index) => (
                          <div
                            key={`${l.id}-${index}`}
                            className="rounded-lg border border-border/70 bg-background/60 p-2.5 text-xs"
                          >
                            <div className="mb-1 font-medium text-foreground">
                              Session {index + 1}
                            </div>
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>In</span>
                              <span className="text-foreground">
                                {sessionItem.checkedInAt
                                  ? fmtDateTime(sessionItem.checkedInAt)
                                  : "—"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>Out</span>
                              <span className="text-foreground">
                                {sessionItem.checkedOutAt
                                  ? fmtDateTime(sessionItem.checkedOutAt)
                                  : "—"}
                              </span>
                            </div>
                            <div className="mt-2 space-y-1 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                              <div className="flex items-center justify-between">
                                <span>Calls</span>
                                <span className="text-foreground">{sessionItem.calls ?? 0}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>Follow-ups</span>
                                <span className="text-foreground">
                                  {sessionItem.followups ?? 0}
                                </span>
                              </div>
                              {sessionItem.notes ? (
                                <div className="pt-1 text-[10px] text-muted-foreground">
                                  {sessionItem.notes}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="hidden w-px self-stretch bg-border lg:block" />

                    {/* Stats */}
                    <div className="flex shrink-0 gap-4 lg:w-40 lg:flex-col lg:gap-2">
                      <div className="flex-1 lg:flex-none">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Calls
                        </div>
                        <div className="text-sm font-semibold">{l.calls}</div>
                      </div>
                      <div className="flex-1 lg:flex-none">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Follow-ups
                        </div>
                        <div className="text-sm font-semibold">{l.followups}</div>
                      </div>
                    </div>

                    <div className="hidden w-px self-stretch bg-border lg:block" />

                    {/* Notes */}
                    <div className="min-w-0 flex-1 lg:max-w-[220px]">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Notes
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-3">{l.notes || "—"}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
