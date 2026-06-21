import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatReportPeriod } from "@/lib/format";
import { RedesignPerformance, type PerfData } from "@/components/redesign/keystones/performance";

export default async function ClientPerformancePage() {
  const profile = await requireRole(["client"]);
  const supabase = await createClient();

  // Program-only page — project clients get their Value Proof "Results" view instead.
  const { data: typeRow } = await supabase.from("client_clients").select("client_type").maybeSingle();
  if (typeRow?.client_type === "project") redirect("/results");

  const [{ data: defs }, { data: entries }, { data: competitors }, { data: reports }] = await Promise.all([
    supabase.from("metric_definitions").select("id, label, unit, sort_order").order("sort_order"),
    supabase.from("metric_entries").select("definition_id, period, value_numeric, value_text").order("period"),
    supabase
      .from("competitors")
      .select("id, name_or_handle, niche, follower_count, avg_views, top_content_format, hook_style, whats_working, gap_notes, adapted_idea, priority")
      .order("priority", { ascending: false }),
    supabase.from("reports").select("id, title, period_start, period_end, summary, pdf_path").order("period_end", { ascending: false }),
  ]);

  const allDefs = (defs ?? []) as { id: string; label: string; unit: string }[];
  const data: PerfData = {
    firstName: (profile.full_name ?? "there").split(" ")[0],
    avatarSrc: profile.avatar_url,
    clientId: profile.client_id ?? undefined,
    numericDefs: allDefs.filter((d) => d.unit !== "text").map((d) => ({ id: d.id, label: d.label, unit: d.unit })),
    textDefs: allDefs.filter((d) => d.unit === "text").map((d) => ({ id: d.id, label: d.label, unit: d.unit })),
    entries: (entries ?? []).map((e) => ({ definition_id: e.definition_id, period: e.period, value_numeric: e.value_numeric, value_text: e.value_text })),
    competitors: (competitors ?? []).map((c) => ({
      id: c.id, name: c.name_or_handle, niche: c.niche, followers: c.follower_count, avgViews: c.avg_views,
      topFormat: c.top_content_format, hook: c.hook_style, working: c.whats_working, gap: c.gap_notes, play: c.adapted_idea, priority: c.priority,
    })),
    reports: (reports ?? []).map((r) => ({ id: r.id, title: r.title, periodLabel: formatReportPeriod(r.period_start, r.period_end), summary: r.summary, pdfPath: r.pdf_path })),
  };

  return <RedesignPerformance data={data} embedded />;
}
