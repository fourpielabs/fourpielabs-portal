import Link from "next/link";
import { ArrowUpRight, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Banner } from "@/components/ui/banner";
import { labelOf, PROGRAMS, DELIVERABLE_TYPES } from "@/lib/constants";
import { formatMetricValue, formatMonthYear } from "@/lib/format";
import { PersonAvatar } from "@/components/ui/person-avatar";
import {
  ClientChecklist,
  type ClientChecklistItem,
} from "@/components/client/client-checklist";
import { ProjectsBoard } from "@/components/client/projects-board";
import { Greeting } from "@/components/client/greeting";
import { StatusChip } from "@/components/ui/status-chip";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MetricValue } from "@/components/ui/metric-value";
import { MetricDelta } from "@/components/ui/metric-delta";
import { Stagger, StaggerItem } from "@/components/motion/motion-primitives";

type MetricRow = {
  period: string;
  value_numeric: number | null;
  value_text: string | null;
  definition: { label: string; unit: string; sort_order: number } | null;
};

const MS_BORDER: Record<string, string> = {
  done: "#B45309",
  in_progress: "#FBBF24",
  upcoming: "#E7E5E0",
};

export async function ClientDashboard({
  clientId,
  userName,
}: {
  clientId: string;
  userName: string | null;
}) {
  const supabase = await createClient();

  // Branch: a `project` client gets the projects board instead of the 90-day
  // program dashboard. The program path below is unchanged for program clients.
  const { data: typeRow } = await supabase
    .from("client_clients")
    .select("client_type")
    .maybeSingle();
  if (typeRow?.client_type === "project") {
    return <ProjectsBoard clientId={clientId} userName={userName} />;
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
    supabase
      .from("milestones")
      .select("id, title, phase_label, status, sort_order")
      .order("sort_order"),
    supabase
      .from("metric_entries")
      .select("period, value_numeric, value_text, definition:metric_definitions!inner(label, unit, sort_order)")
      .order("period", { ascending: false })
      .limit(60),
    supabase
      .from("deliverables")
      .select("id, title, status, type")
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("reports")
      .select("id, title, summary")
      .order("period_end", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("updates")
      .select("id, title, body, pinned, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("deliverables").select("id").eq("status", "needs_review"),
  ]);

  const reviewCount = (needsReview ?? []).length;

  // KPIs: latest vs previous month, numeric metrics
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
      const before = rows.find(
        (x) => x.period === prev && x.definition?.label === label,
      )?.value_numeric ?? null;
      const cur = r.value_numeric ?? null;
      const delta = cur !== null && before !== null ? cur - before : null;
      return { label, unit: r.definition!.unit, cur, before, delta };
    });

  // roadmap
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
  // Greeting uses the signed-in PERSON's first name (not the company name).
  const firstName = (userName ?? "there").split(" ")[0];

  // Honest "Live" pill — derive +N citations this month from the real metric
  // when present (the mockup's "this week" granularity isn't in our schema).
  const citations =
    rows.find((r) => r.period === latest && /citation/i.test(r.definition?.label ?? ""))
      ?.value_numeric ?? null;
  const livePill =
    citations != null
      ? `Live · +${citations.toLocaleString()} citations this month`
      : "Live · updated monthly";

  return (
    <div className="flex flex-col gap-8">
      {/* greeting + CTA row */}
      <div className="flex flex-col gap-4">
        <div>
          <Greeting name={firstName} monthLabel={monthLabel} />
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-2">
            <span className="font-semibold">{labelOf(PROGRAMS, client?.program)}</span>
            {dayLabel && <span className="text-ink-3">· {dayLabel}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild>
            <Link href="/calls-notes">Book a call</Link>
          </Button>
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800">
            <span className="size-1.5 rounded-full bg-amber-600" />
            {livePill}
          </span>
        </div>
      </div>

      {reviewCount > 0 && (
        <Banner
          tone="amber"
          icon={<Clock />}
          action={
            <Button asChild size="sm" variant="amber">
              <Link href="/deliverables">Review now</Link>
            </Button>
          }
        >
          <span className="font-semibold">
            {reviewCount === 1
              ? "1 deliverable is waiting on your review."
              : `${reviewCount} deliverables are waiting on your review.`}
          </span>
        </Banner>
      )}

      {/* KPIs */}
      {kpis.length > 0 && (
        <Stagger as="div" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpis.map((k) => {
            return (
              <StaggerItem key={k.label} lift className="block">
              <Link href="/performance" className="block">
              <Card className="h-full transition-shadow hover:shadow-e3">
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold tracking-wider text-ink-3 uppercase">
                      {k.label}
                    </span>
                    <span className="shrink-0 text-[11px] font-semibold text-ink-3">{monthLabel}</span>
                  </div>
                  <div className="flex items-baseline gap-2.5">
                    <MetricValue size="hero" value={k.cur} unit={k.unit}>
                      {formatMetricValue(k.unit, k.cur, null)}
                    </MetricValue>
                    {k.delta !== null && <MetricDelta delta={k.delta} variant="badge" />}
                  </div>
                  <div className="text-xs text-ink-3 tabular-nums">
                    {k.before !== null ? `vs ${k.before.toLocaleString()} last month` : monthLabel}
                  </div>
                </CardContent>
              </Card>
              </Link>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}

      {/* main: 2fr left / 1fr right rail */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* LEFT */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="flex flex-col gap-4">
              <h2 className="font-display text-xl font-semibold tracking-[-0.01em]">Start here</h2>
              <ClientChecklist items={(checklist ?? []) as ClientChecklistItem[]} />
            </CardContent>
          </Card>

          {ms.length > 0 && (
            <Card>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-xl font-semibold tracking-[-0.01em]">
                      Your 90-day program
                    </h2>
                    {client?.start_date && (
                      <p className="text-xs text-ink-3">
                        {labelOf(PROGRAMS, client?.program)} · started {formatMonthYear(client.start_date)}
                      </p>
                    )}
                  </div>
                  {dayLabel && (
                    <span className="rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                      {dayLabel}
                    </span>
                  )}
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-amber-600" style={{ width: `${msPct}%` }} />
                </div>
                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                  {ms.slice(0, 8).map((m) => (
                    <div
                      key={m.id}
                      className="pt-3"
                      style={{ borderTop: `3px solid ${MS_BORDER[m.status] ?? "#E7E5E0"}` }}
                    >
                      {m.phase_label && (
                        <div className="text-[11px] font-semibold text-ink-3">{m.phase_label}</div>
                      )}
                      <div className="mt-0.5 text-sm font-semibold">{m.title}</div>
                      <div className="mt-2">
                        <StatusChip kind="milestone" value={m.status} />
                      </div>
                    </div>
                  ))}
                </div>
                <Link
                  href="/program"
                  className="text-xs font-semibold text-amber-700 hover:text-amber-800"
                >
                  View full program →
                </Link>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold tracking-[-0.01em]">
                  Latest deliverables
                </h2>
                <Link href="/deliverables" className="text-xs font-semibold text-amber-700 hover:text-amber-800">
                  View all →
                </Link>
              </div>
              {(deliverables ?? []).length === 0 ? (
                <p className="text-sm text-ink-3">Your deliverables show up here as we ship them.</p>
              ) : (
                <ul className="flex flex-col">
                  {(deliverables ?? []).map((d) => (
                    <li
                      key={d.id}
                      className="-mx-2 flex items-center justify-between gap-2 rounded-lg border-b border-row-divider px-2 py-3 transition-colors last:border-0 hover:bg-bg"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{d.title}</span>
                        <span className="block text-xs text-ink-3">
                          {labelOf(DELIVERABLE_TYPES, d.type)}
                        </span>
                      </span>
                      <StatusChip kind="deliverable" value={d.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT rail */}
        <div className="flex flex-col gap-6">
          {/* dark report card */}
          <div
            className="flex flex-col gap-4 rounded-2xl border border-dark-border p-6 text-dark-ink"
            style={{ background: "var(--dark-glow), #101012" }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-bold tracking-wider text-amber-400 uppercase">
                Latest report
              </div>
              {report && <StatusChip kind="report" value="published" label="Published" />}
            </div>
            <div>
              <p className="font-display text-[21px] leading-tight font-semibold">
                {report ? report.title : "Your first report lands after month 1."}
              </p>
              {report?.summary && (
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-dark-ink-2">
                  {report.summary}
                </p>
              )}
            </div>
            {report && (
              <Link
                href="/performance#reports"
                className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800"
              >
                Read report <ArrowUpRight className="size-4" />
              </Link>
            )}
          </div>

          {/* updates */}
          <Card>
            <CardContent className="flex flex-col gap-3">
              <h2 className="font-display text-xl font-semibold tracking-[-0.01em]">Updates</h2>
              {updateFeed.length === 0 ? (
                <p className="text-sm text-ink-3">No updates yet.</p>
              ) : (
                <ul className="flex flex-col">
                  {updateFeed.map((u) => (
                    <li key={u.id} className="border-b border-row-divider py-3 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{u.title}</span>
                        {u.pinned && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                            Pinned
                          </span>
                        )}
                      </div>
                      {u.body && <p className="line-clamp-2 pt-1 text-xs text-ink-3">{u.body}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* partner card */}
          {partner && (
            <Card>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <PersonAvatar
                    name={partner.full_name}
                    email={partner.email}
                    src={partner.avatar_url}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold tracking-wider text-ink-3 uppercase">
                      Your partner
                    </div>
                    <div className="truncate font-semibold">{partner.full_name ?? partner.email}</div>
                    {client?.comms_channel && (
                      <div className="truncate text-xs text-ink-3">{client.comms_channel}</div>
                    )}
                  </div>
                </div>
                <Button asChild variant="amber" className="w-full">
                  <Link href="/calls-notes">Book a call</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
