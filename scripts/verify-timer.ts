/**
 * Timer-model verification (BUG 2). Provisions a program client + assigned team
 * user + a task, signs in as the team member, and exercises the RPCs to confirm
 * the corrected model: start→in_progress; plain stop stays in_progress (NOT done);
 * stop&complete→done; one-running enforced; elapsed/total accurate; entries save;
 * and a CLIENT cannot touch any of it (staff-only). Self-cleans.
 *
 * Run: npx tsx scripts/verify-timer.ts   (NON-DESTRUCTIVE)
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const PW = "FourPie!Demo2026";

const results: { check: string; pass: boolean; detail: string }[] = [];
const rec = (check: string, pass: boolean, detail = "") => { results.push({ check, pass, detail }); };
const status = async (taskId: string) => (await admin.from("tasks").select("status").eq("id", taskId).single()).data?.status;
const running = async (taskId: string) => (await admin.from("time_entries").select("id").eq("task_id", taskId).is("ended_at", null)).data ?? [];

async function ensureUser(email: string, meta: Record<string, unknown>) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const ex = list?.users.find((u) => u.email === email);
  if (ex) await admin.auth.admin.deleteUser(ex.id);
  const { data, error } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true, user_metadata: meta });
  if (error) throw error;
  return data.user!.id;
}

async function main() {
  const TEAM = "zz-timer-team@example.com", CLIENTU = "zz-timer-client@example.com", SLUG = "zz-timer";
  await admin.from("clients").delete().eq("slug", SLUG);
  const { data: cl } = await admin.from("clients").insert({ name: "ZZ Timer", slug: SLUG, industry: "other_local_service", program: "foundation", status: "active", client_type: "program" }).select("id").single();
  const clientId = cl!.id;
  try {
    const teamUid = await ensureUser(TEAM, { role: "team", full_name: "Timer Team" });
    await ensureUser(CLIENTU, { role: "client", client_id: clientId, full_name: "Timer Client" });
    await admin.from("client_assignments").insert({ client_id: clientId, user_id: teamUid });
    const { data: task } = await admin.from("tasks").insert({ client_id: clientId, title: "Timer task", visible_to_client: true }).select("id, status").single();
    const taskId = task!.id;
    rec("task starts as todo", task!.status === "todo", task!.status);

    const team = createClient(url, anonKey, { auth: { persistSession: false } });
    await team.auth.signInWithPassword({ email: TEAM, password: PW });

    // START → in_progress, one running entry
    const s1 = await team.rpc("start_timer", { p_task_id: taskId });
    rec("start_timer ok", !s1.error, s1.error?.message ?? "");
    rec("start → status in_progress", (await status(taskId)) === "in_progress", String(await status(taskId)));
    rec("one running entry exists", (await running(taskId)).length === 1, `${(await running(taskId)).length}`);
    const entry1 = (await running(taskId))[0].id;

    // one-running enforced
    const s2 = await team.rpc("start_timer", { p_task_id: taskId });
    rec("second start REJECTED (one-running)", !!s2.error, s2.error?.message ?? "(unexpectedly succeeded)");

    // PLAIN STOP → stays in_progress (NOT done)
    await new Promise((r) => setTimeout(r, 1200)); // accrue ~1s
    const st1 = await team.rpc("stop_timer", { p_entry_id: entry1, p_complete: false });
    rec("plain stop ok", !st1.error, st1.error?.message ?? "");
    rec("plain stop → status STAYS in_progress (not done)", (await status(taskId)) === "in_progress", String(await status(taskId)));
    rec("entry got ended_at (saved)", !!(await admin.from("time_entries").select("ended_at").eq("id", entry1).single()).data?.ended_at, "");
    rec("no running entry after stop", (await running(taskId)).length === 0, `${(await running(taskId)).length}`);
    const { data: e1row } = await admin.from("time_entries").select("started_at, ended_at").eq("id", entry1).single();
    const elapsed1 = (new Date(e1row!.ended_at!).getTime() - new Date(e1row!.started_at).getTime()) / 1000;
    rec("elapsed accurate (>=1s accrued)", elapsed1 >= 1 && elapsed1 < 30, `${elapsed1.toFixed(1)}s`);

    // START again → STOP & COMPLETE → done
    await team.rpc("start_timer", { p_task_id: taskId });
    const entry2 = (await running(taskId))[0].id;
    const st2 = await team.rpc("stop_timer", { p_entry_id: entry2, p_complete: true });
    rec("stop & complete ok", !st2.error, st2.error?.message ?? "");
    rec("stop & complete → status done", (await status(taskId)) === "done", String(await status(taskId)));

    // total across entries
    const { data: allE } = await admin.from("time_entries").select("started_at, ended_at").eq("task_id", taskId);
    const total = (allE ?? []).reduce((a, e) => a + (e.ended_at ? (new Date(e.ended_at).getTime() - new Date(e.started_at).getTime()) / 1000 : 0), 0);
    rec("total = sum of entries (2 entries)", (allE ?? []).length === 2 && total >= elapsed1, `${total.toFixed(1)}s across ${allE?.length}`);

    // edit + delete own entry
    const newStart = new Date(Date.now() - 3600_000).toISOString();
    const ed = await team.rpc("edit_time_entry", { p_entry_id: entry1, p_started_at: newStart, p_ended_at: new Date().toISOString() });
    rec("edit own entry ok", !ed.error, ed.error?.message ?? "");
    const del = await team.rpc("delete_time_entry", { p_entry_id: entry1 });
    rec("delete own entry ok", !del.error, del.error?.message ?? "");
    rec("entry count now 1", ((await admin.from("time_entries").select("id").eq("task_id", taskId)).data ?? []).length === 1, "");

    // CLIENT cannot touch any of it (staff-only)
    const clientApi = createClient(url, anonKey, { auth: { persistSession: false } });
    await clientApi.auth.signInWithPassword({ email: CLIENTU, password: PW });
    const cStart = await clientApi.rpc("start_timer", { p_task_id: taskId });
    rec("client start_timer DENIED", !!cStart.error, cStart.error?.message ?? "(succeeded!)");
    const { data: cRead } = await clientApi.from("time_entries").select("id").eq("task_id", taskId);
    rec("client cannot read time_entries", (cRead?.length ?? 0) === 0, `${cRead?.length ?? 0} rows`);
  } finally {
    await admin.from("clients").delete().eq("id", clientId);
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const email of ["zz-timer-team@example.com", "zz-timer-client@example.com"]) { const u = list?.users.find((x) => x.email === email); if (u) await admin.auth.admin.deleteUser(u.id); }
  }

  let failed = 0;
  for (const r of results) { console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.check}${r.detail ? `  — ${r.detail}` : ""}`); if (!r.pass) failed++; }
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  if (failed) process.exit(1);
  console.log("Timer model verified. ✓");
}
main().catch((e) => { console.error(e); process.exit(1); });
