import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { type ClientUpdateValues } from "@/lib/schemas";
import { type TeamMember } from "@/components/redesign/staff/assignment-manager";
import { ClientSettingsBody } from "@/components/redesign/staff/client-settings-body";

export default async function ClientSettingsPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  await requireRole(["admin"]); // P2: client management is admin-only
  const { clientId } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select(
      "id, name, slug, industry, program, status, website_url, start_date, service_type, investment, comms_channel, internal_notes, client_type",
    )
    .eq("id", clientId)
    .single();

  if (!client) notFound();

  const [{ data: team }, { data: assignments }, { data: perms }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "team")
      .eq("is_active", true)
      .order("full_name"),
    supabase
      .from("client_assignments")
      .select("user_id")
      .eq("client_id", clientId),
    supabase
      .from("client_field_permissions")
      .select("can_edit_website_url, can_edit_comms_channel")
      .eq("client_id", clientId)
      .maybeSingle(),
  ]);

  const defaults: ClientUpdateValues = {
    id: client.id,
    name: client.name,
    industry: client.industry,
    program: client.program,
    status: client.status,
    website_url: client.website_url ?? "",
    start_date: client.start_date ?? "",
    service_type: client.service_type ?? "",
    investment: client.investment ?? "",
    comms_channel: client.comms_channel ?? "",
    internal_notes: client.internal_notes ?? "",
  };

  const assignedIds = (assignments ?? []).map((a) => a.user_id);

  return (
    <ClientSettingsBody
      defaults={defaults}
      clientId={client.id}
      isProject={client.client_type === "project"}
      team={(team ?? []) as TeamMember[]}
      assignedIds={assignedIds}
      fieldPermissions={{
        can_edit_website_url: perms?.can_edit_website_url ?? false,
        can_edit_comms_channel: perms?.can_edit_comms_channel ?? false,
      }}
    />
  );
}
