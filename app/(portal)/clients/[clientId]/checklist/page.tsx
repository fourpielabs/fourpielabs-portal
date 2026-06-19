import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import {
  ChecklistEditor,
  type ChecklistItem,
} from "@/components/redesign/staff/checklist-editor";

export default async function ChecklistPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  await requireClientAccess(clientId);
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("checklist_items")
    .select(
      "id, kind, phase_label, title, link_url, assignee, sort_order, is_done, visible_to_client",
    )
    .eq("client_id", clientId)
    .order("sort_order");

  return (
    <div className="space-y-4">
      <ChecklistEditor
        clientId={clientId}
        items={(items ?? []) as ChecklistItem[]}
      />
    </div>
  );
}
