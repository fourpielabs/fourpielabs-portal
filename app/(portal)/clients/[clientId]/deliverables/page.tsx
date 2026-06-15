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

  const { data: deliverables } = await supabase
    .from("deliverables")
    .select(
      "id, title, description, type, status, due_date, preview_url, visible_to_client, file_path, created_at, client_approved_at",
    )
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <DeliverablesList
        clientId={clientId}
        deliverables={(deliverables ?? []) as DeliverableRow[]}
      />
    </div>
  );
}
