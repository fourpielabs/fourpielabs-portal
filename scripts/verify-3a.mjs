// 3a — per-client-type settings views. Self-cleans temp admin + temp program client.
import { config } from "dotenv"; config({ path: ".env.local" });
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";
const BASE = "http://localhost:3000", PASS = "FourPie!Demo2026", ADMIN = "zz-3a-admin@example.com";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OUT = "docs/features/client-settings/3a"; mkdirSync(OUT, { recursive: true });
const results = []; const rec = (n, ok, d = "") => { results.push({ n, ok }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };
const slug = "zz-3a-prog-" + Math.floor(Math.random() * 1e6);
const b = await chromium.launch({ channel: "chrome", headless: true });
let progId = null;
try {
  await admin.auth.admin.listUsers({ perPage: 1000 }).then(({ data }) => { const u = data?.users.find(x => x.email === ADMIN); return u && admin.auth.admin.deleteUser(u.id); });
  await admin.auth.admin.createUser({ email: ADMIN, password: PASS, email_confirm: true, user_metadata: { role: "admin", full_name: "3a Admin" } });
  const { data: proj } = await admin.from("clients").select("id").eq("client_type", "project").limit(1).single();
  const { data: prog } = await admin.from("clients").insert({ name: "ZZ Program Co", slug, client_type: "program", program: "pipeline", status: "active", industry: "painting_contractor" }).select("id").single();
  progId = prog.id;

  const login = async (page, dark) => {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    if (dark) await page.evaluate(() => localStorage.setItem("rd-mode", "dark"));
    await page.fill("input[type=email]", ADMIN); await page.fill("input[type=password]", PASS);
    await page.click('button:has-text("Sign in")'); await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
  };
  for (const dark of [false, true]) {
    const tag = dark ? "dark" : "light";
    const ctx = await b.newContext({ viewport: { width: 1280, height: 1100 } }); const page = await ctx.newPage();
    await login(page, dark);
    // PROJECT settings
    await page.goto(`${BASE}/clients/${proj.id}/settings`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/project_settings_${tag}.png`, fullPage: true });
    if (!dark) {
      rec("project: 'Project workspace' panel", await page.locator("text=Project workspace").count() > 0);
      rec("project: 'Results & metrics' entry point", await page.locator("text=Results & metrics").count() > 0);
      rec("project: NO Program dropdown (field label absent)", await page.locator('label:has-text("Program")').count() === 0);
    }
    // PROGRAM settings
    await page.goto(`${BASE}/clients/${progId}/settings`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/program_settings_${tag}.png`, fullPage: true });
    if (!dark) {
      rec("program: 'Program workspace' panel", await page.locator("text=Program workspace").count() > 0);
      rec("program: Program dropdown present", await page.locator('text=Program & milestones').count() > 0 || await page.locator('select').count() > 0);
      rec("program: shared field 'Business name' present (both types)", await page.locator("text=Business name").count() > 0);
    }
    await ctx.close();
  }
} finally {
  if (progId) await admin.from("clients").delete().eq("id", progId);
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 }); const u = data?.users.find(x => x.email === ADMIN); if (u) await admin.auth.admin.deleteUser(u.id);
  await b.close();
}
const failed = results.filter(r => !r.ok); console.log(`\n${results.length - failed.length}/${results.length} passed.`); process.exit(failed.length ? 1 : 0);
