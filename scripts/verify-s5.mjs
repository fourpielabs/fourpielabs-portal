// Track 5 S5 E2E — # deep-linking. Proves: the # picker shows ONLY the viewer's accessible
// entities (own visible — excludes staff-only + cross-client); a selected link persists + renders
// as a chip that DEEP-LINKS; a stored #-link to an item the viewer CANNOT access resolves to
// "unavailable" with NO title leak (both a staff-only item and a cross-client item); staff DO see
// the staff-only title; a malicious entity title stays inert. Provisions its own temp clients/users.
import { config } from "dotenv"; config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";
const BASE = "http://localhost:3000", PASS = "FourPie!Demo2026", ADMIN = "zz-s5-admin@example.com", CLIENT = "zz-s5-client@example.com", SLUG_A = "zz-s5-a", SLUG_B = "zz-s5-b";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OUT = "docs/features/messages/s5"; mkdirSync(OUT, { recursive: true });
const results = []; const rec = (n, ok, d = "") => { results.push({ n, ok }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };
const delU = async (e) => { const { data } = await admin.auth.admin.listUsers({ perPage: 1000 }); const u = data?.users.find(x => x.email === e); if (u) await admin.auth.admin.deleteUser(u.id); };
const b = await chromium.launch({ channel: "chrome", headless: true });
const waitFor = async (page, fn, ms = 12000, step = 400) => { for (let t = 0; t < ms; t += step) { if (await fn()) return true; await page.waitForTimeout(step); } return false; };
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
let clientA = null, clientB = null;
try {
  await delU(ADMIN); await delU(CLIENT);
  await admin.from("clients").delete().in("slug", [SLUG_A, SLUG_B]);
  const { data: au } = await admin.auth.admin.createUser({ email: ADMIN, password: PASS, email_confirm: true, user_metadata: { role: "admin", full_name: "S5 Admin" } });
  const mk = async (slug, name) => (await admin.from("clients").insert({ name, slug, industry: "other_local_service", program: "foundation", status: "active", client_type: "project" }).select("id").single()).data.id;
  clientA = await mk(SLUG_A, "ZZ S5 Client A"); clientB = await mk(SLUG_B, "ZZ S5 Client B");
  const { data: cu } = await admin.auth.admin.createUser({ email: CLIENT, password: PASS, email_confirm: true, user_metadata: { role: "client", client_id: clientA, full_name: "S5 Client" } });
  await admin.from("profiles").update({ role: "client", client_id: clientA, full_name: "S5 Client" }).eq("id", cu.user.id);
  const sharedT = (await admin.from("threads").select("id").eq("client_id", clientA).eq("type", "client_shared").single()).data.id;

  // clientA entities: visible task/project/deliverable (linkable by the client), a STAFF-ONLY task
  // (client can't see), and a malicious-titled task. clientB: a cross-client task.
  const taskVisible = (await admin.from("tasks").insert({ client_id: clientA, title: "ZZS5TASK visible", visible_to_client: true }).select("id").single()).data.id;
  const proj = (await admin.from("projects").insert({ client_id: clientA, title: "ZZS5PROJ alpha" }).select("id").single()).data.id;
  const deliv = (await admin.from("deliverables").insert({ client_id: clientA, title: "ZZS5DELIV report", type: "other", status: "pending", visible_to_client: true }).select("id").single()).data.id;
  const taskHidden = (await admin.from("tasks").insert({ client_id: clientA, title: "ZZS5HIDDEN secret", visible_to_client: false }).select("id").single()).data.id;
  const taskXss = (await admin.from("tasks").insert({ client_id: clientA, title: "ZZS5XSS <img src=x onerror=window.__xss=1>", visible_to_client: true }).select("id").single()).data.id;
  const taskCross = (await admin.from("tasks").insert({ client_id: clientB, title: "ZZS5CROSS otherclient", visible_to_client: true }).select("id").single()).data.id;

  // a seeded message (by admin) in clientA's SHARED thread that #-links a STAFF-ONLY task + a
  // CROSS-CLIENT task + the XSS task. body plaintext is generic; body_rich holds the chips.
  const chip = (type, id, label) => `<span class="rd-entity" data-type="${type}" data-id="${id}">#${label}</span>`;
  await admin.from("messages").insert({
    thread_id: sharedT, client_id: clientA, thread_type: "client_shared", author_id: au.user.id,
    body: "refs #task #task #task",
    body_rich: `<p>refs ${chip("task", taskHidden, "ZZS5HIDDEN secret")} ${chip("task", taskCross, "ZZS5CROSS otherclient")} ${chip("task", taskXss, "ZZS5XSS bad")}</p>`,
  });
  // NON-CANONICAL chips referencing the STAFF-ONLY task — these defeat a naive regex resolver
  // (reordered attrs / inner markup / extra class). The DOM-based resolver must still rewrite them
  // to "unavailable" for the client (zero title leak), or it's a real boundary bypass.
  await admin.from("messages").insert({
    thread_id: sharedT, client_id: clientA, thread_type: "client_shared", author_id: au.user.id,
    body: "noncanon #task",
    body_rich: `<p>nc <span data-id="${taskHidden}" class="rd-entity" data-type="task">#ZZS5NCREORDER sneaky</span>`
      + ` <span class="rd-entity x" data-type="task" data-id="${taskHidden}" data-extra="1">#ZZS5NCEXTRA sneaky</span>`
      + ` <span class="rd-entity" data-type="task" data-id="${taskHidden}">#ZZS5NCINNER <b>sneaky</b></span></p>`,
  });

  // ───────────── CLIENT: picker shows own only; resolution hides hidden/cross ─────────────
  const cctx = await b.newContext({ viewport: { width: 1280, height: 1000 } }); const cp = await cctx.newPage();
  const cerrs = []; cp.on("pageerror", e => cerrs.push(String(e)));
  await login(cp, CLIENT);
  await cp.goto(`${BASE}/messages`, { waitUntil: "domcontentloaded" });
  await cp.waitForSelector(".rd-richeditor", { timeout: 30000 }); await cp.waitForTimeout(800);

  // open the # picker
  await cp.locator(".rd-richeditor").click();
  await cp.keyboard.type("#ZZS5");
  const picker = cp.locator('[role="listbox"][aria-label*="Link"]');
  rec("# picker opens for the client", await waitFor(cp, () => picker.count().then((c) => c > 0), 30000));
  await cp.waitForTimeout(500);
  await cp.screenshot({ path: `${OUT}/picker_own_only.png`, fullPage: true });
  rec("picker shows OWN visible task", await picker.locator('text=ZZS5TASK').count() > 0);
  rec("picker shows OWN project", await picker.locator('text=ZZS5PROJ').count() > 0);
  rec("picker shows OWN deliverable", await picker.locator('text=ZZS5DELIV').count() > 0);
  rec("picker EXCLUDES staff-only task (boundary)", await picker.locator('text=ZZS5HIDDEN').count() === 0);
  rec("picker EXCLUDES cross-client task (boundary)", await picker.locator('text=ZZS5CROSS').count() === 0);

  // select the visible task → chip inserted → send → rendered chip deep-links
  await picker.locator('button:has-text("ZZS5TASK")').first().click();
  await cp.waitForTimeout(300);
  await cp.keyboard.type(" please review");
  await cp.keyboard.press("Control+Enter");
  await cp.waitForTimeout(1800);
  rec("sent #-link renders a chip deep-linking the task", await waitFor(cp, () => cp.locator('.rd-msg .rd-entity[data-href*="/tasks?task="]:has-text("ZZS5TASK")').count().then((c) => c > 0), 20000));
  await cp.screenshot({ path: `${OUT}/resolved_chip.png`, fullPage: true });
  const stored = (await admin.from("messages").select("body, body_rich").eq("client_id", clientA).ilike("body", "%please review%").maybeSingle()).data;
  rec("stored: body plaintext is GENERIC (#task, no title leak)", !!stored && stored.body.includes("#task") && !stored.body.includes("ZZS5TASK"), stored?.body ?? "");
  rec("stored: body_rich holds the entity ref (data-id)", !!stored?.body_rich && stored.body_rich.includes(`data-id="${taskVisible}"`));

  // resolution boundary: the seeded hidden + cross links render "unavailable" with NO title
  rec("client: staff-only link resolves to 'unavailable' (no title leak)", (await cp.locator('text=ZZS5HIDDEN').count()) === 0 && (await cp.locator('.rd-entity--gone').count()) > 0);
  rec("client: cross-client link resolves to 'unavailable' (no title leak)", (await cp.locator('text=ZZS5CROSS').count()) === 0);
  rec("client: XSS title is inert (no <img> rendered, no execution)", (await cp.evaluate(() => !window.__xss)) && (await cp.locator('.rd-msg img').count()) === 0);
  // the NON-CANONICAL staff-only chips (reordered/extra/inner-markup) must ALSO resolve to
  // "unavailable" — the DOM resolver rewrites every rd-entity element, not just canonical ones.
  rec("client: NON-CANONICAL staff-only chips also resolve to 'unavailable' (regex-bypass closed)",
    (await cp.locator('text=ZZS5NCREORDER').count()) === 0 && (await cp.locator('text=ZZS5NCEXTRA').count()) === 0 && (await cp.locator('text=ZZS5NCINNER').count()) === 0 && (await cp.locator('text=sneaky').count()) === 0);
  await cp.screenshot({ path: `${OUT}/client_unavailable.png`, fullPage: true });
  rec("no client console errors", cerrs.length === 0, cerrs.slice(0, 1).join("").slice(0, 140));
  await cctx.close();

  // ───────────── STAFF: picker includes staff-only; resolution shows the staff-only title ─────────────
  const sctx = await b.newContext({ viewport: { width: 1280, height: 1000 } }); const sp = await sctx.newPage();
  await login(sp, ADMIN);
  await sp.goto(`${BASE}/clients/${clientA}/messages`, { waitUntil: "domcontentloaded" });
  await sp.waitForSelector(".rd-richeditor", { timeout: 60000 }); await sp.waitForTimeout(800);
  rec("staff: staff-only link resolves to its TITLE (can access)", await waitFor(sp, () => sp.locator('.rd-msg .rd-entity:has-text("ZZS5HIDDEN")').count().then((c) => c > 0)));
  await sp.locator(".rd-richeditor").click();
  await sp.keyboard.type("#ZZS5HID");
  const spicker = sp.locator('[role="listbox"][aria-label*="Link"]');
  rec("staff picker INCLUDES the staff-only task (can link)", await waitFor(sp, () => spicker.locator('text=ZZS5HIDDEN').count().then((c) => c > 0), 30000));
  await sp.screenshot({ path: `${OUT}/staff_picker.png`, fullPage: true });
  await sctx.close();

  // dark
  const d2 = await b.newContext({ viewport: { width: 1280, height: 1000 } }); const dp = await d2.newPage();
  await dp.addInitScript(() => localStorage.setItem("rd-mode", "dark"));
  await login(dp, CLIENT);
  await dp.goto(`${BASE}/messages`, { waitUntil: "domcontentloaded" });
  await dp.waitForSelector(".rd-richeditor", { timeout: 30000 }); await dp.waitForTimeout(800);
  rec("dark: resolved chip renders", await waitFor(dp, () => dp.locator('.rd-msg .rd-entity:has-text("ZZS5TASK")').count().then((c) => c > 0)));
  await dp.screenshot({ path: `${OUT}/dark_deeplink.png`, fullPage: true });
  await d2.close();
} finally {
  for (const cid of [clientA, clientB]) if (cid) await admin.from("clients").delete().eq("id", cid);
  await admin.from("clients").delete().in("slug", [SLUG_A, SLUG_B]);
  await delU(ADMIN); await delU(CLIENT);
  await b.close();
}
const failed = results.filter(r => !r.ok); console.log(`\n${results.length - failed.length}/${results.length} passed.`); process.exit(failed.length ? 1 : 0);
