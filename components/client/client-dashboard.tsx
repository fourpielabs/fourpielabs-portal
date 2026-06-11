import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { labelOf, PROGRAMS } from "@/lib/constants";
import { formatMetricValue, formatMonthYear, initials } from "@/lib/format";
import {
  ClientChecklist,
  type ClientChecklistItem,
} from "@/components/client/client-checklist";
import { StatusChip } from "@/components/ui/status-chip";
import { Card, CardContent } from "@/components/ui/card";

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

export async function ClientDashboard({ clientId }: { clientId: string }) {
  const supabase = await createClient();

  const [
    { data: client },
    { data: partner },
    { data: checklist },
    { data: milestones },
    { data: metricRows },
    { data: deliverables },
    { data: report },
    { data: updates },
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
      .select("id, title, status")
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("reports")
      .select("id, title")
      .order("period_end", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("updates")
      .select("id, title, body, pinned, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

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
      const before = rows.find(
        (x) => x.period === prev && x.definition?.label === r.definition!.label,
      )?.value_numeric ?? null;
      const cur = r.value_numeric ?? null;
      const delta = cur !== null && before !== null ? cur - before : null;
      return { label: r.definition!.label, unit: r.definition!.unit, cur, before, delta };
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
  const firstName = (client?.name ?? "there").split(" ")[0];

  return (
    <div className="flex flex-col gap-8">
      {/* greeting + partner */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl leading-[1.05] font-medium tracking-[-0.02em] text-balance sm:text-5xl">
            Welcome, {firstName} —{" "}
            {monthLabel ? (
              <>
                here&apos;s <span className="font-bold">{monthLabel}</span> at a glance
              </>
            ) : (
              <>your portal at a glance</>
            )}
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            <span className="font-semibold">{labelOf(PROGRAMS, client?.program)}</span>
            {dayLabel ? ` · ${dayLabel}` : ""}
          </p>
        </div>
        {partner && (
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-e1">
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">
              {initials(partner.full_name, partner.email)}
            </span>
            <div className="text-sm">
              <div className="text-[11px] font-bold tracking-wider text-ink-3 uppercase">
                Your partner
              </div>
              <div className="font-semibold">{partner.full_name ?? partner.email}</div>
              {client?.comms_channel && (
                <div className="text-xs text-ink-3">{client.comms_channel}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* KPIs */}
      {kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpis.map((k) => {
            const up = (k.delta ?? 0) > 0;
            return (
              <Card key={k.label} className="gap-3">
                <CardContent className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold tracking-wider text-ink-3 uppercase">
                      {k.label}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-display text-4xl leading-none font-bold tracking-[-0.01em] tabular-nums">
                      {formatMetricValue(k.unit, k.cur, null)}
                    </span>
                    {k.delta !== null && k.delta !== 0 && (
                      <span
                        className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${up ? "bg-success-bg text-success-text" : "bg-danger-bg text-danger-text"}`}
                      >
                        {up ? "▲" : "▼"} {Math.abs(k.delta).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-ink-3 tabular-nums">
                    {k.before !== null ? `vs ${k.before.toLocaleString()} last month` : monthLabel}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Start Here + report */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-col gap-4">
            <h2 className="font-display text-xl font-semibold tracking-[-0.01em]">Start here</h2>
            <ClientChecklist items={(checklist ?? []) as ClientChecklistItem[]} />
          </CardContent>
        </Card>

        {/* dark report card */}
        <div
          className="flex flex-col justify-between gap-6 rounded-2xl border border-dark-border p-6 text-dark-ink"
          style={{ background: "var(--dark-glow), #101012" }}
        >
          <div>
            <div className="text-[11px] font-bold tracking-wider text-amber-400 uppercase">
              Latest report
            </div>
            <p className="mt-2 font-display text-lg font-semibold">
              {report ? report.title : "Your first report lands after month 1."}
            </p>
          </div>
          {report && (
            <Link
              href="/performance"
              className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800"
            >
              View report <ArrowUpRight className="size-4" />
            </Link>
          )}
        </div>
      </div>

      {/* roadmap */}
      {ms.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl font-semibold tracking-[-0.01em]">Your roadmap</h2>
              <div className="flex items-center gap-3">
                {dayLabel && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                    {dayLabel}
                  </span>
                )}
                <span className="text-xs font-semibold text-ink-3 tabular-nums">
                  {msDone}/{ms.length}
                </span>
              </div>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-amber-600" style={{ width: `${msPct}%` }} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {ms.slice(0, 8).map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border border-border bg-surface p-3"
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
          </CardContent>
        </Card>
      )}

      {/* deliverables + updates */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-3">
            <h2 className="font-display text-xl font-semibold tracking-[-0.01em]">
              Latest deliverables
            </h2>
            {(deliverables ?? []).length === 0 ? (
              <p className="text-sm text-ink-3">
                Your deliverables show up here as we ship them.
              </p>
            ) : (
              <ul className="flex flex-col">
                {(deliverables ?? []).map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-2 border-b border-row-divider py-2.5 last:border-0"
                  >
                    <span className="text-sm font-medium">{d.title}</span>
                    <StatusChip kind="deliverable" value={d.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <h2 className="font-display text-xl font-semibold tracking-[-0.01em]">Updates</h2>
            {pinned.length === 0 && recent.length === 0 ? (
              <p className="text-sm text-ink-3">No updates yet.</p>
            ) : (
              [...pinned, ...recent].slice(0, 4).map((u) => (
                <div key={u.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{u.title}</span>
                    {u.pinned && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        Pinned
                      </span>
                    )}
                  </div>
                  {u.body && (
                    <p className="line-clamp-2 pt-1 text-xs text-ink-3">{u.body}</p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
