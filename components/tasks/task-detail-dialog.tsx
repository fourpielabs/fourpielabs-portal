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
import { TaskChecklist } from "./task-checklist";
import { TaskTimer } from "./task-timer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import { StatusChip } from "@/components/ui/status-chip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const NONE = "__none__";

export type DetailTask = {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "review" | "done";
  assignee_id: string | null;
  assigneeName: string | null;
  due_date: string | null;
  source_message_id: string | null;
  // the source message's REAL thread type (resolved server-side) — picks the staff tab.
  sourceThreadType: "client_shared" | "internal" | null;
  createdByName: string | null;
  created_at: string;
  visible_to_client?: boolean; // staff only
};

/**
 * Task detail surface — a Dialog opened by a `?task={id}` query param (the host for
 * future Phase-4 subtasks + a Phase-5 staff timer; see the slots near the bottom).
 *
 * CLIENT view edits TITLE + DESCRIPTION only (updateTaskAction → update_task RPC);
 * status is the read-only StatusChip and assignee/due are read-only — status stays
 * STAFF-ONLY (the Phase-1 lock; never a client status control here). A client can only
 * ever open a row their RLS list already returned (own + visible_to_client), so an
 * internal/staff-only task can never reach this surface for a client.
 *
 * STAFF view has full control (staffUpdateTaskAction): title, description, status,
 * assignee, due_date, visible_to_client.
 */
export function TaskDetailDialog({
  task,
  role,
  clientId,
  members,
  checklist,
  timeEntries,
  currentUserId,
  open,
  onOpenChange,
}: {
  task: DetailTask;
  role: "client" | "staff";
  clientId?: string;
  members: TaskMember[];
  checklist: TaskChecklistItem[];
  timeEntries?: TimeEntry[]; // staff only
  currentUserId?: string; // staff only
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const isStaff = role === "staff";
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [status, setStatus] = useState(task.status); // staff-only
  const [assignee, setAssignee] = useState(task.assignee_id ?? NONE); // staff-only
  const [due, setDue] = useState(task.due_date ?? ""); // staff-only
  const [visible, setVisible] = useState(task.visible_to_client ?? true); // staff-only

  // Reseed when a different task opens (?task changes) — "adjust state on prop change".
  const [prevId, setPrevId] = useState(task.id);
  if (task.id !== prevId) {
    setPrevId(task.id);
    setTitle(task.title);
    setDescription(task.description ?? "");
    setStatus(task.status);
    setAssignee(task.assignee_id ?? NONE);
    setDue(task.due_date ?? "");
    setVisible(task.visible_to_client ?? true);
  }

  // "Created from a message" deep-link — audience-correct: client → their single shared
  // thread; staff → the client's thread, branching on the source's REAL thread_type.
  const sourceHref = task.source_message_id
    ? isStaff
      ? `/clients/${clientId}/messages${task.sourceThreadType === "internal" ? "?tab=internal" : ""}`
      : "/messages"
    : null;

  async function save() {
    if (!title.trim()) return toast.error("Title is required.");
    setSubmitting(true);
    const res = isStaff
      ? await staffUpdateTaskAction(clientId!, task.id, {
          title,
          description,
          status,
          assignee_id: assignee === NONE ? "" : assignee,
          due_date: due,
          visible_to_client: visible,
        })
      : await updateTaskAction({ id: task.id, title, description });
    setSubmitting(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    toast.success("Task saved.");
    onOpenChange(false);
    router.refresh();
  }

  const labelCls = "text-[11px] font-semibold tracking-wide text-ink-3 uppercase";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Task detail</DialogTitle>
          <DialogDescription className="sr-only">View and edit this task.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* TITLE + STATUS (client: read-only chip · staff: status Select) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="td-title" className={labelCls}>Title</Label>
              {isStaff ? (
                <Select value={status} onValueChange={(s) => setStatus(s as DetailTask["status"])}>
                  <SelectTrigger size="sm" className="w-[8.5rem]" aria-label="Status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <StatusChip kind="task" value={task.status} />
              )}
            </div>
            <Input id="td-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          {/* DESCRIPTION (editable both roles) */}
          <div className="space-y-2">
            <Label htmlFor="td-desc" className={labelCls}>Description</Label>
            <Textarea
              id="td-desc"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any detail or context."
              className="resize-none"
            />
          </div>

          {/* ASSIGNEE + DUE (staff: editable · client: read-only) */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className={labelCls}>Assignee</Label>
              {isStaff ? (
                <Select value={assignee} onValueChange={setAssignee}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Unassigned</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="inline-flex items-center gap-1.5 text-sm">
                  <User className="size-3.5 text-ink-3" /> {task.assigneeName ?? "Unassigned"}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className={labelCls}>Due date</Label>
              {isStaff ? (
                <DatePicker value={due} onChange={setDue} />
              ) : (
                <p className="inline-flex items-center gap-1.5 text-sm">
                  <Calendar className="size-3.5 text-ink-3" />
                  {task.due_date ? formatDate(task.due_date) : "No due date"}
                </p>
              )}
            </div>
          </div>

          {/* VISIBILITY (staff only) */}
          {isStaff && (
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border px-3 py-2.5">
              <span className="min-w-0">
                <span className="block text-sm font-medium">Visible to the client</span>
                <span className="block text-xs text-ink-3">
                  {visible ? "The client sees this task." : "Internal — staff-only, the client never sees it."}
                </span>
              </span>
              <Switch checked={visible} onCheckedChange={setVisible} aria-label="Visible to the client" />
            </label>
          )}

          {/* CREATED-BY / CREATED-AT + the source-message link */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-ink-3">
            <span className="inline-flex items-center gap-1">
              <User className="size-3" /> Created by {task.createdByName ?? "—"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" /> {formatDateTime(task.created_at)}
            </span>
            {sourceHref && (
              <Link href={sourceHref} className="inline-flex items-center gap-1 font-medium text-amber-700 hover:text-amber-800">
                <MessageSquare className="size-3" /> Created from a message
              </Link>
            )}
          </div>

          {/* ════════════════════════════════════════════════════════════════
              SUBTASKS (Phase 4) — checklist-style items + a parent progress bar,
              for BOTH roles. Client writes via the SECURITY DEFINER RPCs (own-client
              + parent visible_to_client); staff write directly. The boundary is
              inherited from the parent task this detail already gated on.
             ════════════════════════════════════════════════════════════════ */}
          <TaskChecklist taskId={task.id} role={role} clientId={clientId} items={checklist} />

          {/* ════════════════════════════════════════════════════════════════
              TIME TRACKING (Phase 5, STAFF-ONLY) — rendered ONLY in the staff
              branch, so a client never sees a timer. Start → in_progress; plain
              Stop leaves in_progress; "Stop & complete" → done.
             ════════════════════════════════════════════════════════════════ */}
          {isStaff && clientId && currentUserId && (
            <TaskTimer
              clientId={clientId}
              taskId={task.id}
              currentUserId={currentUserId}
              entries={timeEntries ?? []}
            />
          )}
        </div>

        <DialogFooter>
          <Button onClick={save} loading={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
