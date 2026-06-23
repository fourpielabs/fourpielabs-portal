"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth/guards";

// A typer / reader is keyed by user id; names are resolved via the service role (the caller can
// already see these rows). All reads are RLS-scoped — a client gets ZERO rows for the internal
// thread, so it can never observe internal typing or seen-state.
export type Typer = { userId: string; name: string };
export type ReadReceipt = { userId: string; name: string; lastReadAt: string };

const TYPING_WINDOW_MS = 6000; // a row is "actively typing" if touched within this window

/**
 * Signal that the caller is typing in a thread, via the set_typing SECURITY DEFINER RPC (the
 * sole write path). The RPC re-derives the REAL thread_type/client_id and gates on
 * can_access_thread, so a client can never emit a typing signal into the internal thread.
 * INSERT/UPDATE only (no DELETE) — the boundary path stays RLS-filterable at the realtime layer.
 */
export async function setTypingAction(threadId: string): Promise<void> {
  await requireProfile();
  const supabase = await createClient();
  await supabase.rpc("set_typing", { p_thread_id: threadId });
}

/**
 * Who is actively typing in a thread RIGHT NOW (excluding the caller) — RLS-scoped: a client
 * gets zero rows for the internal thread (typing_states mirrors messages visibility), so a
 * client can never receive an internal typing signal. Stale rows (older than the window) are
 * ignored, so no DELETE is ever needed.
 */
export async function getActiveTypersAction(threadId: string): Promise<Typer[]> {
  const me = await requireProfile();
  const supabase = await createClient();
  const since = new Date(Date.now() - TYPING_WINDOW_MS).toISOString();
  const { data } = await supabase
    .from("typing_states")
    .select("user_id")
    .eq("thread_id", threadId)
    .gt("updated_at", since);
  const ids = [...new Set((data ?? []).map((r) => r.user_id as string))].filter((id) => id !== me.id);
  if (ids.length === 0) return [];
  const names = await resolveNames(ids);
  return ids.map((id) => ({ userId: id, name: names.get(id) ?? "Someone" }));
}

/**
 * Other participants' read state (last_read_at) for a thread — RLS-scoped: a client sees its
 * own + staff's reads on the SHARED thread only; staff's INTERNAL read-state is never returned
 * to (or inferable by) a client. Drives the "Seen by … at …" marker. Excludes the caller.
 */
export async function getThreadReadsAction(threadId: string): Promise<ReadReceipt[]> {
  const me = await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("thread_reads")
    .select("user_id, last_read_at")
    .eq("thread_id", threadId);
  const rows = (data ?? []).filter((r) => (r.user_id as string) !== me.id) as { user_id: string; last_read_at: string }[];
  if (rows.length === 0) return [];
  const names = await resolveNames(rows.map((r) => r.user_id));
  return rows.map((r) => ({ userId: r.user_id, name: names.get(r.user_id) ?? "Someone", lastReadAt: r.last_read_at }));
}

// service-role name lookup (the caller can already see the underlying RLS-scoped rows)
async function resolveNames(userIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds)];
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("id, full_name, email").in("id", ids);
  for (const p of data ?? []) map.set(p.id as string, (p.full_name as string) ?? (p.email as string) ?? "Someone");
  return map;
}
