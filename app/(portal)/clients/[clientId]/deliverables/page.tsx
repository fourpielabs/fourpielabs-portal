import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import {
  DeliverablesList,
} from "@/components/deliverables/deliverables-list";
import { type DeliverableRow } from "@/components/deliverables/deliverable-dialog";

export default async function DeliverablesPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  await requireClientAccess(clientId);
  const supabase = await createClient();

  const [{ data: client }, { data: deliverables }] = await Promise.all([
    supabase.from("clients").select("client_type").eq("id", clientId).maybeSingle(),
    supabase
      .from("deliverables")
      .select(
        "id, title, description, type, status, due_date, preview_url, visible_to_client, file_path, created_at, client_approved_at, project_id",
      )
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
  ]);

  const clientType = (client?.client_type as "program" | "project") ?? "program";
  // Only project clients can link deliverables to projects — fetch their projects.
  let projects: { id: string; title: string }[] = [];
  if (clientType === "project") {
    const { data } = await supabase
      .from("projects")
      .select("id, title")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    projects = data ?? [];
  }

  return (
    <div className="space-y-4">
      <DeliverablesList
        clientId={clientId}
        deliverables={(deliverables ?? []) as DeliverableRow[]}
        projects={projects}
        clientType={clientType}
      />
    </div>
  );
}
