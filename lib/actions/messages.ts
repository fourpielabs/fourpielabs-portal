"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth/guards";
import { notify, clientUserIds, staffUserIds } from "@/lib/notifications";
import { messageRecipientIds } from "@/lib/notification-recipients";

type Result<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export type ThreadMessage = {
  id: string;
  body: string;
  authorId: string | null;
  authorName: string;
  authorRole: "admin" | "team" | "client" | null;
  createdAt: string;
};

type PostedMessage = {
  id: string;
  client_id: string;
  thread_type: "client_shared" | "internal";
  author_id: string;
};

/**
 * Post a message via the 4a `post_message` SECURITY DEFINER RPC (the sole write
 * path; RLS-scoped, body-validated), then generate notifications for the OTHER
 * participants.
 *
 * TIGHTENING: the internal-vs-shared recipient branch is derived from
 * `msg.thread_type` — the value the DEFINER RPC stamped from the REAL thread
 * row — never from caller input. So a client/internal thread can't be spoofed
 * into notifying the wrong side. The author is excluded by notify() itself.
 */
export async function postMessageAction(
  threadId: string,
  body: string,
): Promise<Result<{ id: string }>> {
  const me = await requireProfile();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("post_message", {
    p_thread_id: threadId,
    p_body: body,
  });
  if (error) return { ok: false, error: error.message };

  const msg = (Array.isArray(data) ? data[0] : data) as PostedMessage | null;
  if (msg) {
    // Recipients via the pure messageRecipientIds() — thread type comes from the
    // RPC's returned row (the REAL thread), so the internal-never-client boundary
    // and author-exclusion are structurally tied to the real thread, not input.
    const [clients, staff] = await Promise.all([
      clientUserIds(msg.client_id),
      staffUserIds(msg.client_id),
    ]);
    const recipients = messageRecipientIds({
      threadType: msg.thread_type,
      authorRole: me.role,
      authorId: me.id,
      clientUserIds: clients,
      staffUserIds: staff,
    });

    const toStaff = msg.thread_type === "internal" || me.role === "client";
    const link = toStaff
      ? `/clients/${msg.client_id}/messages${msg.thread_type === "internal" ? "?tab=internal" : ""}`
      : "/messages"; // 4c routes — forward-looking deep-link

    await notify({
      recipients,
      excludeUserId: me.id,
      type: "message",
      title: `New message from ${me.full_name ?? (me.role === "client" ? "your client" : "your team")}`,
      body: body.trim().slice(0, 140),
      link,
      clientId: msg.client_id,
      threadId,
    });
  }

  revalidatePath("/dashboard");
  return { ok: true, data: msg ? { id: msg.id } : undefined };
}

/**
 * RLS-scoped message fetch for a thread (the third Realtime-boundary layer: the
 * list is always loaded through this, never rendered from a raw realtime payload,
 * so a client can only ever see its own client_shared thread — internal rows are
 * RLS-denied here even if a stray event arrived). Author display names are
 * resolved via the service role (the caller can already see these messages).
 */
export async function getThreadMessagesAction(threadId: string): Promise<ThreadMessage[]> {
  await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("id, body, author_id, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  const msgs = data ?? [];

  const authorIds = [...new Set(msgs.map((m) => m.author_id).filter(Boolean))] as string[];
  const nameById = new Map<string, { name: string; role: ThreadMessage["authorRole"] }>();
  if (authorIds.length) {
    const admin = createAdminClient();
    const { data: profs } = await admin.from("profiles").select("id, full_name, email, role").in("id", authorIds);
    for (const p of profs ?? []) nameById.set(p.id, { name: p.full_name ?? p.email ?? "Unknown", role: p.role });
  }
  return msgs.map((m) => {
    const a = m.author_id ? nameById.get(m.author_id) : null;
    return {
      id: m.id as string,
      body: m.body as string,
      authorId: (m.author_id as string | null) ?? null,
      authorName: a?.name ?? "Removed user",
      authorRole: a?.role ?? null,
      createdAt: m.created_at as string,
    };
  });
}

/**
 * On opening a thread: (1) per-thread read state via the 4a mark_thread_read RPC
 * (ignored if the caller can't access the thread), and (2) clear the bell's
 * `message` notifications for THIS thread — `link` already encodes the thread
 * (per 4b), so only that thread's message notifications are marked read.
 */
export async function markThreadViewedAction(threadId: string, notifLink: string): Promise<{ ok: boolean }> {
  await requireProfile();
  const supabase = await createClient();
  await supabase.rpc("mark_thread_read", { p_thread_id: threadId });
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("type", "message")
    .eq("link", notifLink)
    .is("read_at", null);
  return { ok: true };
}
