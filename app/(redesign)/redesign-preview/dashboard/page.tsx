import { requireProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatMetricValue, formatMonthYear } from "@/lib/format";
import { labelOf, PROGRAMS, DELIVERABLE_TYPES } from "@/lib/constants";
import { RedesignDashboard, type DashData } from "@/components/redesign/keystones/dashboard";
import { PreviewNotice } from "@/components/redesign/preview-notice";

type MetricRow = {
  period: string;
  value_numeric: number | null;
  value_text: string | null;
  definition: { label: string; unit: string; sort_order: number } | null;
};

/**
 * Keystone 2 — CLIENT DASHBOARD. A NEW presentation reading the SAME real data as
 * the live dashboard: the program-client query chain is replicated verbatim
 * (RLS-scoped createClient(), read-only — no writes, no logic changes). Computation
 * (KPIs, roadmap %, day label, live pill) mirrors components/client/client-dashboard.tsx.
 */
export default async function RedesignDashboardPreview() {
  const profile = await requireProfile();

  if (profile.role !== "client" || !profile.client_id) {
    return (
      <PreviewNotice
        title="Sign in as a client to preview"
        body="This keystone renders a client's own live dashboard. Sign in with a client account (the demo client works) to see it wired to real data."
      />
    );
  }

  const supabase = await createClient();

  const { data: typeRow } = await supabase.from("client_clients").select("client_type").maybeSingle();
  if (typeRow?.client_type === "project") {
    return (
      <PreviewNotice
        title="This account is a project client"
        body="The dashboard keystone previews the 90-day PROGRAM dashboard. The signed-in account is a project client, which uses a different board (out of scope for R0)."
      />
    );
  }

  const [
    { data: client },
    { data: partner },
    { data: checklist },
    { data: milestones },
    { data: metricRows },
    { data: deliverables },
    { data: report },
    { data: updates },
    { data: needsReview },
  ] = await Promise.all([
    supabase.from("client_clients").select("*").maybeSingle(),
    supabase.from("client_partner").select("*").maybeSingle(),
    supabase
      .from("checklist_items")
      .select("id, phase_label, title, link_url, assignee, is_done, sort_order")
      .eq("kind", "onboarding")
      .order("sort_order"),
    supabase.from("milestones").select("id, title, phase_label, status, sort_order").order("sort_order"),
    supabase
      .from("metric_entries")
      .select("period, value_numeric, value_text, definition:metric_definitions!inner(label, unit, sort_order)")
      .order("period", { ascending: false })
      .limit(60),
    supabase.from("deliverables").select("id, title, status, type").order("created_at", { ascending: false }).limit(4),
    supabase.from("reports").select("id, title, summary").order("period_end", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("updates").select("id, title, body, pinned, created_at").order("created_at", { ascending: false }).limit(6),
    supabase.from("deliverables").select("id").eq("status", "needs_review"),
  ]);

  const rows = (metricRows ?? []) as unknown as MetricRow[];
  const periods = [...new Set(rows.map((r) => r.period))].sort().reverse();
  const latest = periods[0];
  const prev = periods[1];
  const monthLabel = latest ? formatMonthYear(latest) : "";

  const kpis = rows
    .filter((r) => r.period === latest && r.definition && r.definition.unit !== "text")
    .sort((a, b) => (a.definition!.sort_order ?? 0) - (b.definition!.sort_order ?? 0))
    .slice(0, 4)
    .map((r) => {
      const label = r.definition!.label;
      const unit = r.definition!.unit;
      const before =
        rows.find((x) => x.period === prev && x.definition?.label === label)?.value_numeric ?? null;
      const cur = r.value_numeric ?? null;
      const delta = cur !== null && before !== null ? cur - before : null;
      return {
        label,
        unit,
        curDisplay: formatMetricValue(unit, cur, null),
        delta,
        beforeDisplay: before !== null ? before.toLocaleString() : null,
      };
    });

  const ms = milestones ?? [];
  const msDone = ms.filter((m) => m.status === "done").length;
  const msPct = ms.length ? Math.round((msDone / ms.length) * 100) : 0;

  let dayLabel: string | null = null;
  if (client?.start_date) {
    const start = new Date(`${client.start_date}T00:00:00`);
    const days = Math.floor((Date.now() - start.getTime()) / 86_400_000) + 1;
    if (days >= 1) dayLabel = `Day ${Math.min(days, 90)} of 90`;
  }

  const pinned = (updates ?? []).filter((u) => u.pinned);
  const recent = (updates ?? []).filter((u) => !u.pinned);
  const updateFeed = [...pinned, ...recent].slice(0, 4);

  const citations =
    rows.find((r) => r.period === latest && /citation/i.test(r.definition?.label ?? ""))?.value_numeric ?? null;
  const livePill =
    citations != null ? `Live · +${citations.toLocaleString()} this month` : "Live · updated monthly";

  const data: DashData = {
    firstName: (profile.full_name ?? "there").split(" ")[0],
    programLabel: labelOf(PROGRAMS, client?.program),
    monthLabel,
    dayLabel,
    livePill,
    reviewCount: (needsReview ?? []).length,
    kpis,
    checklist: (checklist ?? []).map((c) => ({
      id: c.id,
      phase_label: c.phase_label,
      title: c.title,
      assignee: c.assignee as "client" | "team",
      is_done: c.is_done,
    })),
    milestones: ms.map((m) => ({ id: m.id, title: m.title, phase_label: m.phase_label, status: m.status })),
    msDone,
    msPct,
    deliverables: (deliverables ?? []).map((d) => ({
      id: d.id,
      title: d.title,
      typeLabel: labelOf(DELIVERABLE_TYPES, d.type),
      status: d.status,
    })),
    report: report ? { title: report.title, summary: report.summary } : null,
    updates: updateFeed.map((u) => ({ id: u.id, title: u.title, body: u.body, pinned: u.pinned })),
    partner: partner ? { full_name: partner.full_name, email: partner.email, avatar_url: partner.avatar_url } : null,
    commsChannel: client?.comms_channel ?? null,
  };

  return <RedesignDashboard data={data} />;
}
