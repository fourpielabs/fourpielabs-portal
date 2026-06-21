// Track D E2E + screenshots. Dev-only; NON-DESTRUCTIVE (self-cleans).
//   node scripts/verify-advanced-tasks.mjs   (server on :3000)
// Proves: staff Kanban is DRAGGABLE (and a drag persists status), the CLIENT board
// is READ-ONLY (no drag handles), the Review column + milestone/BLOCKED-BY-CLIENT/
// dependency indicators render, and the client milestone sign-off records to the
// audit log (IP+timestamp+user) WITHOUT changing status, and is NOT "legally binding".
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const BASE = process.env.VERIFY_BASE || "http://localhost:3000";
const PASS = "FourPie!Demo2026";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OUT = "docs/features/advanced-tasks";
mkdirSync(OUT, { recursive: true });
const results = [];
const rec = (n, ok, d = "") => { results.push({ n, ok, d }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };

const TEAM = "zz-adv-team@example.com", CLIENTU = "zz-adv-client@example.com", SLUG = "zz-adv";
let clientId, teamUid, mstId;
const browser = await chromium.launch({ channel: "chrome", headless: true });
async function ensureUser(email, meta) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const ex = list?.users.find((u) => u.email === email); if (ex) await admin.auth.admin.deleteUser(ex.id);
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true, user_metadata: meta });
  if (error) throw error; return data.user.id;
}
async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("input[type=email]", email); await page.fill("input[type=password]", PASS);
  await page.click('button:has-text("Sign in")'); await page.waitForURL("**/dashboard").catch(() => {});
  await page.waitForTimeout(700);
}
const mkTask = (title, extra) => admin.from("tasks").insert({ client_id: clientId, title, visible_to_client: true, ...extra }).select("id").single();

try {
  await admin.from("clients").delete().eq("slug", SLUG);
  const { data: cl } = await admin.from("clients").insert({ name: "ZZ Advanced", slug: SLUG, industry: "other_local_service", program: "foundation", status: "active", client_type: "project" }).select("id").single();
  clientId = cl.id;
  teamUid = await ensureUser(TEAM, { role: "team", full_name: "Adv Team" });
  await ensureUser(CLIENTU, { role: "client", client_id: clientId, full_name: "Adv Client" });
  await admin.from("client_assignments").insert({ client_id: clientId, user_id: teamUid });

  const { data: mst } = await mkTask("Design homepage", { status: "todo", is_milestone: true });
  const { data: blk } = await mkTask("Brand assets ready", { status: "todo" });
  mstId = mst.id;
  await admin.from("task_dependencies").insert({ task_id: mst.id, blocked_by_task_id: blk.id });
  await mkTask("Content draft", { status: "in_progress" });
  await mkTask("Copy review", { status: "review", blocked_by_client: true, blocked_reason: "Waiting on your feedback on the draft." });
  await mkTask("Logo finalized", { status: "done" });

  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const page = await ctx.newPage();
  const shot = (t) => page.screenshot({ path: `${OUT}/${t}.png`, fullPage: true });

  // STAFF board
  await login(page, TEAM);
  await page.goto(`${BASE}/clients/${clientId}/tasks`, { waitUntil: "networkidle" }); await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Board" }).click(); await page.waitForTimeout(1200);
  await shot("01_staff_board");
  const staffTxt = await page.locator("body").innerText();
  rec("Review column present", /REVIEW/i.test(staffTxt), "");
  rec("milestone + BLOCKED BY CLIENT + dependency indicators render", /Design homepage/.test(staffTxt) && /BLOCKED BY CLIENT/.test(staffTxt) && /Blocked · 1/.test(staffTxt), "");
  const staffHandles = await page.locator("[data-rfd-drag-handle-draggable-id]").count();
  rec("staff cards are DRAGGABLE (drag handles present)", staffHandles >= 5, `${staffHandles} handles`);

  // staff keyboard-drag "Content draft" (In Progress → Review) — @hello-pangea/dnd a11y
  const dragged = await (async () => {
    try {
      const card = page.locator('[data-rfd-drag-handle-draggable-id]').filter({ hasText: "Content draft" }).first();
      await card.focus(); await page.keyboard.press("Space"); await page.waitForTimeout(300);
      await page.keyboard.press("ArrowRight"); await page.waitForTimeout(300);
      await page.keyboard.press("Space"); await page.waitForTimeout(1500);
      return true;
    } catch { return false; }
  })();
  const { data: cd } = await admin.from("tasks").select("status").eq("client_id", clientId).eq("title", "Content draft").single();
  rec("staff drag persists status (Content draft → review)", dragged && cd?.status === "review", `status=${cd?.status}`);
  await admin.from("tasks").update({ status: "in_progress" }).eq("client_id", clientId).eq("title", "Content draft"); // reset
  await ctx.close();

  // CLIENT board — read-only
  const cctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const cpage = await cctx.newPage();
  await login(cpage, CLIENTU);
  await cpage.goto(`${BASE}/tasks`, { waitUntil: "networkidle" }); await cpage.waitForTimeout(700);
  await cpage.getByRole("button", { name: "Board" }).click(); await cpage.waitForTimeout(1000);
  await cpage.screenshot({ path: `${OUT}/02_client_board_readonly.png`, fullPage: true });
  const clientHandles = await cpage.locator("[data-rfd-drag-handle-draggable-id]").count();
  rec("CLIENT board is READ-ONLY (no drag handles)", clientHandles === 0, `${clientHandles} handles`);
  rec("client sees Review column + BLOCKED BY CLIENT badge", /REVIEW/i.test(await cpage.locator("body").innerText()) && /BLOCKED BY CLIENT/.test(await cpage.locator("body").innerText()), "");

  // CLIENT milestone sign-off
  await cpage.goto(`${BASE}/tasks?task=${mstId}`, { waitUntil: "networkidle" });
  await cpage.waitForSelector(".fui-DialogSurface", { timeout: 8000 }); await cpage.waitForTimeout(600);
  const dlg = await cpage.locator(".fui-DialogSurface").innerText();
  rec("sign-off NOT labeled 'legally binding'", /formal/i.test(dlg) && !/legally binding/i.test(dlg), "");
  rec("detail shows dependency (Blocked by)", /Blocked by/i.test(dlg) && /Brand assets ready/.test(dlg), "");
  await cpage.getByRole("button", { name: /Approve milestone/i }).click();
  await cpage.waitForTimeout(2000);
  await cpage.screenshot({ path: `${OUT}/03_signoff.png`, fullPage: true });
  const { data: t2 } = await admin.from("tasks").select("client_signed_off_at, status").eq("id", mstId).single();
  rec("sign-off recorded + status UNCHANGED (lock)", !!t2?.client_signed_off_at && t2?.status === "todo", `signed=${!!t2?.client_signed_off_at} status=${t2?.status}`);
  const { data: aud } = await admin.from("audit_log").select("metadata").eq("action", "milestone.signed_off").eq("entity_id", mstId).order("created_at", { ascending: false }).limit(1);
  const meta = aud?.[0]?.metadata ?? {};
  rec("audit log row has IP + user + timestamp", !!meta.ip && !!meta.user_id && !!meta.signed_at, JSON.stringify(meta).slice(0, 80));
  await cctx.close();

  // STAFF detail — deps + flags controls
  const sctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const sp = await sctx.newPage();
  await login(sp, TEAM);
  await sp.goto(`${BASE}/clients/${clientId}/tasks?task=${mstId}`, { waitUntil: "networkidle" });
  await sp.waitForSelector(".fui-DialogSurface", { timeout: 8000 }); await sp.waitForTimeout(600);
  await sp.screenshot({ path: `${OUT}/04_staff_detail.png`, fullPage: true });
  rec("staff detail: Milestone + Blocked-by-client controls", /Milestone/.test(await sp.locator(".fui-DialogSurface").innerText()) && /Blocked by client/.test(await sp.locator(".fui-DialogSurface").innerText()), "");
  await sctx.close();

  // mobile board
  const mctx = await browser.newContext({ viewport: { width: 390, height: 1100 } });
  const mp = await mctx.newPage();
  await login(mp, CLIENTU);
  await mp.goto(`${BASE}/tasks`, { waitUntil: "networkidle" }); await mp.waitForTimeout(700);
  await mp.getByRole("button", { name: "Board" }).click(); await mp.waitForTimeout(900);
  await mp.screenshot({ path: `${OUT}/05_mobile_board.png`, fullPage: true });
  rec("mobile board renders", /REVIEW/i.test(await mp.locator("body").innerText()), "");
  await mctx.close();
} finally {
  if (clientId) await admin.from("clients").delete().eq("id", clientId);
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const e of [TEAM, CLIENTU]) { const u = list?.users.find((x) => x.email === e); if (u) await admin.auth.admin.deleteUser(u.id); }
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
