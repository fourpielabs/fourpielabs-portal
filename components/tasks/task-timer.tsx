"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Pencil, Play, Square, Timer, Trash2, X } from "lucide-react";

import { formatDuration, formatDateTime } from "@/lib/format";
import type { TimeEntry } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  startTimerAction,
  stopTimerAction,
  editTimeEntryAction,
  deleteTimeEntryAction,
} from "@/lib/actions/time";

function durationSec(e: TimeEntry, nowMs: number): number {
  const start = new Date(e.started_at).getTime();
  const end = e.ended_at ? new Date(e.ended_at).getTime() : nowMs;
  return Math.max(0, (end - start) / 1000);
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * STAFF-ONLY task timer — fills the TIME TRACKING slot in the staff branch of the
 * task detail (never rendered for a client). Start moves the task to in_progress;
 * a plain Stop leaves it in_progress (the clock stops, the task is NOT completed);
 * "Stop & complete" stops AND sets done. One running entry per staff member.
 */
export function TaskTimer({
  clientId,
  taskId,
  currentUserId,
  entries: incoming,
}: {
  clientId: string;
  taskId: string;
  currentUserId: string;
  entries: TimeEntry[];
}) {
  const router = useRouter();
  const [entries, setEntries] = useState(incoming);
  const [prev, setPrev] = useState(incoming);
  if (incoming !== prev) {
    setPrev(incoming);
    setEntries(incoming);
  }

  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  const myRunning = entries.find((e) => !e.ended_at && e.user_id === currentUserId) ?? null;
  const anyRunning = entries.some((e) => !e.ended_at);

  // Live clock — ticks only while something runs. `now` stays null until mount so
  // SSR (a ?task= deep-link) and the first client render agree (no hydration drift).
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    if (!anyRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [anyRunning]);
  const nowMs = now ?? 0;

  const totalSec = entries.reduce((acc, e) => acc + (e.ended_at ? durationSec(e, 0) : 0), 0);

  async function run(p: Promise<{ ok: boolean; error?: string }>, fail: string) {
    setBusy(true);
    const res = await p;
    setBusy(false);
    if (!res.ok) {
      toast.error(fail, { description: res.error });
      return false;
    }
    router.refresh();
    return true;
  }

  const sorted = [...entries].sort((a, b) => b.started_at.localeCompare(a.started_at));

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
          <Timer className="size-3.5" /> Time tracking
        </span>
        {totalSec > 0 && (
          <span className="text-xs text-ink-3">
            Total <span className="font-semibold text-ink tabular-nums">{formatDuration(totalSec)}</span>
          </span>
        )}
      </div>

      {/* Start / Stop control */}
      {myRunning ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5">
          <span className="inline-flex items-center gap-2">
            <span className="size-2 animate-pulse rounded-full bg-amber-600" />
            <span className="text-lg font-semibold tabular-nums text-amber-800">
              {now === null ? "0:00:00" : formatDuration(durationSec(myRunning, nowMs), true)}
            </span>
          </span>
          <span className="ml-auto flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" loading={busy} onClick={() => run(stopTimerAction(clientId, myRunning.id, false), "Couldn't stop the timer")}>
              <Square className="size-4" /> Stop
            </Button>
            <Button type="button" size="sm" loading={busy} onClick={() => run(stopTimerAction(clientId, myRunning.id, true), "Couldn't complete")}>
              <Check className="size-4" /> Stop &amp; complete
            </Button>
          </span>
        </div>
      ) : (
        <Button type="button" variant="outline" loading={busy} onClick={() => run(startTimerAction(clientId, taskId), "Couldn't start the timer")}>
          <Play className="size-4" /> Start timer
        </Button>
      )}

      {/* Past entries */}
      {sorted.length === 0 ? (
        <p className="text-xs text-ink-3">No time logged yet.</p>
      ) : (
        <ul className="space-y-1">
          {sorted.map((e) => {
            const mine = e.user_id === currentUserId;
            const running = !e.ended_at;
            const dur = running ? (now === null ? 0 : durationSec(e, nowMs)) : durationSec(e, 0);
            return (
              <li key={e.id} className="rounded-lg px-1.5 py-1 text-sm hover:bg-surface-2">
                {editId === e.id ? (
                  <div className="flex flex-col gap-2 py-1">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[11px] text-ink-3">
                        Start
                        <Input type="datetime-local" value={editStart} onChange={(ev) => setEditStart(ev.target.value)} className="mt-0.5 h-8" />
                      </label>
                      <label className="text-[11px] text-ink-3">
                        End <span className="text-ink-faint">(empty = running)</span>
                        <Input type="datetime-local" value={editEnd} onChange={(ev) => setEditEnd(ev.target.value)} className="mt-0.5 h-8" />
                      </label>
                    </div>
                    <div className="flex justify-end gap-1.5">
                      <Button type="button" size="sm" variant="ghost" onClick={() => setEditId(null)}>
                        <X className="size-4" /> Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        loading={busy}
                        onClick={async () => {
                          const start = fromLocalInput(editStart);
                          if (!start) return toast.error("Start time is required");
                          const ok = await run(
                            editTimeEntryAction(clientId, e.id, start, fromLocalInput(editEnd)),
                            "Couldn't save the entry",
                          );
                          if (ok) setEditId(null);
                        }}
                      >
                        <Check className="size-4" /> Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="group flex items-center gap-2">
                    <span className={cn("min-w-0 flex-1", running && "text-amber-800")}>
                      <span className="font-medium tabular-nums">{formatDuration(dur)}</span>
                      <span className="text-ink-3">
                        {" · "}
                        {formatDateTime(e.started_at)}
                        {running ? " · running" : ` – ${formatDateTime(e.ended_at)}`}
                      </span>
                      {!mine && <span className="text-ink-3"> · {e.userName ?? "Teammate"}</span>}
                    </span>
                    {mine && (
                      <>
                        <button
                          type="button"
                          aria-label="Edit entry"
                          onClick={() => {
                            setEditId(e.id);
                            setEditStart(toLocalInput(e.started_at));
                            setEditEnd(toLocalInput(e.ended_at));
                          }}
                          className="shrink-0 rounded-md p-1 text-ink-3 opacity-0 transition hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete entry"
                          onClick={() => run(deleteTimeEntryAction(clientId, e.id), "Couldn't delete the entry")}
                          className="shrink-0 rounded-md p-1 text-ink-3 opacity-0 transition hover:text-rose-600 focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
