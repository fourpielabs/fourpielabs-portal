"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Pencil, Play, Square, Timer, Trash2, X } from "lucide-react";
import { formatDuration, formatDateTime } from "@/lib/format";
import type { TimeEntry } from "@/lib/tasks";
import { Button, EmberButton, tokens } from "@/components/redesign/ui";
import { useRedesignMode } from "@/components/redesign/themed-fluent";
import { startTimerAction, stopTimerAction, editTimeEntryAction, deleteTimeEntryAction } from "@/lib/actions/time";

const durationSec = (e: TimeEntry, nowMs: number) => Math.max(0, ((e.ended_at ? new Date(e.ended_at).getTime() : nowMs) - new Date(e.started_at).getTime()) / 1000);
const toLocalInput = (iso: string | null) => { if (!iso) return ""; const d = new Date(iso); if (isNaN(d.getTime())) return ""; const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const fromLocalInput = (v: string) => { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d.toISOString(); };

/**
 * R3 STAFF-ONLY task timer (re-skinned) — rendered ONLY in the staff branch of the task
 * detail; never on any client surface. State model preserved verbatim: Start →
 * in_progress; plain Stop leaves in_progress (clock stops, NOT done); "Stop & complete"
 * → done. One running entry per staff member. Edit/delete own entries.
 */
export function TaskTimer({ clientId, taskId, currentUserId, entries: incoming }: { clientId: string; taskId: string; currentUserId: string; entries: TimeEntry[] }) {
  const router = useRouter();
  const { mode } = useRedesignMode();
  const onDark = mode === "dark";
  const [entries, setEntries] = useState(incoming);
  const [prev, setPrev] = useState(incoming);
  if (incoming !== prev) { setPrev(incoming); setEntries(incoming); }
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  const myRunning = entries.find((e) => !e.ended_at && e.user_id === currentUserId) ?? null;
  const anyRunning = entries.some((e) => !e.ended_at);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); if (!anyRunning) return; const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, [anyRunning]);
  const nowMs = now ?? 0;
  const totalSec = entries.reduce((acc, e) => acc + (e.ended_at ? durationSec(e, 0) : 0), 0);

  async function run(p: Promise<{ ok: boolean; error?: string }>, fail: string) {
    setBusy(true); const res = await p; setBusy(false);
    if (!res.ok) { toast.error(fail, { description: res.error }); return false; }
    router.refresh(); return true;
  }
  const sorted = [...entries].sort((a, b) => b.started_at.localeCompare(a.started_at));
  const fg1 = tokens.colorNeutralForeground1, fg3 = tokens.colorNeutralForeground3;
  const border = onDark ? "#34302a" : "#e7e5e0";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, borderTop: `1px solid ${border}`, paddingTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="rd-eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: fg3 }}><Timer size={13} /> Time tracking</span>
        {totalSec > 0 && <span style={{ fontSize: 12, color: fg3 }}>Total <span className="rd-tnum" style={{ fontWeight: 600, color: fg1 }}>{formatDuration(totalSec)}</span></span>}
      </div>

      {myRunning ? (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, borderRadius: 12, border: `1px solid ${onDark ? "rgba(245,158,11,0.4)" : "#fcd34d"}`, background: onDark ? "rgba(245,158,11,0.12)" : "#fffaf0", padding: "0.6rem 0.85rem" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: "#d97706" }} className="animate-pulse" />
            <span className="rd-tnum" style={{ fontSize: "1.1rem", fontWeight: 600, color: onDark ? "#fcd34d" : "#92400e" }}>{now === null ? "0:00:00" : formatDuration(durationSec(myRunning, nowMs), true)}</span>
          </span>
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <Button size="small" appearance="outline" loading={busy} icon={<Square size={14} />} onClick={() => run(stopTimerAction(clientId, myRunning.id, false), "Couldn't stop the timer")}>Stop</Button>
            <EmberButton size="small" loading={busy} icon={<Check size={14} />} onClick={() => run(stopTimerAction(clientId, myRunning.id, true), "Couldn't complete")}>Stop &amp; complete</EmberButton>
          </span>
        </div>
      ) : (
        <Button appearance="outline" loading={busy} icon={<Play size={14} />} onClick={() => run(startTimerAction(clientId, taskId), "Couldn't start the timer")}>Start timer</Button>
      )}

      {sorted.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: fg3 }}>No time logged yet.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          {sorted.map((e) => {
            const mine = e.user_id === currentUserId;
            const running = !e.ended_at;
            const dur = running ? (now === null ? 0 : durationSec(e, nowMs)) : durationSec(e, 0);
            return (
              <li key={e.id} style={{ borderRadius: 8, padding: "4px 6px", fontSize: 14 }}>
                {editId === e.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "4px 0" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <label style={{ fontSize: 11, color: fg3 }}>Start<input type="datetime-local" value={editStart} onChange={(ev) => setEditStart(ev.target.value)} style={{ marginTop: 2, width: "100%", height: 32, borderRadius: 6, border: `1px solid ${border}`, background: onDark ? "#1c1813" : "#fff", color: fg1, padding: "0 6px" }} /></label>
                      <label style={{ fontSize: 11, color: fg3 }}>End <span style={{ color: fg3 }}>(empty = running)</span><input type="datetime-local" value={editEnd} onChange={(ev) => setEditEnd(ev.target.value)} style={{ marginTop: 2, width: "100%", height: 32, borderRadius: 6, border: `1px solid ${border}`, background: onDark ? "#1c1813" : "#fff", color: fg1, padding: "0 6px" }} /></label>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                      <Button size="small" appearance="subtle" icon={<X size={14} />} onClick={() => setEditId(null)}>Cancel</Button>
                      <EmberButton size="small" loading={busy} icon={<Check size={14} />} onClick={async () => { const start = fromLocalInput(editStart); if (!start) return toast.error("Start time is required"); const ok = await run(editTimeEntryAction(clientId, e.id, start, fromLocalInput(editEnd)), "Couldn't save the entry"); if (ok) setEditId(null); }}>Save</EmberButton>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ minWidth: 0, flex: 1, color: running ? (onDark ? "#fcd34d" : "#92400e") : fg1 }}>
                      <span className="rd-tnum" style={{ fontWeight: 500 }}>{formatDuration(dur)}</span>
                      <span style={{ color: fg3 }}>{" · "}{formatDateTime(e.started_at)}{running ? " · running" : ` – ${formatDateTime(e.ended_at)}`}</span>
                      {!mine && <span style={{ color: fg3 }}> · {e.userName ?? "Teammate"}</span>}
                    </span>
                    {mine && (
                      <>
                        <button type="button" aria-label="Edit entry" className="rd-focus" onClick={() => { setEditId(e.id); setEditStart(toLocalInput(e.started_at)); setEditEnd(toLocalInput(e.ended_at)); }} style={{ flexShrink: 0, borderRadius: 6, border: "none", background: "none", cursor: "pointer", color: fg3, padding: 4 }}><Pencil size={14} /></button>
                        <button type="button" aria-label="Delete entry" className="rd-focus" onClick={() => run(deleteTimeEntryAction(clientId, e.id), "Couldn't delete the entry")} style={{ flexShrink: 0, borderRadius: 6, border: "none", background: "none", cursor: "pointer", color: fg3, padding: 4 }}><Trash2 size={14} /></button>
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
