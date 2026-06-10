import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type MetricEntry = {
  value_numeric: number | null;
  value_text: string | null;
  period: string;
  definition: { label: string; unit: string; sort_order: number } | null;
};

function fmtMetric(e: MetricEntry): string {
  if (e.definition?.unit === "text") return e.value_text ?? "—";
  if (e.value_numeric === null) return "—";
  if (e.definition?.unit === "currency")
    return `$${e.value_numeric.toLocaleString()}`;
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

  const [
    { data: checklist },
    { data: entries },
    { data: deliverables },
    { data: updates },
    { data: reports },
  ] = await Promise.all([
    supabase
      .from("checklist_items")
      .select("is_done")
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

  const allEntries = (entries ?? []) as unknown as MetricEntry[];
  const latestPeriod = allEntries[0]?.period;
  const snapshot = allEntries
    .filter((e) => e.period === latestPeriod && e.definition)
    .sort((a, b) => (a.definition!.sort_order ?? 0) - (b.definition!.sort_order ?? 0))
    .slice(0, 6);

  const activity = [
    ...(deliverables ?? []).map((d) => ({
      kind: "Deliverable",
      title: d.title,
      at: d.created_at,
    })),
    ...(updates ?? []).map((u) => ({
      kind: "Update",
      title: u.title,
      at: u.created_at,
    })),
    ...(reports ?? []).map((r) => ({
      kind: "Report",
      title: r.title,
      at: r.created_at,
    })),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Onboarding progress</CardTitle>
            <CardDescription>
              <Link href={`/clients/${clientId}/checklist`} className="underline">
                Open checklist
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-sm font-medium">
                {done}/{total}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest metrics</CardTitle>
            <CardDescription>
              {latestPeriod ? `Period ${latestPeriod}` : "No metric entries yet"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {snapshot.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Enter monthly metrics to see a snapshot here.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {snapshot.map((e, i) => (
                  <div key={i} className="rounded-md border p-2">
                    <div className="text-xs text-muted-foreground">
                      {e.definition?.label}
                    </div>
                    <div className="truncate text-sm font-semibold">
                      {fmtMetric(e)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="divide-y">
              {activity.map((a, i) => (
                <li key={i} className="flex items-center justify-between py-2">
                  <span className="flex items-center gap-2 text-sm">
                    <Badge variant="secondary" className="text-[10px]">
                      {a.kind}
                    </Badge>
                    {a.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
