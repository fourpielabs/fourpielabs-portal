import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getThreadMessagesAction } from "@/lib/actions/messages";
import { getAssignableMembers } from "@/lib/tasks";
import { Conversation } from "@/components/redesign/client/conversation";
import { MessagesEmpty } from "@/components/redesign/client/conversation-empty";

export default async function ClientMessagesPage() {
  const me = await requireRole(["client"]);
  const supabase = await createClient();

  // thread + the mention circle in parallel. RLS exposes ONLY the client's own
  // client_shared thread — the internal thread is invisible.
  const [{ data: thread }, members] = await Promise.all([
    supabase.from("threads").select("id").eq("type", "client_shared").maybeSingle(),
    me.client_id ? getAssignableMembers(me.client_id) : Promise.resolve([]),
  ]);

  if (!thread) return <MessagesEmpty />;

  return (
    <Conversation
      threadId={thread.id}
      notifLink="/messages"
      currentUserId={me.id}
      currentUserName={me.full_name ?? "You"}
      initialMessages={await getThreadMessagesAction(thread.id)}
      audience="shared"
      taskContext={{ role: "client", clientId: me.client_id ?? "", members }}
    />
  );
}
