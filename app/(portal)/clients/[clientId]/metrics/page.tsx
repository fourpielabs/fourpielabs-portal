import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { formatMonthYear } from "@/lib/format";
import {
  DefinitionsManager,
  type MetricDef,
} from "@/components/metrics/definitions-manager";
import {
  MonthlyEntryGrid,
  type ActiveDef,
} from "@/components/metrics/monthly-entry-grid";
import { CsvImport } from "@/components/metrics/csv-import";
import {
  MetricsCharts,
  type DefLite,
  type Entry,
} from "@/components/metrics/metrics-charts";

const pad = (n: number) => String(n).padStart(2, "0");

export default async function MetricsPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  await requireClientAccess(clientId);
  const supabase = await createClient();

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  // last 12 months (ascending) as first-of-month periods
  const periods: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`);
  }

  const [{ data: defs }, { data: monthEntries }, { data: histEntries }] =
    await Promise.all([
      supabase
        .from("metric_definitions")
        .select("id, key, label, unit, is_active, sort_order")
        .eq("client_id", clientId)
        .order("sort_order"),
      supabase
        .from("metric_entries")
        .select("definition_id, value_numeric, value_text")
        .eq("client_id", clientId)
        .eq("period", `${currentMonth}-01`),
      supabase
        .from("metric_entries")
        .select("definition_id, period, value_numeric, value_text")
        .eq("client_id", clientId)
        .in("period", periods),
    ]);

  const allDefs = (defs ?? []) as MetricDef[];
  const activeDefs: ActiveDef[] = allDefs
    .filter((d) => d.is_active)
    .map((d) => ({ id: d.id, key: d.key, label: d.label, unit: d.unit }));

  const monthMap = new Map((monthEntries ?? []).map((e) => [e.definition_id, e]));
  const initialValues: Record<string, string> = {};
  for (const d of activeDefs) {
    const e = monthMap.get(d.id);
    initialValues[d.id] =
      !e
        ? ""
        : d.unit === "text"
          ? (e.value_text ?? "")
          : e.value_numeric === null
            ? ""
            : String(e.value_numeric);
  }

  const numericDefs: DefLite[] = activeDefs
    .filter((d) => d.unit !== "text")
    .map((d) => ({ id: d.id, label: d.label, unit: d.unit }));
  const textDefs: DefLite[] = activeDefs
    .filter((d) => d.unit === "text")
    .map((d) => ({ id: d.id, label: d.label, unit: d.unit }));

  // Entry status — per recent month, how many active defs are filled.
  const filledByPeriod = new Map<string, number>();
  for (const e of histEntries ?? []) {
    const has = e.value_numeric !== null || (e.value_text ?? "") !== "";
    if (has) filledByPeriod.set(e.period, (filledByPeriod.get(e.period) ?? 0) + 1);
  }
  const entryStatus = [...periods]
    .reverse()
    .slice(0, 6)
    .map((p) => {
      const filled = filledByPeriod.get(p) ?? 0;
      const total = activeDefs.length;
      const status =
        total > 0 && filled >= total ? "complete" : filled > 0 ? "in_progress" : "empty";
      return { period: p, status };
    });

  const statusChip = (s: string) =>
    s === "complete"
      ? "border border-success-border bg-success-bg text-success-text"
      : s === "in_progress"
        ? "border border-amber-200 bg-amber-100 text-amber-800"
        : "border border-border text-ink-3";
  const statusLabel = (s: string) =>
    s === "complete" ? "Complete" : s === "in_progress" ? "In progress" : "Not started";

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[320px_1fr_300px] lg:items-start">
        <DefinitionsManager clientId={clientId} definitions={allDefs} />

        <MonthlyEntryGrid
          clientId={clientId}
          activeDefs={activeDefs}
          initialPeriod={currentMonth}
          initialValues={initialValues}
        />

        <div className="rounded-2xl border border-border bg-surface p-5 shadow-e2">
          <h3 className="text-sm font-semibold">Entry status</h3>
          <p className="text-[11.5px] text-ink-3">Recent months</p>
          <ul className="mt-3 flex flex-col gap-2">
            {entryStatus.map((m) => (
              <li key={m.period} className="flex items-center justify-between gap-2 text-[13px]">
                <span>{formatMonthYear(m.period)}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusChip(m.status)}`}>
                  {statusLabel(m.status)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Client preview — exactly what the client sees */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-e2 sm:p-6">
        <div className="mb-4">
          <h3 className="font-display text-xl font-semibold tracking-[-0.01em]">Client preview</h3>
          <p className="text-[12.5px] text-ink-3">
            Exactly what the client sees on their Performance page.
          </p>
        </div>
        <MetricsCharts
          numericDefs={numericDefs}
          textDefs={textDefs}
          entries={(histEntries ?? []) as Entry[]}
        />
      </div>

      {/* CSV import — full width */}
      <CsvImport
        clientId={clientId}
        defs={activeDefs.map((d) => ({ key: d.key, unit: d.unit }))}
        currentMonth={currentMonth}
      />
    </div>
  );
}
