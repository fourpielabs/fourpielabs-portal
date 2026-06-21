import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getAssignableMembers, type TaskChecklistItem } from "@/lib/tasks";
import type { ClientTaskRow } from "@/components/tasks/client-task-board";
import { TaskBoard } from "@/components/redesign/client/task-board";

export default async function MyTasksPage() {
  const profile = await requireRole(["client"]);
  const supabase = await createClient();

  // tasks + subtasks + the assignee circle in parallel. RLS scopes tasks to the
  // client's own client_id AND visible_to_client; the task_checklist_items SELECT
  // policy mirrors it (items only on a visible own task), so a bare select is safe.
  const [{ data: tasks }, { data: items }, { data: deps }, members] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, description, status, assignee_id, due_date, source_message_id, created_by, created_at, is_milestone, blocked_by_client, blocked_reason, client_signed_off_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("task_checklist_items")
      .select("id, task_id, title, is_done, sort_order")
      .order("sort_order", { ascending: true }),
    supabase.from("task_dependencies").select("id, task_id, blocked_by_task_id"),
    profile.client_id ? getAssignableMembers(profile.client_id) : Promise.resolve([]),
  ]);
  const nameById = new Map(members.map((m) => [m.id, m.name]));

  const checklistByTask = new Map<string, TaskChecklistItem[]>();
  for (const it of items ?? []) {
    const arr = checklistByTask.get(it.task_id) ?? [];
    arr.push({ id: it.id, title: it.title, is_done: it.is_done, sort_order: it.sort_order });
    checklistByTask.set(it.task_id, arr);
  }
  const list: ClientTaskRow[] = (tasks ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status as ClientTaskRow["status"],
    assignee_id: t.assignee_id,
    due_date: t.due_date,
    source_message_id: t.source_message_id,
    assigneeName: t.assignee_id ? nameById.get(t.assignee_id) ?? null : null,
    createdByName: t.created_by ? nameById.get(t.created_by) ?? null : null,
    created_at: t.created_at,
    // a client's source is always a client_shared message (create_task RPC-enforced),
    // and the client source-link goes to /messages regardless — type is unused here.
    sourceThreadType: t.source_message_id ? "client_shared" : null,
    checklist: checklistByTask.get(t.id) ?? [],
    is_milestone: t.is_milestone ?? false,
    blocked_by_client: t.blocked_by_client ?? false,
    blocked_reason: t.blocked_reason,
    client_signed_off_at: t.client_signed_off_at,
  }));

  return <TaskBoard tasks={list} members={members} deps={(deps ?? []) as { id: string; task_id: string; blocked_by_task_id: string }[]} />;
}
