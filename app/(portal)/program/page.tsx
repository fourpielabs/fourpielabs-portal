import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatMonthYear } from "@/lib/format";
import { resolveClientPrograms } from "@/lib/programs";
import { ProgramBody, type ProgramData } from "@/components/redesign/client/program-body";

export default async function ClientProgramPage() {
  const profile = await requireRole(["client"]);
  const supabase = await createClient();

  const { data: client } = await supabase.from("client_clients").select("*").maybeSingle();

  // Program-only page — project clients are routed to their projects board.
  if (client?.client_type === "project") redirect("/dashboard");

  const clientId = client?.id ?? profile.client_id;
  const [{ data: milestones }, resolved] = await Promise.all([
    supabase.from("milestones").select("id, title, description, phase_label, status, due_date").order("sort_order"),
    clientId ? resolveClientPrograms(supabase, clientId, client?.program ?? null) : Promise.resolve(null),
  ]);

  const programNames = resolved?.assigned.map((p) => p.name).join(" + ") || null;
  const rawDetails: { label: string; value: string | null }[] = [
    { label: "Program", value: programNames },
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
    programs: (resolved?.assigned ?? []).map((p) => ({ key: p.key, name: p.name, eyebrow: p.eyebrow, tagline: p.tagline, is_parallel: p.is_parallel })),
    details: rawDetails.filter((d): d is { label: string; value: string } => !!d.value),
    guidelines: rawGuidelines.filter((d): d is { label: string; value: string } => !!d.value && d.value.trim() !== ""),
    milestones: (milestones ?? []).map((m) => ({ id: m.id, title: m.title, description: m.description, phase_label: m.phase_label, status: m.status })),
    included: (resolved?.included ?? []).map((s) => ({ label: s.label, description: s.description, category: s.category, programName: s.programName })),
    notIncluded: (resolved?.notIncluded ?? []).map((s) => ({ label: s.label, description: s.description, programName: s.programName })),
  };

  return <ProgramBody data={data} />;
}
