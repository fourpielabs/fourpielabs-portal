import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { CallsNotesBody, type CallsData } from "@/components/redesign/client/calls-notes-body";

export default async function ClientCallsNotesPage() {
  const me = await requireRole(["client"]);
  const supabase = await createClient();

  const [{ data: callTypes }, { data: upcoming }, { data: recordings }, { data: notes }] = await Promise.all([
    supabase.from("call_types").select("id, name, duration_label, frequency_label, booking_url").order("sort_order"),
    supabase
      .from("call_bookings")
      .select("id, title, start_at, meeting_url")
      .eq("status", "booked")
      .gte("start_at", new Date().toISOString())
      .order("start_at", { ascending: true }),
    supabase.from("call_recordings").select("id, call_date, call_type, recording_url, key_topic").order("call_date", { ascending: false }),
    supabase.from("meeting_notes").select("id, title, meeting_date, body").order("meeting_date", { ascending: false }),
  ]);

  const data: CallsData = {
    callTypes: (callTypes ?? []).map((c) => ({ id: c.id, name: c.name, durationLabel: c.duration_label, frequencyLabel: c.frequency_label, bookingUrl: c.booking_url })),
    upcoming: (upcoming ?? []).map((b) => ({ id: b.id, title: b.title, start_at: b.start_at, meeting_url: b.meeting_url })),
    recordings: (recordings ?? []).map((r) => ({ id: r.id, call_date: r.call_date, call_type: r.call_type, recording_url: r.recording_url, key_topic: r.key_topic })),
    notes: (notes ?? []).map((n) => ({ id: n.id, title: n.title, meeting_date: n.meeting_date, body: n.body })),
    user: { name: me.full_name, email: me.email, clientId: me.client_id ?? "" },
  };

  return <CallsNotesBody data={data} />;
}
