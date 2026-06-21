import { requireClientAccess } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssignableMembers, type TaskChecklistItem, type TimeEntry } from "@/lib/tasks";
import { StaffTasksManager, type StaffTask } from "@/components/redesign/staff/staff-task-board";

export default async function ClientTasksPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();

  const [{ data: tasks }, { data: depRows }, members] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, title, description, status, assignee_id, due_date, visible_to_client, source_message_id, created_by, created_at, is_milestone, blocked_by_client, blocked_reason, client_signed_off_at",
      )
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    supabase.from("task_dependencies").select("id, task_id, blocked_by_task_id"),
    getAssignableMembers(clientId),
  ]);

  const nameById = new Map(members.map((m) => [m.id, m.name]));

  // Subtasks for this client's tasks (RLS = team_all/admin_all, redundantly scoped to
  // these task ids). Grouped onto each task for the card progress + the detail list.
  const taskIds = (tasks ?? []).map((t) => t.id);
  const checklistByTask = new Map<string, TaskChecklistItem[]>();
  if (taskIds.length) {
    const { data: items } = await supabase
      .from("task_checklist_items")
      .select("id, task_id, title, is_done, sort_order")
      .in("task_id", taskIds)
      .order("sort_order", { ascending: true });
    for (const it of items ?? []) {
      const arr = checklistByTask.get(it.task_id) ?? [];
      arr.push({ id: it.id, title: it.title, is_done: it.is_done, sort_order: it.sort_order });
      checklistByTask.set(it.task_id, arr);
    }
  }

  // STAFF-ONLY time entries per task (RLS = admin_all/team_all; clients have no
  // policy so this never returns for them, and only the staff detail consumes it).
  const timeByTask = new Map<string, TimeEntry[]>();
  if (taskIds.length) {
    const { data: te } = await supabase
      .from("time_entries")
      .select("id, task_id, user_id, started_at, ended_at")
      .in("task_id", taskIds)
      .order("started_at", { ascending: false });
    for (const e of te ?? []) {
      const arr = timeByTask.get(e.task_id) ?? [];
      arr.push({
        id: e.id,
        task_id: e.task_id,
        user_id: e.user_id,
        userName: nameById.get(e.user_id) ?? null,
        started_at: e.started_at,
        ended_at: e.ended_at,
      });
      timeByTask.set(e.task_id, arr);
    }
  }

  // Resolve each sourced task's REAL thread_type (service-role) so the detail's
  // "Created from a message" link picks the right thread + tab (shared vs internal) —
  // fixing the old hardcoded-shared link.
  const sourceIds = [
    ...new Set((tasks ?? []).map((t) => t.source_message_id).filter(Boolean)),
  ] as string[];
  const threadTypeById = new Map<string, "client_shared" | "internal">();
  if (sourceIds.length) {
    const admin = createAdminClient();
    const { data: msgs } = await admin.from("messages").select("id, thread_type").in("id", sourceIds);
    for (const m of msgs ?? []) threadTypeById.set(m.id as string, m.thread_type as "client_shared" | "internal");
  }

  const list: StaffTask[] = (tasks ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status as StaffTask["status"],
    assignee_id: t.assignee_id,
    due_date: t.due_date,
    visible_to_client: t.visible_to_client,
    source_message_id: t.source_message_id,
    assigneeName: t.assignee_id ? nameById.get(t.assignee_id) ?? null : null,
    createdByName: t.created_by ? nameById.get(t.created_by) ?? null : null,
    created_at: t.created_at,
    sourceThreadType: t.source_message_id ? threadTypeById.get(t.source_message_id) ?? null : null,
    checklist: checklistByTask.get(t.id) ?? [],
    timeEntries: timeByTask.get(t.id) ?? [],
    is_milestone: t.is_milestone ?? false,
    blocked_by_client: t.blocked_by_client ?? false,
    blocked_reason: t.blocked_reason,
    client_signed_off_at: t.client_signed_off_at,
  }));

  return (
    <div className="space-y-4">
      <StaffTasksManager clientId={clientId} currentUserId={me.id} tasks={list} members={members} deps={(depRows ?? []) as { id: string; task_id: string; blocked_by_task_id: string }[]} />
    </div>
  );
}
