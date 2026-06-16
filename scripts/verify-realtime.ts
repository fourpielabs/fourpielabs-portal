/**
 * Realtime-boundary BLOCKER test. Run: npx tsx scripts/verify-realtime.ts
 *
 * A client opens an RLS-enforced `messages` postgres_changes subscription (NO
 * thread filter — so RLS is the ONLY gate, the strongest test). Staff posts to
 * the INTERNAL thread → the client subscription must fire ZERO events. Staff
 * posts to the SHARED thread → the client MUST receive it (proving the connection
 * is authenticated and not silently blocking everything). If a client can ever
 * receive an internal message at the Realtime layer, that's a blocker.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, svc, { auth: { persistSession: false } });
const PW = "FourPie!Demo2026";

const results: { n: string; ok: boolean; d: string }[] = [];
const rec = (n: string, ok: boolean, d = "") => {
  results.push({ n, ok, d });
  console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`);
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { data: premier } = await admin.from("clients").select("id").eq("slug", "premier-painting").single();
  const premierId = premier!.id as string;
  const tid = async (type: string) => (await admin.from("threads").select("id").eq("client_id", premierId).eq("type", type).single()).data!.id as string;
  const sharedThread = await tid("client_shared");
  const internalThread = await tid("internal");
  await admin.from("messages").delete().eq("client_id", premierId).like("body", "RT-%");

  // client realtime subscription (authenticated → RLS-enforced)
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data: signIn } = await client.auth.signInWithPassword({ email: "demo-client@example.com", password: PW });
  client.realtime.setAuth(signIn.session!.access_token);

  const received: string[] = [];
  const channel = client.channel("rt-boundary-test").on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "messages" },
    (payload) => {
      const b = (payload.new as { body?: string })?.body;
      if (b) received.push(b);
    },
  );
  await new Promise<void>((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") resolve();
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(new Error(`subscribe: ${status}`));
    });
    setTimeout(() => reject(new Error("subscribe timeout")), 12000);
  });

  const staff = createClient(url, anon, { auth: { persistSession: false } });
  await staff.auth.signInWithPassword({ email: "demo-admin@example.com", password: PW });

  // (1) staff → INTERNAL: the client must receive NOTHING
  const pi = await staff.rpc("post_message", { p_thread_id: internalThread, p_body: "RT-internal" });
  if (pi.error) throw new Error(`internal post failed: ${pi.error.message}`);
  await wait(4500);
  rec("client subscription receives ZERO internal-thread messages", received.filter((b) => b === "RT-internal").length === 0, `received=${received.filter((b) => b === "RT-internal").length}`);

  // (2) staff → SHARED: the client MUST receive it (auth works, not blocking all)
  const ps = await staff.rpc("post_message", { p_thread_id: sharedThread, p_body: "RT-shared" });
  if (ps.error) throw new Error(`shared post failed: ${ps.error.message}`);
  await wait(4500);
  rec("client subscription DOES receive shared-thread messages", received.filter((b) => b === "RT-shared").length >= 1, `received=${received.filter((b) => b === "RT-shared").length}`);

  await client.removeChannel(channel);
  await admin.from("messages").delete().eq("client_id", premierId).like("body", "RT-%");

  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} realtime-boundary checks passed.`);
  if (results.some((r) => !r.ok)) process.exit(1);
  console.log("Realtime boundary holds — a client can never receive internal messages. ✓");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
