// PHASE-0 AUDIT TOOLING (throwaway — kept under /docs/ui-audit/ per the audit constraint).
// Provisions an ISOLATED demo PROJECT-type client + a demo project-client login, so the
// project-client-side UI (projects board + filtered nav) can be screenshotted. It does NOT
// touch the real project account (fourpielabs@gmail.com). Non-destructive + idempotent.
//
//   Run:  npx tsx docs/ui-audit/tools/provision-demo-project.mjs
//   Undo: see the cleanup SQL printed at the end (or docs/ui-audit/screens/README.md).
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase env in .env.local");
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const PASS = "FourPie!Demo2026";
const SLUG = "demo-project";
const EMAIL = "demo-project@example.com";

async function main() {
  // 1) the demo PROJECT client (program='foundation' neutral baseline, per the project path)
  const { data: client, error: cErr } = await db
    .from("clients")
    .upsert(
      {
        name: "Demo Project Co.",
        slug: SLUG,
        industry: "other_local_service",
        client_type: "project",
        program: "foundation",
        status: "active",
        website_url: "https://demoproject.example.com",
        start_date: "2026-05-01",
        internal_notes: "AUDIT DEMO — isolated project client for Phase-0 screenshots. Safe to delete.",
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();
  if (cErr) throw cErr;
  const clientId = client.id;

  // 2) admin id (created_by for projects/deliverables)
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  const admin = list.users.find((u) => u.email === "demo-admin@example.com");
  const adminId = admin?.id;

  // 3) the demo project-client login (role=client, attached to the demo project client)
  const existing = list.users.find((u) => u.email?.toLowerCase() === EMAIL);
  let userId;
  if (existing) {
    await db.auth.admin.updateUserById(existing.id, {
      password: PASS,
      email_confirm: true,
      user_metadata: { full_name: "Jordan Project", role: "client", client_id: clientId },
    });
    userId = existing.id;
    await db.from("profiles").update({ client_id: clientId, role: "client", is_active: true }).eq("id", userId);
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email: EMAIL,
      password: PASS,
      email_confirm: true,
      user_metadata: { full_name: "Jordan Project", role: "client", client_id: clientId },
    });
    if (error) throw error;
    userId = data.user.id;
  }

  // 4) assign the demo team member so staff can reach it too
  const team = list.users.find((u) => u.email === "demo-team@example.com");
  if (team) {
    await db.from("clients").update({ primary_contact_user_id: team.id }).eq("id", clientId);
    await db.from("client_assignments").upsert(
      { client_id: clientId, user_id: team.id, assigned_by: adminId },
      { onConflict: "client_id,user_id" },
    );
  }

  // 5) a couple of projects + a linked deliverable so the board isn't empty
  await db.from("projects").delete().eq("client_id", clientId);
  const { data: projs } = await db
    .from("projects")
    .insert([
      { client_id: clientId, title: "Website redesign", description: "New marketing site — 6 pages, CMS, launch.", status: "active", start_date: "2026-05-05", due_date: "2026-07-15", created_by: adminId },
      { client_id: clientId, title: "Brand identity refresh", description: "Logo, palette, type system, brand guide.", status: "proposed", start_date: "2026-06-01", due_date: "2026-08-01", created_by: adminId },
      { client_id: clientId, title: "Q1 launch campaign", description: "Paid + organic launch push.", status: "complete", start_date: "2026-02-01", due_date: "2026-04-01", created_by: adminId },
    ])
    .select("id");
  await db.from("deliverables").delete().eq("client_id", clientId);
  await db.from("deliverables").insert([
    { client_id: clientId, project_id: projs?.[0]?.id ?? null, title: "Homepage hi-fi mockup", description: "Desktop + mobile.", type: "other", status: "needs_review", due_date: "2026-06-20", visible_to_client: true, created_by: adminId },
    { client_id: clientId, project_id: projs?.[0]?.id ?? null, title: "Sitemap + wireframes", description: "Approved IA.", type: "other", status: "delivered", due_date: "2026-05-20", visible_to_client: true, delivered_at: "2026-05-19T10:00:00Z", created_by: adminId },
  ]);

  console.log("✅ Demo project client provisioned.");
  console.log("   client:", clientId, "(slug: demo-project)");
  console.log("   login :", EMAIL, "/", PASS);
  console.log("\nCLEANUP SQL (run later to remove):");
  console.log(`   delete from clients where slug = '${SLUG}'; -- cascades child rows`);
  console.log(`   -- then delete the auth user ${EMAIL} via the dashboard or admin API`);
}

main().catch((e) => {
  console.error("Provision failed:", e);
  process.exit(1);
});
