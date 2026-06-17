import { MessageSquare } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getThreadMessagesAction } from "@/lib/actions/messages";
import { getAssignableMembers } from "@/lib/tasks";
import { Conversation } from "@/components/messaging/conversation";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";

export default async function ClientMessagesPage() {
  const me = await requireRole(["client"]);
  const supabase = await createClient();

  // thread + the mention circle in parallel. RLS exposes ONLY the client's own
  // client_shared thread — the internal thread is invisible.
  const [{ data: thread }, members] = await Promise.all([
    supabase.from("threads").select("id").eq("type", "client_shared").maybeSingle(),
    me.client_id ? getAssignableMembers(me.client_id) : Promise.resolve([]),
  ]);

  return (
    <PageContainer width="standard" stack>
      <PageHeader
        title="Messages"
        description="Your conversation with the 4Pie Labs team."
      />
      {!thread ? (
        <EmptyState
          icon={<MessageSquare />}
          title="No conversation yet"
          description="Your message thread will appear here."
        />
      ) : (
        <Conversation
          threadId={thread.id}
          notifLink="/messages"
          currentUserId={me.id}
          currentUserName={me.full_name ?? "You"}
          initialMessages={await getThreadMessagesAction(thread.id)}
          audience="shared"
          taskContext={{ role: "client", clientId: me.client_id ?? "", members }}
        />
      )}
    </PageContainer>
  );
}
