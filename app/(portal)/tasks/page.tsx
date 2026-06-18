import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getAssignableMembers } from "@/lib/tasks";
import { ClientTaskBoard, type ClientTaskRow } from "@/components/tasks/client-task-board";

export default async function MyTasksPage() {
  const profile = await requireRole(["client"]);
  const supabase = await createClient();

  // tasks + the assignee circle in parallel (members no longer adds to the critical
  // path). RLS scopes tasks to the client's own client_id AND visible_to_client.
  const [{ data: tasks }, members] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, description, status, assignee_id, due_date, source_message_id, created_by, created_at")
      .order("created_at", { ascending: false }),
    profile.client_id ? getAssignableMembers(profile.client_id) : Promise.resolve([]),
  ]);
  const nameById = new Map(members.map((m) => [m.id, m.name]));
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
  }));

  return <ClientTaskBoard tasks={list} members={members} />;
}
