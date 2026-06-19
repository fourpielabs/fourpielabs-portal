import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { NotesManager, type MeetingNote } from "@/components/redesign/staff/notes-manager";

export default async function NotesPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  await requireClientAccess(clientId);
  const supabase = await createClient();

  const { data: notes } = await supabase
    .from("meeting_notes")
    .select("id, title, meeting_date, body, visible_to_client")
    .eq("client_id", clientId)
    .order("meeting_date", { ascending: false });

  return (
    <div className="space-y-4">
      <NotesManager clientId={clientId} notes={(notes ?? []) as MeetingNote[]} />
    </div>
  );
}
