import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { formatMonthYear } from "@/lib/format";
import { PROJECT_STATUSES } from "@/lib/constants";
import { StaffOverviewBody, type OverviewData } from "@/components/redesign/staff/overview-body";

type MetricEntry = {
  value_numeric: number | null;
  value_text: string | null;
  period: string;
  definition: { label: string; unit: string; sort_order: number } | null;
  creator: { full_name: string | null; email: string | null } | null;
};

function fmtMetric(e: MetricEntry): string {
  if (e.definition?.unit === "text") return e.value_text ?? "—";
  if (e.value_numeric === null) return "—";
  if (e.definition?.unit === "currency") return `$${e.value_numeric.toLocaleString()}`;
  if (e.definition?.unit === "percent") return `${e.value_numeric}%`;
  return e.value_numeric.toLocaleString();
}

export default async function ClientOverviewPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  await requireClientAccess(clientId);
  const supabase = await createClient();
  const base = `/clients/${clientId}`;

  const [
    { data: client },
    { data: projects },
    { data: checklist },
    { data: entries },
    { data: waiting },
    { data: deliverables },
    { data: updates },
    { data: reports },
  ] = await Promise.all([
    supabase.from("clients").select("client_type").eq("id", clientId).maybeSingle(),
    supabase
      .from("projects")
      .select("id, title, status, due_date, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("checklist_items")
      .select("is_done, phase_label")
      .eq("client_id", clientId)
      .eq("kind", "onboarding"),
    supabase
      .from("metric_entries")
      .select("value_numeric, value_text, period, definition:metric_definitions(label, unit, sort_order), creator:profiles!created_by(full_name, email)")
      .eq("client_id", clientId)
      .order("period", { ascending: false })
      .limit(40),
    supabase
      .from("deliverables")
      .select("id, title")
      .eq("client_id", clientId)
      .eq("status", "needs_review")
      .order("created_at", { ascending: false }),
    supabase
      .from("deliverables")
      .select("id, title, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("updates")
      .select("id, title, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("reports")
      .select("id, title, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const total = checklist?.length ?? 0;
  const done = (checklist ?? []).filter((c) => c.is_done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const phases = new Map<string, { done: number; total: number }>();
  for (const c of checklist ?? []) {
    const p = c.phase_label ?? "Steps";
    const g = phases.get(p) ?? { done: 0, total: 0 };
    g.total++;
    if (c.is_done) g.done++;
    phases.set(p, g);
  }

  const allEntries = (entries ?? []) as unknown as MetricEntry[];
  const periodsDesc = [...new Set(allEntries.map((e) => e.period))];
  const latestPeriod = periodsDesc[0];
  const prevPeriod = periodsDesc[1];
  const snapshot = allEntries
    .filter((e) => e.period === latestPeriod && e.definition)
    .sort((a, b) => (a.definition!.sort_order ?? 0) - (b.definition!.sort_order ?? 0))
    .slice(0, 4)
    .map((e) => {
      const prior = allEntries.find(
        (x) => x.period === prevPeriod && x.definition?.label === e.definition!.label,
      )?.value_numeric ?? null;
      const delta =
        e.definition!.unit !== "text" && e.value_numeric !== null && prior !== null
          ? e.value_numeric - prior
          : null;
      return { e, delta };
    });

  const activity = [
    ...(deliverables ?? []).map((d) => ({ kind: "Deliverable", title: d.title, at: d.created_at })),
    ...(updates ?? []).map((u) => ({ kind: "Update", title: u.title, at: u.created_at })),
    ...(reports ?? []).map((r) => ({ kind: "Report", title: r.title, at: r.created_at })),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 8);

  const waitingList = waiting ?? [];
  const isProject = client?.client_type === "project";
  const projectList = (projects ?? []) as { id: string; title: string; status: string; due_date: string | null }[];
  const projByStatus = PROJECT_STATUSES.map((s) => ({ ...s, count: projectList.filter((p) => p.status === s.value).length }));
  const activeCount = projectList.filter((p) => p.status === "active" || p.status === "in_review").length;

  const data: OverviewData = {
    base,
    isProject,
    waiting: waitingList.length > 0 ? { firstTitle: waitingList[0]?.title ?? null, count: waitingList.length } : null,
    checklist: { pct, done, total, phases: [...phases.entries()].map(([phase, g]) => ({ phase, done: g.done, total: g.total })) },
    metrics: {
      periodLabel: latestPeriod ? formatMonthYear(latestPeriod) : null,
      by: snapshot[0]?.e.creator?.full_name ?? snapshot[0]?.e.creator?.email ?? null,
      enterMonth: latestPeriod ? formatMonthYear(latestPeriod).split(" ")[0] : "month",
      items: snapshot.map(({ e, delta }) => ({
        label: e.definition?.label ?? "",
        value: fmtMetric(e),
        delta,
        deltaSuffix: e.definition?.unit === "percent" ? "%" : "",
      })),
    },
    projects: {
      total: projectList.length,
      active: activeCount,
      byStatus: projByStatus.map((s) => ({ value: s.value, label: s.label, count: s.count })),
      recent: projectList.slice(0, 5).map((p) => ({ id: p.id, title: p.title, status: p.status, due: p.due_date })),
    },
    activity,
  };

  return <StaffOverviewBody data={data} />;
}
