// Track 5 S2 E2E — threaded replies. Proves: a client replies within their OWN thread
// (renders threaded + live + DB inheritance), staff reply in BOTH threads, an internal reply
// STAYS internal (the client never sees it — the boundary on the new reply path), existing
// top-level messages render as before, and the reply composer chip. Provisions its OWN temp
// project client (pristine threads) + temp users, then self-cleans everything.
import { config } from "dotenv"; config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";
const BASE = "http://localhost:3000", PASS = "FourPie!Demo2026", ADMIN = "zz-s2-admin@example.com", CLIENT = "zz-s2-client@example.com", SLUG = "zz-s2-threads";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OUT = "docs/features/messages/s2"; mkdirSync(OUT, { recursive: true });
const results = []; const rec = (n, ok, d = "") => { results.push({ n, ok }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };
const delU = async (e) => { const { data } = await admin.auth.admin.listUsers({ perPage: 1000 }); const u = data?.users.find(x => x.email === e); if (u) await admin.auth.admin.deleteUser(u.id); };
const b = await chromium.launch({ channel: "chrome", headless: true });
// click the Reply affordance on the bubble that contains a given text (the bubble is the div
// whose DIRECT child is the .rd-msg body) — robust against other messages in the thread.
const replyTo = async (page, text) => {
  const bubble = page.locator('div:has(> .rd-msg)').filter({ hasText: text }).last();
  await bubble.getByLabel("Reply to message").click();
};
let clientId = null;
const login = async (page, email) => {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("input[type=email]", email); await page.fill("input[type=password]", PASS);
  await page.click('button:has-text("Sign in")'); await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
};
try {
  await delU(ADMIN); await delU(CLIENT);
  await admin.from("clients").delete().eq("slug", SLUG); // clean any prior run
  const { data: au } = await admin.auth.admin.createUser({ email: ADMIN, password: PASS, email_confirm: true, user_metadata: { role: "admin", full_name: "S2 Admin" } });
  const { data: cl } = await admin.from("clients").insert({ name: "ZZ S2 Threads Co", slug: SLUG, industry: "other_local_service", program: "foundation", status: "active", client_type: "project" }).select("id").single();
  clientId = cl.id; // creating the client auto-seeds its two threads (trg_seed_client_threads)
  const { data: cu } = await admin.auth.admin.createUser({ email: CLIENT, password: PASS, email_confirm: true, user_metadata: { role: "client", client_id: clientId, full_name: "S2 Client" } });
  await admin.from("profiles").update({ role: "client", client_id: clientId, full_name: "S2 Client" }).eq("id", cu.user.id);
  const threads = (await admin.from("threads").select("id, type").eq("client_id", clientId)).data ?? [];
  const sharedT = threads.find(t => t.type === "client_shared")?.id, internalT = threads.find(t => t.type === "internal")?.id;
  // a top-level shared message (by admin → "other" for the client, repliable); an INTERNAL
  // message + an INTERNAL reply the client must NEVER see.
  const parent = (await admin.from("messages").insert({ thread_id: sharedT, client_id: clientId, thread_type: "client_shared", author_id: au.user.id, body: "ZZS2PARENT discuss the logo" }).select("id").single()).data;
  const intMsg = (await admin.from("messages").insert({ thread_id: internalT, client_id: clientId, thread_type: "internal", author_id: au.user.id, body: "ZZS2INTERNAL secret topic" }).select("id").single()).data;
  await admin.from("messages").insert({ thread_id: internalT, client_id: clientId, thread_type: "internal", author_id: au.user.id, body: "ZZS2INTREPLY secret reply", parent_message_id: intMsg.id });

  // ───────────── CLIENT replies within their own thread ─────────────
  const cctx = await b.newContext({ viewport: { width: 1280, height: 1000 } }); const cp = await cctx.newPage();
  const cerrs = []; cp.on("pageerror", e => cerrs.push(String(e)));
  await login(cp, CLIENT);
  await cp.goto(`${BASE}/messages`, { waitUntil: "domcontentloaded" });
  await cp.waitForSelector(".rd-richeditor", { timeout: 20000 }); await cp.waitForTimeout(800);
  rec("existing top-level message renders (no parent)", await cp.locator('.rd-msg:has-text("ZZS2PARENT")').count() > 0);
  rec("INTERNAL message NOT visible to client (boundary)", await cp.locator("text=ZZS2INTERNAL").count() === 0);
  rec("INTERNAL reply NOT visible to client (boundary)", await cp.locator("text=ZZS2INTREPLY").count() === 0);
  await replyTo(cp, "ZZS2PARENT");
  await cp.waitForTimeout(300);
  rec("reply composer chip shows 'Replying to'", await cp.locator('text=/Replying to/').count() > 0);
  await cp.screenshot({ path: `${OUT}/reply_composer.png`, fullPage: true });
  await cp.locator(".rd-richeditor").click();
  await cp.keyboard.type("ZZS2REPLY sounds great");
  await cp.keyboard.press("Control+Enter");
  await cp.waitForTimeout(1800);
  rec("LIVE: reply renders threaded under parent (no reload)", await cp.locator('text=/1 reply/').count() > 0 && await cp.locator('.rd-msg:has-text("ZZS2REPLY")').count() > 0);
  await cp.screenshot({ path: `${OUT}/client_thread_with_replies.png`, fullPage: true });
  // DB inheritance: the client's reply inherits the parent's thread + carries parent_message_id
  let reply = null;
  for (let i = 0; i < 16; i++) { await cp.waitForTimeout(400); reply = (await admin.from("messages").select("thread_type, parent_message_id, client_id").eq("client_id", clientId).eq("body", "ZZS2REPLY sounds great").maybeSingle()).data; if (reply) break; }
  rec("reply INHERITS parent thread (client_shared + parent_message_id)", reply?.thread_type === "client_shared" && reply?.parent_message_id === parent.id && reply?.client_id === clientId, `parent=${reply?.parent_message_id === parent.id}`);
  rec("no client console errors", cerrs.length === 0, cerrs.slice(0, 1).join("").slice(0, 140));
  await cctx.close();

  // ───────────── STAFF replies in BOTH threads ─────────────
  const sctx = await b.newContext({ viewport: { width: 1280, height: 1000 } }); const sp = await sctx.newPage();
  await login(sp, ADMIN);
  await sp.goto(`${BASE}/clients/${clientId}/messages`, { waitUntil: "domcontentloaded" });
  await sp.waitForSelector(".rd-richeditor", { timeout: 20000 }); await sp.waitForTimeout(800);
  await replyTo(sp, "ZZS2PARENT"); await sp.waitForTimeout(300);
  await sp.locator(".rd-richeditor").click(); await sp.keyboard.type("ZZS2STAFFREPLY on it");
  await sp.keyboard.press("Control+Enter"); await sp.waitForTimeout(1800);
  rec("staff reply renders threaded in CLIENT thread", await sp.locator('.rd-msg:has-text("ZZS2STAFFREPLY")').count() > 0);
  await sp.goto(`${BASE}/clients/${clientId}/messages?tab=internal`, { waitUntil: "domcontentloaded" });
  await sp.waitForSelector(".rd-richeditor", { timeout: 20000 }); await sp.waitForTimeout(800);
  await replyTo(sp, "ZZS2INTERNAL"); await sp.waitForTimeout(300);
  await sp.locator(".rd-richeditor").click(); await sp.keyboard.type("ZZS2STAFFINTREPLY staff only");
  await sp.keyboard.press("Control+Enter"); await sp.waitForTimeout(1800);
  rec("staff reply renders threaded in INTERNAL thread", await sp.locator('.rd-msg:has-text("ZZS2STAFFINTREPLY")').count() > 0);
  await sp.screenshot({ path: `${OUT}/staff_internal_reply.png`, fullPage: true });
  const sIntReply = (await admin.from("messages").select("thread_type, parent_message_id").eq("client_id", clientId).eq("body", "ZZS2STAFFINTREPLY staff only").maybeSingle()).data;
  rec("staff internal reply STAYS internal (inherits parent)", sIntReply?.thread_type === "internal" && sIntReply?.parent_message_id === intMsg.id);
  await sctx.close();

  // ───────────── CLIENT re-checks: still no internal content (boundary) ─────────────
  const c2 = await b.newContext({ viewport: { width: 1280, height: 1000 } }); const cp2 = await c2.newPage();
  await login(cp2, CLIENT);
  await cp2.goto(`${BASE}/messages`, { waitUntil: "domcontentloaded" });
  await cp2.waitForSelector(".rd-richeditor", { timeout: 20000 }); await cp2.waitForTimeout(1000);
  rec("client sees the STAFF reply in their thread", await cp2.locator('.rd-msg:has-text("ZZS2STAFFREPLY")').count() > 0);
  rec("client STILL cannot see internal reply (ZZS2STAFFINTREPLY)", await cp2.locator("text=ZZS2STAFFINTREPLY").count() === 0);
  rec("client STILL cannot see internal message/reply (ZZS2INTERNAL/ZZS2INTREPLY)", await cp2.locator("text=ZZS2INTERNAL").count() === 0 && await cp2.locator("text=ZZS2INTREPLY").count() === 0);
  await cp2.setViewportSize({ width: 390, height: 850 }); await cp2.waitForTimeout(400);
  await cp2.screenshot({ path: `${OUT}/mobile_threaded.png`, fullPage: true });
  await c2.close();

  // dark-mode threaded view (light/dark requirement)
  const d2 = await b.newContext({ viewport: { width: 1280, height: 1000 } }); const dp = await d2.newPage();
  await dp.addInitScript(() => localStorage.setItem("rd-mode", "dark"));
  await login(dp, CLIENT);
  await dp.goto(`${BASE}/messages`, { waitUntil: "domcontentloaded" });
  await dp.waitForSelector(".rd-richeditor", { timeout: 20000 }); await dp.waitForTimeout(900);
  rec("dark: threaded reply renders", await dp.locator('text=/repl(y|ies)/').count() > 0 && await dp.locator('.rd-msg:has-text("ZZS2REPLY")').count() > 0);
  await dp.screenshot({ path: `${OUT}/dark_threaded.png`, fullPage: true });
  await d2.close();
} finally {
  if (clientId) await admin.from("clients").delete().eq("id", clientId); // cascades threads + messages
  await admin.from("clients").delete().eq("slug", SLUG);
  await delU(ADMIN); await delU(CLIENT);
  await b.close();
}
const failed = results.filter(r => !r.ok); console.log(`\n${results.length - failed.length}/${results.length} passed.`); process.exit(failed.length ? 1 : 0);
