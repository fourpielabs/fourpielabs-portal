import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getAssignableMembers } from "@/lib/tasks";
import { ClientTaskBoard, type ClientTaskRow } from "@/components/tasks/client-task-board";

export default async function MyTasksPage() {
  const profile = await requireRole(["client"]);
  const supabase = await createClient();

  // RLS scopes to the client's own client_id AND visible_to_client (internal/
  // staff-only tasks never reach here — the boundary).
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, description, status, assignee_id, due_date, source_message_id")
    .order("created_at", { ascending: false });

  const members = profile.client_id ? await getAssignableMembers(profile.client_id) : [];
  const nameById = new Map(members.map((m) => [m.id, m.name]));
  const list: ClientTaskRow[] = (tasks ?? []).map((t) => ({
    ...t,
    status: t.status as ClientTaskRow["status"],
    assigneeName: t.assignee_id ? nameById.get(t.assignee_id) ?? null : null,
  }));

  return <ClientTaskBoard tasks={list} members={members} />;
}
