import Link from "next/link";
import { Clock, ClipboardList, FileText, FolderKanban, Megaphone, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { formatDate, formatMonthYear } from "@/lib/format";
import { PROJECT_STATUSES, labelOf } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/banner";
import { StatusChip } from "@/components/ui/status-chip";
import { MetricValue } from "@/components/ui/metric-value";
import { MetricDelta } from "@/components/ui/metric-delta";

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

const ACTIVITY: Record<string, { icon: typeof Package; bg: string; fg: string }> = {
  Deliverable: { icon: Package, bg: "#FEF3C7", fg: "#92400E" },
  Update: { icon: Megaphone, bg: "#DBEAFE", fg: "#1D4ED8" },
  Report: { icon: FileText, bg: "#DCFCE7", fg: "#166534" },
};

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

  // per-phase counts
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
  const ringCirc = 2 * Math.PI * 30;

  // Project-client overview: project counts by status + recent projects.
  const isProject = client?.client_type === "project";
  const projectList = (projects ?? []) as {
    id: string;
    title: string;
    status: string;
    due_date: string | null;
  }[];
  const projByStatus = PROJECT_STATUSES.map((s) => ({
    ...s,
    count: projectList.filter((p) => p.status === s.value).length,
  }));
  const activeCount = projectList.filter(
    (p) => p.status === "active" || p.status === "in_review",
  ).length;
  const recentProjects = projectList.slice(0, 5);

  const activityCard = (
    <Card size="sm">
      <CardContent className="flex flex-col gap-2">
        <h3 className="text-[14.5px] font-semibold">Recent activity</h3>
        {activity.length === 0 ? (
          <p className="flex items-center gap-2 py-6 text-sm text-ink-3">
            <ClipboardList className="size-4" /> No activity yet.
          </p>
        ) : (
          <ul className="flex flex-col">
            {activity.map((a, i) => {
              const cfg = ACTIVITY[a.kind] ?? ACTIVITY.Update;
              const Icon = cfg.icon;
              return (
                <li key={i} className="flex items-center gap-3 border-b border-row-divider py-2.5 last:border-0">
                  <span
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-full"
                    style={{ background: cfg.bg, color: cfg.fg }}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px]">{a.title}</span>
                  <span className="shrink-0 text-xs text-ink-3">{formatDate(a.at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {waitingList.length > 0 && (
        <Banner
          tone="amber"
          icon={<Clock />}
          action={
            <Button asChild variant="link" size="sm" className="text-amber-700 hover:text-amber-800">
              <Link href={`${base}/deliverables`}>Open deliverable →</Link>
            </Button>
          }
        >
          <span className="font-semibold text-ink">Waiting on client</span>
          <span className="text-ink-2">
            {" "}— {waitingList[0]?.title ?? `${waitingList.length} deliverable(s)`} awaiting review.
          </span>
        </Banner>
      )}

      {isProject && (
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr_1.25fr]">
          {/* projects summary */}
          <Card size="sm">
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  <FolderKanban className="size-6" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[14.5px] font-semibold">Projects</h3>
                  <p className="text-xs text-ink-3 tabular-nums">
                    {projectList.length} total · {activeCount} in flight
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 text-xs">
                {projByStatus.map((s) => (
                  <div key={s.value} className="flex items-center justify-between">
                    <span className="text-ink-2">{s.label}</span>
                    <span className="tabular-nums text-ink-3">{s.count}</span>
                  </div>
                ))}
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`${base}/projects`}>Open projects</Link>
              </Button>
            </CardContent>
          </Card>

          {/* recent projects */}
          <Card size="sm">
            <CardContent className="flex flex-col gap-3">
              <h3 className="text-[14.5px] font-semibold">Recent projects</h3>
              {recentProjects.length === 0 ? (
                <p className="text-sm text-ink-3">
                  No projects yet — create one from the Projects tab.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {recentProjects.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-2 border-b border-row-divider py-2.5 last:border-0"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] font-medium">{p.title}</span>
                        {p.due_date && (
                          <span className="block text-xs text-ink-3">
                            Due {formatDate(p.due_date)}
                          </span>
                        )}
                      </span>
                      <StatusChip kind="project" value={p.status} />
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild size="sm">
                <Link href={`${base}/projects`}>Manage projects</Link>
              </Button>
            </CardContent>
          </Card>

          {activityCard}
        </div>
      )}

      {!isProject && (
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr_1.25fr]">
        {/* checklist progress */}
        <Card size="sm">
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
                  <circle cx="40" cy="40" r="30" fill="none" stroke="#F4F4F0" strokeWidth="7" />
                  <circle
                    cx="40" cy="40" r="30" fill="none" stroke="#D97706" strokeWidth="7"
                    strokeLinecap="round" strokeDasharray={ringCirc}
                    strokeDashoffset={ringCirc * (1 - pct / 100)}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[15px] font-bold tabular-nums">
                  {pct}%
                </span>
              </div>
              <div className="min-w-0">
                <h3 className="text-[14.5px] font-semibold">Checklist progress</h3>
                <p className="text-xs text-ink-3 tabular-nums">{done} of {total} steps done</p>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 text-xs">
              {[...phases.entries()].map(([p, g]) => (
                <div key={p} className="flex items-center justify-between">
                  <span className="text-ink-2">{p}</span>
                  <span className="tabular-nums text-ink-3">{g.done}/{g.total}</span>
                </div>
              ))}
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={`${base}/checklist`}>Open checklist</Link>
            </Button>
          </CardContent>
        </Card>

        {/* latest metrics */}
        <Card size="sm">
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-[14.5px] font-semibold">Latest metrics</h3>
                <p className="text-xs text-ink-3">
                  {latestPeriod
                    ? `Entered ${formatMonthYear(latestPeriod)}${
                        snapshot[0]?.e.creator?.full_name || snapshot[0]?.e.creator?.email
                          ? ` by ${snapshot[0]?.e.creator?.full_name ?? snapshot[0]?.e.creator?.email}`
                          : ""
                      }`
                    : "No entries yet"}
                </p>
              </div>
            </div>
            {snapshot.length === 0 ? (
              <p className="text-sm text-ink-3">Enter monthly metrics to see a snapshot here.</p>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {snapshot.map(({ e, delta }, i) => {
                  return (
                    <div key={i}>
                      <div className="text-[11px] font-bold tracking-wider text-ink-3 uppercase">
                        {e.definition?.label}
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <MetricValue size="snapshot" className="truncate" value={e.value_numeric} unit={e.definition?.unit}>
                          {fmtMetric(e)}
                        </MetricValue>
                        {delta !== null && <MetricDelta delta={delta} variant="inline" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <Button asChild size="sm">
              <Link href={`${base}/metrics`}>
                Enter {latestPeriod ? formatMonthYear(latestPeriod).split(" ")[0] : "month"} metrics
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* activity */}
        {activityCard}
      </div>
      )}
    </div>
  );
}
