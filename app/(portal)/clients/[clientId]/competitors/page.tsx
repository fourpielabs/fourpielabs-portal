import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import {
  CompetitorsManager,
  type Competitor,
} from "@/components/competitors/competitors-manager";

export default async function CompetitorsPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  await requireClientAccess(clientId);
  const supabase = await createClient();

  const { data: competitors } = await supabase
    .from("competitors")
    .select(
      "id, name_or_handle, niche, follower_count, avg_views, top_content_format, hook_style, whats_working, gap_notes, adapted_idea, priority, visible_to_client",
    )
    .eq("client_id", clientId)
    .order("priority", { ascending: false });

  return (
    <div className="space-y-4">
      <CompetitorsManager
        clientId={clientId}
        competitors={(competitors ?? []) as Competitor[]}
      />
    </div>
  );
}
