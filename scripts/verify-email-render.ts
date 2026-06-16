/**
 * Render every email (auth invite/recovery + notification message/deliverable/
 * report/project) in a headless browser at 600px (desktop) and 360px (mobile),
 * assert the REAL LOGO loads (naturalWidth>0) and the CTA button is present, and
 * save screenshots to .email-shots/ so the branded result can be eyeballed.
 * Run a local prod server first (serves /email-logo.png), then:
 *   npx tsx scripts/verify-email-render.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.VERIFY_BASE || "http://localhost:3000";
// the notification logo + links resolve to NEXT_PUBLIC_SITE_URL — point it at the
// running server so /email-logo.png loads during the render.
process.env.NEXT_PUBLIC_SITE_URL = BASE;

async function main() {
  const { buildNotificationEmail } = await import("../lib/email");
  const { inviteTemplate, recoveryTemplate } = await import("../lib/auth-email-templates");
  const sub = (h: string) =>
    h.replaceAll("{{ .SiteURL }}", BASE).replaceAll("{{ .TokenHash }}", "demo-token-123");

  const emails = [
    { name: "auth-invite", html: sub(inviteTemplate().html) },
    { name: "auth-recovery", html: sub(recoveryTemplate().html) },
    { name: "notif-message", html: buildNotificationEmail({ type: "message", title: "New message from Riley Partner", clientName: "Premier Painting Co.", link: "/messages" }).html },
    { name: "notif-deliverable", html: buildNotificationEmail({ type: "deliverable_delivered", title: "A new deliverable is ready", clientName: "Premier Painting Co.", link: "/deliverables" }).html },
    { name: "notif-report", html: buildNotificationEmail({ type: "report_published", title: "Your monthly report is published", clientName: "Coastal Tours Co.", link: "/performance" }).html },
    { name: "notif-project", html: buildNotificationEmail({ type: "project_status", title: "Project status updated", clientName: "Coastal Tours Co.", link: "/dashboard" }).html },
  ];

  mkdirSync(".email-shots", { recursive: true });
  const results: { ok: boolean }[] = [];
  const rec = (n: string, ok: boolean, d = "") => { results.push({ ok }); console.log(`${ok ? "✓" : "✗"} ${n}${d ? `  (${d})` : ""}`); };

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const e of emails) {
    for (const [w, tag] of [[600, "desktop"], [360, "mobile"]] as const) {
      const page = await browser.newPage({ viewport: { width: w, height: 900 } });
      await page.setContent(e.html, { waitUntil: "networkidle" }).catch(() => {});
      await page.waitForTimeout(300);
      await page.screenshot({ path: `.email-shots/${e.name}-${tag}.png`, fullPage: true });
      if (tag === "desktop") {
        const logoOk = await page.locator('img[alt="4Pie Labs"]').first().evaluate((img: HTMLImageElement) => img.naturalWidth > 0).catch(() => false);
        const ctaOk = (await page.locator('a[style*="B45309"]').count()) > 0;
        rec(`${e.name}: real logo renders (naturalWidth>0)`, logoOk, "");
        rec(`${e.name}: amber CTA button present`, ctaOk, "");
      }
      await page.close();
    }
  }
  await browser.close();

  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} render checks passed.  (screenshots → .email-shots/)`);
  if (results.some((r) => !r.ok)) process.exit(1);
  console.log("All emails render with the real logo + CTA. ✓");
}

main().catch((e) => { console.error(e); process.exit(1); });
