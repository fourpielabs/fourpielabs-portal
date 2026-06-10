import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { ReportsManager, type Report } from "@/components/reports/reports-manager";

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  await requireClientAccess(clientId);
  const supabase = await createClient();

  const { data: reports } = await supabase
    .from("reports")
    .select("id, title, period_start, period_end, summary, pdf_path, published, published_at")
    .eq("client_id", clientId)
    .order("period_end", { ascending: false });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Reports</h2>
        <p className="text-sm text-muted-foreground">
          Monthly performance reports. Drafts stay hidden; clients only see
          published reports (enforced by RLS).
        </p>
      </div>
      <ReportsManager clientId={clientId} reports={(reports ?? []) as Report[]} />
    </div>
  );
}
