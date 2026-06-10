import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { COMPETITOR_PRIORITIES, labelOf } from "@/lib/constants";
import {
  MetricsCharts,
  type DefLite,
  type Entry,
} from "@/components/metrics/metrics-charts";
import { ClientReports, type ClientReport } from "@/components/client/client-reports";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function priorityVariant(p: string): "default" | "secondary" | "outline" {
  if (p === "high") return "default";
  if (p === "low") return "outline";
  return "secondary";
}

export default async function ClientPerformancePage() {
  const profile = await requireRole(["client"]);
  const supabase = await createClient();

  const [{ data: defs }, { data: entries }, { data: competitors }, { data: reports }] =
    await Promise.all([
      // RLS: client sees active definitions only
      supabase
        .from("metric_definitions")
        .select("id, label, unit, sort_order")
        .order("sort_order"),
      // All entries — the chart windows itself to months that have data
      supabase
        .from("metric_entries")
        .select("definition_id, period, value_numeric, value_text")
        .order("period"),
      // RLS: visible competitors only
      supabase
        .from("competitors")
        .select("id, name_or_handle, niche, top_content_format, whats_working, adapted_idea, priority")
        .order("priority", { ascending: false }),
      // RLS: published reports only
      supabase
        .from("reports")
        .select("id, title, period_start, period_end, summary, pdf_path")
        .order("period_end", { ascending: false }),
    ]);

  const allDefs = (defs ?? []) as DefLite[];
  const numericDefs = allDefs.filter((d) => d.unit !== "text");
  const textDefs = allDefs.filter((d) => d.unit === "text");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Performance</h1>
        <p className="text-muted-foreground">Your results over time.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <MetricsCharts
            numericDefs={numericDefs}
            textDefs={textDefs}
            entries={(entries ?? []) as Entry[]}
          />
        </CardContent>
      </Card>

      {(competitors ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Competitor landscape</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {(competitors ?? []).map((c) => (
                <div key={c.id} className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.name_or_handle}</span>
                    <Badge variant={priorityVariant(c.priority)} className="text-[10px]">
                      {labelOf(COMPETITOR_PRIORITIES, c.priority)}
                    </Badge>
                  </div>
                  {c.niche && (
                    <div className="text-xs text-muted-foreground">{c.niche}</div>
                  )}
                  {c.whats_working && (
                    <p className="pt-1 text-sm">
                      <span className="text-muted-foreground">Working: </span>
                      {c.whats_working}
                    </p>
                  )}
                  {c.adapted_idea && (
                    <p className="pt-1 text-sm">
                      <span className="text-muted-foreground">Our take: </span>
                      {c.adapted_idea}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientReports
            clientId={profile.client_id!}
            reports={(reports ?? []) as ClientReport[]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
