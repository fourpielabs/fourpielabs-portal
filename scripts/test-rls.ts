/**
 * RLS verification suite (spec §6 P6).  Run: npm run test:rls
 *
 * Exercises the access model against the LINKED database as client / team / anon
 * and prints a pass/fail table. NON-DESTRUCTIVE to real data: every write it
 * attempts is expected to be DENIED; any that unexpectedly succeeds is deleted
 * and reported as a FAIL. Temp fixtures it creates (one unassigned client, a few
 * hidden rows) are cleaned up at the end.
 *
 * Exit code is non-zero if any check fails.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const PW = "FourPie!Demo2026";

type Row = { group: string; check: string; pass: boolean; detail?: string };
const results: Row[] = [];
const rec = (group: string, check: string, pass: boolean, detail = "") =>
  results.push({ group, check, pass, detail });

// tables that carry a client_id and a client/team SELECT path
const CLIENT_TABLES = [
  "checklist_items", "milestones", "deliverables", "content_items",
  "metric_definitions", "metric_entries", "competitors", "call_types",
  "call_recordings", "meeting_notes", "reports", "updates", "files",
];
// admin-only tables clients/team must never read
const RESTRICTED_TABLES = ["invitations", "audit_log"];

function insertPayloads(clientId: string, defId: string) {
  return [
    { t: "checklist_items", row: { client_id: clientId, kind: "onboarding", title: "rls" } },
    { t: "milestones", row: { client_id: clientId, title: "rls" } },
    { t: "deliverables", row: { client_id: clientId, title: "rls" } },
    { t: "content_items", row: { client_id: clientId, title: "rls" } },
    { t: "metric_definitions", row: { client_id: clientId, key: `rls_${Date.now()}`, label: "rls" } },
    { t: "metric_entries", row: { client_id: clientId, definition_id: defId, period: "2026-09-01", value_numeric: 1 } },
    { t: "competitors", row: { client_id: clientId, name_or_handle: "rls" } },
    { t: "call_types", row: { client_id: clientId, name: "rls" } },
    { t: "call_recordings", row: { client_id: clientId, call_type: "rls" } },
    { t: "meeting_notes", row: { client_id: clientId, title: "rls" } },
    { t: "reports", row: { client_id: clientId, title: "rls" } },
    { t: "updates", row: { client_id: clientId, title: "rls" } },
    { t: "files", row: { client_id: clientId, name: "rls", storage_path: `${clientId}/rls.txt` } },
    { t: "invitations", row: { email: "rls@example.com", role: "team" } },
    { t: "audit_log", row: { action: "rls.attempt" } },
  ];
}

async function defIdFor(clientId: string): Promise<string> {
  const { data } = await admin
    .from("metric_definitions")
    .select("id")
    .eq("client_id", clientId)
    .limit(1)
    .single();
  return data!.id;
}

async function expectNoRows(
  db: SupabaseClient,
  group: string,
  table: string,
  clientId: string | null,
) {
  let q = db.from(table).select("id");
  if (clientId) q = q.eq("client_id", clientId);
  const { data, error } = await q;
  // 0 rows (or an error) == denied/blocked
  const pass = !!error || (data?.length ?? 0) === 0;
  rec(group, `read ${table}`, pass, error ? "error" : `${data?.length ?? 0} rows`);
}

async function expectWriteDenied(
  db: SupabaseClient,
  group: string,
  table: string,
  row: Record<string, unknown>,
) {
  const { data, error } = await db.from(table).insert(row).select("id");
  const inserted = data?.[0]?.id as string | undefined;
  if (inserted) {
    // unexpected success — clean up and FAIL
    await admin.from(table).delete().eq("id", inserted);
    rec(group, `write ${table}`, false, "INSERT SUCCEEDED");
  } else {
    rec(group, `write ${table}`, !!error, error?.code ?? "no-insert");
  }
}

async function main() {
  // --- fixtures -------------------------------------------------------------
  const { data: premier } = await admin.from("clients").select("id").eq("slug", "premier-painting").single();
  const { data: pulse } = await admin.from("clients").select("id").eq("slug", "coastal-tours").single();
  const premierId = premier!.id;
  const pulseId = pulse!.id;

  await admin.from("clients").delete().eq("slug", "rls-unassigned");
  const { data: un } = await admin
    .from("clients")
    .insert({ name: "RLS Unassigned", slug: "rls-unassigned", industry: "other_local_service", program: "foundation", status: "onboarding" })
    .select("id")
    .single();
  const unId = un!.id; // demo-team is NOT assigned to this client

  const premierDef = await defIdFor(premierId);
  const unDef = await defIdFor(unId);

  // hidden/unpublished fixtures on premier
  await admin.from("deliverables").insert({ client_id: premierId, title: "RLSHIDE-d", type: "other", status: "pending", visible_to_client: false });
  await admin.from("reports").insert({ client_id: premierId, title: "RLSHIDE-r", published: false });

  // approval-RPC fixtures: a VISIBLE deliverable on premier (the client's own), a
  // cross-client one on pulse, and the hidden premier one looked up by title.
  const { data: apprDel } = await admin
    .from("deliverables")
    .insert({ client_id: premierId, title: "RLSAPPR-d", type: "other", status: "needs_review", visible_to_client: true })
    .select("id")
    .single();
  const apprId = apprDel!.id;
  const { data: xcDel } = await admin
    .from("deliverables")
    .insert({ client_id: pulseId, title: "RLSXC-d", type: "other", status: "needs_review", visible_to_client: true })
    .select("id")
    .single();
  const xcId = xcDel!.id;
  const { data: hideDel } = await admin
    .from("deliverables").select("id").eq("client_id", premierId).eq("title", "RLSHIDE-d").single();
  const hideId = hideDel!.id;

  // ====================== AS CLIENT (demo-client / premier) =================
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  await client.auth.signInWithPassword({ email: "demo-client@example.com", password: PW });

  // cross-client reads (pulse data) must be 0
  for (const t of CLIENT_TABLES) await expectNoRows(client, "client", t, pulseId);
  await expectNoRows(client, "client", "clients", null); // base clients table
  for (const t of RESTRICTED_TABLES) await expectNoRows(client, "client", t, null);

  // writes to every table denied (own client)
  for (const { t, row } of insertPayloads(premierId, premierDef)) {
    await expectWriteDenied(client, "client", t, row);
  }

  // hidden/unpublished invisible
  {
    const { data: d } = await client.from("deliverables").select("title");
    const { data: r } = await client.from("reports").select("title");
    const hiddenGone =
      !(d ?? []).some((x) => x.title?.includes("RLSHIDE")) &&
      !(r ?? []).some((x) => x.title?.includes("RLSHIDE"));
    rec("client", "hidden/unpublished invisible", hiddenGone);
  }

  // RPC toggles
  const { data: items } = await admin
    .from("checklist_items")
    .select("id, kind, assignee")
    .eq("client_id", premierId);
  const clientItem = items!.find((i) => i.kind === "onboarding" && i.assignee === "client")!;
  const teamItem = items!.find((i) => i.kind === "onboarding" && i.assignee === "team")!;
  const offItem = items!.find((i) => i.kind === "offboarding")!;
  {
    const ok = await client.rpc("toggle_checklist_item", { item_id: clientItem.id });
    rec("client", "RPC toggle client item allowed", !ok.error);
    if (!ok.error) await client.rpc("toggle_checklist_item", { item_id: clientItem.id }); // restore
    const tt = await client.rpc("toggle_checklist_item", { item_id: teamItem.id });
    rec("client", "RPC toggle TEAM item denied", !!tt.error);
    const oo = await client.rpc("toggle_checklist_item", { item_id: offItem.id });
    rec("client", "RPC toggle OFFBOARDING item denied", !!oo.error);
  }

  // --- deliverable approval (the NEW client write path) ---------------------
  {
    const cols =
      "id, client_id, title, description, type, status, due_date, preview_url, file_path, visible_to_client, delivered_at, created_by, created_at, updated_at, client_approved_at";
    const { data: before } = await admin.from("deliverables").select(cols).eq("id", apprId).single();

    // 1. client CAN approve own visible deliverable via the RPC
    const ap = await client.rpc("set_deliverable_approval", { deliverable_id: apprId, approved: true });
    rec("client-write", "approve OWN visible deliverable allowed", !ap.error, ap.error?.message ?? "");

    // 2. only client_approved_at changed (updated_at is the system trigger column)
    const { data: after } = await admin.from("deliverables").select(cols).eq("id", apprId).single();
    const changed = Object.keys(before ?? {}).filter(
      (k) => JSON.stringify((before as Record<string, unknown>)[k]) !== JSON.stringify((after as Record<string, unknown>)[k]),
    );
    const allowed = new Set(["client_approved_at", "updated_at"]);
    const onlyApproval =
      changed.includes("client_approved_at") &&
      changed.every((k) => allowed.has(k)) &&
      !!(after as Record<string, unknown>).client_approved_at;
    rec("client-write", "approve mutated ONLY client_approved_at", onlyApproval, `changed: ${changed.join(",") || "none"}`);

    // 3. direct UPDATE denied (no client UPDATE policy → error or 0 rows)
    const upd = await client.from("deliverables").update({ client_approved_at: null }).eq("id", apprId).select("id");
    rec("client-write", "direct UPDATE deliverables denied", !!upd.error || (upd.data?.length ?? 0) === 0, upd.error?.code ?? `${upd.data?.length ?? 0} rows`);

    // 4. cross-client approval denied
    const xc = await client.rpc("set_deliverable_approval", { deliverable_id: xcId, approved: true });
    rec("client-write", "approve CROSS-CLIENT deliverable denied", !!xc.error);

    // 5. hidden (not visible_to_client) approval denied
    const hd = await client.rpc("set_deliverable_approval", { deliverable_id: hideId, approved: true });
    rec("client-write", "approve HIDDEN deliverable denied", !!hd.error);

    await admin.from("deliverables").update({ client_approved_at: null }).eq("id", apprId);
  }

  // ====================== AS TEAM (demo-team, unassigned client) ============
  const team = createClient(url, anonKey, { auth: { persistSession: false } });
  await team.auth.signInWithPassword({ email: "demo-team@example.com", password: PW });

  for (const t of CLIENT_TABLES) await expectNoRows(team, "team→unassigned", t, unId);
  for (const { t, row } of insertPayloads(unId, unDef)) {
    await expectWriteDenied(team, "team→unassigned", t, row);
  }
  {
    const { error } = await team.storage.from("client-files").createSignedUrl(`${unId}/x.txt`, 60);
    rec("team→unassigned", "storage sign denied", !!error);
  }
  {
    const tap = await team.rpc("set_deliverable_approval", { deliverable_id: apprId, approved: true });
    rec("client-write", "TEAM approve deliverable denied (client-only)", !!tap.error);
  }

  // ====================== AS ANON ===========================================
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  for (const t of [...CLIENT_TABLES, "clients", ...RESTRICTED_TABLES])
    await expectNoRows(anon, "anon", t, null);
  for (const { t, row } of insertPayloads(premierId, premierDef)) {
    await expectWriteDenied(anon, "anon", t, row);
  }
  {
    const aoff = await anon.rpc("toggle_checklist_item", { item_id: clientItem.id });
    rec("anon", "RPC toggle denied", !!aoff.error);
    const { error } = await anon.storage.from("client-files").createSignedUrl(`${premierId}/x.txt`, 60);
    rec("anon", "storage sign denied", !!error);
    const aap = await anon.rpc("set_deliverable_approval", { deliverable_id: apprId, approved: true });
    rec("client-write", "ANON approve deliverable denied", !!aap.error);
  }

  // --- cleanup --------------------------------------------------------------
  await admin.from("deliverables").delete().eq("client_id", premierId).like("title", "RLSHIDE%");
  await admin.from("deliverables").delete().eq("client_id", premierId).like("title", "RLSAPPR%");
  await admin.from("deliverables").delete().eq("client_id", pulseId).like("title", "RLSXC%");
  await admin.from("reports").delete().eq("client_id", premierId).like("title", "RLSHIDE%");
  await admin.from("clients").delete().eq("id", unId);

  // --- report ---------------------------------------------------------------
  const failed = results.filter((r) => !r.pass);
  console.log("\n=== RLS VERIFICATION ===\n");
  const width = Math.max(...results.map((r) => r.group.length)) + 2;
  for (const r of results) {
    const mark = r.pass ? "PASS" : "FAIL";
    console.log(`${r.pass ? "✓" : "✗"} [${mark}] ${r.group.padEnd(width)} ${r.check}${r.detail ? `  (${r.detail})` : ""}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) {
    console.log("\nFAILURES:");
    for (const f of failed) console.log(`  - [${f.group}] ${f.check} ${f.detail}`);
    process.exit(1);
  }
  console.log("All RLS checks passed. ✓");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
