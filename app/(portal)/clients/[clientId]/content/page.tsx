import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { ContentCalendar } from "@/components/redesign/staff/content-calendar";
import { type ContentItem } from "@/components/content/content-dialog";

export default async function ContentPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  await requireClientAccess(clientId);
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("content_items")
    .select(
      "id, title, platform, content_type, status, publish_date, cta, core_message, notes, asset_url, views_after_posting, visible_to_client",
    )
    .eq("client_id", clientId)
    .order("publish_date", { ascending: true, nullsFirst: false });

  return (
    <div className="space-y-4">
      <ContentCalendar clientId={clientId} items={(items ?? []) as ContentItem[]} />
    </div>
  );
}
