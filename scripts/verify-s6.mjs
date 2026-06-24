// Track 5 S6 E2E — (edited) tags + re-rich-ify edits. Proves: editing a rich message PRESERVES
// its formatting + #-links (body_rich updated, not cleared — the S1 seam closed); "(edited)"
// shows on edited messages (top-level + reply) and NOT on unedited; an INTERNAL message's edited
// state never leaks to the client; an edited body_rich with XSS is inert. Temp client + users.
import { config } from "dotenv"; config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";
const BASE = "http://localhost:3000", PASS = "FourPie!Demo2026", ADMIN = "zz-s6-admin@example.com", CLIENT = "zz-s6-client@example.com", SLUG = "zz-s6-edits";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OUT = "docs/features/messages/s6"; mkdirSync(OUT, { recursive: true });
const results = []; const rec = (n, ok, d = "") => { results.push({ n, ok }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };
const delU = async (e) => { const { data } = await admin.auth.admin.listUsers({ perPage: 1000 }); const u = data?.users.find(x => x.email === e); if (u) await admin.auth.admin.deleteUser(u.id); };
const b = await chromium.launch({ channel: "chrome", headless: true });
const bubbleOf = (page, text) => page.locator("div.rd-bubble").filter({ hasText: text }).last();
const waitFor = async (page, fn, ms = 15000, step = 400) => { for (let t = 0; t < ms; t += step) { if (await fn()) return true; await page.waitForTimeout(step); } return false; };
const login = async (page, email) => {
  for (let a = 0; a < 3; a++) {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(400);
    await page.fill("input[type=email]", email); await page.fill("input[type=password]", PASS);
    await page.click('button:has-text("Sign in")');
    if (await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 }).then(() => true).catch(() => false)) return;
  }
};
let clientId = null;
try {
  await delU(ADMIN); await delU(CLIENT); await admin.from("clients").delete().eq("slug", SLUG);
  const { data: au } = await admin.auth.admin.createUser({ email: ADMIN, password: PASS, email_confirm: true, user_metadata: { role: "admin", full_name: "S6 Admin" } });
  const { data: cl } = await admin.from("clients").insert({ name: "ZZ S6 Edits Co", slug: SLUG, industry: "other_local_service", program: "foundation", status: "active", client_type: "project" }).select("id").single();
  clientId = cl.id;
  const { data: cu } = await admin.auth.admin.createUser({ email: CLIENT, password: PASS, email_confirm: true, user_metadata: { role: "client", client_id: clientId, full_name: "S6 Client" } });
  await admin.from("profiles").update({ role: "client", client_id: clientId, full_name: "S6 Client" }).eq("id", cu.user.id);
  const threads = (await admin.from("threads").select("id, type").eq("client_id", clientId)).data ?? [];
  const sharedT = threads.find(t => t.type === "client_shared")?.id, internalT = threads.find(t => t.type === "internal")?.id;
  const task = (await admin.from("tasks").insert({ client_id: clientId, title: "ZZS6TASK linked", visible_to_client: true }).select("id").single()).data.id;

  // a CLIENT-authored rich message with bold + a #-link (the client can edit their own); an
  // UNEDITED plain message; an INTERNAL edited message (client must never see it or its (edited)).
  const rich = `<p><strong>ZZS6BOLD</strong> see <span class="rd-entity" data-type="task" data-id="${task}">#ZZS6TASK linked</span></p>`;
  await admin.from("messages").insert({ thread_id: sharedT, client_id: clientId, thread_type: "client_shared", author_id: cu.user.id, body: "ZZS6BOLD see #task", body_rich: rich });
  await admin.from("messages").insert({ thread_id: sharedT, client_id: clientId, thread_type: "client_shared", author_id: au.user.id, body: "ZZS6PLAIN unedited" });
  await admin.from("messages").insert({ thread_id: internalT, client_id: clientId, thread_type: "internal", author_id: au.user.id, body: "ZZS6INTERNAL secret", edited_at: new Date().toISOString() });

  const cctx = await b.newContext({ viewport: { width: 1280, height: 1000 } }); const cp = await cctx.newPage();
  const cerrs = []; cp.on("pageerror", e => cerrs.push(String(e)));
  await login(cp, CLIENT);
  await cp.goto(`${BASE}/messages`, { waitUntil: "domcontentloaded" });
  await cp.waitForSelector(".rd-richeditor", { timeout: 30000 }); await cp.waitForTimeout(800);

  // baseline: rich renders; unedited has NO (edited); internal not visible
  rec("rich message renders bold + resolved #-link chip", await bubbleOf(cp, "ZZS6BOLD").locator("strong").count() > 0 && await bubbleOf(cp, "ZZS6BOLD").locator('.rd-entity:has-text("ZZS6TASK")').count() > 0);
  rec("unedited message shows NO (edited) tag", await bubbleOf(cp, "ZZS6PLAIN").locator('text=/\\(edited\\)/').count() === 0);
  rec("INTERNAL message NOT visible to client (boundary)", await cp.locator("text=ZZS6INTERNAL").count() === 0);
  rec("INTERNAL (edited) state never leaks to client", await cp.locator('text=/\\(edited\\)/').count() === 0);

  // EDIT the rich message via the TipTap edit composer (pre-filled with bold + #-link)
  const bubble = bubbleOf(cp, "ZZS6BOLD");
  await bubble.getByLabel("Edit message").click();
  const editor = bubble.locator(".rd-richeditor");
  rec("edit opens the TipTap composer pre-filled (bold survives into editor)", await waitFor(cp, () => editor.locator("strong").count().then((c) => c > 0)));
  rec("edit composer pre-fills the #-link chip", await editor.locator('.rd-entity:has-text("ZZS6TASK")').count() > 0);
  await cp.screenshot({ path: `${OUT}/editing_rich.png`, fullPage: true });
  await editor.click();
  await cp.keyboard.press("End");
  await cp.keyboard.type(" EDITED");
  await bubble.getByRole("button", { name: "Save" }).click();
  await cp.waitForTimeout(1800);

  // after edit: formatting + #-link PRESERVED, body text updated, (edited) shown
  rec("after edit: bold formatting PRESERVED (body_rich not cleared)", await waitFor(cp, () => bubbleOf(cp, "ZZS6BOLD").locator("strong").count().then((c) => c > 0)));
  rec("after edit: #-link chip PRESERVED", await bubbleOf(cp, "ZZS6BOLD").locator('.rd-entity:has-text("ZZS6TASK")').count() > 0);
  rec("after edit: new text saved (EDITED)", await bubbleOf(cp, "ZZS6BOLD").locator('text=EDITED').count() > 0);
  rec("after edit: (edited) tag shows", await bubbleOf(cp, "ZZS6BOLD").locator('text=/\\(edited\\)/').count() > 0);
  await cp.screenshot({ path: `${OUT}/edited_tag.png`, fullPage: true });

  // DB: body_rich was UPDATED (still has <strong> + the entity ref), edited_at set, not cleared
  // poll: the edit dispatch is deferred (setTimeout) + the action is cold, so the commit lands a
  // beat after the optimistic UI update.
  let stored = null;
  for (let i = 0; i < 20; i++) {
    stored = (await admin.from("messages").select("body, body_rich, edited_at").eq("client_id", clientId).ilike("body", "%ZZS6BOLD%").maybeSingle()).data;
    if (stored?.edited_at && stored.body.includes("EDITED")) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  rec("DB: edited body_rich preserved (strong + entity ref), edited_at set", !!stored && !!stored.body_rich && stored.body_rich.includes("<strong>") && stored.body_rich.includes(`data-id="${task}"`) && !!stored.edited_at && stored.body.includes("EDITED"));
  rec("no client console errors", cerrs.length === 0, cerrs.slice(0, 1).join("").slice(0, 140));
  await cctx.close();

  // XSS via an edited body_rich (simulated malicious edit) is inert on render
  await admin.from("messages").insert({ thread_id: sharedT, client_id: clientId, thread_type: "client_shared", author_id: au.user.id, body: "ZZS6XSS edited", body_rich: `<p>ZZS6XSS <img src=x onerror="window.__x6=1"> <script>window.__x6=1<\/script></p>`, edited_at: new Date().toISOString() });
  const c2 = await b.newContext({ viewport: { width: 1280, height: 1000 } }); const cp2 = await c2.newPage();
  await login(cp2, CLIENT);
  await cp2.goto(`${BASE}/messages`, { waitUntil: "domcontentloaded" });
  await cp2.waitForSelector(".rd-richeditor", { timeout: 30000 }); await cp2.waitForTimeout(1000);
  rec("edited body_rich XSS is inert (no <img>/<script>, no execution)", (await cp2.evaluate(() => !window.__x6)) && (await cp2.locator('.rd-msg img').count()) === 0 && (await cp2.locator('.rd-msg script').count()) === 0);
  // dark
  await cp2.addInitScript(() => localStorage.setItem("rd-mode", "dark"));
  await cp2.reload({ waitUntil: "domcontentloaded" });
  await cp2.waitForSelector(".rd-richeditor", { timeout: 30000 }); await cp2.waitForTimeout(800);
  rec("dark: edited message + (edited) renders", await waitFor(cp2, () => bubbleOf(cp2, "ZZS6BOLD").locator('text=/\\(edited\\)/').count().then((c) => c > 0)));
  await cp2.screenshot({ path: `${OUT}/dark_edited.png`, fullPage: true });
  await c2.close();
} finally {
  if (clientId) await admin.from("clients").delete().eq("id", clientId);
  await admin.from("clients").delete().eq("slug", SLUG);
  await delU(ADMIN); await delU(CLIENT);
  await b.close();
}
const failed = results.filter(r => !r.ok); console.log(`\n${results.length - failed.length}/${results.length} passed.`); process.exit(failed.length ? 1 : 0);
