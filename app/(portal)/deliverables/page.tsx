import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { DeliverablesList, type DeliverableRow } from "@/components/redesign/client/deliverables-list";

export default async function ClientDeliverablesPage() {
  const profile = await requireRole(["client"]);
  const supabase = await createClient();

  // RLS: visible_to_client deliverables for the client's own client
  const { data: deliverables } = await supabase
    .from("deliverables")
    .select(
      "id, title, description, type, status, due_date, delivered_at, preview_url, file_path, client_approved_at",
    )
    .order("created_at", { ascending: false });

  return <DeliverablesList deliverables={(deliverables ?? []) as DeliverableRow[]} clientId={profile.client_id!} />;
}
