"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ListChecks, Lock, MessageSquare, Pencil, Plus, Trash2, User } from "lucide-react";

import { staffSetTaskStatusAction, staffDeleteTaskAction } from "@/lib/actions/tasks";
import { TASK_STATUSES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { TaskMember } from "@/lib/tasks";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";
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
import { TaskFormDialog, type StaffTaskRow } from "./task-form-dialog";

export type StaffTask = StaffTaskRow & { assigneeName: string | null };

export function StaffTasksManager({
  clientId,
  tasks: initialTasks,
  members,
}: {
  clientId: string;
  tasks: StaffTask[];
  members: TaskMember[];
}) {
  // local copy → status changes + deletes paint INSTANTLY; the server prop
  // re-syncs on refresh/navigation (and after edits/creates via the dialog).
  const [tasks, setTasks] = useState(initialTasks);
  // Re-sync local optimistic state when the server prop changes (refresh/edit/create) —
  // "adjust state during render" instead of an effect (no cascading render).
  const [prevTasks, setPrevTasks] = useState(initialTasks);
  if (initialTasks !== prevTasks) {
    setPrevTasks(initialTasks);
    setTasks(initialTasks);
  }

  async function changeStatus(id: string, status: StaffTaskRow["status"]) {
    const prev = tasks;
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, status } : t))); // <100ms
    const res = await staffSetTaskStatusAction(clientId, id, status);
    if (!res.ok) {
      setTasks(prev);
      toast.error("Couldn't update", { description: res.error });
    }
  }
  async function deleteTask(id: string) {
    const prev = tasks;
    setTasks((ts) => ts.filter((t) => t.id !== id)); // row vanishes instantly
    const res = await staffDeleteTaskAction(clientId, id);
    if (!res.ok) {
      setTasks(prev);
      toast.error("Couldn't delete", { description: res.error });
    }
  }

  const newBtn = (
    <TaskFormDialog
      clientId={clientId}
      members={members}
      trigger={
        <Button size="sm">
          <Plus className="size-4" /> New task
        </Button>
      }
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-3">
          {tasks.length === 0 ? "No tasks yet." : `${tasks.length} task${tasks.length === 1 ? "" : "s"}`}
        </p>
        {newBtn}
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<ListChecks />}
          title="No tasks yet"
          description="Create a task for this client — assign it to your team or to the client, and they'll see it on their Tasks page."
          action={newBtn}
        />
      ) : (
        <ul className="space-y-3">
          {tasks.map((t) => (
            <li
              key={t.id}
              className="rounded-2xl border border-border bg-surface p-4 shadow-e1 transition-shadow hover:shadow-e2"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{t.title}</span>
                    <StatusChip kind="task" value={t.status} />
                    {!t.visible_to_client && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                        <Lock className="size-3" /> Internal
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-ink-3">
                    <span className="inline-flex items-center gap-1">
                      <User className="size-3" />
                      {t.assigneeName ?? "Unassigned"}
                    </span>
                    {t.due_date && <span>Due {formatDate(t.due_date)}</span>}
                    {t.source_message_id && (
                      <Link
                        href={`/clients/${clientId}/messages`}
                        className="inline-flex items-center gap-1 text-ink-3 hover:text-ink"
                      >
                        <MessageSquare className="size-3" /> from a message
                      </Link>
                    )}
                  </div>
                  {t.description && <p className="pt-1 text-sm text-ink-3">{t.description}</p>}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Select
                    value={t.status}
                    onValueChange={(s) => changeStatus(t.id, s as StaffTaskRow["status"])}
                  >
                    <SelectTrigger size="sm" className="w-[8.5rem]" aria-label={`Status for ${t.title}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_STATUSES.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <TaskFormDialog
                    clientId={clientId}
                    members={members}
                    task={t}
                    trigger={
                      <Button variant="ghost" size="icon" aria-label="Edit">
                        <Pencil className="size-4" />
                      </Button>
                    }
                  />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Delete">
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete task?</AlertDialogTitle>
                        <AlertDialogDescription>
                          &ldquo;{t.title}&rdquo; will be removed.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteTask(t.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
