"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ListChecks, Lock, MessageSquare, Pencil, Plus, User } from "lucide-react";

import { staffSetTaskStatusAction, staffDeleteTaskAction } from "@/lib/actions/tasks";
import { TASK_STATUSES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { TaskMember } from "@/lib/tasks";
import { Select, EmberButton, StatusPill } from "@/components/redesign/ui";
import { useRedesignMode } from "@/components/redesign/themed-fluent";
import { TaskFormDialog, type StaffTaskRow } from "./task-form-dialog";
import { TaskDetailDialog } from "./task-detail-dialog";
import { TaskChecklistProgress } from "@/components/tasks/task-checklist";
import { usePanel, EmptyPanel, ConfirmDelete } from "./ui";
import type { StaffTask } from "@/components/tasks/staff-tasks-manager";

export type { StaffTask };

/** R3 staff tasks board (re-skinned). Optimistic status/delete + ?task= detail verbatim. */
export function StaffTasksManager({
  clientId, currentUserId, tasks: initialTasks, members,
}: {
  clientId: string;
  currentUserId: string;
  tasks: StaffTask[];
  members: TaskMember[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const { mode } = useRedesignMode();
  const { panel, fg1, fg2, fg3, onDark } = usePanel();
  const [tasks, setTasks] = useState(initialTasks);
  const [prevTasks, setPrevTasks] = useState(initialTasks);
  if (initialTasks !== prevTasks) { setPrevTasks(initialTasks); setTasks(initialTasks); }

  const openId = params.get("task");
  const openTask = openId ? tasks.find((t) => t.id === openId) ?? null : null;

  async function changeStatus(id: string, status: StaffTaskRow["status"]) {
    const prev = tasks;
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, status } : t)));
    const res = await staffSetTaskStatusAction(clientId, id, status);
    if (!res.ok) { setTasks(prev); toast.error("Couldn't update", { description: res.error }); }
  }
  async function deleteTask(id: string) {
    const prev = tasks;
    setTasks((ts) => ts.filter((t) => t.id !== id));
    const res = await staffDeleteTaskAction(clientId, id);
    if (!res.ok) { setTasks(prev); toast.error("Couldn't delete", { description: res.error }); }
  }

  const newBtn = (
    <TaskFormDialog clientId={clientId} members={members} trigger={<EmberButton icon={<Plus size={16} />}>New task</EmberButton>} />
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
        <p style={{ margin: 0, fontSize: "0.85rem", color: fg3 }}>{tasks.length === 0 ? "No tasks yet." : `${tasks.length} task${tasks.length === 1 ? "" : "s"}`}</p>
        {newBtn}
      </div>

      {tasks.length === 0 ? (
        <EmptyPanel icon={<ListChecks size={22} />} title="No tasks yet" description="Create a task for this client — assign it to your team or to the client, and they'll see it on their Tasks page." action={newBtn} />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.7rem" }}>
          {tasks.map((t) => (
            <li key={t.id} className={panel} style={{ borderRadius: 18, padding: "1rem 1.1rem", display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                  <Link href={`/clients/${clientId}/tasks?task=${t.id}`} scroll={false} className="rd-focus" style={{ fontWeight: 600, color: fg1, textDecoration: "none" }}>{t.title}</Link>
                  <StatusPill value={t.status} mode={mode} />
                  {!t.visible_to_client && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "0.15rem 0.45rem", borderRadius: 999, background: onDark ? "rgba(245,158,11,0.16)" : "#fef3c7", color: onDark ? "#fcd34d" : "#92400e" }}><Lock size={12} /> Internal</span>
                  )}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.25rem 0.85rem", paddingTop: 4, fontSize: 12, color: fg3 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><User size={12} /> {t.assigneeName ?? "Unassigned"}</span>
                  {t.due_date && <span>Due {formatDate(t.due_date)}</span>}
                  {t.source_message_id && (
                    <Link href={`/clients/${clientId}/messages${t.sourceThreadType === "internal" ? "?tab=internal" : ""}`} className="rd-focus" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: fg3, textDecoration: "none" }}><MessageSquare size={12} /> from a message</Link>
                  )}
                  <TaskChecklistProgress items={t.checklist} />
                </div>
                {t.description && <p style={{ margin: "0.4rem 0 0", fontSize: "0.85rem", color: fg2 }}>{t.description}</p>}
              </div>

              <div style={{ display: "flex", flexShrink: 0, alignItems: "center", gap: 4 }}>
                <Select value={t.status} onChange={(e) => changeStatus(t.id, e.target.value as StaffTaskRow["status"])} aria-label={`Status for ${t.title}`} style={{ minWidth: "8.5rem" }}>
                  {TASK_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
                <TaskFormDialog clientId={clientId} members={members} task={t} trigger={<button type="button" aria-label="Edit" className="rd-focus" style={{ flexShrink: 0, borderRadius: 8, border: "none", background: "none", cursor: "pointer", color: fg3, padding: 6, display: "inline-flex" }}><Pencil size={16} /></button>} />
                <ConfirmDelete title="Delete task?" description={`“${t.title}” will be removed.`} onConfirm={() => deleteTask(t.id)} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {openTask && (
        <TaskDetailDialog
          task={openTask}
          role="staff"
          clientId={clientId}
          members={members}
          checklist={openTask.checklist}
          timeEntries={openTask.timeEntries}
          currentUserId={currentUserId}
          open
          onOpenChange={(v) => { if (!v) router.push(`/clients/${clientId}/tasks`, { scroll: false }); }}
        />
      )}
    </div>
  );
}
