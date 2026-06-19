import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { CallsManager } from "@/components/redesign/staff/calls-manager";
import type {
  CallType,
  CallRecording,
} from "@/components/calls/calls-manager";

export default async function CallsPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  await requireClientAccess(clientId);
  const supabase = await createClient();

  const [{ data: callTypes }, { data: recordings }] = await Promise.all([
    supabase
      .from("call_types")
      .select("id, name, duration_label, frequency_label, booking_url")
      .eq("client_id", clientId)
      .order("sort_order"),
    supabase
      .from("call_recordings")
      .select("id, call_date, call_type, recording_url, key_topic, visible_to_client")
      .eq("client_id", clientId)
      .order("call_date", { ascending: false }),
  ]);

  return (
    <div className="space-y-4">
      <CallsManager
        clientId={clientId}
        callTypes={(callTypes ?? []) as CallType[]}
        recordings={(recordings ?? []) as CallRecording[]}
      />
    </div>
  );
}
