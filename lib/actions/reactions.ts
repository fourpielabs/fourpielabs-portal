"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth/guards";

type Result<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

// A grouped reaction on a message: one row per distinct emoji, with its count, whether the
// current viewer reacted with it, and the reactors' display names (for the chip tooltip).
export type ReactionGroup = { emoji: string; count: number; mine: boolean; names: string[] };

/**
 * Reactions for every message in a thread the caller can see — RLS-scoped: the
 * message_reactions SELECT policies mirror the messages policies (client → own
 * client_shared only), so a client receives ZERO rows for internal-thread messages.
 * The existence of an internal reaction therefore can't leak. Reactor names are resolved
 * via the service role (the caller can already see these reaction rows). Returns a map
 * keyed by message_id → grouped reactions, so the UI can attach chips per message.
 */
export async function getThreadReactionsAction(threadId: string): Promise<Record<string, ReactionGroup[]>> {
  const me = await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("message_reactions")
    .select("message_id, user_id, emoji")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as { message_id: string; user_id: string; emoji: string }[];
  if (rows.length === 0) return {};

  // resolve reactor names (service role — the caller can already see these rows)
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const nameById = new Map<string, string>();
  if (userIds.length) {
    const admin = createAdminClient();
    const { data: profs } = await admin.from("profiles").select("id, full_name, email").in("id", userIds);
    for (const p of profs ?? []) nameById.set(p.id as string, (p.full_name as string) ?? (p.email as string) ?? "Someone");
  }

  // group by message → emoji, preserving first-seen emoji order
  const byMsg: Record<string, Map<string, { count: number; mine: boolean; names: string[] }>> = {};
  for (const r of rows) {
    const groups = (byMsg[r.message_id] ??= new Map());
    const g = groups.get(r.emoji) ?? { count: 0, mine: false, names: [] };
    g.count += 1;
    if (r.user_id === me.id) g.mine = true;
    g.names.push(r.user_id === me.id ? "You" : nameById.get(r.user_id) ?? "Someone");
    groups.set(r.emoji, g);
  }
  const out: Record<string, ReactionGroup[]> = {};
  for (const [messageId, groups] of Object.entries(byMsg)) {
    out[messageId] = [...groups.entries()].map(([emoji, g]) => ({ emoji, count: g.count, mine: g.mine, names: g.names }));
  }
  return out;
}

/**
 * Toggle the caller's reaction (add or remove) via the toggle_reaction SECURITY DEFINER
 * RPC — the SOLE write path. The RPC re-reads the message's REAL thread_type/client_id and
 * gates on can_access_thread, so a client can never react to an internal message (even by
 * passing its id), and a direct table write is denied (no client write policy). Returns
 * whether the reaction was added (true) or removed (false).
 */
export async function toggleReactionAction(messageId: string, emoji: string): Promise<Result<{ added: boolean }>> {
  await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("toggle_reaction", { p_message_id: messageId, p_emoji: emoji });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { added: data === true } };
}
