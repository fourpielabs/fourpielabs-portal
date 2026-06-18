import { requireClientAccess } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
        "id, title, description, status, assignee_id, due_date, visible_to_client, source_message_id, created_by, created_at",
      )
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    getAssignableMembers(clientId),
  ]);

  const nameById = new Map(members.map((m) => [m.id, m.name]));

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
  }));

  return (
    <div className="space-y-4">
      <StaffTasksManager clientId={clientId} tasks={list} members={members} />
    </div>
  );
}
