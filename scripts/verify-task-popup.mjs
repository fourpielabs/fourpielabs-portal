// BUG 1 task-popup sizing. Dev-only; NON-DESTRUCTIVE (self-cleans).
//   node scripts/verify-task-popup.mjs   (server on :3000)
// Opens the task detail popup (long description + many subtasks + time entries to
// force height) for STAFF (with timer) and CLIENT (read-only, no timer), at 1440
// and 390, asserting: the surface fits the viewport, the content scrolls INSIDE
// (no double/horizontal scrollbars), and the timer is staff-only. Screens → docs/fixes/.
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const BASE = process.env.VERIFY_BASE || "http://localhost:3000";
const PASS = "FourPie!Demo2026";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OUT = "docs/fixes/task-popup";
mkdirSync(OUT, { recursive: true });
const results = [];
const rec = (n, ok, d = "") => { results.push({ n, ok, d }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };

async function ensureUser(email, meta) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const ex = list?.users.find((u) => u.email === email); if (ex) await admin.auth.admin.deleteUser(ex.id);
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true, user_metadata: meta });
  if (error) throw error; return data.user.id;
}

const TEAM = "zz-pop-team@example.com", CLIENTU = "zz-pop-client@example.com", SLUG = "zz-pop";
let clientId;
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  await admin.from("clients").delete().eq("slug", SLUG);
  const { data: cl } = await admin.from("clients").insert({ name: "ZZ Popup", slug: SLUG, industry: "other_local_service", program: "pipeline", status: "active", client_type: "program" }).select("id").single();
  clientId = cl.id;
  const teamUid = await ensureUser(TEAM, { role: "team", full_name: "Popup Team" });
  await ensureUser(CLIENTU, { role: "client", client_id: clientId, full_name: "Popup Client" });
  await admin.from("client_assignments").insert({ client_id: clientId, user_id: teamUid });
  const longDesc = "This is a deliberately long description to force the dialog tall. ".repeat(8);
  const { data: task } = await admin.from("tasks").insert({ client_id: clientId, title: "A task with a fairly long title to test wrapping in the header", description: longDesc, visible_to_client: true, assignee_id: teamUid }).select("id").single();
  const taskId = task.id;
  for (let i = 1; i <= 7; i++) await admin.from("task_checklist_items").insert({ task_id: taskId, title: `Subtask number ${i} — enough rows to make the body scroll`, position: i });
  // time entries (staff timer list)
  for (let i = 0; i < 4; i++) await admin.from("time_entries").insert({ task_id: taskId, user_id: teamUid, started_at: new Date(Date.now() - (i + 1) * 7200_000).toISOString(), ended_at: new Date(Date.now() - (i + 1) * 7200_000 + 3600_000).toISOString() });

  async function shoot(email, base, role, w, h) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.fill("input[type=email]", email); await page.fill("input[type=password]", PASS);
    await page.click('button:has-text("Sign in")'); await page.waitForURL("**/dashboard").catch(() => {});
    await page.waitForTimeout(700);
    await page.goto(`${BASE}${base}?task=${taskId}`, { waitUntil: "networkidle" });
    await page.waitForSelector(".fui-DialogSurface", { timeout: 8000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${role}_${w}.png` });
    const m = await page.evaluate(() => {
      const s = document.querySelector(".fui-DialogSurface");
      const r = s.getBoundingClientRect();
      // the single scroll region is the content div (overflow-y:auto) inside DialogBody
      const scroller = [...s.querySelectorAll("div")].find((d) => getComputedStyle(d).overflowY === "auto");
      const horiz = scroller ? scroller.scrollWidth - scroller.clientWidth : 0;
      const bodyHoriz = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      const hasTimer = /Time tracking/.test(s.textContent || "");
      return { surfaceW: Math.round(r.width), surfaceH: Math.round(r.height), vw: window.innerWidth, vh: window.innerHeight, horiz, bodyHoriz, hasTimer, scrollerFound: !!scroller };
    });
    const fitsW = m.surfaceW <= m.vw;             // surface within viewport width
    const fitsH = m.surfaceH <= m.vh * 0.9 + 2;   // within ~88vh cap
    const noHoriz = m.horiz <= 1 && m.bodyHoriz <= 1; // no horizontal scrollbar (dialog or page)
    rec(`[${role} @${w}] surface fits viewport`, fitsW && fitsH, `surface ${m.surfaceW}x${m.surfaceH} vw=${m.vw} vh=${m.vh}`);
    rec(`[${role} @${w}] no horizontal scroll`, noHoriz, `dialog=${m.horiz} page=${m.bodyHoriz}`);
    rec(`[${role} @${w}] inner scroll region present`, m.scrollerFound, "");
    rec(`[${role} @${w}] timer ${role === "staff" ? "present" : "absent"}`, role === "staff" ? m.hasTimer : !m.hasTimer, `hasTimer=${m.hasTimer}`);
    await ctx.close();
  }

  await shoot(TEAM, `/clients/${clientId}/tasks`, "staff", 1440, 900);
  await shoot(TEAM, `/clients/${clientId}/tasks`, "staff", 390, 780);
  await shoot(CLIENTU, "/tasks", "client", 1440, 900);
  await shoot(CLIENTU, "/tasks", "client", 390, 780);
} finally {
  if (clientId) await admin.from("clients").delete().eq("id", clientId);
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const e of [TEAM, CLIENTU]) { const u = list?.users.find((x) => x.email === e); if (u) await admin.auth.admin.deleteUser(u.id); }
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
