/**
 * TEST-ACCOUNT CLEANUP (service-role; bypasses RLS + app guards → keepers protected here).
 * DRY RUN by default. Execute with DRY=0.  npx tsx scripts/account-cleanup.ts  (then DRY=0 …)
 *
 * Order (guard-respecting): (1) test client/team logins → (2) test clients (cascade + Storage)
 * → (3) demo-admin LAST. Hard keeper set; aborts if any keeper would be touched or is missing.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const DRY = process.env.DRY !== "0";
const BUCKET = "client-files";

const KEEP_EMAILS = ["syedsuqlain36@gmail.com", "shahmir687@gmail.com", "fourpielabs@gmail.com"];
const KEEP_ADMINS = ["syedsuqlain36@gmail.com", "shahmir687@gmail.com"];
const KEEP_CLIENT_SLUGS = ["fourpie-labs"];
const DEL_USERS_STEP1 = ["demo-client@example.com", "demo-project@example.com", "demo-team@example.com"];
const DEL_USER_LAST = "demo-admin@example.com";
const DEL_CLIENT_SLUGS = ["premier-painting", "coastal-tours", "demo-project", "audit-empty-program", "audit-empty-project"];

function die(msg: string): never { console.error(`\n⛔ STOP — ${msg}\n(nothing deleted)`); process.exit(1); }

async function loadAll() {
  const authUsers: { id: string; email?: string }[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) die("listUsers failed: " + error.message);
    authUsers.push(...(data.users as never[]));
    if (data.users.length < 1000) break;
  }
  const { data: profiles } = await admin.from("profiles").select("id, full_name, email, role, is_active, client_id");
  const { data: clients } = await admin.from("clients").select("id, name, slug");
  return { authUsers, profiles: profiles ?? [], clients: clients ?? [] };
}

async function main() {
  console.log(`=== ACCOUNT CLEANUP — ${DRY ? "DRY RUN (no deletions)" : "EXECUTE"} ===\n`);
  const { authUsers, profiles, clients } = await loadAll();
  const authByEmail = new Map(authUsers.map((u) => [(u.email || "").toLowerCase(), u]));
  const profByEmail = new Map(profiles.map((p) => [(p.email || "").toLowerCase(), p]));
  const clientBySlug = new Map(clients.map((c) => [c.slug, c]));

  // ---- PRE-FLIGHT ----
  console.log("PRE-FLIGHT");
  const keepIds = new Set<string>();
  for (const e of KEEP_EMAILS) {
    const a = authByEmail.get(e); const pr = profByEmail.get(e);
    if (!a) die(`keeper auth user missing: ${e}`);
    keepIds.add(a.id);
    console.log(`  KEEP user ${e} → id ${a.id} role=${pr?.role ?? "?"} active=${pr?.is_active ?? "?"}`);
  }
  for (const e of KEEP_ADMINS) {
    const pr = profByEmail.get(e);
    if (!pr || pr.role !== "admin" || !pr.is_active) die(`keeper admin not an ACTIVE admin: ${e} (role=${pr?.role} active=${pr?.is_active})`);
  }
  for (const slug of KEEP_CLIENT_SLUGS) {
    const c = clientBySlug.get(slug); if (!c) die(`keeper client missing: ${slug}`);
    console.log(`  KEEP client ${slug} → id ${c.id} ("${c.name}")`);
  }
  const activeAdmins = profiles.filter((p) => p.role === "admin" && p.is_active);
  const realActiveAdmins = activeAdmins.filter((p) => KEEP_ADMINS.includes((p.email || "").toLowerCase()));
  console.log(`  active admins: ${activeAdmins.length} | real-keeper active admins: ${realActiveAdmins.length}`);
  if (realActiveAdmins.length < 2) die("fewer than 2 real active admins — last-admin guard at risk");

  // resolve delete targets + assert no keeper overlap
  const delUsers1 = DEL_USERS_STEP1.map((e) => { const a = authByEmail.get(e); if (!a) die(`delete user missing: ${e}`); if (keepIds.has(a.id)) die(`delete user is a KEEPER: ${e}`); return { email: e, id: a.id }; });
  const delLast = (() => { const a = authByEmail.get(DEL_USER_LAST); if (!a) die(`delete user missing: ${DEL_USER_LAST}`); if (keepIds.has(a.id)) die(`demo-admin is a KEEPER?!`); return { email: DEL_USER_LAST, id: a.id }; })();
  const delClients = DEL_CLIENT_SLUGS.map((s) => { const c = clientBySlug.get(s); if (!c) die(`delete client missing: ${s}`); if (KEEP_CLIENT_SLUGS.includes(s)) die(`delete client is a KEEPER: ${s}`); return { slug: s, id: c.id, name: c.name }; });
  console.log(`\n  DELETE step1 users: ${delUsers1.map((u) => u.email).join(", ")}`);
  console.log(`  DELETE clients: ${delClients.map((c) => c.slug).join(", ")}`);
  console.log(`  DELETE last (admin): ${delLast.email}`);
  console.log("  ✓ pre-flight passed — no keeper in any delete set.\n");

  if (DRY) { console.log("DRY RUN — stopping before any deletion. Re-run with DRY=0 to execute."); return; }

  // ---- STEP 1: test client/team logins ----
  console.log("STEP 1 — delete test client/team logins");
  for (const u of delUsers1) {
    const { error } = await admin.auth.admin.deleteUser(u.id);
    console.log(`  ${error ? "❌ " + error.message : "✓ deleted"} ${u.email}`);
    if (error) die(`failed deleting ${u.email}`);
  }

  // ---- STEP 2: test clients (Storage first, then cascade row) ----
  console.log("\nSTEP 2 — delete test clients (Storage + cascade)");
  for (const c of delClients) {
    // remove Storage objects under {client_id}/ (private bucket; path = {client_id}/{uuid}-{name})
    let removed = 0;
    try {
      const { data: objs } = await admin.storage.from(BUCKET).list(c.id, { limit: 1000 });
      const paths = (objs ?? []).filter((o) => o.name).map((o) => `${c.id}/${o.name}`);
      if (paths.length) { const { error } = await admin.storage.from(BUCKET).remove(paths); if (!error) removed = paths.length; }
    } catch { /* bucket/path may not exist */ }
    const { error } = await admin.from("clients").delete().eq("id", c.id);
    console.log(`  ${error ? "❌ " + error.message : "✓ deleted"} client "${c.name}" (${c.slug}) — storage objects removed: ${removed}`);
    if (error) die(`failed deleting client ${c.slug}`);
  }

  // ---- STEP 3: demo-admin LAST (re-confirm 2 real admins still active) ----
  console.log("\nSTEP 3 — delete demo-admin LAST");
  const { data: adminsNow } = await admin.from("profiles").select("email, role, is_active").eq("role", "admin").eq("is_active", true);
  const realNow = (adminsNow ?? []).filter((p) => KEEP_ADMINS.includes((p.email || "").toLowerCase()));
  if (realNow.length < 2) die(`only ${realNow.length} real active admins before demo-admin delete — abort`);
  const { error } = await admin.auth.admin.deleteUser(delLast.id);
  console.log(`  ${error ? "❌ " + error.message : "✓ deleted"} ${delLast.email}  (real active admins remaining: ${realNow.length})`);
  if (error) die(`failed deleting ${delLast.email}`);

  console.log("\n✓ cleanup complete.");
}
main().catch((e) => { console.error(e); process.exit(1); });
