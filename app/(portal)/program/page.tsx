import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { labelOf, PROGRAMS } from "@/lib/constants";
import { formatMonthYear } from "@/lib/format";
import { Markdown } from "@/components/markdown";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusChip } from "@/components/ui/status-chip";

// echoes the dashboard roadmap's phase-color treatment
const MS_BORDER: Record<string, string> = {
  done: "#B45309",
  in_progress: "#FBBF24",
  upcoming: "#E7E5E0",
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

  // Program-only page — project clients are routed to their projects board.
  if (client?.client_type === "project") redirect("/dashboard");

  // Hide rows with no value; End date falls back to "Ongoing".
  const details: { label: string; value: string | null }[] = [
    { label: "Program", value: labelOf(PROGRAMS, client?.program) },
    { label: "Service type", value: client?.service_type ?? null },
    { label: "Investment", value: client?.investment ?? null },
    {
      label: "Started",
      value: client?.start_date ? formatMonthYear(client.start_date) : null,
    },
    {
      label: "Ends",
      value: client?.end_date ? formatMonthYear(client.end_date) : "Ongoing",
    },
  ].filter((d) => d.value !== null);

  const guidelines = [
    { label: "Best way to reach us", value: client?.best_way_to_reach },
    { label: "Response time", value: client?.response_time },
    { label: "Scheduling calls", value: client?.call_scheduling_note },
    { label: "Revisions", value: client?.revision_policy },
  ].filter((d) => d.value && d.value.trim() !== "");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.015em]">Your program</h1>
        <p className="text-sm text-ink-2">Everything your engagement covers.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {details.map((d) => (
              <div key={d.label} className="flex justify-between gap-4 border-b border-row-divider py-1">
                <dt className="text-sm text-ink-3">{d.label}</dt>
                <dd className="text-sm font-medium">{d.value}</dd>
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
            <p className="text-sm text-ink-3">
              Your roadmap will appear here shortly.
            </p>
          ) : (
            <ol className="space-y-3">
              {(milestones ?? []).map((m) => {
                return (
                  <li
                    key={m.id}
                    className="flex gap-3 rounded-xl border border-border p-3"
                    style={{
                      borderLeftWidth: 4,
                      borderLeftColor: MS_BORDER[m.status] ?? "#E7E5E0",
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{m.title}</span>
                        {m.phase_label && (
                          <span className="text-xs text-ink-3">
                            {m.phase_label}
                          </span>
                        )}
                      </div>
                      {m.description && (
                        <p className="pt-1 text-sm text-ink-3">
                          {m.description}
                        </p>
                      )}
                    </div>
                    <StatusChip kind="milestone" value={m.status} className="h-fit" />
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
              <p className="text-sm text-ink-3">—</p>
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
              <p className="text-sm text-ink-3">—</p>
            )}
          </CardContent>
        </Card>
      </div>

      {guidelines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Working together</CardTitle>
            <CardDescription>How and when to reach us.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {guidelines.map((d) => (
                <div key={d.label}>
                  <dt className="text-xs text-ink-3">{d.label}</dt>
                  <dd className="text-sm">{d.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
