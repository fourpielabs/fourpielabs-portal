// Verify #3: primary disabled vs enabled, and that primary/secondary/outline/ghost/
// destructive/disabled are all visually distinct. Run (server up): node docs/ui-audit/tools/shot-buttons.mjs
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const PASS = "FourPie!Demo2026";
const OUT = "docs/ui-audit/phase-2b";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 900, height: 760 } });
const page = await ctx.newPage();
try {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("input[type=email]", "demo-client@example.com");
  await page.fill("input[type=password]", PASS);
  await page.click('button:has-text("Sign in")');
  await page.waitForURL("**/dashboard", { timeout: 30000 }).catch(() => {});
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/settings-disabled.png` });

  // make the form dirty → primary "Save changes" becomes the charcoal primary
  await page.fill('input#full_name', "Pat Premier Jr");
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/settings-enabled.png` });

  // inject a gallery using the REAL button classes (Tailwind generated them from button.tsx)
  await page.evaluate(() => {
    const base = "inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all outline-none select-none h-11 px-[22px] disabled:pointer-events-none disabled:border-transparent disabled:bg-surface-2 disabled:bg-none disabled:text-ink-3 disabled:shadow-none";
    const variants = [
      ["Primary", "bg-ink text-white hover:bg-charcoal-hover"],
      ["Amber CTA", "bg-amber-700 bg-[image:var(--amber-cta)] text-white shadow-[var(--shadow-amber)] hover:bg-amber-800"],
      ["Secondary", "border border-border-strong bg-surface-2 text-ink hover:border-ink hover:bg-border"],
      ["Outline", "border border-border-strong bg-surface text-ink hover:border-ink hover:bg-bg"],
      ["Ghost", "text-ink-2 hover:bg-surface-2 hover:text-ink"],
      ["Destructive", "bg-danger-solid text-white hover:bg-danger-hover"],
    ];
    const wrap = document.createElement("div");
    wrap.style.cssText = "position:fixed;inset:0;background:#f7f6f2;z-index:99999;display:flex;flex-direction:column;gap:18px;padding:40px;font-family:Inter,sans-serif";
    wrap.innerHTML = `<div style="font-weight:700;font-size:18px">Button variants — distinct + none read as disabled</div>`;
    const row = document.createElement("div");
    row.style.cssText = "display:flex;flex-wrap:wrap;gap:14px;align-items:center";
    for (const [label, cls] of variants) {
      const b = document.createElement("button");
      b.className = `${base} ${cls}`;
      b.textContent = label;
      row.appendChild(b);
    }
    // disabled examples
    const dPrimary = document.createElement("button");
    dPrimary.className = `${base} bg-ink text-white`; dPrimary.disabled = true; dPrimary.textContent = "Primary (disabled)";
    const dAmber = document.createElement("button");
    dAmber.className = `${base} bg-amber-700 bg-[image:var(--amber-cta)] text-white shadow-[var(--shadow-amber)]`; dAmber.disabled = true; dAmber.textContent = "Amber (disabled)";
    row.appendChild(dPrimary); row.appendChild(dAmber);
    wrap.appendChild(row);
    document.body.appendChild(wrap);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/button-gallery.png` });
  console.log("captured:", OUT);
} catch (e) {
  console.log("ERR", String(e?.message ?? e));
} finally {
  await ctx.close();
  await browser.close();
}
