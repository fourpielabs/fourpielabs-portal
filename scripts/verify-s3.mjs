// Track 5 S3 E2E — emoji reactions. Proves BOTH boundary leaks closed: a client can react to
// their own thread (chip renders, count, mine-highlighted, toggles, works on a reply, live) but
// can NEVER react to OR see/count a reaction on an INTERNAL message (a distinctive 🦄 internal
// reaction is seeded — it must never appear in the client UI; the internal message stays hidden).
// Staff react in both threads. Provisions its own temp project client + users; self-cleans.
import { config } from "dotenv"; config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";
const BASE = "http://localhost:3000", PASS = "FourPie!Demo2026", ADMIN = "zz-s3-admin@example.com", CLIENT = "zz-s3-client@example.com", SLUG = "zz-s3-reactions";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OUT = "docs/features/messages/s3"; mkdirSync(OUT, { recursive: true });
const results = []; const rec = (n, ok, d = "") => { results.push({ n, ok }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };
const delU = async (e) => { const { data } = await admin.auth.admin.listUsers({ perPage: 1000 }); const u = data?.users.find(x => x.email === e); if (u) await admin.auth.admin.deleteUser(u.id); };
const b = await chromium.launch({ channel: "chrome", headless: true });
const bubbleOf = (page, text) => page.locator("div.rd-bubble").filter({ hasText: text }).last();
// poll a predicate (cold server actions can take a few seconds on first call)
const waitFor = async (page, fn, ms = 12000, step = 400) => { for (let t = 0; t < ms; t += step) { if (await fn()) return true; await page.waitForTimeout(step); } return false; };
// poll the DB until a reaction RPC has COMMITTED, before navigating/closing (a cold ~2s RPC
// would otherwise be aborted by an early navigation, leaving the optimistic chip un-persisted).
const dbWait = async (fn, ms = 12000, step = 400) => { for (let t = 0; t < ms; t += step) { if (await fn()) return true; await new Promise((r) => setTimeout(r, step)); } return false; };
const reactionExists = (messageId, userId, emoji) => dbWait(async () => !!(await admin.from("message_reactions").select("id").eq("message_id", messageId).eq("user_id", userId).eq("emoji", emoji).maybeSingle()).data);
const reactionGone = (messageId, userId, emoji) => dbWait(async () => !(await admin.from("message_reactions").select("id").eq("message_id", messageId).eq("user_id", userId).eq("emoji", emoji).maybeSingle()).data);
const login = async (page, email) => {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("input[type=email]", email); await page.fill("input[type=password]", PASS);
  await page.click('button:has-text("Sign in")'); await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
};
let clientId = null;
try {
  await delU(ADMIN); await delU(CLIENT);
  await admin.from("clients").delete().eq("slug", SLUG);
  const { data: au } = await admin.auth.admin.createUser({ email: ADMIN, password: PASS, email_confirm: true, user_metadata: { role: "admin", full_name: "S3 Admin" } });
  const { data: cl } = await admin.from("clients").insert({ name: "ZZ S3 Reactions Co", slug: SLUG, industry: "other_local_service", program: "foundation", status: "active", client_type: "project" }).select("id").single();
  clientId = cl.id;
  const { data: cu } = await admin.auth.admin.createUser({ email: CLIENT, password: PASS, email_confirm: true, user_metadata: { role: "client", client_id: clientId, full_name: "S3 Client" } });
  await admin.from("profiles").update({ role: "client", client_id: clientId, full_name: "S3 Client" }).eq("id", cu.user.id);
  const threads = (await admin.from("threads").select("id, type").eq("client_id", clientId)).data ?? [];
  const sharedT = threads.find(t => t.type === "client_shared")?.id, internalT = threads.find(t => t.type === "internal")?.id;
  // shared parent + a shared reply (both by admin → repliable/reactable by the client); an internal
  // message + a DISTINCTIVE 🦄 internal reaction the client must never see.
  const parent = (await admin.from("messages").insert({ thread_id: sharedT, client_id: clientId, thread_type: "client_shared", author_id: au.user.id, body: "ZZS3PARENT review the draft" }).select("id").single()).data;
  await admin.from("messages").insert({ thread_id: sharedT, client_id: clientId, thread_type: "client_shared", author_id: au.user.id, body: "ZZS3SREPLY here is v2", parent_message_id: parent.id });
  const intMsg = (await admin.from("messages").insert({ thread_id: internalT, client_id: clientId, thread_type: "internal", author_id: au.user.id, body: "ZZS3INTERNAL secret note" }).select("id").single()).data;
  await admin.from("message_reactions").insert({ message_id: intMsg.id, thread_id: internalT, client_id: clientId, thread_type: "internal", user_id: au.user.id, emoji: "🦄" });

  // ───────────── CLIENT reacts in their own thread ─────────────
  const cctx = await b.newContext({ viewport: { width: 1280, height: 1000 } }); const cp = await cctx.newPage();
  const cerrs = []; cp.on("pageerror", e => cerrs.push(String(e)));
  await login(cp, CLIENT);
  await cp.goto(`${BASE}/messages`, { waitUntil: "domcontentloaded" });
  await cp.waitForSelector(".rd-richeditor", { timeout: 20000 }); await cp.waitForTimeout(800);
  rec("INTERNAL message NOT visible to client (boundary)", await cp.locator("text=ZZS3INTERNAL").count() === 0);
  rec("INTERNAL reaction 🦄 NOT visible to client (existence boundary)", await cp.locator("text=🦄").count() === 0);
  // hover reveals the quick-react bar
  const pbubble = bubbleOf(cp, "ZZS3PARENT");
  await pbubble.hover(); await cp.waitForTimeout(250);
  await cp.screenshot({ path: `${OUT}/hover_react.png`, fullPage: true });
  rec("hover reveals quick-react 👍", await pbubble.getByLabel("React 👍").isVisible());
  await pbubble.getByLabel("React 👍").click();
  const chipShown = await waitFor(cp, async () => await pbubble.locator('button[aria-pressed="true"]:has-text("👍")').count() > 0);
  rec("reaction chip renders with count + mine-highlighted (aria-pressed)", chipShown);
  await cp.screenshot({ path: `${OUT}/reaction_chips.png`, fullPage: true });
  // DB: the client's reaction landed on the parent, inheriting client_shared visibility
  let rx = null;
  for (let i = 0; i < 14; i++) { await cp.waitForTimeout(400); rx = (await admin.from("message_reactions").select("emoji, thread_type, client_id").eq("message_id", parent.id).eq("user_id", cu.user.id).maybeSingle()).data; if (rx) break; }
  rec("reaction stored + inherits message visibility (client_shared)", rx?.emoji === "👍" && rx?.thread_type === "client_shared" && rx?.client_id === clientId);
  // react to the REPLY (reactions work on threaded replies)
  const rbubble = bubbleOf(cp, "ZZS3SREPLY");
  await rbubble.hover(); await cp.waitForTimeout(200);
  await rbubble.getByLabel("React ✅").click();
  rec("reaction works on a threaded reply", await waitFor(cp, async () => await rbubble.locator('button[aria-pressed="true"]:has-text("✅")').count() > 0));
  await cp.screenshot({ path: `${OUT}/reply_reaction.png`, fullPage: true });
  // toggle the 👍 back off → chip disappears (+ confirm the delete COMMITTED before moving on)
  await pbubble.locator('button[aria-pressed="true"]:has-text("👍")').click();
  rec("toggling own reaction off removes the chip", await waitFor(cp, async () => await pbubble.locator('button[aria-pressed="true"]:has-text("👍")').count() === 0));
  await reactionGone(parent.id, cu.user.id, "👍");
  // emoji picker (the "+" popover)
  await pbubble.hover(); await cp.waitForTimeout(150);
  await pbubble.getByLabel("Add reaction").click(); await cp.waitForTimeout(300);
  rec("emoji picker opens", await cp.getByLabel("React 🎉").count() > 0);
  await cp.screenshot({ path: `${OUT}/emoji_picker.png`, fullPage: true });
  await cp.keyboard.press("Escape");
  rec("no client console errors", cerrs.length === 0, cerrs.slice(0, 1).join("").slice(0, 140));
  await cctx.close();

  // ───────────── STAFF reacts in BOTH threads ─────────────
  const sctx = await b.newContext({ viewport: { width: 1280, height: 1000 } }); const sp = await sctx.newPage();
  await login(sp, ADMIN);
  await sp.goto(`${BASE}/clients/${clientId}/messages`, { waitUntil: "domcontentloaded" });
  await sp.waitForSelector(".rd-richeditor", { timeout: 40000 }); await sp.waitForTimeout(800);
  const spb = bubbleOf(sp, "ZZS3PARENT"); await spb.hover(); await sp.waitForTimeout(200);
  await spb.getByLabel("Add reaction").click(); await sp.waitForTimeout(300); // 🎉 lives in the picker
  await sp.getByLabel("React 🎉").click();
  rec("staff reacts in CLIENT thread (via picker)", await waitFor(sp, async () => await spb.locator('button[aria-pressed="true"]:has-text("🎉")').count() > 0));
  rec("staff 🎉 persisted (committed before nav)", await reactionExists(parent.id, au.user.id, "🎉"));
  await sp.goto(`${BASE}/clients/${clientId}/messages?tab=internal`, { waitUntil: "domcontentloaded" });
  await sp.waitForSelector(".rd-richeditor", { timeout: 40000 }); await sp.waitForTimeout(800);
  rec("staff sees the internal 🦄 reaction (assigned)", await waitFor(sp, async () => await sp.locator("text=🦄").count() > 0));
  const sib = bubbleOf(sp, "ZZS3INTERNAL"); await sib.hover(); await sp.waitForTimeout(200);
  await sib.getByLabel("React 👍").click();
  rec("staff reacts in INTERNAL thread", await waitFor(sp, async () => await sib.locator('button[aria-pressed="true"]:has-text("👍")').count() > 0));
  await reactionExists(intMsg.id, au.user.id, "👍");
  await sp.screenshot({ path: `${OUT}/staff_internal_reaction.png`, fullPage: true });
  await sctx.close();

  // ───────────── CLIENT re-checks: staff's shared reaction visible, internal still hidden ─────────────
  const c2 = await b.newContext({ viewport: { width: 1280, height: 1000 } }); const cp2 = await c2.newPage();
  await login(cp2, CLIENT);
  await cp2.goto(`${BASE}/messages`, { waitUntil: "domcontentloaded" });
  await cp2.waitForSelector(".rd-richeditor", { timeout: 20000 }); await cp2.waitForTimeout(1000);
  rec("client sees staff's 🎉 on the shared message", await waitFor(cp2, async () => await bubbleOf(cp2, "ZZS3PARENT").locator('button:has-text("🎉")').count() > 0));
  rec("client STILL cannot see internal 🦄 reaction (existence boundary)", await cp2.locator("text=🦄").count() === 0);
  rec("client STILL cannot see internal message", await cp2.locator("text=ZZS3INTERNAL").count() === 0);
  // dark + mobile
  await cp2.setViewportSize({ width: 390, height: 850 }); await cp2.waitForTimeout(400);
  await cp2.screenshot({ path: `${OUT}/mobile_reactions.png`, fullPage: true });
  await c2.close();
  const d2 = await b.newContext({ viewport: { width: 1280, height: 1000 } }); const dp = await d2.newPage();
  await dp.addInitScript(() => localStorage.setItem("rd-mode", "dark"));
  await login(dp, CLIENT);
  await dp.goto(`${BASE}/messages`, { waitUntil: "domcontentloaded" });
  await dp.waitForSelector(".rd-richeditor", { timeout: 20000 }); await dp.waitForTimeout(900);
  rec("dark: reaction chip renders", await waitFor(dp, async () => await bubbleOf(dp, "ZZS3PARENT").locator('button:has-text("🎉")').count() > 0));
  await dp.screenshot({ path: `${OUT}/dark_reactions.png`, fullPage: true });
  await d2.close();
} finally {
  if (clientId) await admin.from("clients").delete().eq("id", clientId);
  await admin.from("clients").delete().eq("slug", SLUG);
  await delU(ADMIN); await delU(CLIENT);
  await b.close();
}
const failed = results.filter(r => !r.ok); console.log(`\n${results.length - failed.length}/${results.length} passed.`); process.exit(failed.length ? 1 : 0);
