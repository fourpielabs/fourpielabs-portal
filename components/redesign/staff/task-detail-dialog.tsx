"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Calendar, Clock, MessageSquare, User } from "lucide-react";

import { updateTaskAction } from "@/lib/actions/tasks-client";
import { staffUpdateTaskAction } from "@/lib/actions/tasks";
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
  status: "todo" | "in_progress" | "done";
  assignee_id: string | null; assigneeName: string | null;
  due_date: string | null; source_message_id: string | null;
  sourceThreadType: "client_shared" | "internal" | null;
  createdByName: string | null; created_at: string; visible_to_client?: boolean;
};

/**
 * R3 task detail (re-skinned, shared). CLIENT view: read-only status chip + read-only
 * assignee/due; edits TITLE + DESCRIPTION only (updateTaskAction → update_task RPC).
 * STAFF view: full control (staffUpdateTaskAction) — status/assignee/due/visibility —
 * PLUS the TaskTimer, which renders ONLY in the staff branch (never for a client). The
 * role gating is preserved verbatim; this is presentation only.
 */
export function TaskDetailDialog({
  task, role, clientId, members, checklist, timeEntries, currentUserId, open, onOpenChange,
}: {
  task: DetailTask; role: "client" | "staff"; clientId?: string; members: TaskMember[];
  checklist: TaskChecklistItem[]; timeEntries?: TimeEntry[]; currentUserId?: string;
  open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const { mode } = useRedesignMode();
  const onDark = mode === "dark";
  const isStaff = role === "staff";
  const [submitting, setSubmitting] = useState(false);
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

  const fg1 = tokens.colorNeutralForeground1, fg2 = tokens.colorNeutralForeground2, fg3 = tokens.colorNeutralForeground3;
  const border = onDark ? "#34302a" : "#e7e5e0";

  return (
    <Dialog open={open} onOpenChange={(_, d) => onOpenChange(d.open)}>
      <DialogSurface style={{ maxHeight: "90vh", overflowY: "auto" }}>
        <DialogBody>
          <DialogTitle style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Task detail</DialogTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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

            {/* SUBTASKS (both roles) */}
            <TaskChecklist taskId={task.id} role={role} clientId={clientId} items={checklist} />

            {/* TIMER — staff branch ONLY (never rendered for a client) */}
            {isStaff && clientId && currentUserId && (
              <TaskTimer clientId={clientId} taskId={task.id} currentUserId={currentUserId} entries={timeEntries ?? []} />
            )}
          </div>

          <DialogActions>
            <EmberButton onClick={save} loading={submitting}>Save</EmberButton>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
