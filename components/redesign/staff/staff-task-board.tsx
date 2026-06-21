"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
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
import { TaskDetailDialog, type TaskDep } from "./task-detail-dialog";
import { ViewToggle } from "@/components/redesign/client/task-board";

const TaskKanban = dynamic(() => import("@/components/redesign/client/task-kanban").then((m) => m.TaskKanban), { ssr: false });
type Dep = { id: string; task_id: string; blocked_by_task_id: string };
import { TaskChecklistProgress } from "@/components/tasks/task-checklist";
import { usePanel, EmptyPanel, ConfirmDelete } from "./ui";
import type { StaffTask } from "@/components/tasks/staff-tasks-manager";

export type { StaffTask };

/** R3 staff tasks board (re-skinned). Optimistic status/delete + ?task= detail verbatim. */
export function StaffTasksManager({
  clientId, currentUserId, tasks: initialTasks, members, deps = [],
}: {
  clientId: string;
  currentUserId: string;
  tasks: StaffTask[];
  members: TaskMember[];
  deps?: Dep[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const { mode } = useRedesignMode();
  const { panel, fg1, fg2, fg3, onDark } = usePanel();
  const [tasks, setTasks] = useState(initialTasks);
  const [prevTasks, setPrevTasks] = useState(initialTasks);
  if (initialTasks !== prevTasks) { setPrevTasks(initialTasks); setTasks(initialTasks); }
  const [view, setView] = useState<"list" | "board">("list");

  const openId = params.get("task");
  const openTask = openId ? tasks.find((t) => t.id === openId) ?? null : null;
  const titleById = new Map(tasks.map((t) => [t.id, { title: t.title, status: t.status as string }]));
  const openDeps: TaskDep[] = openTask
    ? deps.filter((d) => d.task_id === openTask.id).map((d) => ({ id: d.id, blocker_id: d.blocked_by_task_id, title: titleById.get(d.blocked_by_task_id)?.title ?? "—", status: titleById.get(d.blocked_by_task_id)?.status ?? "todo" }))
    : [];
  const candidateTasks = openTask ? tasks.filter((t) => t.id !== openTask.id).map((t) => ({ id: t.id, title: t.title })) : [];

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
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          {tasks.length > 0 && <ViewToggle view={view} onChange={setView} onDark={onDark} />}
          {newBtn}
        </div>
      </div>

      {tasks.length === 0 ? (
        <EmptyPanel icon={<ListChecks size={22} />} title="No tasks yet" description="Create a task for this client — assign it to your team or to the client, and they'll see it on their Tasks page." action={newBtn} />
      ) : view === "board" ? (
        <TaskKanban
          role="staff"
          tasks={tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, assigneeName: t.assigneeName, due_date: t.due_date, is_milestone: t.is_milestone, blocked_by_client: t.blocked_by_client, client_signed_off_at: t.client_signed_off_at }))}
          deps={deps.map((d) => ({ task_id: d.task_id, blocked_by_task_id: d.blocked_by_task_id }))}
          onStatusChange={changeStatus}
          onOpen={(id) => router.push(`/clients/${clientId}/tasks?task=${id}`, { scroll: false })}
        />
      ) : (
        <ul className="rd-stagger" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.7rem" }}>
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
          deps={openDeps}
          candidateTasks={candidateTasks}
          open
          onOpenChange={(v) => { if (!v) router.push(`/clients/${clientId}/tasks`, { scroll: false }); }}
        />
      )}
    </div>
  );
}
