// R2 verification test data: provision a demo PROJECT-client login + a few projects so the
// projects board (project-client-only) and project-type tab behavior can be verified.
// Service-role (bypasses RLS) — test data only; touches NO app logic. Run: node scripts/seed-r2-test.mjs
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase env in .env.local");
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const PW = "FourPie!Demo2026";
const EMAIL = "demo-project@example.com";
const NAME = "Jordan Project";
const CLIENT_ID = "53865671-de53-477b-a7eb-0ba3925938c8"; // Demo Project Co. (client_type=project)

async function main() {
  // 1. user (idempotent)
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  let uid;
  const existing = list.users.find((u) => u.email?.toLowerCase() === EMAIL);
  const meta = { full_name: NAME, role: "client", client_id: CLIENT_ID };
  if (existing) {
    await db.auth.admin.updateUserById(existing.id, { password: PW, email_confirm: true, user_metadata: meta });
    uid = existing.id;
  } else {
    const { data, error } = await db.auth.admin.createUser({ email: EMAIL, password: PW, email_confirm: true, user_metadata: meta });
    if (error) throw error;
    uid = data.user.id;
  }
  // 2. profile (trigger may create it; upsert to be sure)
  await db.from("profiles").upsert(
    { id: uid, role: "client", full_name: NAME, email: EMAIL, client_id: CLIENT_ID, is_active: true },
    { onConflict: "id" },
  );

  // 3. projects (idempotent: clear R2-demo markers, re-insert a varied set)
  await db.from("projects").delete().eq("client_id", CLIENT_ID).like("title", "R2 Demo:%");
  const projects = [
    { title: "R2 Demo: Brand refresh", description: "New visual identity + guidelines.", status: "active", priority: "high", target_date: "2026-08-15" },
    { title: "R2 Demo: Launch landing page", description: "Conversion-focused page for the fall launch.", status: "proposed", priority: "urgent", target_date: "2026-07-30" },
    { title: "R2 Demo: Q2 retrospective deck", description: "What worked, what's next.", status: "complete", priority: "low", target_date: "2026-06-01" },
  ].map((p) => ({ ...p, client_id: CLIENT_ID, created_by: uid }));
  const { data: ins, error: pErr } = await db.from("projects").insert(projects).select("id, title");
  if (pErr) throw pErr;

  // 4. one visible deliverable attached to the first project (for the "attached deliverables" display)
  const projId = ins[0]?.id;
  await db.from("deliverables").delete().eq("client_id", CLIENT_ID).like("title", "R2 Demo:%");
  await db.from("deliverables").insert({
    client_id: CLIENT_ID, project_id: projId, title: "R2 Demo: Logo pack v1", type: "other",
    status: "needs_review", visible_to_client: true, created_by: uid,
  });

  console.log(`OK — project client ${EMAIL} / ${PW} on Demo Project Co.; ${ins.length} projects + 1 deliverable seeded`);
}
main().catch((e) => { console.error(e); process.exit(1); });
