import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  MetricsCharts,
  type DefLite,
  type Entry,
} from "@/components/metrics/metrics-charts";
import { ClientReports, type ClientReport } from "@/components/client/client-reports";
import { StatusChip } from "@/components/ui/status-chip";
import { Card, CardContent } from "@/components/ui/card";

export default async function ClientPerformancePage() {
  const profile = await requireRole(["client"]);
  const supabase = await createClient();

  const [{ data: defs }, { data: entries }, { data: competitors }, { data: reports }] =
    await Promise.all([
      supabase.from("metric_definitions").select("id, label, unit, sort_order").order("sort_order"),
      supabase
        .from("metric_entries")
        .select("definition_id, period, value_numeric, value_text")
        .order("period"),
      supabase
        .from("competitors")
        .select("id, name_or_handle, niche, follower_count, avg_views, top_content_format, hook_style, whats_working, gap_notes, adapted_idea, priority")
        .order("priority", { ascending: false }),
      supabase
        .from("reports")
        .select("id, title, period_start, period_end, summary, pdf_path")
        .order("period_end", { ascending: false }),
    ]);

  const allDefs = (defs ?? []) as DefLite[];
  const numericDefs = allDefs.filter((d) => d.unit !== "text");
  const textDefs = allDefs.filter((d) => d.unit === "text");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.015em]">
          Your numbers, live
        </h1>
        <p className="mt-1 text-sm text-ink-2">
          Fresh metrics on the first of every month — straight from the sources we track.
        </p>
      </div>

      <Card>
        <CardContent>
          <MetricsCharts numericDefs={numericDefs} textDefs={textDefs} entries={(entries ?? []) as Entry[]} />
        </CardContent>
      </Card>

      {(competitors ?? []).length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-semibold tracking-[-0.01em]">
            Competitors
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {(competitors ?? []).map((c) => (
              <Card key={c.id}>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{c.name_or_handle}</div>
                      {c.niche && <div className="text-xs text-ink-3">{c.niche}</div>}
                    </div>
                    <StatusChip kind="priority" value={c.priority} />
                  </div>

                  {(c.follower_count != null || c.avg_views != null) && (
                    <div className="flex gap-6">
                      {c.follower_count != null && (
                        <div>
                          <div className="text-[11px] font-bold tracking-wider text-ink-3 uppercase">Followers</div>
                          <div className="text-sm font-semibold tabular-nums">{c.follower_count.toLocaleString()}</div>
                        </div>
                      )}
                      {c.avg_views != null && (
                        <div>
                          <div className="text-[11px] font-bold tracking-wider text-ink-3 uppercase">Avg views</div>
                          <div className="text-sm font-semibold tabular-nums">{c.avg_views.toLocaleString()}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {(c.top_content_format || c.hook_style) && (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {c.top_content_format && (
                        <div>
                          <div className="text-[11px] font-bold tracking-wider text-ink-3 uppercase">Top format</div>
                          <div>{c.top_content_format}</div>
                        </div>
                      )}
                      {c.hook_style && (
                        <div>
                          <div className="text-[11px] font-bold tracking-wider text-ink-3 uppercase">Hook style</div>
                          <div>{c.hook_style}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {c.whats_working && (
                    <p className="text-sm">
                      <span className="text-ink-3">What&apos;s working: </span>
                      {c.whats_working}
                    </p>
                  )}
                  {c.gap_notes && (
                    <p className="text-sm">
                      <span className="text-ink-3">The gap: </span>
                      {c.gap_notes}
                    </p>
                  )}
                  {c.adapted_idea && (
                    <div className="rounded-xl bg-amber-50 p-3 text-sm">
                      <div className="text-[11px] font-bold tracking-wider text-amber-800 uppercase">
                        Our play
                      </div>
                      <p className="mt-1 text-amber-900">{c.adapted_idea}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold tracking-[-0.01em]">Reports</h2>
        <ClientReports clientId={profile.client_id!} reports={(reports ?? []) as ClientReport[]} />
      </div>
    </div>
  );
}
