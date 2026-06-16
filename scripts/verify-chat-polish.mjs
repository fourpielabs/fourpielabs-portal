// Data-layer E2E for Batch 3 (chat polish: inline image preview + in-thread search).
// No app server needed — both new features' boundaries are RLS-enforced on `messages`,
// so we exercise the SAME policy the server actions use, via the anon client as each role.
//   Run: node scripts/verify-chat-polish.mjs
//
// BOUNDARY-FIRST (the two gates the new features ride):
//  (1) IMAGE PREVIEW rides getMessageAttachmentUrlAction → re-checks the message row via
//      RLS. An INTERNAL image's row is unreadable by the client → preview can't sign it.
//  (2) SEARCH (searchThreadMessagesAction) is just `messages` SELECT + .ilike under RLS.
//      A client searching an internal thread id sees ZERO rows; staff (assigned) see both.
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const PASS = "FourPie!Demo2026";
const ts = `${Math.floor(Date.now() / 1000)}`;
const TOKEN = `B3SEARCH-${ts}`; // unique, so .ilike matches only our seeded rows

const results = [];
const rec = (n, ok, d = "") => { results.push({ ok }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };
const asUser = async (email) => {
  const c = createClient(url, anon, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password: PASS });
  return c;
};

const premierId = (await admin.from("clients").select("id").eq("slug", "premier-painting").single()).data.id;
const threads = (await admin.from("threads").select("id, type").eq("client_id", premierId)).data ?? [];
const sharedThread = threads.find((t) => t.type === "client_shared");
const internalThread = threads.find((t) => t.type === "internal");
const staffId = (await admin.from("profiles").select("id").eq("email", "demo-admin@example.com").single()).data.id;

const seed = (thread, body, attachment_name = null) => admin.from("messages").insert({
  client_id: premierId,
  thread_id: thread.id,
  thread_type: thread.type,
  author_id: staffId,
  body,
  attachment_path: attachment_name ? `${premierId}/${ts}-${attachment_name}` : null,
  attachment_name,
}).select("id").single();

try {
  await admin.from("messages").delete().like("body", "B3SEARCH-%");

  // Seed: a searchable message in BOTH threads; the internal one carries an IMAGE attachment.
  const sharedMsg = (await seed(sharedThread, `${TOKEN} shared hello painting`)).data;
  const internalImg = (await seed(internalThread, `${TOKEN} internal secret note`, "secret-chart.png")).data;

  const client = await asUser("demo-client@example.com");
  const staff = await asUser("demo-team@example.com");

  // (1) IMAGE BOUNDARY — client CANNOT read the internal image's message row, so the
  // inline preview's getMessageAttachmentUrlAction returns DENIED (no URL minted). FIRST.
  const cImg = await client.from("messages").select("id, attachment_name").eq("id", internalImg.id);
  rec("INTERNAL image → client DENIED (inline preview can't sign it)", (cImg.data?.length ?? 0) === 0, `${cImg.data?.length ?? 0} rows`);

  // staff CAN read the internal image row (→ preview signs + renders for staff)
  const sImg = await staff.from("messages").select("id, attachment_name").eq("id", internalImg.id);
  rec("INTERNAL image → staff (assigned) can read the row (preview works)", (sImg.data?.length ?? 0) === 1 && sImg.data[0].attachment_name === "secret-chart.png", `${sImg.data?.length ?? 0} rows`);

  // (2) SEARCH BOUNDARY — client searching the INTERNAL thread sees ZERO (RLS shared-only)
  const cSearchInternal = await client.from("messages").select("id").eq("thread_id", internalThread.id).ilike("body", `%${TOKEN}%`);
  rec("client SEARCH into internal thread → ZERO results", (cSearchInternal.data?.length ?? 0) === 0, `${cSearchInternal.data?.length ?? 0} rows`);

  // client searching their OWN shared thread → finds the shared message
  const cSearchShared = await client.from("messages").select("id").eq("thread_id", sharedThread.id).ilike("body", `%${TOKEN}%`);
  rec("client SEARCH own shared thread → finds the message", (cSearchShared.data?.length ?? 0) === 1 && cSearchShared.data[0].id === sharedMsg.id, `${cSearchShared.data?.length ?? 0} rows`);

  // staff (assigned) searching BOTH threads → finds both
  const sSearchInternal = await staff.from("messages").select("id").eq("thread_id", internalThread.id).ilike("body", `%${TOKEN}%`);
  const sSearchShared = await staff.from("messages").select("id").eq("thread_id", sharedThread.id).ilike("body", `%${TOKEN}%`);
  rec("staff SEARCH both threads → finds both (internal + shared)", (sSearchInternal.data?.length ?? 0) === 1 && (sSearchShared.data?.length ?? 0) === 1, `internal=${sSearchInternal.data?.length ?? 0} shared=${sSearchShared.data?.length ?? 0}`);
} catch (e) {
  rec("UNCAUGHT ERROR", false, String(e?.message ?? e));
} finally {
  await admin.from("messages").delete().like("body", "B3SEARCH-%");
}

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} chat-polish boundary checks passed.`);
if (results.some((r) => !r.ok)) process.exit(1);
console.log("Chat-polish boundaries hold — internal images + internal search stay client-invisible. ✓");
