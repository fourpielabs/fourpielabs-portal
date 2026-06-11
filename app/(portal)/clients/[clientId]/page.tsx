import Link from "next/link";
import { ArrowUpRight, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { formatDate, formatMonthYear } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/banner";

type MetricEntry = {
  value_numeric: number | null;
  value_text: string | null;
  period: string;
  definition: { label: string; unit: string; sort_order: number } | null;
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
    { data: checklist },
    { data: entries },
    { data: waiting },
    { data: deliverables },
    { data: updates },
    { data: reports },
  ] = await Promise.all([
    supabase
      .from("checklist_items")
      .select("is_done, phase_label")
      .eq("client_id", clientId)
      .eq("kind", "onboarding"),
    supabase
      .from("metric_entries")
      .select("value_numeric, value_text, period, definition:metric_definitions(label, unit, sort_order)")
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
  const latestPeriod = allEntries[0]?.period;
  const snapshot = allEntries
    .filter((e) => e.period === latestPeriod && e.definition)
    .sort((a, b) => (a.definition!.sort_order ?? 0) - (b.definition!.sort_order ?? 0))
    .slice(0, 4);

  const activity = [
    ...(deliverables ?? []).map((d) => ({ kind: "Deliverable", title: d.title, at: d.created_at })),
    ...(updates ?? []).map((u) => ({ kind: "Update", title: u.title, at: u.created_at })),
    ...(reports ?? []).map((r) => ({ kind: "Report", title: r.title, at: r.created_at })),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 8);

  const waitingList = waiting ?? [];
  const ringCirc = 2 * Math.PI * 26;

  return (
    <div className="space-y-6">
      {waitingList.length > 0 && (
        <Banner
          tone="amber"
          action={
            <Button asChild size="sm">
              <Link href={`${base}/deliverables`}>Open deliverable</Link>
            </Button>
          }
        >
          <span className="font-semibold">Waiting on client</span> —{" "}
          {waitingList.length} deliverable{waitingList.length === 1 ? "" : "s"} awaiting review.
        </Banner>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* checklist ring */}
        <Card size="sm">
          <CardContent className="flex items-center gap-5">
            <div className="relative shrink-0">
              <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
                <circle cx="36" cy="36" r="26" fill="none" stroke="#F4F4F0" strokeWidth="8" />
                <circle
                  cx="36"
                  cy="36"
                  r="26"
                  fill="none"
                  stroke="#D97706"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={ringCirc}
                  strokeDashoffset={ringCirc * (1 - pct / 100)}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums">
                {pct}%
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Onboarding</h3>
                <Link href={`${base}/checklist`} className="text-xs font-semibold text-amber-700 hover:text-amber-800">
                  Open checklist
                </Link>
              </div>
              <p className="text-xs text-ink-3 tabular-nums">{done} of {total} steps done</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
                {[...phases.entries()].map(([p, g]) => (
                  <span key={p} className="tabular-nums">
                    <span className="text-ink-3">{p}:</span> {g.done}/{g.total}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* latest metrics */}
        <Card size="sm">
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Latest metrics</h3>
                <p className="text-xs text-ink-3">
                  {latestPeriod ? `Entered ${formatMonthYear(latestPeriod)}` : "No entries yet"}
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={`${base}/metrics`}>Enter month</Link>
              </Button>
            </div>
            {snapshot.length === 0 ? (
              <p className="text-sm text-ink-3">Enter monthly metrics to see a snapshot here.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {snapshot.map((e, i) => (
                  <div key={i} className="rounded-xl border border-border p-3">
                    <div className="text-[11px] font-bold tracking-wider text-ink-3 uppercase">
                      {e.definition?.label}
                    </div>
                    <div className="truncate font-display text-xl font-bold tabular-nums">
                      {fmtMetric(e)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* activity */}
      <Card size="sm">
        <CardContent className="flex flex-col gap-2">
          <h3 className="font-semibold">Recent activity</h3>
          {activity.length === 0 ? (
            <p className="flex items-center gap-2 py-6 text-sm text-ink-3">
              <ClipboardList className="size-4" /> No activity yet.
            </p>
          ) : (
            <ul className="flex flex-col">
              {activity.map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-3 border-b border-row-divider py-2.5 last:border-0">
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-ink-2">
                      {a.kind}
                    </span>
                    <span className="truncate">{a.title}</span>
                  </span>
                  <span className="shrink-0 text-xs text-ink-3">{formatDate(a.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
