import { MessageSquare } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getThreadMessagesAction } from "@/lib/actions/messages";
import { Conversation } from "@/components/messaging/conversation";
import { EmptyState } from "@/components/ui/empty-state";

export default async function ClientMessagesPage() {
  const me = await requireRole(["client"]);
  const supabase = await createClient();

  // RLS exposes ONLY the client's own client_shared thread — the internal thread
  // is invisible, so a client has no internal surface anywhere.
  const { data: thread } = await supabase
    .from("threads")
    .select("id")
    .eq("type", "client_shared")
    .maybeSingle();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.015em]">Messages</h1>
        <p className="text-sm text-ink-2">Your conversation with the 4Pie Labs team.</p>
      </div>
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
        />
      )}
    </div>
  );
}
