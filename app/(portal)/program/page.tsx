import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { labelOf, PROGRAMS } from "@/lib/constants";
import { formatMonthYear } from "@/lib/format";
import { ProgramBody, type ProgramData } from "@/components/redesign/client/program-body";

export default async function ClientProgramPage() {
  await requireRole(["client"]);
  const supabase = await createClient();

  const [{ data: client }, { data: milestones }] = await Promise.all([
    supabase.from("client_clients").select("*").maybeSingle(),
    supabase.from("milestones").select("id, title, description, phase_label, status, due_date").order("sort_order"),
  ]);

  // Program-only page — project clients are routed to their projects board.
  if (client?.client_type === "project") redirect("/dashboard");

  const rawDetails: { label: string; value: string | null }[] = [
    { label: "Program", value: labelOf(PROGRAMS, client?.program) },
    { label: "Service type", value: client?.service_type ?? null },
    { label: "Investment", value: client?.investment ?? null },
    { label: "Started", value: client?.start_date ? formatMonthYear(client.start_date) : null },
    { label: "Ends", value: client?.end_date ? formatMonthYear(client.end_date) : "Ongoing" },
  ];
  const rawGuidelines: { label: string; value: string | null }[] = [
    { label: "Best way to reach us", value: client?.best_way_to_reach ?? null },
    { label: "Response time", value: client?.response_time ?? null },
    { label: "Scheduling calls", value: client?.call_scheduling_note ?? null },
    { label: "Revisions", value: client?.revision_policy ?? null },
  ];

  const data: ProgramData = {
    details: rawDetails.filter((d): d is { label: string; value: string } => !!d.value),
    guidelines: rawGuidelines.filter((d): d is { label: string; value: string } => !!d.value && d.value.trim() !== ""),
    milestones: (milestones ?? []).map((m) => ({ id: m.id, title: m.title, description: m.description, phase_label: m.phase_label, status: m.status })),
    whatsIncluded: client?.whats_included ?? null,
    whatsNotIncluded: client?.whats_not_included ?? null,
  };

  return <ProgramBody data={data} />;
}
