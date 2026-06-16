/**
 * Generate the Supabase auth email templates (invite + recovery) from the shared
 * shell, and either PRINT them for review or PATCH them to the live auth config.
 *   npx tsx scripts/push-auth-templates.ts            # --print (default): show the HTML
 *   npx tsx scripts/push-auth-templates.ts --push     # PATCH the Management API
 * Reversible config change (the LAUNCH.md / auth-phase pattern), NOT a DB migration.
 */
import { inviteTemplate, recoveryTemplate } from "../lib/auth-email-templates";

async function main() {
  const mode = process.argv[2] ?? "--print";
  const inv = inviteTemplate();
  const rec = recoveryTemplate();

  if (mode === "--print") {
    console.log("===== INVITE SUBJECT =====");
    console.log(inv.subject);
    console.log("\n===== INVITE HTML =====");
    console.log(inv.html);
    console.log("\n===== RECOVERY SUBJECT =====");
    console.log(rec.subject);
    console.log("\n===== RECOVERY HTML =====");
    console.log(rec.html);
    return;
  }

  if (mode === "--push") {
    const token = process.env.SUPABASE_ACCESS_TOKEN;
    const ref = process.env.SUPABASE_PROJECT_REF ?? "frmukrgjkhlpxplhzeqj";
    if (!token) {
      console.error("Missing SUPABASE_ACCESS_TOKEN in env.");
      process.exit(1);
    }
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        mailer_subjects_invite: inv.subject,
        mailer_templates_invite_content: inv.html,
        mailer_subjects_recovery: rec.subject,
        mailer_templates_recovery_content: rec.html,
      }),
    });
    console.log("PATCH /config/auth →", res.status, res.ok ? "OK" : await res.text());
    if (!res.ok) process.exit(1);
    console.log("Invite + recovery templates updated. ✓");
    return;
  }

  console.error(`Unknown mode "${mode}" (use --print or --push)`);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
