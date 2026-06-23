"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth/guards";
import { notify, clientUserIds, staffUserIds } from "@/lib/notifications";
import { messageRecipientIds } from "@/lib/notification-recipients";
import { createTaskAction } from "@/lib/actions/tasks-client";
import { staffCreateTaskAction } from "@/lib/actions/tasks";

type Result<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export type ThreadMessage = {
  id: string;
  body: string;
  bodyRich: string | null; // TipTap HTML for new messages; null → render legacy markdown body
  authorId: string | null;
  authorName: string;
  authorRole: "admin" | "team" | "client" | null;
  createdAt: string;
  attachmentName: string | null;
  editedAt: string | null;
  linkedTask: { id: string; title: string; status: string } | null; // task-bubble (source_message_id)
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
  mentionedIds?: string[],
  attachmentPath?: string | null,
  attachmentName?: string | null,
  bodyRich?: string | null,
): Promise<Result<{ id: string }>> {
  const me = await requireProfile();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("post_message", {
    p_thread_id: threadId,
    p_body: body,
    p_attachment_path: attachmentPath ?? null,
    p_attachment_name: attachmentName ?? null,
    p_body_rich: bodyRich ?? null,
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

    // @mentions — notify mentioned users who AREN'T already in the message
    // recipients (same-side mentions). The valid-participant set is recomputed
    // from the REAL thread type: internal → staff ONLY, so a client id passed as
    // a mention into an internal thread is filtered out (the boundary, server-
    // enforced, never trusting the caller's list).
    const valid = new Set(msg.thread_type === "internal" ? staff : [...clients, ...staff]);
    const mentionExtra = [...new Set(mentionedIds ?? [])].filter(
      (id) => valid.has(id) && id !== me.id && !recipients.includes(id),
    );
    if (mentionExtra.length) {
      await notify({
        recipients: mentionExtra,
        excludeUserId: me.id,
        type: "message",
        title: `${me.full_name ?? "Someone"} mentioned you`,
        body: body.trim().slice(0, 140),
        link,
        clientId: msg.client_id,
        threadId,
      });
    }
  }

  revalidatePath("/dashboard");
  return { ok: true, data: msg ? { id: msg.id } : undefined };
}

export type ThreadParticipant = { id: string; name: string };

/**
 * The users who can be @mentioned in a thread = its participants, RLS-gated.
 * The thread is read through the USER client, so a client calling this for an
 * INTERNAL thread reads nothing (threads_client_select is shared-only) → []. For
 * a shared thread: the client's users + staff; for internal: staff ONLY (clients
 * are never staff). So a client can never be offered — nor mentioned — into
 * internal content (the same boundary the post action re-enforces).
 */
export async function getThreadParticipantsAction(threadId: string): Promise<ThreadParticipant[]> {
  const me = await requireProfile();
  const supabase = await createClient();
  const { data: thread } = await supabase
    .from("threads")
    .select("client_id, type")
    .eq("id", threadId)
    .maybeSingle();
  if (!thread) return [];
  const clientId = thread.client_id as string;
  const type = thread.type as "client_shared" | "internal";

  const [clients, staff] = await Promise.all([
    type === "internal" ? Promise.resolve<string[]>([]) : clientUserIds(clientId),
    staffUserIds(clientId),
  ]);
  const targets = [...new Set([...clients, ...staff])].filter((id) => id !== me.id);
  if (targets.length === 0) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .in("id", targets)
    .eq("is_active", true);
  return (data ?? []).map((p) => ({
    id: p.id as string,
    name: (p.full_name as string) ?? (p.email as string) ?? "Unknown",
  }));
}

/**
 * RLS-scoped message fetch for a thread (the third Realtime-boundary layer: the
 * list is always loaded through this, never rendered from a raw realtime payload,
 * so a client can only ever see its own client_shared thread — internal rows are
 * RLS-denied here even if a stray event arrived). Author display names are
 * resolved via the service role (the caller can already see these messages).
 */
export async function getThreadMessagesAction(threadId: string, after?: string): Promise<ThreadMessage[]> {
  await requireProfile();
  const supabase = await createClient();
  // `after` → incremental fetch (only messages newer than the caller's latest), so
  // a realtime event appends ~1 row instead of re-loading the whole thread. Still
  // RLS-scoped (the boundary holds — we never render the raw realtime payload).
  let q = supabase
    .from("messages")
    .select("id, body, body_rich, author_id, created_at, attachment_name, edited_at")
    .eq("thread_id", threadId);
  if (after) q = q.gt("created_at", after);
  const { data } = await q.order("created_at", { ascending: true });
  const rows = (data ?? []) as RawMessage[];

  // task-bubble: tasks linked to these messages (RLS-SCOPED via the user client → a client
  // only ever sees their own visible tasks; staff see assigned). Never widens visibility.
  const ids = rows.map((m) => m.id);
  const taskByMsg = new Map<string, { id: string; title: string; status: string }>();
  if (ids.length) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, status, source_message_id")
      .in("source_message_id", ids);
    for (const t of tasks ?? []) if (t.source_message_id) taskByMsg.set(t.source_message_id as string, { id: t.id as string, title: t.title as string, status: t.status as string });
  }
  return hydrateMessages(rows, taskByMsg);
}

type RawMessage = {
  id: string;
  body: string;
  body_rich: string | null;
  author_id: string | null;
  created_at: string;
  attachment_name: string | null;
  edited_at: string | null;
};

/** Resolve author names (service-role; the caller can already see these rows) + map. */
async function hydrateMessages(msgs: RawMessage[], taskByMsg?: Map<string, { id: string; title: string; status: string }>): Promise<ThreadMessage[]> {
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
      id: m.id,
      body: m.body,
      bodyRich: m.body_rich ?? null,
      authorId: m.author_id ?? null,
      authorName: a?.name ?? "Removed user",
      authorRole: a?.role ?? null,
      createdAt: m.created_at,
      attachmentName: m.attachment_name ?? null,
      editedAt: m.edited_at ?? null,
      linkedTask: taskByMsg?.get(m.id) ?? null,
    };
  });
}

/**
 * Search within a thread — RLS-scoped: a client searches ONLY their own shared
 * thread (the messages_client_select policy is shared-only + non-deleted), staff
 * search the threads they can access. The same SELECT policy as the thread read, so
 * the internal boundary holds (a client gets nothing for an internal thread id).
 */
export async function searchThreadMessagesAction(threadId: string, query: string): Promise<ThreadMessage[]> {
  await requireProfile();
  const q = query.trim();
  if (q.length < 2) return [];
  const esc = q.replace(/[%_\\]/g, (c) => `\\${c}`); // literal — escape ILIKE wildcards
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("id, body, body_rich, author_id, created_at, attachment_name, edited_at")
    .eq("thread_id", threadId)
    .ilike("body", `%${esc}%`)
    .order("created_at", { ascending: false })
    .limit(20);
  return hydrateMessages((data ?? []) as RawMessage[]);
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

/**
 * Edit / soft-delete a message via the SECURITY DEFINER RPCs (the sole write path
 * — no direct client UPDATE policy). The RPCs enforce author-only + can_access_thread,
 * so the internal boundary holds: a client can never edit/delete an internal-thread
 * message or another author's message. Soft-delete preserves history; deleted rows
 * vanish from every read (RLS `deleted_at is null`).
 */
export async function editMessageAction(messageId: string, body: string, bodyRich?: string | null): Promise<Result> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("edit_message", { p_message_id: messageId, p_body: body, p_body_rich: bodyRich ?? null });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteMessageAction(messageId: string): Promise<Result> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_message", { p_message_id: messageId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Create a task FROM chat (the rebuilt task-bubble flow): post the draft as a message in
 * the CURRENT thread, then create a task linked to it via source_message_id → the message
 * renders as a task bubble. BOUNDARY: the message posts to the thread the caller is in
 * (post_message RLS — a client can only reach their own client_shared thread); the task
 * link is created through the SAME gated paths — create_task (client) validates the source
 * is the caller's own client_shared message, and staffCreateTaskAction's resolveSource
 * re-reads the message's REAL thread_type and forces visibility (internal-sourced → staff-
 * only). So a task from the client↔agency thread stays in that thread, never internal.
 */
export async function createTaskFromChatAction(
  threadId: string, title: string,
): Promise<Result<{ messageId: string; taskId: string; title: string; status: string; visibleToClient: boolean }>> {
  const me = await requireProfile();
  const t = title.trim();
  if (!t) return { ok: false, error: "Add a few words for the task." };
  const supabase = await createClient();

  // 1) post the source message (RLS-gated to the caller's accessible thread)
  const { data, error } = await supabase.rpc("post_message", { p_thread_id: threadId, p_body: t });
  if (error) return { ok: false, error: error.message };
  const msg = (Array.isArray(data) ? data[0] : data) as PostedMessage | null;
  if (!msg) return { ok: false, error: "Couldn't post the message." };

  // 2) create the task linked to it — through the existing boundary-gated paths
  let taskId: string | undefined;
  const visibleToClient = msg.thread_type !== "internal";
  if (me.role === "client") {
    const res = await createTaskAction({ title: t, description: "", assignee_id: "", due_date: "", source_message_id: msg.id });
    if (!res.ok) return res;
    taskId = res.data?.id;
  } else {
    const res = await staffCreateTaskAction(msg.client_id, {
      title: t, description: "", status: "todo", assignee_id: "", due_date: "",
      visible_to_client: visibleToClient, source_message_id: msg.id,
    });
    if (!res.ok) return res;
    taskId = res.data?.id;
  }
  return { ok: true, data: { messageId: msg.id, taskId: taskId ?? "", title: t, status: "todo", visibleToClient } };
}
