import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { NotesManager, type MeetingNote } from "@/components/notes/notes-manager";

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
      <div>
        <h2 className="text-lg font-semibold">Meeting notes</h2>
        <p className="text-sm text-muted-foreground">
          One entry per session — decisions, actions, next steps.
        </p>
      </div>
      <NotesManager clientId={clientId} notes={(notes ?? []) as MeetingNote[]} />
    </div>
  );
}
