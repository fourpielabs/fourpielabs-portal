import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import {
  ChecklistEditor,
  type ChecklistItem,
} from "@/components/checklist/checklist-editor";

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
      <div>
        <h2 className="text-lg font-semibold">Checklists</h2>
        <p className="text-sm text-muted-foreground">
          Onboarding and off-boarding. Toggle items done, reorder, set assignee,
          and control client visibility.
        </p>
      </div>
      <ChecklistEditor
        clientId={clientId}
        items={(items ?? []) as ChecklistItem[]}
      />
    </div>
  );
}
