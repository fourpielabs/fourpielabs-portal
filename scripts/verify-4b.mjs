// 4b — global search E2E through the real palette: client finds own data, gets ZERO for
// cross-client + internal terms, deep-links work. Self-cleans temp client/2nd client/users/rows.
import { config } from "dotenv"; config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";
const BASE = "http://localhost:3000", PASS = "FourPie!Demo2026", ADMIN = "zz-4b-admin@example.com", CLIENT = "zz-4b-client@example.com";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OUT = "docs/features/track4/4b"; mkdirSync(OUT, { recursive: true });
const results = []; const rec = (n, ok, d = "") => { results.push({ n, ok }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };
const delU = async (e) => { const { data } = await admin.auth.admin.listUsers({ perPage: 1000 }); const u = data?.users.find(x => x.email === e); if (u) await admin.auth.admin.deleteUser(u.id); };
const slug = "zz-4b-x-" + Math.floor(Math.random() * 1e6);
const b = await chromium.launch({ channel: "chrome", headless: true });
let ownId = null, otherId = null, taskId = null, msgIds = [];
try {
  await delU(ADMIN); await delU(CLIENT);
  await admin.auth.admin.createUser({ email: ADMIN, password: PASS, email_confirm: true, user_metadata: { role: "admin", full_name: "4B Admin" } });
  const { data: own } = await admin.from("clients").select("id").eq("client_type", "project").limit(1).single(); ownId = own.id;
  const { data: cu } = await admin.auth.admin.createUser({ email: CLIENT, password: PASS, email_confirm: true, user_metadata: { role: "client", client_id: ownId, full_name: "4B Client" } });
  await admin.from("profiles").update({ role: "client", client_id: ownId, full_name: "4B Client" }).eq("id", cu.user.id);
  // a SECOND client to hold cross-client data
  const { data: other } = await admin.from("clients").insert({ name: "ZZ Other Co", slug, client_type: "project", program: "foundation", status: "active", industry: "other_local_service" }).select("id").single();
  otherId = other.id;

  // seed: own-visible task (client should FIND), cross-client task (client gets 0),
  // internal message on OWN client (client gets 0 — internal boundary), shared msg on own (FIND)
  taskId = (await admin.from("tasks").insert({ client_id: ownId, title: "ZZOWNFIND deliverable plan", visible_to_client: true }).select("id").single()).data.id;
  await admin.from("tasks").insert({ client_id: otherId, title: "ZZXCLIENT secret roadmap", visible_to_client: true });
  const threads = (await admin.from("threads").select("id, type").eq("client_id", ownId)).data ?? [];
  const internalT = threads.find(t => t.type === "internal")?.id;
  const sharedT = threads.find(t => t.type === "client_shared")?.id;
  if (internalT) msgIds.push((await admin.from("messages").insert({ thread_id: internalT, client_id: ownId, thread_type: "internal", body: "ZZINTSEARCH internal only note" }).select("id").single()).data.id);
  if (sharedT) msgIds.push((await admin.from("messages").insert({ thread_id: sharedT, client_id: ownId, thread_type: "client_shared", body: "ZZSHAREDFIND visible to client" }).select("id").single()).data.id);

  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage();
  const errs = []; page.on("pageerror", e => errs.push(String(e)));
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("input[type=email]", CLIENT); await page.fill("input[type=password]", PASS);
  await page.click('button:has-text("Sign in")'); await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});

  const search = async (term) => {
    if ((await page.locator('.fui-DialogSurface').count()) === 0) await page.locator('button[aria-label="Search"]').first().click();
    await page.waitForSelector('.fui-DialogSurface input', { timeout: 8000 });
    await page.locator('.fui-DialogSurface input').first().fill(term);
    // wait until the search settles (results group, no-results, or hint) — robust vs cold compile
    await page.waitForFunction(() => {
      const d = document.querySelector('.fui-DialogSurface'); if (!d) return false;
      const t = d.textContent || "";
      return !t.includes("Searching") && (t.includes("No results") || /TASKS|PROJECTS|MESSAGES|DELIVERABLES|DOCUMENTS|CLIENTS/.test(t));
    }, { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(300);
  };

  // POSITIVE: own visible task
  await search("ZZOWNFIND");
  rec("client finds OWN task", await page.locator('.fui-DialogSurface:has-text("ZZOWNFIND")').count() > 0);
  await page.screenshot({ path: `${OUT}/client_search_own.png` });
  // POSITIVE: own shared message
  await search("ZZSHAREDFIND");
  rec("client finds OWN shared message", await page.locator('.fui-DialogSurface:has-text("ZZSHAREDFIND")').count() > 0);

  // NEGATIVE: cross-client term → no results
  await search("ZZXCLIENT");
  rec("client search cross-client → NO results", await page.locator('.fui-DialogSurface:has-text("No results")').count() > 0 && await page.locator('.fui-DialogSurface:has-text("secret roadmap")').count() === 0);
  await page.screenshot({ path: `${OUT}/client_search_cross_client_zero.png` });

  // NEGATIVE: internal-thread term → no results (internal boundary via search)
  await search("ZZINTSEARCH");
  rec("client search INTERNAL message → NO results (boundary)", await page.locator('.fui-DialogSurface:has-text("No results")').count() > 0 && await page.locator('.fui-DialogSurface:has-text("internal only")').count() === 0);
  await page.screenshot({ path: `${OUT}/client_search_internal_zero.png` });

  // NO-RESULTS state screenshot (a nonsense term)
  await search("ZZNOTHINGZZ");
  rec("no-results state renders", await page.locator('.fui-DialogSurface:has-text("No results")').count() > 0);
  await page.screenshot({ path: `${OUT}/client_search_no_results.png` });

  // DEEP-LINK: search own task, click it → navigates to /tasks
  await search("ZZOWNFIND");
  await page.locator('.fui-DialogSurface button:has-text("ZZOWNFIND")').first().click();
  await page.waitForTimeout(1200);
  rec("result deep-links (navigated to /tasks)", page.url().includes("/tasks"), page.url().replace(BASE, ""));

  rec("no console/page errors", errs.length === 0, errs.slice(0, 1).join("").slice(0, 120));
  await ctx.close();
} finally {
  if (taskId) await admin.from("tasks").delete().eq("id", taskId);
  if (msgIds.length) await admin.from("messages").delete().in("id", msgIds);
  if (otherId) await admin.from("clients").delete().eq("id", otherId); // cascade
  await delU(ADMIN); await delU(CLIENT);
  await b.close();
}
const failed = results.filter(r => !r.ok); console.log(`\n${results.length - failed.length}/${results.length} passed.`); process.exit(failed.length ? 1 : 0);
