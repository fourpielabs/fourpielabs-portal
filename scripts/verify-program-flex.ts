/**
 * P3 end-to-end FLEX proof. One self-provisioned program client walks the full
 * lifecycle; at each step we assert ALL THREE surfaces flex together:
 *   - services  (resolveClientPrograms — Program tab + "what's included" card)
 *   - KPI set   (active metric_definitions — staff grid + client view)
 *   - the legacy clients.program stays reconciled (core tier, or 'pulse' when Pulse-only)
 * Plus: downgrade DEACTIVATES (never deletes) entered numbers; re-upgrade restores
 * history; Pulse-only is a clean social-only state. Self-cleans to baseline.
 *
 * applyAssignment() mirrors setClientProgramsAction's DB writes exactly (the action
 * adds staff-RLS + guards + audit; the RLS suite proves staff-can / client-cannot).
 *
 * Run: npx tsx scripts/verify-program-flex.ts   (NON-DESTRUCTIVE)
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { resolveClientPrograms, resolveClientKpis } from "../lib/programs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const FOUND = ["leads", "gbp_calls", "top3_keywords", "map_pack_keywords", "aeo_citations", "organic_traffic", "key_learning"];
const PIPE_ADD = ["ad_spend", "ad_conversions", "cost_per_lead", "calls_tracked"];
const OS_ADD = ["blended_cost_per_lead", "pipeline_value", "revenue_attributed"];
const PULSE = ["total_views", "follower_count", "follower_growth", "profile_visits", "inbound_dms", "sales_calls_booked", "new_clients_closed", "revenue_this_month", "best_performing_post", "hook_that_worked_best", "key_learning"];
const uni = (...a: string[][]) => [...new Set(a.flat())];

const results: { check: string; pass: boolean; detail: string }[] = [];
const rec = (check: string, pass: boolean, detail = "") => { results.push({ check, pass, detail }); };
const setEq = (a: string[], b: string[]) => a.length === [...new Set(b)].length && [...new Set(a)].sort().join(",") === [...new Set(b)].sort().join(",");

let pulseId: string;
async function applyAssignment(clientId: string, coreTier: string | null, pulse: boolean) {
  // mirrors setClientProgramsAction
  await admin.from("clients").update({ program: coreTier ?? "pulse" }).eq("id", clientId);
  if (!coreTier) await admin.from("client_programs").delete().eq("client_id", clientId).eq("is_parallel", false);
  if (pulse) await admin.from("client_programs").upsert({ client_id: clientId, program_id: pulseId }, { onConflict: "client_id,program_id", ignoreDuplicates: true });
  else await admin.from("client_programs").delete().eq("client_id", clientId).eq("program_id", pulseId);
}

const activeKpiKeys = async (clientId: string) =>
  ((await admin.from("metric_definitions").select("key").eq("client_id", clientId).eq("is_active", true)).data ?? []).map((r) => r.key as string);
const programValue = async (clientId: string) =>
  (await admin.from("clients").select("program").eq("id", clientId).single()).data?.program as string;

async function assertStep(label: string, clientId: string, opts: { svc: string[]; kpis: string[]; program: string }) {
  const resolved = await resolveClientPrograms(admin, clientId);
  const svcKeys = [...new Set(resolved.included.map((s) => s.programKey))];
  rec(`${label}: services flex`, setEq(svcKeys, opts.svc), svcKeys.join("+"));
  const kpiActive = await activeKpiKeys(clientId);
  rec(`${label}: KPI grid flexes`, setEq(kpiActive, opts.kpis), `${kpiActive.length} kpis`);
  const tsKpis = (await resolveClientKpis(admin, clientId)).map((k) => k.key);
  rec(`${label}: card/KPI resolver agrees with grid`, setEq(tsKpis, kpiActive), `${tsKpis.length}`);
  rec(`${label}: clients.program reconciled`, (await programValue(clientId)) === opts.program, `program=${await programValue(clientId)}`);
}

async function main() {
  pulseId = (await admin.from("programs").select("id").eq("key", "pulse").single()).data!.id;
  const slug = "zz-flex";
  await admin.from("clients").delete().eq("slug", slug);
  let clientId = "";
  try {
    // STEP 1 — Assign Core (create as foundation; mirror trigger + sync fire)
    const { data: cl } = await admin.from("clients")
      .insert({ name: "ZZ Flex", slug, industry: "other_local_service", program: "foundation", status: "active", client_type: "program" })
      .select("id").single();
    clientId = cl!.id;
    await assertStep("[1 Core]", clientId, { svc: ["foundation"], kpis: FOUND, program: "foundation" });
    rec("[1 Core] NO ad columns", !(await activeKpiKeys(clientId)).some((k) => PIPE_ADD.includes(k)), "");

    // STEP 2 — Upgrade to Pipeline (gains Google Ads + ad KPIs)
    await applyAssignment(clientId, "pipeline", false);
    await assertStep("[2 Pipeline]", clientId, { svc: ["foundation", "pipeline"], kpis: uni(FOUND, PIPE_ADD), program: "pipeline" });
    {
      const r = await resolveClientPrograms(admin, clientId);
      rec("[2 Pipeline] services GAINED Google Ads", r.included.some((s) => /Google Ads/.test(s.label)), "");
      rec("[2 Pipeline] 'available to add' updated (OS+Pulse)", setEq([...new Set(r.notIncluded.map((s) => s.programKey))], ["operating_system", "pulse"]), "");
    }

    // STEP 3 — Upgrade to Operating System (all three tiers + 14 KPIs)
    await applyAssignment(clientId, "operating_system", false);
    await assertStep("[3 OS]", clientId, { svc: ["foundation", "pipeline", "operating_system"], kpis: uni(FOUND, PIPE_ADD, OS_ADD), program: "operating_system" });

    // STEP 4 — Add Pulse (social services + social KPIs appear alongside)
    await applyAssignment(clientId, "operating_system", true);
    await assertStep("[4 OS+Pulse]", clientId, { svc: ["foundation", "pipeline", "operating_system", "pulse"], kpis: uni(FOUND, PIPE_ADD, OS_ADD, PULSE), program: "operating_system" });

    // enter a number on an OS-only KPI, to prove downgrade preserves it
    const { data: revDef } = await admin.from("metric_definitions").select("id").eq("client_id", clientId).eq("key", "revenue_attributed").single();
    await admin.from("metric_entries").insert({ client_id: clientId, definition_id: revDef!.id, period: "2026-04-01", value_numeric: 9999 });

    // STEP 5 — Downgrade OS+Pulse → Core+Pulse (higher-tier svc + KPIs REMOVE; data preserved)
    await applyAssignment(clientId, "foundation", true);
    await assertStep("[5 Core+Pulse]", clientId, { svc: ["foundation", "pulse"], kpis: uni(FOUND, PULSE), program: "foundation" });
    {
      const { data: d } = await admin.from("metric_definitions").select("is_active").eq("id", revDef!.id).single();
      const { data: e } = await admin.from("metric_entries").select("value_numeric").eq("definition_id", revDef!.id).maybeSingle();
      rec("[5 downgrade] out-of-program KPI deactivated", d?.is_active === false, `is_active=${d?.is_active}`);
      rec("[5 downgrade] entered number PRESERVED (not orphaned)", e?.value_numeric === 9999, `value=${e?.value_numeric}`);
    }

    // STEP 6 — Pulse-only (remove core tier, keep Pulse) → clean social-only
    await applyAssignment(clientId, null, true);
    await assertStep("[6 Pulse-only]", clientId, { svc: ["pulse"], kpis: PULSE, program: "pulse" });
    {
      const r = await resolveClientPrograms(admin, clientId);
      rec("[6 Pulse-only] clean — no SEO/ads shells in included", r.included.every((s) => s.programKey === "pulse"), `${r.included.length} svc`);
      const { data: cps } = await admin.from("client_programs").select("is_parallel").eq("client_id", clientId);
      rec("[6 Pulse-only] no core-tier assignment remains", (cps ?? []).every((c) => c.is_parallel), `${cps?.length} rows`);
    }

    // STEP 7 — Re-upgrade to OS+Pulse → history restored
    await applyAssignment(clientId, "operating_system", true);
    {
      const { data: d } = await admin.from("metric_definitions").select("is_active").eq("id", revDef!.id).single();
      const { data: e } = await admin.from("metric_entries").select("value_numeric").eq("definition_id", revDef!.id).maybeSingle();
      rec("[7 re-upgrade] KPI reactivated", d?.is_active === true, `is_active=${d?.is_active}`);
      rec("[7 re-upgrade] history intact", e?.value_numeric === 9999, `value=${e?.value_numeric}`);
    }
  } finally {
    if (clientId) await admin.from("clients").delete().eq("id", clientId);
    const { data: left } = await admin.from("clients").select("id").eq("slug", "zz-flex");
    rec("teardown — flex client removed", (left?.length ?? 0) === 0, `${left?.length ?? 0} left`);
  }

  let failed = 0;
  for (const r of results) { console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.check}${r.detail ? `  — ${r.detail}` : ""}`); if (!r.pass) failed++; }
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  if (failed) process.exit(1);
  console.log("End-to-end FLEX verification passed. ✓");
}

main().catch((e) => { console.error(e); process.exit(1); });
