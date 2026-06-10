import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { labelOf, PROGRAMS } from "@/lib/constants";
import { Markdown } from "@/components/markdown";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const MS_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  done: { label: "Done", variant: "default" },
  in_progress: { label: "In progress", variant: "secondary" },
  upcoming: { label: "Upcoming", variant: "outline" },
};

export default async function ClientProgramPage() {
  await requireRole(["client"]);
  const supabase = await createClient();

  const [{ data: client }, { data: milestones }] = await Promise.all([
    supabase.from("client_clients").select("*").maybeSingle(),
    supabase
      .from("milestones")
      .select("id, title, description, phase_label, status, due_date")
      .order("sort_order"),
  ]);

  const details: { label: string; value: string | null }[] = [
    { label: "Program", value: labelOf(PROGRAMS, client?.program) },
    { label: "Service type", value: client?.service_type ?? null },
    { label: "Investment", value: client?.investment ?? null },
    { label: "Start date", value: client?.start_date ?? null },
    { label: "End date", value: client?.end_date ?? null },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your program</h1>
        <p className="text-muted-foreground">Everything your engagement covers.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {details.map((d) => (
              <div key={d.label} className="flex justify-between gap-4 border-b py-1">
                <dt className="text-sm text-muted-foreground">{d.label}</dt>
                <dd className="text-sm font-medium">{d.value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your journey</CardTitle>
          <CardDescription>The phases we&apos;ll move through together.</CardDescription>
        </CardHeader>
        <CardContent>
          {(milestones ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Your roadmap will appear here shortly.
            </p>
          ) : (
            <ol className="space-y-3">
              {(milestones ?? []).map((m) => {
                const s = MS_STATUS[m.status] ?? MS_STATUS.upcoming;
                return (
                  <li key={m.id} className="flex gap-3 rounded-lg border p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{m.title}</span>
                        {m.phase_label && (
                          <span className="text-xs text-muted-foreground">
                            {m.phase_label}
                          </span>
                        )}
                      </div>
                      {m.description && (
                        <p className="pt-1 text-sm text-muted-foreground">
                          {m.description}
                        </p>
                      )}
                    </div>
                    <Badge variant={s.variant} className="h-fit">
                      {s.label}
                    </Badge>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>What&apos;s included</CardTitle>
          </CardHeader>
          <CardContent>
            {client?.whats_included ? (
              <Markdown>{client.whats_included}</Markdown>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>What&apos;s not included</CardTitle>
          </CardHeader>
          <CardContent>
            {client?.whats_not_included ? (
              <Markdown>{client.whats_not_included}</Markdown>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Working together</CardTitle>
          <CardDescription>How and when to reach us.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {[
              { label: "Best way to reach us", value: client?.best_way_to_reach },
              { label: "Response time", value: client?.response_time },
              { label: "Scheduling calls", value: client?.call_scheduling_note },
              { label: "Revisions", value: client?.revision_policy },
            ].map((d) => (
              <div key={d.label}>
                <dt className="text-xs text-muted-foreground">{d.label}</dt>
                <dd className="text-sm">{d.value || "—"}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
