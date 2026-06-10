import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  ClientContent,
  type ClientContentItem,
} from "@/components/client/client-content";

export default async function ClientContentPage() {
  await requireRole(["client"]);
  const supabase = await createClient();

  // RLS returns only visible_to_client items for the client's own client
  const { data: items } = await supabase
    .from("content_items")
    .select("id, title, platform, content_type, status, publish_date, asset_url")
    .order("publish_date", { ascending: true, nullsFirst: false });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Content calendar</h1>
        <p className="text-muted-foreground">What we&apos;re planning and publishing.</p>
      </div>
      <ClientContent items={(items ?? []) as ClientContentItem[]} />
    </div>
  );
}
