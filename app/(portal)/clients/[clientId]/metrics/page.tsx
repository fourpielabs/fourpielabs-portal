import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  const monthMap = new Map(
    (monthEntries ?? []).map((e) => [e.definition_id, e]),
  );
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

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Metrics</h2>
        <p className="text-sm text-muted-foreground">
          Define KPIs, enter monthly values, import via CSV, and view trends.
        </p>
      </div>

      <Tabs defaultValue="entry">
        <TabsList className="flex-wrap">
          <TabsTrigger value="entry">Monthly entry</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
          <TabsTrigger value="import">CSV import</TabsTrigger>
          <TabsTrigger value="definitions">Definitions</TabsTrigger>
        </TabsList>

        <TabsContent value="entry" className="pt-4">
          <MonthlyEntryGrid
            clientId={clientId}
            activeDefs={activeDefs}
            initialPeriod={currentMonth}
            initialValues={initialValues}
          />
        </TabsContent>

        <TabsContent value="charts" className="pt-4">
          <MetricsCharts
            numericDefs={numericDefs}
            textDefs={textDefs}
            entries={(histEntries ?? []) as Entry[]}
          />
        </TabsContent>

        <TabsContent value="import" className="pt-4">
          <CsvImport
            clientId={clientId}
            defs={activeDefs.map((d) => ({ key: d.key, unit: d.unit }))}
            currentMonth={currentMonth}
          />
        </TabsContent>

        <TabsContent value="definitions" className="pt-4">
          <DefinitionsManager clientId={clientId} definitions={allDefs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
