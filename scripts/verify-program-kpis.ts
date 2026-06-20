/**
 * P2 verification: program-driven KPIs. Creates one PROGRAM client per type
 * (mirror trigger → client_programs → sync_client_program_metrics materializes
 * metric_definitions), asserts the resolved KPI set per program (catalog-driven),
 * the Core-no-ad-columns fix, TS↔SQL parity, and DATA PRESERVATION across a
 * program change (deactivate, never orphan; reactivate with history). Self-cleans.
 *
 * Run: npx tsx scripts/verify-program-kpis.ts   (NON-DESTRUCTIVE)
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { resolveClientKpis } from "../lib/programs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const AD_KEYS = ["ad_spend", "ad_conversions", "cost_per_lead", "calls_tracked"];
const EXPECT: Record<string, string[]> = {
  foundation: ["leads", "gbp_calls", "top3_keywords", "map_pack_keywords", "aeo_citations", "organic_traffic", "key_learning"],
  pipeline: ["leads", "gbp_calls", "top3_keywords", "map_pack_keywords", "aeo_citations", "organic_traffic", "key_learning", "ad_spend", "ad_conversions", "cost_per_lead", "calls_tracked"],
  operating_system: ["leads", "gbp_calls", "top3_keywords", "map_pack_keywords", "aeo_citations", "organic_traffic", "key_learning", "ad_spend", "ad_conversions", "cost_per_lead", "calls_tracked", "blended_cost_per_lead", "pipeline_value", "revenue_attributed"],
  pulse: ["total_views", "follower_count", "follower_growth", "profile_visits", "inbound_dms", "sales_calls_booked", "new_clients_closed", "revenue_this_month", "best_performing_post", "hook_that_worked_best", "key_learning"],
};

const results: { check: string; pass: boolean; detail: string }[] = [];
const rec = (check: string, pass: boolean, detail = "") => results.push({ check, pass, detail });
const sameSet = (a: string[], b: string[]) => a.length === b.length && [...new Set(a)].sort().join(",") === [...new Set(b)].sort().join(",");

const activeDefs = async (clientId: string) =>
  (await admin.from("metric_definitions").select("key, source, is_active, unit").eq("client_id", clientId).eq("is_active", true).order("sort_order")).data ?? [];

async function mkClient(program: string) {
  const slug = `zz-kpi-${program.replace(/_/g, "-")}`;
  await admin.from("clients").delete().eq("slug", slug);
  const { data, error } = await admin.from("clients")
    .insert({ name: `ZZ KPI ${program}`, slug, industry: "other_local_service", program, status: "active", client_type: "program" })
    .select("id").single();
  if (error) throw error;
  return data!.id as string;
}

async function main() {
  const made: string[] = [];
  try {
    for (const program of Object.keys(EXPECT)) {
      const id = await mkClient(program);
      made.push(id);
      const defs = await activeDefs(id);
      const keys = defs.map((d: any) => d.key);

      // 1) catalog-driven KPI set materialized into metric_definitions
      rec(`[${program}] metric_definitions == program KPI set`, sameSet(keys, EXPECT[program]), keys.join(","));

      // 2) Core has NO ad columns (the P0 defect)
      if (program === "foundation") {
        const ads = keys.filter((k: string) => AD_KEYS.includes(k));
        rec("[foundation] NO ad columns", ads.length === 0, ads.length ? ads.join(",") : "none");
      }
      if (program === "pipeline") {
        rec("[pipeline] HAS ad columns", AD_KEYS.every((k) => keys.includes(k)), keys.filter((k: string) => AD_KEYS.includes(k)).join(","));
      }
      if (program === "pulse") {
        const seo = keys.filter((k: string) => ["leads", "top3_keywords", "ad_spend"].includes(k));
        rec("[pulse] social-only (no SEO/ad keys)", seo.length === 0, seo.length ? seo.join(",") : "clean");
      }

      // 3) integration-ready: source key present on every def
      rec(`[${program}] every KPI carries a source key`, defs.every((d: any) => !!d.source), defs.map((d: any) => `${d.key}:${d.source}`).slice(0, 3).join(" "));

      // 4) TS resolver ↔ SQL materialization parity (one consistent path)
      const tsKeys = (await resolveClientKpis(admin, id)).map((k) => k.key);
      rec(`[${program}] TS resolveClientKpis == metric_definitions`, sameSet(tsKeys, keys), `${tsKeys.length} keys`);
    }

    // 5) DATA PRESERVATION across a program change
    {
      const id = await mkClient("pipeline");
      made.push(id);
      const { data: adDef } = await admin.from("metric_definitions").select("id").eq("client_id", id).eq("key", "ad_spend").single();
      await admin.from("metric_entries").insert({ client_id: id, definition_id: adDef!.id, period: "2026-05-01", value_numeric: 1234 });

      // downgrade pipeline → foundation: ad_spend leaves the program set
      await admin.from("clients").update({ program: "foundation" }).eq("id", id);
      const { data: adAfter } = await admin.from("metric_definitions").select("is_active").eq("id", adDef!.id).single();
      const { data: entryAfter } = await admin.from("metric_entries").select("value_numeric").eq("definition_id", adDef!.id).eq("period", "2026-05-01").maybeSingle();
      rec("preservation: out-of-program KPI DEACTIVATED not deleted", adAfter?.is_active === false, `is_active=${adAfter?.is_active}`);
      rec("preservation: entered number NOT orphaned", entryAfter?.value_numeric === 1234, `value=${entryAfter?.value_numeric}`);
      const fDefs = (await activeDefs(id)).map((d: any) => d.key);
      rec("preservation: now shows Core set (no ad columns)", sameSet(fDefs, EXPECT.foundation), fDefs.join(","));

      // re-upgrade foundation → pipeline: ad_spend reactivates WITH history
      await admin.from("clients").update({ program: "pipeline" }).eq("id", id);
      const { data: adBack } = await admin.from("metric_definitions").select("is_active").eq("id", adDef!.id).single();
      const { data: entryBack } = await admin.from("metric_entries").select("value_numeric").eq("definition_id", adDef!.id).eq("period", "2026-05-01").maybeSingle();
      rec("preservation: KPI REACTIVATES on re-include", adBack?.is_active === true, `is_active=${adBack?.is_active}`);
      rec("preservation: history intact after reactivation", entryBack?.value_numeric === 1234, `value=${entryBack?.value_numeric}`);
    }
  } finally {
    for (const id of made) await admin.from("clients").delete().eq("id", id); // cascade
    const { data: left } = await admin.from("clients").select("id").like("slug", "zz-kpi-%");
    rec("teardown — all KPI test clients removed", (left?.length ?? 0) === 0, `${left?.length ?? 0} left`);
  }

  let failed = 0;
  for (const r of results) { console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.check}${r.detail ? `  — ${r.detail}` : ""}`); if (!r.pass) failed++; }
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  if (failed) process.exit(1);
  console.log("Program-driven KPI verification passed. ✓");
}

main().catch((e) => { console.error(e); process.exit(1); });
