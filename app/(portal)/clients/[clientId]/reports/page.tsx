import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { ReportsManager, type Report } from "@/components/redesign/staff/reports-manager";

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
      <ReportsManager clientId={clientId} reports={(reports ?? []) as Report[]} />
    </div>
  );
}
