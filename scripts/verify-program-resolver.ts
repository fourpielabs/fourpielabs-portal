/**
 * P1 verification: the program-catalog mirror trigger + the included-set resolver.
 * Creates one PROGRAM client per type (service role → trigger mirrors clients.program
 * into client_programs), runs resolveClientPrograms, asserts the stacking + Pulse-only
 * clean state + derived "not included", then tears everything down.
 *
 * Run: npx tsx scripts/verify-program-resolver.ts   (NON-DESTRUCTIVE — self-cleans)
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { resolveClientPrograms } from "../lib/programs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

type Case = { key: string; expectIncluded: string[]; expectNotIncluded: string[] };
const CASES: Case[] = [
  { key: "foundation", expectIncluded: ["foundation"], expectNotIncluded: ["pipeline", "operating_system", "pulse"] },
  { key: "pipeline", expectIncluded: ["foundation", "pipeline"], expectNotIncluded: ["operating_system", "pulse"] },
  { key: "operating_system", expectIncluded: ["foundation", "pipeline", "operating_system"], expectNotIncluded: ["pulse"] },
  { key: "pulse", expectIncluded: ["pulse"], expectNotIncluded: [] },
];

const results: { check: string; pass: boolean; detail: string }[] = [];
const rec = (check: string, pass: boolean, detail = "") => results.push({ check, pass, detail });
const sameSet = (a: string[], b: string[]) => a.length === b.length && [...new Set(a)].sort().join(",") === [...new Set(b)].sort().join(",");

async function main() {
  const made: string[] = [];
  try {
    for (const c of CASES) {
      const slug = `zz-resolver-${c.key.replace(/_/g, "-")}`;
      await admin.from("clients").delete().eq("slug", slug);
      const { data: cl, error } = await admin
        .from("clients")
        .insert({ name: `ZZ ${c.key}`, slug, industry: "other_local_service", program: c.key, status: "onboarding", client_type: "program" })
        .select("id")
        .single();
      if (error) throw error;
      made.push(cl!.id);

      // 1) mirror trigger created exactly the matching client_programs row
      const { data: cp } = await admin.from("client_programs").select("program_id, programs(key)").eq("client_id", cl!.id);
      const cpKeys = (cp ?? []).map((r: any) => r.programs.key);
      rec(`[${c.key}] mirror trigger → client_programs`, sameSet(cpKeys, [c.key]), cpKeys.join(",") || "(none)");

      // 2) resolver: included + notIncluded program sets
      const r = await resolveClientPrograms(admin, cl!.id);
      const inclKeys = [...new Set(r.included.map((s) => s.programKey))];
      const notInclKeys = [...new Set(r.notIncluded.map((s) => s.programKey))];
      rec(`[${c.key}] included programs`, sameSet(inclKeys, c.expectIncluded), inclKeys.join("+"));
      rec(`[${c.key}] not-included programs`, sameSet(notInclKeys, c.expectNotIncluded), notInclKeys.join("+"));

      // 3) Pulse-only clean state: NO core (SEO/ads) services leak into included
      if (c.key === "pulse") {
        const leak = r.included.filter((s) => s.programKey !== "pulse");
        rec(`[pulse] clean state — no SEO/ads shells in included`, leak.length === 0, leak.length ? leak.map((s) => s.label).join(", ") : "clean");
        rec(`[pulse] included is social-only`, r.included.length > 0 && r.included.every((s) => s.programKey === "pulse"), `${r.included.length} services`);
      }

      // 4) "available on {name}" derivation present on not-included
      const sample = r.notIncluded[0];
      if (sample) rec(`[${c.key}] not-included carries program name`, !!sample.programName, `${sample.label} → available on ${sample.programName}`);
    }
  } finally {
    for (const id of made) await admin.from("clients").delete().eq("id", id);
    // confirm teardown: no resolver test clients remain
    const { data: leftover } = await admin.from("clients").select("id").like("slug", "zz-resolver-%");
    rec("teardown — all test clients removed", (leftover?.length ?? 0) === 0, `${leftover?.length ?? 0} left`);
    const { count } = await admin.from("client_programs").select("client_id", { count: "exact", head: true });
    rec("teardown — client_programs back to baseline (0)", (count ?? -1) === 0, `${count} rows`);
  }

  let failed = 0;
  for (const r of results) {
    console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.check}${r.detail ? `  — ${r.detail}` : ""}`);
    if (!r.pass) failed++;
  }
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  if (failed) process.exit(1);
  console.log("Resolver + mirror-trigger verification passed. ✓");
}

main().catch((e) => { console.error(e); process.exit(1); });
