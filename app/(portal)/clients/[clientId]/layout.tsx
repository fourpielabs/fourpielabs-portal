import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { WorkspaceChrome, type WorkspaceClient } from "@/components/redesign/staff/workspace-chrome";

export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  // Guard: admin or assigned team only. Unassigned team / clients -> /clients.
  const profile = await requireClientAccess(clientId);

  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, slug, status, program, client_type, start_date, logo_url")
    .eq("id", clientId)
    .single();
  if (!client) notFound();

  const isProject = client.client_type === "project";
  let dayLabel: string | null = null;
  if (!isProject && client.start_date) {
    const start = new Date(`${client.start_date}T00:00:00`);
    const days = Math.floor((Date.now() - start.getTime()) / 86_400_000) + 1;
    if (days >= 1) dayLabel = `Day ${Math.min(days, 90)} of 90`;
  }

  return (
    <WorkspaceChrome client={client as WorkspaceClient} isAdmin={profile.role === "admin"} dayLabel={dayLabel}>
      {children}
    </WorkspaceChrome>
  );
}
