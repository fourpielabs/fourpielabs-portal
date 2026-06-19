import { requireClientAccess } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getThreadMessagesAction } from "@/lib/actions/messages";
import { getAssignableMembers } from "@/lib/tasks";
import { StaffMessages } from "@/components/redesign/staff/messages-body";

export default async function StaffMessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { clientId } = await params;
  const { tab } = await searchParams;
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();

  // threads + the mention/assignee circle. RLS exposes both the shared AND internal
  // threads to staff/admin only; a client never reaches this route (requireClientAccess).
  const [{ data: threads }, members] = await Promise.all([
    supabase.from("threads").select("id, type").eq("client_id", clientId),
    getAssignableMembers(clientId),
  ]);
  const shared = (threads ?? []).find((t) => t.type === "client_shared");
  const internal = (threads ?? []).find((t) => t.type === "internal");
  const isInternal = tab === "internal";
  const active = isInternal ? internal : shared;
  const initialMessages = active ? await getThreadMessagesAction(active.id) : [];

  return (
    <StaffMessages
      clientId={clientId}
      activeId={active?.id ?? null}
      isInternal={isInternal}
      hasActive={!!active}
      me={{ id: me.id, name: me.full_name ?? "You" }}
      members={members}
      initialMessages={initialMessages}
    />
  );
}
