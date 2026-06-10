import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { labelOf, PROGRAMS, DELIVERABLE_STATUSES } from "@/lib/constants";
import { formatMetricValue, formatMonthYear, initials } from "@/lib/format";
import {
  ClientChecklist,
  type ClientChecklistItem,
} from "@/components/client/client-checklist";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type MetricRow = {
  period: string;
  value_numeric: number | null;
  value_text: string | null;
  definition: { label: string; unit: string; sort_order: number } | null;
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
      .select("status")
      .order("sort_order"),
    supabase
      .from("metric_entries")
      .select("period, value_numeric, value_text, definition:metric_definitions!inner(label, unit, sort_order)")
      .order("period", { ascending: false })
      .limit(60),
    supabase
      .from("deliverables")
      .select("id, title, status, delivered_at, preview_url")
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("reports")
      .select("id, title, period_end, published_at")
      .order("period_end", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("updates")
      .select("id, title, body, pinned, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  // roadmap progress
  const msTotal = milestones?.length ?? 0;
  const msDone = (milestones ?? []).filter((m) => m.status === "done").length;
  const msPct = msTotal ? Math.round((msDone / msTotal) * 100) : 0;

  // KPI cards: latest period vs previous, numeric metrics
  const rows = (metricRows ?? []) as unknown as MetricRow[];
  const periods = [...new Set(rows.map((r) => r.period))].sort().reverse();
  const latest = periods[0];
  const prev = periods[1];
  const kpis = rows
    .filter((r) => r.period === latest && r.definition && r.definition.unit !== "text")
    .sort((a, b) => (a.definition!.sort_order ?? 0) - (b.definition!.sort_order ?? 0))
    .slice(0, 4)
    .map((r) => {
      const prevRow = rows.find(
        (x) => x.period === prev && x.definition?.label === r.definition!.label,
      );
      const cur = r.value_numeric ?? null;
      const before = prevRow?.value_numeric ?? null;
      const delta = cur !== null && before !== null ? cur - before : null;
      return { label: r.definition!.label, unit: r.definition!.unit, cur, delta };
    });

  const pinned = (updates ?? []).filter((u) => u.pinned);
  const recent = (updates ?? []).filter((u) => !u.pinned);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {client?.name ?? "Welcome"}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">
                {labelOf(PROGRAMS, client?.program)}
              </Badge>
              {client?.start_date && (
                <span>Since {formatMonthYear(client.start_date)}</span>
              )}
              {client?.end_date && (
                <span>· through {formatMonthYear(client.end_date)}</span>
              )}
            </div>
          </div>
          {partner && (
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Avatar>
                {partner.avatar_url && <AvatarImage src={partner.avatar_url} />}
                <AvatarFallback>
                  {initials(partner.full_name, partner.email)}
                </AvatarFallback>
              </Avatar>
              <div className="text-sm">
                <div className="text-xs text-muted-foreground">Your Partner</div>
                <div className="font-medium">{partner.full_name ?? partner.email}</div>
                {client?.comms_channel && (
                  <div className="text-xs text-muted-foreground">
                    {client.comms_channel}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPIs */}
      {kpis.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            This month{latest ? ` · ${formatMonthYear(latest)}` : ""}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {kpis.map((k) => (
              <Card key={k.label}>
                <CardContent className="pt-6">
                  <div className="text-xs text-muted-foreground">{k.label}</div>
                  <div className="text-2xl font-semibold">
                    {formatMetricValue(k.unit, k.cur, null)}
                  </div>
                  {k.delta !== null && k.delta !== 0 && (
                    <div
                      className={`text-xs ${k.delta > 0 ? "text-green-600" : "text-muted-foreground"}`}
                    >
                      {k.delta > 0 ? "▲" : "▼"} {Math.abs(k.delta).toLocaleString()} vs last month
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Start Here checklist */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Start Here</CardTitle>
            <CardDescription>
              A few quick steps to get your program rolling.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ClientChecklist
              items={(checklist ?? []) as ClientChecklistItem[]}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Roadmap */}
          <Card>
            <CardHeader>
              <CardTitle>Your roadmap</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${msPct}%` }} />
                </div>
                <span className="text-sm font-medium">
                  {msDone}/{msTotal}
                </span>
              </div>
              <Link
                href="/program"
                className="mt-3 inline-block text-sm text-primary underline"
              >
                View the journey
              </Link>
            </CardContent>
          </Card>

          {/* Latest report */}
          <Card>
            <CardHeader>
              <CardTitle>Latest report</CardTitle>
            </CardHeader>
            <CardContent>
              {report ? (
                <Link
                  href="/performance"
                  className="text-sm text-primary underline"
                >
                  {report.title}
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Your first report lands after month 1.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Latest deliverables */}
        <Card>
          <CardHeader>
            <CardTitle>Latest deliverables</CardTitle>
          </CardHeader>
          <CardContent>
            {(deliverables ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Your deliverables will show up here as we ship them.
              </p>
            ) : (
              <ul className="divide-y">
                {(deliverables ?? []).map((d) => (
                  <li key={d.id} className="flex items-center justify-between py-2">
                    <span className="text-sm">{d.title}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {labelOf(DELIVERABLE_STATUSES, d.status)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Updates */}
        <Card>
          <CardHeader>
            <CardTitle>Updates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pinned.length === 0 && recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No updates yet.</p>
            ) : (
              [...pinned, ...recent].slice(0, 4).map((u) => (
                <div key={u.id} className="rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{u.title}</span>
                    {u.pinned && (
                      <Badge variant="secondary" className="text-[10px]">
                        pinned
                      </Badge>
                    )}
                  </div>
                  {u.body && (
                    <p className="line-clamp-2 pt-1 text-xs text-muted-foreground">
                      {u.body}
                    </p>
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
