/**
 * Integration test for the MESSAGE notification path. Run:
 *   npx tsx scripts/verify-messages-notify.ts
 *
 * postMessageAction has no UI until 4c, so this exercises its EXACT notification
 * path against real sessions/threads/data: a real `post_message` RPC (so the
 * thread type is RPC-stamped from the real thread), then the REAL production
 * functions messageRecipientIds() + clientUserIds()/staffUserIds() + notify().
 * Surfaces the internal boundary + author-exclusion with real notification rows.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
// The recipient DECISION under test is the REAL production function. notify() and
// the id-resolvers can't be imported here (lib/supabase/admin.ts pulls in
// `server-only`), so they're inlined identically below — the real notify/
// staffUserIds path is separately exercised by verify-notifications.mjs.
import { messageRecipientIds, type AuthorRole } from "../lib/notification-recipients";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, svc, { auth: { persistSession: false } });
const PW = "FourPie!Demo2026";

// inlined copies of lib/notifications.ts helpers (identical logic; can't import)
const clientUserIds = async (cid: string): Promise<string[]> =>
  ((await admin.from("profiles").select("id").eq("client_id", cid).eq("is_active", true)).data ?? []).map((p) => p.id as string);
const staffUserIds = async (cid: string): Promise<string[]> => {
  const assigns = ((await admin.from("client_assignments").select("user_id").eq("client_id", cid)).data ?? []).map((a) => a.user_id as string);
  const ids = new Set<string>();
  if (assigns.length) {
    const team = (await admin.from("profiles").select("id").in("id", assigns).eq("is_active", true)).data ?? [];
    for (const t of team) ids.add(t.id as string);
  }
  const admins = (await admin.from("profiles").select("id").eq("role", "admin").eq("is_active", true)).data ?? [];
  for (const a of admins) ids.add(a.id as string);
  return [...ids];
};
const notify = async (input: { recipients: string[]; excludeUserId?: string; type: string; title: string; body?: string; link?: string }) => {
  const seen = new Set<string>();
  const rows: Record<string, unknown>[] = [];
  for (const uid of input.recipients) {
    if (!uid || uid === input.excludeUserId || seen.has(uid)) continue;
    seen.add(uid);
    rows.push({ user_id: uid, type: input.type, title: input.title, body: input.body ?? null, link: input.link ?? null });
  }
  if (rows.length) await admin.from("notifications").insert(rows);
};

const results: { n: string; ok: boolean; d: string }[] = [];
const rec = (n: string, ok: boolean, d = "") => {
  results.push({ n, ok, d });
  console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`);
};

const prof = async (e: string) => (await admin.from("profiles").select("id").eq("email", e).single()).data!.id as string;
const tid = async (clientId: string, type: string) =>
  (await admin.from("threads").select("id").eq("client_id", clientId).eq("type", type).single()).data!.id as string;
async function session(email: string) {
  const c = createClient(url, anon, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password: PW });
  return c;
}
const noteCount = async (userId: string, marker: string) =>
  (await admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("title", marker)).count ?? 0;

async function main() {
  const { data: premier } = await admin.from("clients").select("id").eq("slug", "premier-painting").single();
  const premierId = premier!.id as string;
  const adminUid = await prof("demo-admin@example.com");
  const teamUid = await prof("demo-team@example.com");
  const clientUid = await prof("demo-client@example.com");
  const sharedThread = await tid(premierId, "client_shared");
  const internalThread = await tid(premierId, "internal");
  const allClientUsers = ((await admin.from("profiles").select("id").eq("client_id", premierId)).data ?? []).map((p) => p.id as string);

  // postMessageAction's exact notification path, run with real data
  async function postAndNotify(sessionClient: Awaited<ReturnType<typeof session>>, authorRole: AuthorRole, authorId: string, threadId: string, marker: string) {
    const { data, error } = await sessionClient.rpc("post_message", { p_thread_id: threadId, p_body: marker });
    if (error) throw new Error(`post_message failed: ${error.message}`);
    const msg = (Array.isArray(data) ? data[0] : data) as { thread_type: "client_shared" | "internal" };
    const [clients, staff] = await Promise.all([clientUserIds(premierId), staffUserIds(premierId)]);
    const recipients = messageRecipientIds({ threadType: msg.thread_type, authorRole, authorId, clientUserIds: clients, staffUserIds: staff });
    await notify({ recipients, excludeUserId: authorId, type: "message", title: marker, body: "msg", link: "/x" });
    return { msg, recipients };
  }

  try {
  await admin.from("notifications").delete().like("title", "E2E-MSG%");
  await admin.from("messages").delete().eq("client_id", premierId).like("body", "E2E-MSG%");

  const adminS = await session("demo-admin@example.com");
  const clientS = await session("demo-client@example.com");

  // (1) staff (admin) → INTERNAL — the boundary
  {
    const M = "E2E-MSG-internal";
    const { recipients } = await postAndNotify(adminS, "admin", adminUid, internalThread, M);
    let clientTotal = 0;
    for (const cu of allClientUsers) clientTotal += await noteCount(cu, M);
    rec("INTERNAL: ZERO notifications for ALL client users", clientTotal === 0, `clientUsers=${allClientUsers.length}, total=${clientTotal}`);
    rec("INTERNAL: staff WERE notified (notify actually ran)", (await noteCount(teamUid, M)) >= 1, `team=${await noteCount(teamUid, M)}`);
    rec("INTERNAL: author (admin) excluded", (await noteCount(adminUid, M)) === 0, `author=${await noteCount(adminUid, M)}`);
    rec("INTERNAL: recipients staff-only (no client ids)", recipients.length > 0 && !recipients.some((id) => allClientUsers.includes(id)), `recipients=${recipients.length}`);
  }

  // (2) staff (admin) → SHARED
  {
    const M = "E2E-MSG-shared-staff";
    await postAndNotify(adminS, "admin", adminUid, sharedThread, M);
    rec("SHARED (staff author): client notified", (await noteCount(clientUid, M)) >= 1, `client=${await noteCount(clientUid, M)}`);
    rec("SHARED (staff author): other staff NOT notified", (await noteCount(teamUid, M)) === 0, `team=${await noteCount(teamUid, M)}`);
    rec("SHARED (staff author): author excluded", (await noteCount(adminUid, M)) === 0, `author=${await noteCount(adminUid, M)}`);
  }

  // (3) client → SHARED
  {
    const M = "E2E-MSG-shared-client";
    await postAndNotify(clientS, "client", clientUid, sharedThread, M);
    rec("SHARED (client author): staff notified", (await noteCount(teamUid, M)) >= 1 && (await noteCount(adminUid, M)) >= 1, `team=${await noteCount(teamUid, M)} admin=${await noteCount(adminUid, M)}`);
    rec("SHARED (client author): author (client) excluded", (await noteCount(clientUid, M)) === 0, `author=${await noteCount(clientUid, M)}`);
  }
  } catch (e) {
    rec("UNCAUGHT ERROR", false, String((e as Error)?.message ?? e));
  } finally {
    await admin.from("notifications").delete().like("title", "E2E-MSG%");
    await admin.from("messages").delete().eq("client_id", premierId).like("body", "E2E-MSG%");
  }

  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} message-notification checks passed.`);
  if (results.some((r) => !r.ok)) process.exit(1);
  console.log("All message-notification checks passed. ✓");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
