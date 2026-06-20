import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { type ProgramValues } from "@/lib/schemas";
import { ProgramBody } from "@/components/redesign/staff/program-body";
import { type Milestone } from "@/components/redesign/staff/milestones-editor";
import { type ProgramAssignment } from "@/components/redesign/staff/program-assignment";

export default async function ProgramPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  await requireClientAccess(clientId);
  const supabase = await createClient();

  const [{ data: client }, { data: milestones }, { data: assigned }] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, client_type, service_type, investment, start_date, end_date, comms_channel, best_way_to_reach, response_time, call_scheduling_note, revision_policy, whats_included, whats_not_included",
      )
      .eq("id", clientId)
      .single(),
    supabase
      .from("milestones")
      .select(
        "id, title, description, phase_label, status, due_date, visible_to_client, sort_order",
      )
      .eq("client_id", clientId)
      .order("sort_order"),
    supabase
      .from("client_programs")
      .select("is_parallel, programs(key, is_parallel)")
      .eq("client_id", clientId),
  ]);

  if (!client) notFound();

  // current program assignment: the one core tier (if any) + whether Pulse is on
  const rows = (assigned ?? []) as unknown as { is_parallel: boolean; programs: { key: string; is_parallel: boolean } }[];
  const coreRow = rows.find((r) => !r.programs.is_parallel);
  const assignment = {
    coreTier: (coreRow?.programs.key ?? null) as ProgramAssignment["coreTier"],
    pulse: rows.some((r) => r.programs.is_parallel),
  };

  const defaults: ProgramValues = {
    id: client.id,
    service_type: client.service_type ?? "",
    investment: client.investment ?? "",
    start_date: client.start_date ?? "",
    end_date: client.end_date ?? "",
    comms_channel: client.comms_channel ?? "",
    best_way_to_reach: client.best_way_to_reach ?? "",
    response_time: client.response_time ?? "",
    call_scheduling_note: client.call_scheduling_note ?? "",
    revision_policy: client.revision_policy ?? "",
    whats_included: client.whats_included ?? "",
    whats_not_included: client.whats_not_included ?? "",
  };

  return (
    <ProgramBody
      defaults={defaults}
      clientId={clientId}
      milestones={(milestones ?? []) as Milestone[]}
      assignment={assignment}
    />
  );
}
