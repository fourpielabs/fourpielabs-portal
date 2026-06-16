import Link from "next/link";
import { Eye, Lock } from "lucide-react";
import { requireClientAccess } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getThreadMessagesAction } from "@/lib/actions/messages";
import { getAssignableMembers } from "@/lib/tasks";
import { Conversation } from "@/components/messaging/conversation";
import { cn } from "@/lib/utils";

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

  // threads + the mention/assignee circle in parallel
  const [{ data: threads }, members] = await Promise.all([
    supabase.from("threads").select("id, type").eq("client_id", clientId),
    getAssignableMembers(clientId),
  ]);
  const shared = (threads ?? []).find((t) => t.type === "client_shared");
  const internal = (threads ?? []).find((t) => t.type === "internal");

  const isInternal = tab === "internal";
  const active = isInternal ? internal : shared;
  const base = `/clients/${clientId}/messages`;

  const tabCls = (on: boolean, internalTab: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
      internalTab
        ? on
          ? "border-amber-400 bg-amber-100 text-amber-900"
          : "border-amber-200 bg-amber-50/60 text-amber-800 hover:bg-amber-50"
        : on
          ? "border-emerald-400 bg-emerald-100 text-emerald-900"
          : "border-emerald-200 bg-emerald-50/60 text-emerald-800 hover:bg-emerald-50",
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={base} className={tabCls(!isInternal, false)}>
          <Eye className="size-4" /> Client thread
        </Link>
        <Link href={`${base}?tab=internal`} className={tabCls(isInternal, true)}>
          <Lock className="size-4" /> Internal
        </Link>
        <span className="ml-1 text-xs text-ink-3">
          {isInternal
            ? "Staff-only — the client cannot see this thread."
            : "Shared with the client."}
        </span>
      </div>

      {active ? (
        <Conversation
          key={active.id}
          threadId={active.id}
          notifLink={isInternal ? `${base}?tab=internal` : base}
          currentUserId={me.id}
          currentUserName={me.full_name ?? "You"}
          initialMessages={await getThreadMessagesAction(active.id)}
          audience={isInternal ? "internal" : "shared"}
          taskContext={{ role: "staff", clientId, members }}
        />
      ) : (
        <p className="text-sm text-ink-3">Thread not found.</p>
      )}
    </div>
  );
}
