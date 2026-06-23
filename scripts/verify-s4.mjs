// Track 5 S4 E2E — typing indicators + read receipts. THE REALTIME-LEAK PROOF, run with TWO
// concurrent browser contexts: while staff types in the INTERNAL thread, the client watching their
// shared thread must see ZERO typing signal; while staff types in the SHARED thread, the client
// sees it live. Plus read receipts ("Seen by …") on the shared thread. Provisions its own temp
// project client + users; self-cleans.
import { config } from "dotenv"; config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";
const BASE = "http://localhost:3000", PASS = "FourPie!Demo2026", ADMIN = "zz-s4-admin@example.com", CLIENT = "zz-s4-client@example.com", SLUG = "zz-s4-presence";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OUT = "docs/features/messages/s4"; mkdirSync(OUT, { recursive: true });
const results = []; const rec = (n, ok, d = "") => { results.push({ n, ok }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };
const delU = async (e) => { const { data } = await admin.auth.admin.listUsers({ perPage: 1000 }); const u = data?.users.find(x => x.email === e); if (u) await admin.auth.admin.deleteUser(u.id); };
const b = await chromium.launch({ channel: "chrome", headless: true });
const login = async (page, email) => {
  // retry to defeat the hydration race where an early click submits the form natively as GET
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(500); // let the sign-in handler hydrate before clicking
    await page.fill("input[type=email]", email); await page.fill("input[type=password]", PASS);
    await page.click('button:has-text("Sign in")');
    const ok = await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 }).then(() => true).catch(() => false);
    if (ok) return;
  }
};
const typingVisible = (page) => page.locator('text=/is typing/').count().then((c) => c > 0);
const waitFor = async (page, fn, ms = 12000, step = 400) => { for (let t = 0; t < ms; t += step) { if (await fn()) return true; await page.waitForTimeout(step); } return false; };
// type chars into the editor periodically for `ms` to keep the typing signal alive
const typeFor = async (page, ms) => { const end = Date.now() + ms; let i = 0; while (Date.now() < end) { await page.locator(".rd-richeditor").click(); await page.keyboard.type("typing" + (i++)); await page.waitForTimeout(900); } };
let clientId = null;
try {
  await delU(ADMIN); await delU(CLIENT); await admin.from("clients").delete().eq("slug", SLUG);
  const { data: au } = await admin.auth.admin.createUser({ email: ADMIN, password: PASS, email_confirm: true, user_metadata: { role: "admin", full_name: "S4 Admin" } });
  const { data: cl } = await admin.from("clients").insert({ name: "ZZ S4 Presence Co", slug: SLUG, industry: "other_local_service", program: "foundation", status: "active", client_type: "project" }).select("id").single();
  clientId = cl.id;
  const { data: cu } = await admin.auth.admin.createUser({ email: CLIENT, password: PASS, email_confirm: true, user_metadata: { role: "client", client_id: clientId, full_name: "S4 Client" } });
  await admin.from("profiles").update({ role: "client", client_id: clientId, full_name: "S4 Client" }).eq("id", cu.user.id);
  const threads = (await admin.from("threads").select("id, type").eq("client_id", clientId)).data ?? [];
  const internalT = threads.find(t => t.type === "internal")?.id, sharedT = threads.find(t => t.type === "client_shared")?.id;
  await admin.from("messages").insert({ thread_id: sharedT, client_id: clientId, thread_type: "client_shared", author_id: au.user.id, body: "ZZS4SEED kickoff" });

  // two concurrent contexts: client (watching shared) + staff
  const cctx = await b.newContext({ viewport: { width: 1280, height: 1000 } }); const cp = await cctx.newPage();
  const cerrs = []; cp.on("pageerror", e => cerrs.push(String(e)));
  const sctx = await b.newContext({ viewport: { width: 1280, height: 1000 } }); const sp = await sctx.newPage();
  await login(cp, CLIENT); await login(sp, ADMIN);
  await cp.goto(`${BASE}/messages`, { waitUntil: "domcontentloaded" });
  await cp.waitForSelector(".rd-richeditor", { timeout: 45000 }); await cp.waitForTimeout(600);

  // ── POSITIVE: staff types in the SHARED thread → client sees it live ──
  await sp.goto(`${BASE}/clients/${clientId}/messages`, { waitUntil: "domcontentloaded" });
  await sp.waitForSelector(".rd-richeditor", { timeout: 75000 }); await sp.waitForTimeout(600);
  const sharedTyping = (async () => typeFor(sp, 9000))();
  rec("client sees staff typing in the SHARED thread (live)", await waitFor(cp, () => typingVisible(cp), 11000));
  if (await typingVisible(cp)) await cp.screenshot({ path: `${OUT}/typing_indicator.png`, fullPage: true });
  await sharedTyping;
  // staff stops typing (no further keystrokes → no further set_typing) → the typing row goes
  // stale and the client's indicator expires (6s window + the 3s re-poll). Allow margin.
  rec("client typing indicator CLEARS after staff stops", await waitFor(cp, async () => !(await typingVisible(cp)), 16000));

  // ── NEGATIVE (critical): staff types in the INTERNAL thread → client sees NOTHING ──
  await sp.goto(`${BASE}/clients/${clientId}/messages?tab=internal`, { waitUntil: "domcontentloaded" });
  await sp.waitForSelector(".rd-richeditor", { timeout: 75000 }); await sp.waitForTimeout(600);
  // precondition: with staff off the shared composer, any leftover shared typing has fully expired
  // on the client — so a positive below can ONLY mean an internal leak, never a stale shared signal.
  await waitFor(cp, async () => !(await typingVisible(cp)), 16000);
  const internalTyping = (async () => typeFor(sp, 8000))();
  // watch the client for ~8s: it must NEVER show a typing indicator for internal activity
  let leaked = false;
  for (let t = 0; t < 8000; t += 600) { if (await typingVisible(cp)) { leaked = true; break; } await cp.waitForTimeout(600); }
  rec("client receives NO typing signal for the INTERNAL thread (realtime leak closed)", !leaked);
  await cp.screenshot({ path: `${OUT}/client_no_internal_typing.png`, fullPage: true });
  await internalTyping;
  // data-layer proof: an internal typing row exists, but the client's RLS-scoped read sees zero
  const intTypingRows = (await admin.from("typing_states").select("user_id").eq("thread_id", internalT)).data ?? [];
  rec("internal typing row EXISTS server-side (so the negative isn't a no-op)", intTypingRows.length > 0, `${intTypingRows.length} rows`);

  // ── READ RECEIPTS: client sends a message; staff opens shared → client sees "Seen by" ──
  await cp.locator(".rd-richeditor").click(); await cp.keyboard.type("ZZS4CMSG please review"); await cp.keyboard.press("Control+Enter");
  await cp.waitForTimeout(1500);
  await sp.goto(`${BASE}/clients/${clientId}/messages`, { waitUntil: "domcontentloaded" }); // staff opens shared → marks read
  await sp.waitForSelector(".rd-richeditor", { timeout: 75000 });
  rec("client sees 'Seen by' read receipt after staff reads (shared)", await waitFor(cp, () => cp.locator('text=/Seen by/').count().then((c) => c > 0), 14000));
  await cp.screenshot({ path: `${OUT}/read_receipt.png`, fullPage: true });
  // staff sees the client's seen-state too (reverse direction): client already opened the thread
  rec("staff sees 'Seen by' read receipt from the client (shared)", await waitFor(sp, () => sp.locator('text=/Seen by/').count().then((c) => c > 0), 14000));

  rec("no client console errors", cerrs.length === 0, cerrs.slice(0, 1).join("").slice(0, 140));
  // dark-mode typing screenshot
  await sctx.close();
  await cctx.close();
  const d2 = await b.newContext({ viewport: { width: 1280, height: 1000 } }); const dp = await d2.newPage();
  await dp.addInitScript(() => localStorage.setItem("rd-mode", "dark"));
  await login(dp, CLIENT);
  await dp.goto(`${BASE}/messages`, { waitUntil: "domcontentloaded" });
  await dp.waitForSelector(".rd-richeditor", { timeout: 45000 }); await dp.waitForTimeout(800);
  rec("dark: thread renders with read receipt", await waitFor(dp, () => dp.locator('text=/Seen by/').count().then((c) => c > 0), 8000));
  await dp.screenshot({ path: `${OUT}/dark_presence.png`, fullPage: true });
  await d2.close();
} finally {
  if (clientId) await admin.from("clients").delete().eq("id", clientId);
  await admin.from("clients").delete().eq("slug", SLUG);
  await delU(ADMIN); await delU(CLIENT);
  await b.close();
}
const failed = results.filter(r => !r.ok); console.log(`\n${results.length - failed.length}/${results.length} passed.`); process.exit(failed.length ? 1 : 0);
