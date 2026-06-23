// Track 5 S1 E2E — TipTap WYSIWYG, instant bold + active-state, @mention, send rich,
// OLD markdown renders, task-from-chat bubble, and the INTERNAL boundary (client can't see
// internal). Self-cleans temp users + seeded rows.
import { config } from "dotenv"; config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";
const BASE = "http://localhost:3000", PASS = "FourPie!Demo2026", ADMIN = "zz-s1-admin@example.com", CLIENT = "zz-s1-client@example.com";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OUT = "docs/features/messages/s1"; mkdirSync(OUT, { recursive: true });
const results = []; const rec = (n, ok, d = "") => { results.push({ n, ok }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };
const delU = async (e) => { const { data } = await admin.auth.admin.listUsers({ perPage: 1000 }); const u = data?.users.find(x => x.email === e); if (u) await admin.auth.admin.deleteUser(u.id); };
const b = await chromium.launch({ channel: "chrome", headless: true });
let clientId = null, seeded = [];
try {
  await delU(ADMIN); await delU(CLIENT);
  const { data: au } = await admin.auth.admin.createUser({ email: ADMIN, password: PASS, email_confirm: true, user_metadata: { role: "admin", full_name: "S1 Admin" } });
  const { data: c } = await admin.from("clients").select("id").eq("client_type", "project").limit(1).single(); clientId = c.id;
  const { data: cu } = await admin.auth.admin.createUser({ email: CLIENT, password: PASS, email_confirm: true, user_metadata: { role: "client", client_id: clientId, full_name: "S1 Client" } });
  await admin.from("profiles").update({ role: "client", client_id: clientId, full_name: "S1 Client" }).eq("id", cu.user.id);
  const threads = (await admin.from("threads").select("id, type").eq("client_id", clientId)).data ?? [];
  const sharedT = threads.find(t => t.type === "client_shared")?.id, internalT = threads.find(t => t.type === "internal")?.id;
  // OLD markdown message (body_rich null) on shared; an INTERNAL message the client must never see
  seeded.push((await admin.from("messages").insert({ thread_id: sharedT, client_id: clientId, thread_type: "client_shared", author_id: au.user.id, body: "**old bold** legacy markdown" }).select("id").single()).data.id);
  seeded.push((await admin.from("messages").insert({ thread_id: internalT, client_id: clientId, thread_type: "internal", author_id: au.user.id, body: "ZZINTERNALSECRET staff only" }).select("id").single()).data.id);

  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } }); const page = await ctx.newPage();
  const errs = []; page.on("pageerror", e => errs.push(String(e)));
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("input[type=email]", CLIENT); await page.fill("input[type=password]", PASS);
  await page.click('button:has-text("Sign in")'); await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
  await page.goto(`${BASE}/messages`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".rd-richeditor", { timeout: 20000 }); await page.waitForTimeout(800);

  rec("TipTap editor renders (contenteditable)", await page.locator(".rd-richeditor").count() > 0);
  rec("OLD markdown message renders bold (<strong>)", await page.locator('.rd-msg strong:has-text("old bold")').count() > 0);
  rec("INTERNAL message NOT visible to client (boundary)", await page.locator('text=ZZINTERNALSECRET').count() === 0);
  await page.screenshot({ path: `${OUT}/editor_and_old_message.png`, fullPage: true });

  // instant Bold + active-state (the React reactivity gotcha)
  await page.locator(".rd-richeditor").click();
  await page.locator('button[aria-label="Bold"]').click();
  rec("Bold toolbar active-state lights up (aria-pressed)", (await page.locator('button[aria-label="Bold"]').getAttribute("aria-pressed")) === "true");
  await page.keyboard.type("richsent");
  rec("typing under Bold produces <strong> in editor (instant WYSIWYG)", await page.locator('.rd-richeditor strong:has-text("richsent")').count() > 0);
  await page.screenshot({ path: `${OUT}/wysiwyg_bold.png` });
  // send via ⌘↵ → posts; the feed shows it rich (bold)
  await page.keyboard.press("Control+Enter");
  await page.waitForTimeout(1800);
  rec("sent rich message renders bold in feed", await page.locator('.rd-msg strong:has-text("richsent")').count() > 0);
  const richRow = await admin.from("messages").select("body, body_rich").eq("client_id", clientId).eq("body", "richsent").maybeSingle();
  rec("sent message stored body=plaintext + body_rich=HTML", richRow.data?.body === "richsent" && !!richRow.data?.body_rich && richRow.data.body_rich.includes("<strong>"));
  if (richRow.data) seeded.push((await admin.from("messages").select("id").eq("client_id", clientId).eq("body", "richsent").maybeSingle()).data?.id);

  // @mention dropdown
  await page.locator(".rd-richeditor").click();
  await page.keyboard.type("@");
  await page.waitForTimeout(600);
  rec("@ opens the mention dropdown", await page.locator('[role="listbox"][aria-label="Mention a person"]').count() > 0);
  await page.screenshot({ path: `${OUT}/mention.png` });
  await page.keyboard.press("Escape"); await page.keyboard.press("Backspace");

  // task-from-chat → bubble
  await page.locator(".rd-richeditor").click();
  await page.keyboard.type("ZZTASKDRAFT ship the homepage");
  await page.locator('button[aria-label="Create a task"]').click();
  let tlist = null;
  for (let i = 0; i < 18; i++) { await page.waitForTimeout(500); tlist = (await admin.from("tasks").select("id, source_message_id, visible_to_client").eq("client_id", clientId).ilike("title", "%ZZTASKDRAFT%")).data; if ((tlist?.length ?? 0) >= 1) break; }
  const task = tlist?.[0];
  rec("task created + linked to a message (source_message_id) + client-visible", !!task?.source_message_id && task.visible_to_client === true);
  rec("exactly ONE task created (no double-create)", (tlist?.length ?? 0) === 1, `${tlist?.length ?? 0} tasks`);
  // LIVE path (no reload): once the action returns, the editor clears AND the bubble appears from
  // its return value. Poll (the DB row is created mid-action, so it lands before the action returns).
  let liveCleared = false, liveCard = 0;
  for (let i = 0; i < 20; i++) {
    liveCleared = (await page.locator(".rd-richeditor").innerText()).trim() === "";
    liveCard = await page.locator('a[href*="/tasks"]:has-text("ZZTASKDRAFT")').count();
    if (liveCleared && liveCard > 0) break;
    await page.waitForTimeout(500);
  }
  rec("LIVE: editor cleared after task create (no reload)", liveCleared);
  rec("LIVE: task CARD appears without reload", liveCard > 0);
  // canonical render: reload → the source message carries linkedTask → the card renders
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".rd-richeditor", { timeout: 20000 }); await page.waitForTimeout(1200);
  rec("task-from-chat renders a task CARD (anchor to /tasks) in the feed", await page.locator('a[href*="/tasks"]:has-text("ZZTASKDRAFT")').count() > 0);
  await page.screenshot({ path: `${OUT}/task_bubble.png`, fullPage: true });
  for (const x of tlist ?? []) { if (x.source_message_id) seeded.push(x.source_message_id); await admin.from("tasks").delete().eq("id", x.id); }
  await ctx.close();

  // ── INTERNAL BOUNDARY re-proof for the NEW task-bubble surface ──
  // A staff member creates a task FROM AN INTERNAL chat message. The new bridge must force
  // visible_to_client=false (derived from the RPC-stamped thread_type, not caller input), so the
  // client can never see it. Prove it at the data layer AND in the client's /tasks UI.
  const sctx = await b.newContext({ viewport: { width: 1280, height: 1000 } }); const sp = await sctx.newPage();
  await sp.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await sp.fill("input[type=email]", ADMIN); await sp.fill("input[type=password]", PASS);
  await sp.click('button:has-text("Sign in")'); await sp.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
  await sp.goto(`${BASE}/clients/${clientId}/messages?tab=internal`, { waitUntil: "domcontentloaded" });
  await sp.waitForSelector(".rd-richeditor", { timeout: 20000 }); await sp.waitForTimeout(800);
  await sp.locator(".rd-richeditor").click();
  await sp.keyboard.type("ZZINTERNALTASK staff-only secret");
  await sp.locator('button[aria-label="Create a task"]').click();
  let itask = null;
  for (let i = 0; i < 20; i++) { await sp.waitForTimeout(500); const r = (await admin.from("tasks").select("id, source_message_id, visible_to_client").eq("client_id", clientId).ilike("title", "%ZZINTERNALTASK%")).data; if ((r?.length ?? 0) >= 1) { itask = r[0]; break; } }
  rec("staff task from INTERNAL message exists + is NOT client-visible (boundary)", !!itask && itask.visible_to_client === false);
  // its source message must be on the internal thread
  const srcMsg = itask?.source_message_id ? (await admin.from("messages").select("thread_type").eq("id", itask.source_message_id).maybeSingle()).data : null;
  rec("internal task's source message is on the INTERNAL thread", srcMsg?.thread_type === "internal");
  await sctx.close();

  // a CLIENT must NOT see that internal task anywhere in their /tasks UI
  const cctx = await b.newContext({ viewport: { width: 1280, height: 1000 } }); const cp = await cctx.newPage();
  await cp.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await cp.fill("input[type=email]", CLIENT); await cp.fill("input[type=password]", PASS);
  await cp.click('button:has-text("Sign in")'); await cp.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
  await cp.goto(`${BASE}/tasks`, { waitUntil: "domcontentloaded" }); await cp.waitForTimeout(1500);
  rec("CLIENT cannot see the internal-sourced task in /tasks (boundary)", await cp.locator('text=ZZINTERNALTASK').count() === 0);
  await cctx.close();
  // clean up the internal task + its source message
  if (itask) { if (itask.source_message_id) seeded.push(itask.source_message_id); await admin.from("tasks").delete().eq("id", itask.id); }

  rec("no console/page errors", errs.length === 0, errs.slice(0, 1).join("").slice(0, 140));
} finally {
  if (seeded.length) await admin.from("messages").delete().in("id", seeded.filter(Boolean));
  await delU(ADMIN); await delU(CLIENT);
  await b.close();
}
const failed = results.filter(r => !r.ok); console.log(`\n${results.length - failed.length}/${results.length} passed.`); process.exit(failed.length ? 1 : 0);
