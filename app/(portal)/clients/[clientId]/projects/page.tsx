import { redirect } from "next/navigation";
import { requireClientAccess } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  StaffProjectsManager,
  type StaffProject,
  type ProjectDeliverable,
} from "@/components/projects/staff-projects-manager";

export default async function ClientProjectsPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  await requireClientAccess(clientId);
  const supabase = await createClient();

  // Projects management is a project-type-client surface only.
  const { data: client } = await supabase
    .from("clients")
    .select("client_type")
    .eq("id", clientId)
    .maybeSingle();
  if (client?.client_type !== "project") redirect(`/clients/${clientId}`);

  const [{ data: projects }, { data: deliverables }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, title, description, status, start_date, due_date")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("deliverables")
      .select("id, title, type, status, visible_to_client, project_id")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
  ]);

  const byProject = new Map<string, ProjectDeliverable[]>();
  for (const d of deliverables ?? []) {
    if (!d.project_id) continue;
    const arr = byProject.get(d.project_id) ?? [];
    arr.push(d);
    byProject.set(d.project_id, arr);
  }
  const list: StaffProject[] = (projects ?? []).map((p) => ({
    ...p,
    deliverables: byProject.get(p.id) ?? [],
  }));

  return (
    <div className="space-y-4">
      <StaffProjectsManager clientId={clientId} projects={list} />
    </div>
  );
}
