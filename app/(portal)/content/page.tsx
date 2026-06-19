import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { ContentBody, type ClientContentItem } from "@/components/redesign/client/content-body";

export default async function ClientContentPage() {
  await requireRole(["client"]);
  const supabase = await createClient();

  // Program-only page — project clients are routed to their projects board.
  const { data: typeRow } = await supabase.from("client_clients").select("client_type").maybeSingle();
  if (typeRow?.client_type === "project") redirect("/dashboard");

  // RLS returns only visible_to_client items for the client's own client
  const { data: items } = await supabase
    .from("content_items")
    .select("id, title, platform, content_type, status, publish_date, asset_url")
    .order("publish_date", { ascending: true, nullsFirst: false });

  return <ContentBody items={(items ?? []) as ClientContentItem[]} />;
}
