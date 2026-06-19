/**
 * READ-ONLY account inventory (dry run — NO deletions, NO writes).
 * Enumerates every auth user, profile, and client; flags dev/test/demo/seed vs real.
 * Run: npx tsx scripts/account-inventory.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const TEST_RE = /(@example\.com$|^demo-|^audit-|^test-|\+test@|seed)/i;
const TEST_CLIENT_RE = /(premier painting|coastal tours|demo project|sunrise plumbing|harbor lab|^test |example|seed)/i;
const d = (s: string | null | undefined) => (s ? new Date(s).toISOString().slice(0, 10) : "—");

async function main() {
  // ---- auth users (paginate) ----
  const authUsers: { id: string; email?: string; created_at: string; last_sign_in_at?: string | null; email_confirmed_at?: string | null }[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    authUsers.push(...(data.users as never[]));
    if (data.users.length < 1000) break;
  }
  const { data: profiles } = await admin.from("profiles").select("id, full_name, email, role, is_active, client_id, created_at");
  const { data: clients } = await admin.from("clients").select("id, name, slug, client_type, program, status, created_at");

  const authById = new Map(authUsers.map((u) => [u.id, u]));
  const clientById = new Map((clients ?? []).map((c) => [c.id, c]));
  const profById = new Map((profiles ?? []).map((p) => [p.id, p]));

  console.log(`\n=== AUTH USERS (${authUsers.length}) + PROFILES (${profiles?.length ?? 0}) ===`);
  const rows = (profiles ?? []).map((p) => {
    const a = authById.get(p.id);
    const email = p.email || a?.email || "—";
    const cname = p.client_id ? clientById.get(p.client_id)?.name ?? p.client_id : "—";
    const test = TEST_RE.test(email) || /^demo|^audit|^test/i.test(p.full_name ?? "");
    return { email, name: p.full_name ?? "—", role: p.role, active: p.is_active, client: cname, created: d(p.created_at), lastSignIn: d(a?.last_sign_in_at), confirmed: a ? !!a.email_confirmed_at : "no-auth", flag: test ? "TEST" : "real?" };
  }).sort((a, b) => (a.role + a.email).localeCompare(b.role + b.email));
  for (const r of rows) console.log(`  [${r.flag.padEnd(5)}] ${r.role.padEnd(6)} ${String(r.email).padEnd(34)} "${r.name}"  client=${r.client}  created=${r.created} lastLogin=${r.lastSignIn} confirmed=${r.confirmed} active=${r.active}`);

  // auth users with NO profile (orphans)
  const orphans = authUsers.filter((u) => !profById.has(u.id));
  if (orphans.length) { console.log(`\n=== AUTH USERS WITHOUT A PROFILE (${orphans.length}) ===`); for (const u of orphans) console.log(`  ${String(u.email).padEnd(34)} created=${d(u.created_at)} id=${u.id}`); }

  console.log(`\n=== CLIENTS (${clients?.length ?? 0}) ===`);
  for (const c of (clients ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const users = (profiles ?? []).filter((p) => p.client_id === c.id);
    const test = TEST_CLIENT_RE.test(c.name);
    console.log(`  [${test ? "TEST" : "real?"}] "${c.name}" (${c.slug})  type=${c.client_type} program=${c.program} status=${c.status} created=${d(c.created_at)}  users=[${users.map((u) => u.email).join(", ") || "none"}]`);
  }

  // counts for the deletion-order note
  const activeAdmins = (profiles ?? []).filter((p) => p.role === "admin" && p.is_active);
  const realActiveAdmins = activeAdmins.filter((p) => !TEST_RE.test(p.email || authById.get(p.id)?.email || ""));
  console.log(`\n=== GUARD ===`);
  console.log(`  active admins total: ${activeAdmins.length} (${activeAdmins.map((p) => p.email).join(", ")})`);
  console.log(`  real (non-test) active admins: ${realActiveAdmins.length} (${realActiveAdmins.map((p) => p.email).join(", ")})`);
  console.log(`\n(READ-ONLY — nothing was modified.)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
