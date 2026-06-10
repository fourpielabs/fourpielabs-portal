import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { type ProgramValues } from "@/lib/schemas";
import { ProgramForm } from "@/components/program/program-form";
import {
  MilestonesEditor,
  type Milestone,
} from "@/components/program/milestones-editor";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ProgramPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  await requireClientAccess(clientId);
  const supabase = await createClient();

  const [{ data: client }, { data: milestones }] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, service_type, investment, start_date, end_date, comms_channel, best_way_to_reach, response_time, call_scheduling_note, revision_policy, whats_included, whats_not_included",
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
  ]);

  if (!client) notFound();

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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Program overview</CardTitle>
          <CardDescription>
            What the client sees on their Program page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProgramForm defaults={defaults} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Journey &amp; milestones</CardTitle>
          <CardDescription>The roadmap shown to the client.</CardDescription>
        </CardHeader>
        <CardContent>
          <MilestonesEditor
            clientId={clientId}
            milestones={(milestones ?? []) as Milestone[]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
