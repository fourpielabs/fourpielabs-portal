import { requireClientAccess } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getAssignableMembers } from "@/lib/tasks";
import { StaffTasksManager, type StaffTask } from "@/components/tasks/staff-tasks-manager";

export default async function ClientTasksPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  await requireClientAccess(clientId);
  const supabase = await createClient();

  const [{ data: tasks }, members] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, title, description, status, assignee_id, due_date, visible_to_client, source_message_id",
      )
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    getAssignableMembers(clientId),
  ]);

  const nameById = new Map(members.map((m) => [m.id, m.name]));
  const list: StaffTask[] = (tasks ?? []).map((t) => ({
    ...t,
    status: t.status as StaffTask["status"],
    assigneeName: t.assignee_id ? nameById.get(t.assignee_id) ?? null : null,
  }));

  return (
    <div className="space-y-4">
      <StaffTasksManager clientId={clientId} tasks={list} members={members} />
    </div>
  );
}
