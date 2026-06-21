"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Calendar, Clock, Flag, Link2, Lock, MessageSquare, Plus, ShieldCheck, User, X } from "lucide-react";

import { updateTaskAction, signOffMilestoneAction } from "@/lib/actions/tasks-client";
import { staffUpdateTaskAction, staffSetTaskFlagsAction, addTaskDependencyAction, removeTaskDependencyAction } from "@/lib/actions/tasks";
import { TASK_STATUSES } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import type { TaskMember, TaskChecklistItem, TimeEntry } from "@/lib/tasks";
import { TaskChecklist } from "@/components/tasks/task-checklist";
import { DatePicker } from "@/components/ui/date-picker";
import { TaskTimer } from "@/components/redesign/staff/task-timer";
import {
  Dialog, DialogSurface, DialogTitle, DialogBody, DialogActions,
  Input, Textarea, Select, Switch, EmberButton, StatusPill, Eyebrow, tokens,
} from "@/components/redesign/ui";
import { useRedesignMode } from "@/components/redesign/themed-fluent";

const NONE = "__none__";

export type DetailTask = {
  id: string; title: string; description: string | null;
  status: "todo" | "in_progress" | "review" | "done";
  assignee_id: string | null; assigneeName: string | null;
  due_date: string | null; source_message_id: string | null;
  sourceThreadType: "client_shared" | "internal" | null;
  createdByName: string | null; created_at: string; visible_to_client?: boolean;
  is_milestone?: boolean; blocked_by_client?: boolean; blocked_reason?: string | null;
  client_signed_off_at?: string | null;
};
export type TaskDep = { id: string; blocker_id: string; title: string; status: string };

/**
 * R3 task detail (re-skinned, shared). CLIENT view: read-only status chip + read-only
 * assignee/due; edits TITLE + DESCRIPTION only (updateTaskAction → update_task RPC).
 * STAFF view: full control (staffUpdateTaskAction) — status/assignee/due/visibility —
 * PLUS the TaskTimer, which renders ONLY in the staff branch (never for a client). The
 * role gating is preserved verbatim; this is presentation only.
 */
export function TaskDetailDialog({
  task, role, clientId, members, checklist, timeEntries, currentUserId, deps = [], candidateTasks = [], open, onOpenChange,
}: {
  task: DetailTask; role: "client" | "staff"; clientId?: string; members: TaskMember[];
  checklist: TaskChecklistItem[]; timeEntries?: TimeEntry[]; currentUserId?: string;
  deps?: TaskDep[]; candidateTasks?: { id: string; title: string }[];
  open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const { mode } = useRedesignMode();
  const onDark = mode === "dark";
  const isStaff = role === "staff";
  const [submitting, setSubmitting] = useState(false);
  const [isMilestone, setIsMilestone] = useState(task.is_milestone ?? false);
  const [blockedByClient, setBlockedByClient] = useState(task.blocked_by_client ?? false);
  const [blockedReason, setBlockedReason] = useState(task.blocked_reason ?? "");
  const [newDep, setNewDep] = useState(NONE);
  const [flagBusy, setFlagBusy] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [status, setStatus] = useState(task.status);
  const [assignee, setAssignee] = useState(task.assignee_id ?? NONE);
  const [due, setDue] = useState(task.due_date ?? "");
  const [visible, setVisible] = useState(task.visible_to_client ?? true);

  const [prevId, setPrevId] = useState(task.id);
  if (task.id !== prevId) {
    setPrevId(task.id); setTitle(task.title); setDescription(task.description ?? "");
    setStatus(task.status); setAssignee(task.assignee_id ?? NONE); setDue(task.due_date ?? "");
    setVisible(task.visible_to_client ?? true);
    setIsMilestone(task.is_milestone ?? false); setBlockedByClient(task.blocked_by_client ?? false); setBlockedReason(task.blocked_reason ?? "");
  }

  const sourceHref = task.source_message_id
    ? isStaff ? `/clients/${clientId}/messages${task.sourceThreadType === "internal" ? "?tab=internal" : ""}` : "/messages"
    : null;

  async function save() {
    if (!title.trim()) return toast.error("Title is required.");
    setSubmitting(true);
    const res = isStaff
      ? await staffUpdateTaskAction(clientId!, task.id, { title, description, status, assignee_id: assignee === NONE ? "" : assignee, due_date: due, visible_to_client: visible })
      : await updateTaskAction({ id: task.id, title, description });
    setSubmitting(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    toast.success("Task saved.");
    onOpenChange(false);
    router.refresh();
  }

  async function saveFlags(next: { is_milestone?: boolean; blocked_by_client?: boolean; blocked_reason?: string | null }) {
    setFlagBusy(true);
    const res = await staffSetTaskFlagsAction(clientId!, task.id, next);
    setFlagBusy(false);
    if (!res.ok) return toast.error("Couldn't update", { description: res.error });
    router.refresh();
  }
  async function addDep() {
    if (newDep === NONE) return;
    const res = await addTaskDependencyAction(clientId!, task.id, newDep);
    if (!res.ok) return toast.error("Couldn't add", { description: res.error });
    setNewDep(NONE); router.refresh();
  }
  async function removeDep(depId: string) {
    const res = await removeTaskDependencyAction(clientId!, depId);
    if (!res.ok) return toast.error("Couldn't remove", { description: res.error });
    router.refresh();
  }
  async function signOff() {
    setSubmitting(true);
    const res = await signOffMilestoneAction(task.id);
    setSubmitting(false);
    if (!res.ok) return toast.error("Couldn't sign off", { description: res.error });
    toast.success("Milestone signed off — recorded.");
    router.refresh();
  }

  const openDeps = deps.filter((d) => d.status !== "done").length;

  const fg1 = tokens.colorNeutralForeground1, fg2 = tokens.colorNeutralForeground2, fg3 = tokens.colorNeutralForeground3;
  const border = onDark ? "#34302a" : "#e7e5e0";

  return (
    <Dialog open={open} onOpenChange={(_, d) => onOpenChange(d.open)}>
      {/* Surface constrained to the viewport (width + height); the SINGLE scroll
          region is the inner content div, with actions pinned below it — no
          double-scrollbars, no horizontal overflow on mobile (390w). */}
      <DialogSurface style={{ width: "min(600px, 92vw)", maxWidth: "min(600px, 92vw)", maxHeight: "88vh", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        <DialogBody style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1, gap: 0 }}>
          <DialogTitle style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Task detail</DialogTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 20, overflowY: "auto", overflowX: "hidden", minHeight: 0, flex: 1, paddingRight: 4 }}>
            {/* TITLE + STATUS */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <Eyebrow tone="muted">Title</Eyebrow>
                {isStaff ? (
                  <Select value={status} onChange={(e) => setStatus(e.target.value as DetailTask["status"])} aria-label="Status" style={{ width: "9rem" }}>
                    {TASK_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                ) : (
                  <StatusPill value={task.status} mode={mode} />
                )}
              </div>
              <Input value={title} onChange={(_, d) => setTitle(d.value)} />
            </div>

            {/* DESCRIPTION */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Eyebrow tone="muted">Description</Eyebrow>
              <Textarea value={description} onChange={(_, d) => setDescription(d.value)} resize="vertical" placeholder="Add any detail or context." />
            </div>

            {/* ASSIGNEE + DUE */}
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                <Eyebrow tone="muted">Assignee</Eyebrow>
                {isStaff ? (
                  <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Assignee">
                    <option value={NONE}>Unassigned</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </Select>
                ) : (
                  <p style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: fg1 }}><User size={14} color={fg3} /> {task.assigneeName ?? "Unassigned"}</p>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                <Eyebrow tone="muted">Due date</Eyebrow>
                {isStaff ? (
                  <DatePicker value={due} onChange={setDue} />
                ) : (
                  <p style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: fg1 }}><Calendar size={14} color={fg3} /> {task.due_date ? formatDate(task.due_date) : "No due date"}</p>
                )}
              </div>
            </div>

            {/* VISIBILITY (staff only) */}
            {isStaff && (
              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, borderRadius: 12, border: `1px solid ${border}`, padding: "0.6rem 0.85rem", cursor: "pointer" }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 500, color: fg1 }}>Visible to the client</span>
                  <span style={{ display: "block", fontSize: 12, color: fg3 }}>{visible ? "The client sees this task." : "Internal — staff-only, the client never sees it."}</span>
                </span>
                <Switch checked={visible} onChange={(_, d) => setVisible(d.checked)} aria-label="Visible to the client" />
              </label>
            )}

            {/* meta + source link */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.25rem 1rem", borderTop: `1px solid ${border}`, paddingTop: 12, fontSize: 12, color: fg3 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><User size={12} /> Created by {task.createdByName ?? "—"}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Clock size={12} /> {formatDateTime(task.created_at)}</span>
              {sourceHref && <Link href={sourceHref} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 500, color: tokens.colorBrandForeground1, textDecoration: "none" }}><MessageSquare size={12} /> Created from a message</Link>}
            </div>

            {/* STATE BADGES (both roles) */}
            {(task.is_milestone || task.blocked_by_client || openDeps > 0 || task.client_signed_off_at) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {task.is_milestone && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: 999, background: onDark ? "rgba(245,158,11,0.16)" : "#fef3c7", color: onDark ? "#fcd34d" : "#92400e" }}><Flag size={12} /> Milestone</span>}
                {task.blocked_by_client && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 800, padding: "0.2rem 0.5rem", borderRadius: 999, background: onDark ? "rgba(220,38,38,0.18)" : "#fef2f2", color: onDark ? "#fca5a5" : "#b91c1c", border: `1px solid ${onDark ? "rgba(220,38,38,0.4)" : "#fecaca"}` }}><Lock size={12} /> BLOCKED BY CLIENT</span>}
                {openDeps > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: 999, background: onDark ? "rgba(255,255,255,0.06)" : "#f1efe8", color: fg3 }}><Link2 size={12} /> Blocked · {openDeps}</span>}
                {task.client_signed_off_at && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: 999, background: onDark ? "rgba(34,197,94,0.16)" : "#dcfce7", color: onDark ? "#6ee7b7" : "#15803d" }}><ShieldCheck size={12} /> Signed off {formatDate(task.client_signed_off_at)}</span>}
              </div>
            )}
            {task.blocked_by_client && task.blocked_reason && <p style={{ margin: 0, fontSize: 13, color: fg2 }}>{task.blocked_reason}</p>}

            {/* DEPENDENCIES (both roles read; staff manage) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: `1px solid ${border}`, paddingTop: 12 }}>
              <Eyebrow tone="muted">Blocked by</Eyebrow>
              {deps.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: fg3 }}>No dependencies.</p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                  {deps.map((d) => (
                    <li key={d.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: fg1 }}>
                        {d.status !== "done" && <Lock size={12} color={fg3} />}{d.title}
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <StatusPill value={d.status} mode={mode} />
                        {isStaff && <button type="button" aria-label="Remove dependency" onClick={() => removeDep(d.id)} className="rd-focus" style={{ border: "none", background: "none", cursor: "pointer", color: fg3, padding: 2 }}><X size={14} /></button>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {isStaff && candidateTasks.length > 0 && (
                <div style={{ display: "flex", gap: 8 }}>
                  <Select value={newDep} onChange={(e) => setNewDep(e.target.value)} aria-label="Add a blocking task" style={{ flex: 1 }}>
                    <option value={NONE}>Add a blocking task…</option>
                    {candidateTasks.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </Select>
                  <EmberButton size="small" icon={<Plus size={14} />} onClick={addDep} disabled={newDep === NONE}>Add</EmberButton>
                </div>
              )}
            </div>

            {/* ADVANCED FLAGS — staff only */}
            {isStaff && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, borderTop: `1px solid ${border}`, paddingTop: 12 }}>
                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontSize: 14, color: fg1 }}>Milestone <span style={{ color: fg3, fontSize: 12 }}>· client can formally sign off</span></span>
                  <Switch checked={isMilestone} disabled={flagBusy} onChange={(_, d) => { setIsMilestone(d.checked); void saveFlags({ is_milestone: d.checked }); }} />
                </label>
                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontSize: 14, color: fg1 }}>Blocked by client <span style={{ color: fg3, fontSize: 12 }}>· waiting on them</span></span>
                  <Switch checked={blockedByClient} disabled={flagBusy} onChange={(_, d) => { setBlockedByClient(d.checked); void saveFlags({ blocked_by_client: d.checked }); }} />
                </label>
                {blockedByClient && (
                  <Input value={blockedReason} onChange={(_, d) => setBlockedReason(d.value)} onBlur={() => void saveFlags({ blocked_reason: blockedReason })} placeholder="What are we waiting on? (shown to the client)" />
                )}
              </div>
            )}

            {/* MILESTONE SIGN-OFF — client only (formal, logged; not legally binding) */}
            {!isStaff && task.is_milestone && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, borderRadius: 12, border: `1px solid ${onDark ? "rgba(34,197,94,0.3)" : "#a7f3d0"}`, background: onDark ? "rgba(34,197,94,0.08)" : "#ecfdf5", padding: "0.85rem 1rem" }}>
                {task.client_signed_off_at ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, color: onDark ? "#6ee7b7" : "#15803d" }}><ShieldCheck size={16} /> You signed off on {formatDate(task.client_signed_off_at)}.</span>
                ) : (
                  <>
                    <span style={{ fontSize: 14, fontWeight: 600, color: fg1 }}>Approve this milestone</span>
                    <span style={{ fontSize: 12, color: fg3 }}>A formal, logged acceptance (recorded with the date + your account). It doesn&rsquo;t change the task status — your team manages that.</span>
                    <EmberButton size="small" icon={<ShieldCheck size={14} />} loading={submitting} onClick={signOff}>Approve milestone</EmberButton>
                  </>
                )}
              </div>
            )}

            {/* SUBTASKS (both roles) */}
            <TaskChecklist taskId={task.id} role={role} clientId={clientId} items={checklist} />

            {/* TIMER — staff branch ONLY (never rendered for a client) */}
            {isStaff && clientId && currentUserId && (
              <TaskTimer clientId={clientId} taskId={task.id} currentUserId={currentUserId} entries={timeEntries ?? []} />
            )}
          </div>

          <DialogActions style={{ flexShrink: 0, paddingTop: 16 }}>
            <EmberButton onClick={save} loading={submitting}>Save</EmberButton>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
