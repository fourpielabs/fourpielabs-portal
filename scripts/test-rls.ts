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
  "call_recordings", "call_bookings", "meeting_notes", "reports", "updates", "files",
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
    { t: "call_bookings", row: { client_id: clientId, external_id: `rls_bk_${clientId}`, title: "rls" } },
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

  // --- projects fixtures ----------------------------------------------------
  // A PROJECT client (no seed) + its own client user; plus a project on premier
  // (a PROGRAM client) for cross-client and team-assigned checks.
  await admin.from("clients").delete().eq("slug", "rls-project");
  const { data: proj } = await admin
    .from("clients")
    .insert({ name: "RLS Project", slug: "rls-project", industry: "other_local_service", program: "foundation", status: "onboarding", client_type: "project" })
    .select("id")
    .single();
  const projId = proj!.id;
  const { data: premierProject } = await admin
    .from("projects")
    .insert({ client_id: premierId, title: "RLSPROJ-premier" })
    .select("id")
    .single();
  const premierProjectId = premierProject!.id;

  // project-client auth user — handle_new_user seeds its profile from metadata
  const projEmail = "rls-project-client@example.com";
  {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existing = list?.users.find((u) => u.email === projEmail);
    if (existing) await admin.auth.admin.deleteUser(existing.id);
  }
  const { error: cuErr } = await admin.auth.admin.createUser({
    email: projEmail,
    password: PW,
    email_confirm: true,
    user_metadata: { role: "client", client_id: projId, full_name: "RLS Project Client" },
  });
  if (cuErr) throw cuErr;

  // --- messaging fixtures ---------------------------------------------------
  // threads are auto-seeded per client (trg_seed_client_threads) + backfilled for
  // the demo clients; look up the ones we exercise.
  const tid = async (cid: string, type: "client_shared" | "internal") => {
    const { data } = await admin.from("threads").select("id").eq("client_id", cid).eq("type", type).single();
    return data!.id as string;
  };
  const premierShared = await tid(premierId, "client_shared");
  const premierInternal = await tid(premierId, "internal");
  const pulseShared = await tid(pulseId, "client_shared");
  const unShared = await tid(unId, "client_shared");
  const { data: teamProf } = await admin.from("profiles").select("id").eq("email", "demo-team@example.com").single();
  const teamUid = teamProf!.id as string;
  // seed one message in each premier thread (service-role insert bypasses RLS)
  await admin.from("messages").delete().eq("client_id", premierId).like("body", "RLS%");
  await admin.from("messages").insert([
    { thread_id: premierShared, client_id: premierId, thread_type: "client_shared", body: "RLSMSG-shared" },
    { thread_id: premierInternal, client_id: premierId, thread_type: "internal", body: "RLSMSG-internal", attachment_path: `${premierId}/rls-internal.bin`, attachment_name: "rls-internal.bin" },
  ]);

  // --- notifications fixtures (service-role insert; no insert policy) --------
  const { data: clientProf } = await admin.from("profiles").select("id").eq("email", "demo-client@example.com").single();
  const clientProfileId = clientProf!.id as string;
  await admin.from("notifications").delete().like("title", "RLSNOTE%");
  const { data: cNote } = await admin.from("notifications").insert({ user_id: clientProfileId, type: "message", title: "RLSNOTE-client" }).select("id").single();
  const { data: tNote } = await admin.from("notifications").insert({ user_id: teamUid, type: "message", title: "RLSNOTE-team" }).select("id").single();
  const clientNoteId = cNote!.id as string;
  const teamNoteId = tNote!.id as string;

  // --- notification_preferences fixtures (4e) -------------------------------
  await admin.from("notification_preferences").delete().in("user_id", [clientProfileId, teamUid]);
  await admin.from("notification_preferences").insert({ user_id: teamUid, email_message: false });

  // --- tasks fixtures (5a) --------------------------------------------------
  // a VISIBLE task on premier (demo-client's own), a HIDDEN (staff-only) one, and
  // a cross-client task on pulse. Plus an "arbitrary" user OUTSIDE premier's circle
  // (the project client's own user) and the premier shared/internal message ids
  // (for the create_task source-message boundary guard).
  await admin.from("tasks").delete().like("title", "RLSTASK%");
  const { data: visTask } = await admin.from("tasks")
    .insert({ client_id: premierId, title: "RLSTASK-visible", visible_to_client: true }).select("id").single();
  const visTaskId = visTask!.id as string;
  // hidden (staff-only) + cross-client fixture rows — ids used by the update_task
  // cross-client / invisible denial checks.
  const { data: hidTask } = await admin.from("tasks")
    .insert({ client_id: premierId, title: "RLSTASK-hidden", visible_to_client: false }).select("id").single();
  const hidTaskId = hidTask!.id as string;
  const { data: xcTask } = await admin.from("tasks")
    .insert({ client_id: pulseId, title: "RLSTASK-cross", visible_to_client: true }).select("id").single();
  const xcTaskId = xcTask!.id as string;
  const { data: arbProf } = await admin.from("profiles").select("id").eq("email", projEmail).single();
  const arbitraryUid = arbProf!.id as string; // belongs to the project client → NOT in premier's circle

  // --- task subtasks fixtures (Phase 4) ------------------------------------
  // one checklist item under each of the three tasks (visible-own / hidden-own /
  // cross-client) — item read+write visibility must FOLLOW the parent task.
  await admin.from("task_checklist_items").delete().like("title", "RLSSUB%");
  const seedSub = async (taskId: string, title: string) =>
    (await admin.from("task_checklist_items").insert({ task_id: taskId, title }).select("id").single()).data!.id as string;
  const visSubId = await seedSub(visTaskId, "RLSSUB-visible");
  const hidSubId = await seedSub(hidTaskId, "RLSSUB-hidden");
  const xcSubId = await seedSub(xcTaskId, "RLSSUB-cross");
  // a task + item on the UNASSIGNED client — demo-team must read/write neither.
  const { data: unTask } = await admin.from("tasks")
    .insert({ client_id: unId, title: "RLSTASK-unassigned", visible_to_client: true }).select("id").single();
  const unTaskId = unTask!.id as string;
  const unSubId = await seedSub(unTaskId, "RLSSUB-unassigned");

  // --- call_bookings fixtures (Cal.com sync) --------------------------------
  // a VISIBLE booking on premier (demo-client's own), a HIDDEN one, and a
  // cross-client booking on pulse. Service-role insert (the webhook's path).
  await admin.from("call_bookings").delete().like("external_id", "RLSBK%");
  await admin.from("call_bookings").insert([
    { client_id: premierId, external_id: "RLSBK-visible", title: "RLSBK visible", status: "booked", visible_to_client: true },
    { client_id: premierId, external_id: "RLSBK-hidden", title: "RLSBK hidden", status: "booked", visible_to_client: false },
    { client_id: pulseId, external_id: "RLSBK-cross", title: "RLSBK cross", status: "booked", visible_to_client: true },
  ]);
  const { data: sharedMsg } = await admin.from("messages").select("id").eq("client_id", premierId).eq("body", "RLSMSG-shared").single();
  const { data: internalMsg } = await admin.from("messages").select("id").eq("client_id", premierId).eq("body", "RLSMSG-internal").single();
  const sharedMsgId = sharedMsg!.id as string;
  const internalMsgId = internalMsg!.id as string;

  // --- edit/delete fixtures (Batch 2) --------------------------------------
  // messages with KNOWN authors: client-authored shared (edit + delete), a
  // staff-authored shared (author-only checks), and a staff-authored internal
  // (the boundary). Service-role insert bypasses RLS.
  await admin.from("messages").delete().eq("client_id", premierId).like("body", "RLSED-%");
  const seedMsg = async (thread: string, type: string, author: string, body: string) =>
    (await admin.from("messages").insert({ thread_id: thread, client_id: premierId, thread_type: type, author_id: author, body }).select("id").single()).data!.id as string;
  const mClientEdit = await seedMsg(premierShared, "client_shared", clientProfileId, "RLSED-client-edit");
  const mClientDel = await seedMsg(premierShared, "client_shared", clientProfileId, "RLSED-client-del");
  const mStaffShared = await seedMsg(premierShared, "client_shared", teamUid, "RLSED-staff-shared");
  const mIntMsg = await seedMsg(premierInternal, "internal", teamUid, "RLSED-internal");

  // ====================== AS CLIENT (demo-client / premier) =================
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  await client.auth.signInWithPassword({ email: "demo-client@example.com", password: PW });
  const clientUid = (await client.auth.getUser()).data.user?.id as string;

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

  // --- projects: client write path (create_project / update_project RPCs) ---
  const projClient = createClient(url, anonKey, { auth: { persistSession: false } });
  await projClient.auth.signInWithPassword({ email: projEmail, password: PW });
  {
    // a PROGRAM client (demo-client / premier) cannot create projects — type gate
    const pg = await client.rpc("create_project", { p_title: "RLS should fail", p_description: "" });
    rec("projects", "PROGRAM client create denied (type gate)", !!pg.error, pg.error?.message ?? "");

    // project client CAN create its OWN project via the RPC
    const cr = await projClient.rpc("create_project", { p_title: "RLSPROJ-own", p_description: "desc" });
    rec("projects", "project client create OWN allowed", !cr.error, cr.error?.message ?? "");
    const newProj = (Array.isArray(cr.data) ? cr.data[0] : cr.data) as { id: string } | null;

    // project client CAN update its OWN project's TITLE + DESCRIPTION (the client
    // RPC no longer accepts status — status is staff-only).
    let updOk = false, updErr = "";
    if (newProj?.id) {
      const up = await projClient.rpc("update_project", { p_id: newProj.id, p_title: "RLSPROJ-own2", p_description: "d2" });
      updOk = !up.error; updErr = up.error?.message ?? "";
    }
    rec("projects", "project client update OWN title/desc allowed", updOk, updErr);

    // SECURITY — status is staff-only; a client must NOT be able to change it.
    // (a) the status-settable overload was DROPPED → passing p_status is rejected
    //     (PostgREST finds no update_project matching {p_id,p_title,p_description,p_status}).
    if (newProj?.id) {
      const withStatus = await projClient.rpc("update_project", {
        p_id: newProj.id, p_title: "RLSPROJ-hack", p_description: "x", p_status: "complete",
      });
      rec("projects", "client update_project(p_status) REJECTED — param dropped", !!withStatus.error, withStatus.error?.message ?? "(unexpectedly succeeded)");
    }
    // (b) a normal title/desc edit leaves status UNTOUCHED (stays 'proposed' from
    //     create_project) — the client can never move status through the RPC.
    if (newProj?.id) {
      await projClient.rpc("update_project", { p_id: newProj.id, p_title: "RLSPROJ-own3", p_description: "d3" });
      const { data: after } = await admin.from("projects").select("status").eq("id", newProj.id).single();
      rec("projects", "client edit leaves status unchanged (still 'proposed')", after?.status === "proposed", `status=${after?.status ?? "?"}`);
    }

    // PHASE 3 — client CAN set priority + target_date (advanced options), and these
    // must NOT become a status / staff-due_date escalation vector.
    if (newProj?.id) {
      // admin stamps a staff due_date first → prove the client edit preserves it.
      await admin.from("projects").update({ due_date: "2026-12-31" }).eq("id", newProj.id);
      const setOpts = await projClient.rpc("update_project", {
        p_id: newProj.id, p_title: "RLSPROJ-opts", p_description: "d4",
        p_priority: "urgent", p_target_date: "2026-09-01",
      });
      rec("projects", "client update_project priority+target_date allowed", !setOpts.error, setOpts.error?.message ?? "");
      const { data: opt } = await admin.from("projects")
        .select("priority, target_date, status, due_date").eq("id", newProj.id).single();
      rec("projects", "client set priority persisted (urgent)", opt?.priority === "urgent", `priority=${opt?.priority ?? "?"}`);
      rec("projects", "client set target_date persisted", opt?.target_date === "2026-09-01", `target_date=${opt?.target_date ?? "?"}`);
      rec("projects", "client priority/target edit did NOT touch status", opt?.status === "proposed", `status=${opt?.status ?? "?"}`);
      rec("projects", "client priority/target edit did NOT touch staff due_date", opt?.due_date === "2026-12-31", `due_date=${opt?.due_date ?? "?"}`);

      // passing p_due_date is rejected — no such RPC param (due_date is staff-only).
      const withDue = await projClient.rpc("update_project", {
        p_id: newProj.id, p_title: "RLSPROJ-hack2", p_description: "x", p_due_date: "2026-01-01",
      });
      rec("projects", "client update_project(p_due_date) REJECTED — no such param", !!withDue.error, withDue.error?.message ?? "(unexpectedly succeeded)");

      // create_project also carries priority + target_date, never status/due_date.
      const crOpts = await projClient.rpc("create_project", {
        p_title: "RLSPROJ-opts2", p_description: "", p_priority: "high", p_target_date: "2026-10-15",
      });
      const crRow = (Array.isArray(crOpts.data) ? crOpts.data[0] : crOpts.data) as
        { priority?: string; status?: string; due_date?: string | null } | null;
      rec("projects", "client create_project with priority+target_date allowed", !crOpts.error, crOpts.error?.message ?? "");
      rec("projects", "created project: priority=high, status=proposed, no due_date",
        crRow?.priority === "high" && crRow?.status === "proposed" && !crRow?.due_date,
        `priority=${crRow?.priority} status=${crRow?.status} due=${crRow?.due_date ?? "null"}`);
    }

    // direct INSERT denied — no client INSERT policy on projects
    const di = await projClient.from("projects").insert({ client_id: projId, title: "RLS direct" }).select("id");
    rec("projects", "project client direct INSERT denied", !!di.error || (di.data?.length ?? 0) === 0, di.error?.code ?? `${di.data?.length ?? 0} rows`);
    if (di.data?.[0]?.id) await admin.from("projects").delete().eq("id", di.data[0].id);

    // direct UPDATE of status denied — no client UPDATE policy (the RPC is the only write path)
    if (newProj?.id) {
      const dsu = await projClient.from("projects").update({ status: "complete" }).eq("id", newProj.id).select("id");
      rec("projects", "project client direct status UPDATE denied", !!dsu.error || (dsu.data?.length ?? 0) === 0, dsu.error?.code ?? `${dsu.data?.length ?? 0} rows`);
    }

    // update ANOTHER client's project denied (premier's project)
    const xu = await projClient.rpc("update_project", { p_id: premierProjectId, p_title: "RLS hijack", p_description: "" });
    rec("projects", "project client update CROSS-CLIENT denied", !!xu.error, xu.error?.message ?? "");

    // SELECT scoping: own visible, cross-client invisible
    const ownSel = await projClient.from("projects").select("id").eq("client_id", projId);
    rec("projects", "project client reads OWN projects", !ownSel.error && (ownSel.data?.length ?? 0) >= 1, `${ownSel.data?.length ?? 0} rows`);
    const xSel = await projClient.from("projects").select("id").eq("client_id", premierId);
    rec("projects", "project client cross-client read 0", (xSel.data?.length ?? 0) === 0, `${xSel.data?.length ?? 0} rows`);

    // deliverable↔project link is a STAFF path — a client has no deliverable write
    const clientLink = await projClient
      .from("deliverables")
      .update({ project_id: premierProjectId })
      .eq("id", apprId)
      .select("id");
    rec(
      "projects",
      "project client cannot link deliverable→project (direct UPDATE denied)",
      !!clientLink.error || (clientLink.data?.length ?? 0) === 0,
      clientLink.error?.code ?? `${clientLink.data?.length ?? 0} rows`,
    );
  }

  // --- messaging: client (demo-client / premier) ----------------------------
  {
    // reads OWN client_shared thread only — internal invisible
    const { data: cThreads } = await client.from("threads").select("id, type");
    rec(
      "messaging",
      "client reads OWN client_shared thread only (internal invisible)",
      (cThreads?.length ?? 0) === 1 && cThreads?.[0]?.type === "client_shared",
      `${cThreads?.length ?? 0} thread(s)`,
    );
    const { data: cx } = await client.from("threads").select("id").eq("client_id", pulseId);
    rec("messaging", "client cross-client threads 0", (cx?.length ?? 0) === 0, `${cx?.length ?? 0} rows`);

    // messages: sees shared-thread, NOT internal-thread, NOT cross-client
    const { data: cMsgs } = await client.from("messages").select("body");
    const bodies = (cMsgs ?? []).map((m) => m.body);
    rec("messaging", "client reads shared-thread messages", bodies.includes("RLSMSG-shared"), "");
    rec("messaging", "client CANNOT read internal-thread messages", !bodies.includes("RLSMSG-internal"), "");
    // 5d: a client can't read an INTERNAL message's attachment_path (the columns
    // inherit the row's RLS — messages_client_select is shared-only)
    const cAtt = await client.from("messages").select("attachment_path").eq("id", internalMsgId);
    rec("messaging", "client CANNOT read internal message attachment_path", (cAtt.data?.length ?? 0) === 0, `${cAtt.data?.length ?? 0} rows`);
    const { data: cxMsg } = await client.from("messages").select("id").eq("client_id", pulseId);
    rec("messaging", "client cross-client messages 0", (cxMsg?.length ?? 0) === 0, `${cxMsg?.length ?? 0} rows`);

    // post via RPC: OWN shared allowed; OWN internal denied; cross-client denied
    const pShared = await client.rpc("post_message", { p_thread_id: premierShared, p_body: "RLSPOST-shared" });
    rec("messaging", "client post to OWN shared thread allowed", !pShared.error, pShared.error?.message ?? "");
    const pInternal = await client.rpc("post_message", { p_thread_id: premierInternal, p_body: "RLSPOST-internal" });
    rec("messaging", "client post to OWN internal thread DENIED", !!pInternal.error, pInternal.error?.message ?? "");
    const pCross = await client.rpc("post_message", { p_thread_id: pulseShared, p_body: "RLSPOST-cross" });
    rec("messaging", "client post to CROSS-CLIENT thread DENIED", !!pCross.error, pCross.error?.message ?? "");

    // edit/delete (Batch 2): author-only + the internal boundary, BOTH ways
    const eInt = await client.rpc("edit_message", { p_message_id: mIntMsg, p_body: "hijack" });
    rec("messaging", "client edit INTERNAL message DENIED (boundary)", !!eInt.error, eInt.error?.message ?? "");
    const dInt = await client.rpc("delete_message", { p_message_id: mIntMsg });
    rec("messaging", "client delete INTERNAL message DENIED (boundary)", !!dInt.error, dInt.error?.message ?? "");
    const eOther = await client.rpc("edit_message", { p_message_id: mStaffShared, p_body: "hijack" });
    rec("messaging", "client edit ANOTHER author's message DENIED", !!eOther.error, eOther.error?.message ?? "");
    const dOther = await client.rpc("delete_message", { p_message_id: mStaffShared });
    rec("messaging", "client delete ANOTHER author's message DENIED", !!dOther.error, dOther.error?.message ?? "");
    const eOwn = await client.rpc("edit_message", { p_message_id: mClientEdit, p_body: "RLSED-client-edit (edited)" });
    rec("messaging", "client edits OWN shared message allowed", !eOwn.error, eOwn.error?.message ?? "");
    const dOwn = await client.rpc("delete_message", { p_message_id: mClientDel });
    rec("messaging", "client deletes OWN shared message allowed", !dOwn.error, dOwn.error?.message ?? "");
    const cGone = await client.from("messages").select("id").eq("id", mClientDel);
    rec("messaging", "soft-deleted message absent from CLIENT read", (cGone.data?.length ?? 0) === 0, `${cGone.data?.length ?? 0} rows`);
    const edu = await client.from("messages").update({ body: "x" }).eq("id", mStaffShared).select("id");
    rec("messaging", "client direct UPDATE messages still DENIED", !!edu.error || (edu.data?.length ?? 0) === 0, edu.error?.code ?? `${edu.data?.length ?? 0} rows`);

    // direct writes denied (no client write policy on any of these)
    const di = await client.from("messages").insert({ thread_id: premierShared, client_id: premierId, thread_type: "client_shared", body: "RLSDIRECT" }).select("id");
    rec("messaging", "client direct-INSERT messages DENIED", !!di.error || (di.data?.length ?? 0) === 0, di.error?.code ?? `${di.data?.length ?? 0} rows`);
    const dt = await client.from("threads").insert({ client_id: premierId, type: "client_shared" }).select("id");
    rec("messaging", "client direct-INSERT threads denied", !!dt.error || (dt.data?.length ?? 0) === 0, dt.error?.code ?? `${dt.data?.length ?? 0} rows`);
    const dtr = await client.from("thread_reads").insert({ thread_id: premierShared, user_id: clientUid }).select("thread_id");
    rec("messaging", "client direct-write thread_reads denied", !!dtr.error || (dtr.data?.length ?? 0) === 0, dtr.error?.code ?? `${dtr.data?.length ?? 0} rows`);

    // mark_thread_read: own shared allowed; internal/cross denied
    const mrShared = await client.rpc("mark_thread_read", { p_thread_id: premierShared });
    rec("messaging", "client mark_thread_read OWN shared allowed", !mrShared.error, mrShared.error?.message ?? "");
    const mrInternal = await client.rpc("mark_thread_read", { p_thread_id: premierInternal });
    rec("messaging", "client mark_thread_read internal DENIED", !!mrInternal.error, mrInternal.error?.message ?? "");
    const mrCross = await client.rpc("mark_thread_read", { p_thread_id: pulseShared });
    rec("messaging", "client mark_thread_read cross-client DENIED", !!mrCross.error, mrCross.error?.message ?? "");

    // reads OWN thread_reads only (admin seeds a team read row that must stay hidden)
    await admin.from("thread_reads").upsert({ thread_id: premierShared, user_id: teamUid });
    const { data: trRows } = await client.from("thread_reads").select("user_id");
    const onlyOwn = (trRows ?? []).length >= 1 && (trRows ?? []).every((r) => r.user_id === clientUid);
    rec("messaging", "client reads OWN thread_reads only", onlyOwn, `${trRows?.length ?? 0} row(s)`);
  }

  // --- notifications: client (own-only read/update; no direct insert) -------
  {
    const { data: own } = await client.from("notifications").select("title, user_id");
    const ownOnly = (own ?? []).length >= 1 && (own ?? []).every((n) => n.user_id === clientUid);
    rec("notifications", "client reads ONLY own notifications", ownOnly, `${own?.length ?? 0} row(s)`);
    rec("notifications", "client cannot read another user's notification", !(own ?? []).some((n) => n.title === "RLSNOTE-team"), "");

    const mr = await client.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", clientNoteId).select("id");
    rec("notifications", "client marks OWN notification read", !mr.error && (mr.data?.length ?? 0) === 1, mr.error?.code ?? `${mr.data?.length ?? 0} rows`);
    const mrx = await client.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", teamNoteId).select("id");
    rec("notifications", "client cannot mark another user's read", !!mrx.error || (mrx.data?.length ?? 0) === 0, mrx.error?.code ?? `${mrx.data?.length ?? 0} rows`);
    const di = await client.from("notifications").insert({ user_id: clientUid, type: "message", title: "RLSNOTE-direct" }).select("id");
    rec("notifications", "client direct-INSERT notifications DENIED", !!di.error || (di.data?.length ?? 0) === 0, di.error?.code ?? `${di.data?.length ?? 0} rows`);
  }

  // --- notification_preferences (4e): self-manage own only ------------------
  {
    const { data: own } = await client.from("notification_preferences").select("user_id");
    rec("notif_prefs", "client reads OWN prefs only (team row invisible)", (own ?? []).every((r) => r.user_id === clientUid), `${own?.length ?? 0} row(s)`);
    const xr = await client.from("notification_preferences").select("user_id").eq("user_id", teamUid);
    rec("notif_prefs", "client cross-user prefs read 0", (xr.data?.length ?? 0) === 0, `${xr.data?.length ?? 0} rows`);

    const ins = await client.from("notification_preferences").upsert({ user_id: clientUid, email_message: false }, { onConflict: "user_id" }).select("user_id");
    rec("notif_prefs", "client upserts OWN prefs (insert/update)", !ins.error && (ins.data?.length ?? 0) === 1, ins.error?.code ?? `${ins.data?.length ?? 0} rows`);
    const xu = await client.from("notification_preferences").update({ email_message: true }).eq("user_id", teamUid).select("user_id");
    rec("notif_prefs", "client cannot UPDATE another user's prefs", !!xu.error || (xu.data?.length ?? 0) === 0, xu.error?.code ?? `${xu.data?.length ?? 0} rows`);
    const xi = await client.from("notification_preferences").insert({ user_id: teamUid, email_message: true }).select("user_id");
    rec("notif_prefs", "client cannot INSERT prefs for another user", !!xi.error || (xi.data?.length ?? 0) === 0, xi.error?.code ?? `${xi.data?.length ?? 0} rows`);
  }

  // --- tasks (5a): client write path (create_task / update_task_status RPCs) -
  {
    // reads OWN-client VISIBLE tasks only — hidden (staff-only) invisible; cross-client 0
    const { data: cTasks } = await client.from("tasks").select("title");
    const titles = (cTasks ?? []).map((t) => t.title);
    rec("tasks", "client reads OWN-client visible tasks only", titles.includes("RLSTASK-visible") && !titles.includes("RLSTASK-hidden") && !titles.includes("RLSTASK-cross"), `${cTasks?.length ?? 0} row(s)`);
    const xr = await client.from("tasks").select("id").eq("client_id", pulseId);
    rec("tasks", "client cross-client tasks read 0", (xr.data?.length ?? 0) === 0, `${xr.data?.length ?? 0} rows`);

    // direct writes denied — no client INSERT/UPDATE policy
    const di = await client.from("tasks").insert({ client_id: premierId, title: "RLSTASK-direct" }).select("id");
    rec("tasks", "client direct INSERT tasks DENIED (42501)", !!di.error || (di.data?.length ?? 0) === 0, di.error?.code ?? `${di.data?.length ?? 0} rows`);
    if (di.data?.[0]?.id) await admin.from("tasks").delete().eq("id", di.data[0].id);
    const du = await client.from("tasks").update({ status: "done" }).eq("id", visTaskId).select("id");
    rec("tasks", "client direct UPDATE tasks denied", !!du.error || (du.data?.length ?? 0) === 0, du.error?.code ?? `${du.data?.length ?? 0} rows`);

    // create_task: own client, assignee = SELF (in circle) → allowed
    const crSelf = await client.rpc("create_task", { p_title: "RLSTASK-own", p_assignee: clientUid });
    rec("tasks", "create_task own-client (assign to self) allowed", !crSelf.error, crSelf.error?.message ?? "");
    // create_task: arbitrary NON-CIRCLE assignee → RAISES  ← the key proof
    const crArb = await client.rpc("create_task", { p_title: "RLSTASK-arb", p_assignee: arbitraryUid });
    rec("tasks", "create_task arbitrary non-circle assignee RAISES", !!crArb.error, crArb.error?.message ?? "");
    // create_task: source = INTERNAL message → RAISES (boundary at task source)
    const crInt = await client.rpc("create_task", { p_title: "RLSTASK-srcint", p_source_message_id: internalMsgId });
    rec("tasks", "create_task source=INTERNAL message RAISES (boundary)", !!crInt.error, crInt.error?.message ?? "");
    // create_task: source = own SHARED message → allowed
    const crShr = await client.rpc("create_task", { p_title: "RLSTASK-srcshared", p_source_message_id: sharedMsgId });
    rec("tasks", "create_task source=own shared message allowed", !crShr.error, crShr.error?.message ?? "");

    // SECURITY — task status is STAFF-ONLY now (update_task_status was DROPPED).
    // (a) the client status RPC is gone → a client calling it is rejected.
    const usGone = await client.rpc("update_task_status", { p_task_id: visTaskId, p_status: "done" });
    rec("tasks", "client update_task_status REJECTED — RPC dropped", !!usGone.error, usGone.error?.message ?? "(unexpectedly succeeded)");
    // (b) a client cannot move status by ANY path: staff sets 'done', then the client's
    //     RPC attempt + a direct UPDATE both fail and the status STAYS staff-set.
    await admin.from("tasks").update({ status: "done" }).eq("id", visTaskId);
    await client.rpc("update_task_status", { p_task_id: visTaskId, p_status: "todo" }); // RPC gone → errors
    await client.from("tasks").update({ status: "todo" }).eq("id", visTaskId);          // no client UPDATE policy → denied
    const { data: afterTask } = await admin.from("tasks").select("status").eq("id", visTaskId).single();
    rec("tasks", "client cannot move status — stays staff-set 'done'", afterTask?.status === "done", `status=${afterTask?.status ?? "?"}`);

    // --- update_task (Phase 2): client edits OWN task TITLE/DESC only, NO escalation ---
    const { data: beforeUt } = await admin.from("tasks")
      .select("status, assignee_id, due_date, visible_to_client").eq("id", visTaskId).single();
    const ut = await client.rpc("update_task", { p_task_id: visTaskId, p_title: "RLSTASK-edited", p_description: "edited by client" });
    rec("tasks", "client update_task own title/desc allowed", !ut.error, ut.error?.message ?? "");
    const { data: afterUt } = await admin.from("tasks")
      .select("title, description, status, assignee_id, due_date, visible_to_client").eq("id", visTaskId).single();
    rec("tasks", "client update_task changed title + description", afterUt?.title === "RLSTASK-edited" && afterUt?.description === "edited by client", `title=${afterUt?.title}`);
    rec("tasks", "client update_task did NOT escalate (status/assignee/due/visibility unchanged)",
      afterUt?.status === beforeUt?.status && afterUt?.assignee_id === beforeUt?.assignee_id && afterUt?.due_date === beforeUt?.due_date && afterUt?.visible_to_client === beforeUt?.visible_to_client,
      `status=${afterUt?.status} vis=${afterUt?.visible_to_client}`);
    const utXc = await client.rpc("update_task", { p_task_id: xcTaskId, p_title: "RLS hijack", p_description: "" });
    rec("tasks", "client update_task CROSS-CLIENT denied", !!utXc.error, utXc.error?.message ?? "");
    const utHid = await client.rpc("update_task", { p_task_id: hidTaskId, p_title: "RLS hijack", p_description: "" });
    rec("tasks", "client update_task INVISIBLE (staff-only) denied", !!utHid.error, utHid.error?.message ?? "");
  }

  // --- task subtasks (Phase 4): read + RPC writes FOLLOW the parent task -----
  {
    // READ: only the item under the OWN VISIBLE task is visible; invisible + cross 0.
    const { data: cSubs } = await client.from("task_checklist_items").select("title");
    const subTitles = (cSubs ?? []).map((s) => s.title);
    rec("subtasks", "client reads item on OWN VISIBLE task", subTitles.includes("RLSSUB-visible"), `${cSubs?.length ?? 0} row(s)`);
    rec("subtasks", "client CANNOT read item on invisible/cross task",
      !subTitles.includes("RLSSUB-hidden") && !subTitles.includes("RLSSUB-cross"), `${cSubs?.length ?? 0} row(s)`);

    // DIRECT writes denied (NO client INSERT/UPDATE/DELETE policy).
    const sdi = await client.from("task_checklist_items").insert({ task_id: visTaskId, title: "RLSSUB-direct" }).select("id");
    rec("subtasks", "client direct INSERT item DENIED", !!sdi.error || (sdi.data?.length ?? 0) === 0, sdi.error?.code ?? `${sdi.data?.length ?? 0} rows`);
    if (sdi.data?.[0]?.id) await admin.from("task_checklist_items").delete().eq("id", sdi.data[0].id);
    const sdu = await client.from("task_checklist_items").update({ is_done: true }).eq("id", visSubId).select("id");
    rec("subtasks", "client direct UPDATE item denied", !!sdu.error || (sdu.data?.length ?? 0) === 0, sdu.error?.code ?? `${sdu.data?.length ?? 0} rows`);
    const sdd = await client.from("task_checklist_items").delete().eq("id", visSubId).select("id");
    rec("subtasks", "client direct DELETE item denied", !!sdd.error || (sdd.data?.length ?? 0) === 0, sdd.error?.code ?? `${sdd.data?.length ?? 0} rows`);

    // RPC on the OWN VISIBLE task → allowed (add → toggle → edit → delete).
    const sAdd = await client.rpc("add_task_checklist_item", { p_task_id: visTaskId, p_title: "RLSSUB-rpc" });
    rec("subtasks", "client add_task_checklist_item on visible task allowed", !sAdd.error, sAdd.error?.message ?? "");
    const newSubId = (Array.isArray(sAdd.data) ? sAdd.data[0]?.id : sAdd.data?.id) as string | undefined;
    const sTog = await client.rpc("toggle_task_checklist_item", { p_item_id: newSubId });
    rec("subtasks", "client toggle own item allowed", !sTog.error, sTog.error?.message ?? "");
    const sEd = await client.rpc("edit_task_checklist_item", { p_item_id: newSubId, p_title: "RLSSUB-rpc2" });
    rec("subtasks", "client edit own item allowed", !sEd.error, sEd.error?.message ?? "");
    const sDel = await client.rpc("delete_task_checklist_item", { p_item_id: newSubId });
    rec("subtasks", "client delete own item allowed", !sDel.error, sDel.error?.message ?? "");

    // RPC on an INVISIBLE / CROSS-CLIENT parent → RAISES (the inherited boundary).
    const sAddHid = await client.rpc("add_task_checklist_item", { p_task_id: hidTaskId, p_title: "RLSSUB-hijack" });
    rec("subtasks", "client add on INVISIBLE (staff-only) task RAISES", !!sAddHid.error, sAddHid.error?.message ?? "");
    const sAddXc = await client.rpc("add_task_checklist_item", { p_task_id: xcTaskId, p_title: "RLSSUB-hijack" });
    rec("subtasks", "client add on CROSS-CLIENT task RAISES", !!sAddXc.error, sAddXc.error?.message ?? "");
    const sTogHid = await client.rpc("toggle_task_checklist_item", { p_item_id: hidSubId });
    rec("subtasks", "client toggle item on INVISIBLE task RAISES", !!sTogHid.error, sTogHid.error?.message ?? "");
    const sTogXc = await client.rpc("toggle_task_checklist_item", { p_item_id: xcSubId });
    rec("subtasks", "client toggle item on CROSS-CLIENT task RAISES", !!sTogXc.error, sTogXc.error?.message ?? "");
    const sEdXc = await client.rpc("edit_task_checklist_item", { p_item_id: xcSubId, p_title: "RLSSUB-hijack" });
    rec("subtasks", "client edit item on CROSS-CLIENT task RAISES", !!sEdXc.error, sEdXc.error?.message ?? "");
    const sDelXc = await client.rpc("delete_task_checklist_item", { p_item_id: xcSubId });
    rec("subtasks", "client delete item on CROSS-CLIENT task RAISES", !!sDelXc.error, sDelXc.error?.message ?? "");
  }

  // --- call_bookings: client sees OWN VISIBLE only; the service-role upsert is
  //     the ONLY write path (no client INSERT/UPDATE policy) ------------------
  {
    const { data: bk } = await client.from("call_bookings").select("external_id");
    const ids = (bk ?? []).map((b) => b.external_id);
    rec("bookings", "client reads OWN visible booking", ids.includes("RLSBK-visible"), `${bk?.length ?? 0} rows`);
    rec("bookings", "client cannot see HIDDEN booking", !ids.includes("RLSBK-hidden"));
    // direct UPDATE denied (no client UPDATE policy → error or 0 rows)
    const bu = await client.from("call_bookings").update({ status: "cancelled" }).eq("external_id", "RLSBK-visible").select("id");
    rec("bookings", "client direct UPDATE denied", !!bu.error || (bu.data?.length ?? 0) === 0, bu.error?.code ?? `${bu.data?.length ?? 0} rows`);

    // service-role idempotent upsert (the webhook's path): same external_id twice = 1 row
    await admin.from("call_bookings").upsert({ external_id: "RLSBK-visible", client_id: premierId, title: "RLSBK upsert-1", status: "booked", visible_to_client: true }, { onConflict: "external_id" });
    await admin.from("call_bookings").upsert({ external_id: "RLSBK-visible", client_id: premierId, title: "RLSBK upsert-2", status: "rescheduled", visible_to_client: true }, { onConflict: "external_id" });
    const { data: dup } = await admin.from("call_bookings").select("status").eq("external_id", "RLSBK-visible");
    rec("bookings", "service-role upsert idempotent (1 row)", (dup?.length ?? 0) === 1, `${dup?.length ?? 0} rows`);
    rec("bookings", "service-role upsert updates fields (status)", dup?.[0]?.status === "rescheduled", `status=${dup?.[0]?.status ?? "?"}`);
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
  // projects: unassigned team can neither read nor write the project client's
  {
    const tr = await team.from("projects").select("id").eq("client_id", projId);
    rec("team→unassigned", "read projects 0", (tr.data?.length ?? 0) === 0, `${tr.data?.length ?? 0} rows`);
    const ti = await team.from("projects").insert({ client_id: projId, title: "RLS team-un" }).select("id");
    rec("team→unassigned", "write projects denied", !!ti.error || (ti.data?.length ?? 0) === 0, ti.error?.code ?? `${ti.data?.length ?? 0} rows`);
    if (ti.data?.[0]?.id) await admin.from("projects").delete().eq("id", ti.data[0].id);
  }
  // projects: ASSIGNED team (demo-team ↔ premier) can read + write premier's
  {
    const tr = await team.from("projects").select("id").eq("client_id", premierId);
    rec("team→assigned", "read premier projects allowed", !tr.error && (tr.data?.length ?? 0) >= 1, `${tr.data?.length ?? 0} rows`);
    const ti = await team.from("projects").insert({ client_id: premierId, title: "RLS team-assigned" }).select("id");
    rec("team→assigned", "write premier project allowed", !ti.error && (ti.data?.length ?? 0) === 1, ti.error?.code ?? `${ti.data?.length ?? 0} rows`);
    if (ti.data?.[0]?.id) await admin.from("projects").delete().eq("id", ti.data[0].id);

    // staff can link a deliverable to a project of the SAME client (set project_id)
    const teamLink = await team
      .from("deliverables")
      .update({ project_id: premierProjectId })
      .eq("id", apprId)
      .select("id");
    rec(
      "team→assigned",
      "link deliverable→project (set project_id) allowed",
      !teamLink.error && (teamLink.data?.length ?? 0) === 1,
      teamLink.error?.code ?? `${teamLink.data?.length ?? 0} rows`,
    );
    await admin.from("deliverables").update({ project_id: null }).eq("id", apprId); // reset
  }
  // call_bookings: ASSIGNED team reads premier's bookings, INCLUDING hidden ones
  {
    const tb = await team.from("call_bookings").select("external_id").eq("client_id", premierId);
    const ids = (tb.data ?? []).map((x) => x.external_id);
    rec("team→assigned", "read premier bookings incl. hidden", ids.includes("RLSBK-visible") && ids.includes("RLSBK-hidden"), `${tb.data?.length ?? 0} rows`);
  }
  // messaging: ASSIGNED team reads BOTH thread types + posts to both
  {
    const { data: tThreads } = await team.from("threads").select("type").eq("client_id", premierId);
    rec("team→assigned", "read BOTH thread types", (tThreads?.length ?? 0) === 2, `${tThreads?.length ?? 0} threads`);
    const tShared = await team.rpc("post_message", { p_thread_id: premierShared, p_body: "RLS team shared" });
    rec("team→assigned", "post to shared thread allowed", !tShared.error, tShared.error?.message ?? "");
    const tInternal = await team.rpc("post_message", { p_thread_id: premierInternal, p_body: "RLS team internal" });
    rec("team→assigned", "post to internal thread allowed", !tInternal.error, tInternal.error?.message ?? "");

    // edit/delete (Batch 2): the client's soft-deleted message must be absent from
    // STAFF reads too (proves the policy change vanishes it everywhere AND that the
    // staff is_assigned scoping still works); staff are author-only as well.
    const tGone = await team.from("messages").select("id").eq("id", mClientDel);
    rec("team→assigned", "soft-deleted message absent from STAFF read (vanish + scoping intact)", (tGone.data?.length ?? 0) === 0, `${tGone.data?.length ?? 0} rows`);
    const tEditOwn = await team.rpc("edit_message", { p_message_id: mStaffShared, p_body: "RLSED-staff-shared (edited)" });
    rec("team→assigned", "staff edits OWN message allowed", !tEditOwn.error, tEditOwn.error?.message ?? "");
    const tEditOther = await team.rpc("edit_message", { p_message_id: mClientEdit, p_body: "hijack" });
    rec("team→assigned", "staff edit ANOTHER author's message DENIED (author-only)", !!tEditOther.error, tEditOther.error?.message ?? "");
  }
  // messaging: UNASSIGNED team — no read, no post, no mark
  {
    const { data: tun } = await team.from("threads").select("id").eq("client_id", unId);
    rec("team→unassigned", "read threads 0", (tun?.length ?? 0) === 0, `${tun?.length ?? 0} rows`);
    const tunPost = await team.rpc("post_message", { p_thread_id: unShared, p_body: "RLS unassigned" });
    rec("team→unassigned", "post denied", !!tunPost.error, tunPost.error?.message ?? "");
    const tunMark = await team.rpc("mark_thread_read", { p_thread_id: unShared });
    rec("team→unassigned", "mark_thread_read denied", !!tunMark.error, tunMark.error?.message ?? "");
  }
  // tasks: ASSIGNED team reads + writes premier's; UNASSIGNED team neither
  {
    const ttr = await team.from("tasks").select("id").eq("client_id", premierId);
    rec("team→assigned", "read premier tasks allowed", !ttr.error && (ttr.data?.length ?? 0) >= 1, `${ttr.data?.length ?? 0} rows`);
    const tti = await team.from("tasks").insert({ client_id: premierId, title: "RLSTASK-team" }).select("id");
    rec("team→assigned", "write premier task allowed", !tti.error && (tti.data?.length ?? 0) === 1, tti.error?.code ?? `${tti.data?.length ?? 0} rows`);
    if (tti.data?.[0]?.id) await admin.from("tasks").delete().eq("id", tti.data[0].id);
    // staff status control is UNAFFECTED — a team member changes status via a direct
    // UPDATE under the tasks for-all policy (no RPC; the client status RPC was dropped).
    const tts = await team.from("tasks").update({ status: "in_progress" }).eq("id", visTaskId).select("id");
    rec("team→assigned", "staff CAN change task status (direct UPDATE)", !tts.error && (tts.data?.length ?? 0) === 1, tts.error?.code ?? `${tts.data?.length ?? 0} rows`);

    const tun = await team.from("tasks").select("id").eq("client_id", unId);
    rec("team→unassigned", "read tasks 0", (tun.data?.length ?? 0) === 0, `${tun.data?.length ?? 0} rows`);
    const tunI = await team.from("tasks").insert({ client_id: unId, title: "RLSTASK-teamun" }).select("id");
    rec("team→unassigned", "write tasks denied", !!tunI.error || (tunI.data?.length ?? 0) === 0, tunI.error?.code ?? `${tunI.data?.length ?? 0} rows`);
    if (tunI.data?.[0]?.id) await admin.from("tasks").delete().eq("id", tunI.data[0].id);

    // subtasks: ASSIGNED team manages premier's items directly (for-all policies);
    // UNASSIGNED team can neither read nor write — read scoped to the parent task.
    const tsr = await team.from("task_checklist_items").select("id").eq("task_id", visTaskId);
    rec("team→assigned", "read premier subtasks allowed", !tsr.error && (tsr.data?.length ?? 0) >= 1, `${tsr.data?.length ?? 0} rows`);
    const tsi = await team.from("task_checklist_items").insert({ task_id: visTaskId, title: "RLSSUB-team" }).select("id");
    rec("team→assigned", "write premier subtask allowed", !tsi.error && (tsi.data?.length ?? 0) === 1, tsi.error?.code ?? `${tsi.data?.length ?? 0} rows`);
    if (tsi.data?.[0]?.id) await admin.from("task_checklist_items").delete().eq("id", tsi.data[0].id);
    // a HIDDEN (staff-only) task's items are still visible to assigned staff (parent is_assigned).
    const tsh = await team.from("task_checklist_items").select("id").eq("task_id", hidTaskId);
    rec("team→assigned", "read staff-only task subtasks allowed", !tsh.error && (tsh.data?.length ?? 0) >= 1, `${tsh.data?.length ?? 0} rows`);

    const tuns = await team.from("task_checklist_items").select("id").eq("task_id", unTaskId);
    rec("team→unassigned", "read unassigned-client subtasks 0", (tuns.data?.length ?? 0) === 0, `${tuns.data?.length ?? 0} rows`);
    const tunsI = await team.from("task_checklist_items").insert({ task_id: unTaskId, title: "RLSSUB-teamun" }).select("id");
    rec("team→unassigned", "write unassigned-client subtask denied", !!tunsI.error || (tunsI.data?.length ?? 0) === 0, tunsI.error?.code ?? `${tunsI.data?.length ?? 0} rows`);
    if (tunsI.data?.[0]?.id) await admin.from("task_checklist_items").delete().eq("id", tunsI.data[0].id);
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
    const ar = await anon.from("projects").select("id");
    rec("anon", "read projects 0", (ar.data?.length ?? 0) === 0, `${ar.data?.length ?? 0} rows`);
    const ai = await anon.from("projects").insert({ client_id: premierId, title: "RLS anon" }).select("id");
    rec("anon", "write projects denied", !!ai.error || (ai.data?.length ?? 0) === 0, ai.error?.code ?? `${ai.data?.length ?? 0} rows`);
    if (ai.data?.[0]?.id) await admin.from("projects").delete().eq("id", ai.data[0].id);
    const acp = await anon.rpc("create_project", { p_title: "x", p_description: "" });
    rec("anon", "create_project RPC denied", !!acp.error);
    const anThreads = await anon.from("threads").select("id");
    rec("anon", "read threads 0", (anThreads.data?.length ?? 0) === 0, `${anThreads.data?.length ?? 0} rows`);
    const anMsgs = await anon.from("messages").select("id");
    rec("anon", "read messages 0", (anMsgs.data?.length ?? 0) === 0, `${anMsgs.data?.length ?? 0} rows`);
    const anPost = await anon.rpc("post_message", { p_thread_id: premierShared, p_body: "x" });
    rec("anon", "post_message denied", !!anPost.error);
    const anMark = await anon.rpc("mark_thread_read", { p_thread_id: premierShared });
    rec("anon", "mark_thread_read denied", !!anMark.error);
    const anEdit = await anon.rpc("edit_message", { p_message_id: mClientEdit, p_body: "x" });
    rec("anon", "edit_message denied", !!anEdit.error);
    const anDel = await anon.rpc("delete_message", { p_message_id: mClientEdit });
    rec("anon", "delete_message denied", !!anDel.error);
    const anNotes = await anon.from("notifications").select("id");
    rec("anon", "read notifications 0", (anNotes.data?.length ?? 0) === 0, `${anNotes.data?.length ?? 0} rows`);
    const anUpd = await anon.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", clientNoteId).select("id");
    rec("anon", "update notifications denied", !!anUpd.error || (anUpd.data?.length ?? 0) === 0, anUpd.error?.code ?? `${anUpd.data?.length ?? 0} rows`);
    const anPref = await anon.from("notification_preferences").select("user_id");
    rec("anon", "read notification_preferences 0", (anPref.data?.length ?? 0) === 0, `${anPref.data?.length ?? 0} rows`);
    const anPrefIns = await anon.from("notification_preferences").insert({ user_id: clientProfileId, email_message: false }).select("user_id");
    rec("anon", "insert notification_preferences denied", !!anPrefIns.error || (anPrefIns.data?.length ?? 0) === 0, anPrefIns.error?.code ?? `${anPrefIns.data?.length ?? 0} rows`);
    const atr = await anon.from("tasks").select("id");
    rec("anon", "read tasks 0", (atr.data?.length ?? 0) === 0, `${atr.data?.length ?? 0} rows`);
    const ati = await anon.from("tasks").insert({ client_id: premierId, title: "RLSTASK-anon" }).select("id");
    rec("anon", "write tasks denied", !!ati.error || (ati.data?.length ?? 0) === 0, ati.error?.code ?? `${ati.data?.length ?? 0} rows`);
    if (ati.data?.[0]?.id) await admin.from("tasks").delete().eq("id", ati.data[0].id);
    const act = await anon.rpc("create_task", { p_title: "x" });
    rec("anon", "create_task RPC denied", !!act.error);
    const aut = await anon.rpc("update_task_status", { p_task_id: visTaskId, p_status: "done" });
    rec("anon", "update_task_status RPC denied", !!aut.error);
  }

  // ====================== SEED GATING =======================================
  // A project client is seeded NOTHING; a program client (premier) is seeded.
  {
    const [{ count: projCk }, { count: projMs }, { count: projMd }] = await Promise.all([
      admin.from("checklist_items").select("id", { count: "exact", head: true }).eq("client_id", projId),
      admin.from("milestones").select("id", { count: "exact", head: true }).eq("client_id", projId),
      admin.from("metric_definitions").select("id", { count: "exact", head: true }).eq("client_id", projId),
    ]);
    rec("seed-gating", "project client has NO checklist", (projCk ?? 0) === 0, `${projCk ?? 0} rows`);
    rec("seed-gating", "project client has NO milestones", (projMs ?? 0) === 0, `${projMs ?? 0} rows`);
    rec("seed-gating", "project client has NO metric defs", (projMd ?? 0) === 0, `${projMd ?? 0} rows`);
    const [{ count: progCk }, { count: progMs }] = await Promise.all([
      admin.from("checklist_items").select("id", { count: "exact", head: true }).eq("client_id", premierId),
      admin.from("milestones").select("id", { count: "exact", head: true }).eq("client_id", premierId),
    ]);
    rec("seed-gating", "program client HAS checklist", (progCk ?? 0) > 0, `${progCk ?? 0} rows`);
    rec("seed-gating", "program client HAS milestones", (progMs ?? 0) > 0, `${progMs ?? 0} rows`);
  }

  // ====================== THREAD SEEDING (both client types) ================
  {
    // project client (projId) was created during this run → trigger seeded 2 threads
    const { data: projTypes } = await admin.from("threads").select("type").eq("client_id", projId);
    const projBoth =
      (projTypes ?? []).filter((t) => t.type === "client_shared").length === 1 &&
      (projTypes ?? []).filter((t) => t.type === "internal").length === 1;
    rec("seeding", "PROJECT client seeded 1 shared + 1 internal thread", projBoth, `${projTypes?.length ?? 0} threads`);
    // program client (premier) — backfilled in the migration
    const { data: progTypes } = await admin.from("threads").select("type").eq("client_id", premierId);
    const progBoth =
      (progTypes ?? []).filter((t) => t.type === "client_shared").length === 1 &&
      (progTypes ?? []).filter((t) => t.type === "internal").length === 1;
    rec("seeding", "PROGRAM client has its 2 threads (backfill)", progBoth, `${progTypes?.length ?? 0} threads`);
  }

  // --- cleanup --------------------------------------------------------------
  await admin.from("notification_preferences").delete().in("user_id", [clientProfileId, teamUid]);
  await admin.from("tasks").delete().like("title", "RLSTASK%");
  await admin.from("notifications").delete().like("title", "RLSNOTE%");
  await admin.from("messages").delete().eq("client_id", premierId).like("body", "RLS%");
  await admin.from("thread_reads").delete().eq("thread_id", premierShared);
  await admin.from("projects").delete().eq("client_id", premierId).like("title", "RLS%");
  await admin.from("call_bookings").delete().like("external_id", "RLSBK%");
  {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const u = list?.users.find((x) => x.email === projEmail);
    if (u) await admin.auth.admin.deleteUser(u.id);
  }
  await admin.from("clients").delete().eq("id", projId); // cascades projId's projects
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
