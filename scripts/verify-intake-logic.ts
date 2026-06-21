/**
 * Intake logic proof (Track C) — the "no hidden-required-field" guarantee.
 * Loads the live intake_config and, for EVERY service branch, fills the required
 * VISIBLE fields and asserts the form submits (allValid). It also asserts that a
 * required field on a DIFFERENT branch (hidden on this path) never blocks submit —
 * the classic conditional-form bug. Pure logic; touches no data.
 *
 * Run: npx tsx scripts/verify-intake-logic.ts
 */
import { config as dotenv } from "dotenv";
dotenv({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import {
  type IntakeConfig, type IntakeAnswers,
  visibleSteps, fieldVisible, validateStep, allValid, computeEstimate,
} from "../lib/intake/config";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const results: { check: string; pass: boolean; detail: string }[] = [];
const rec = (check: string, pass: boolean, detail = "") => { results.push({ check, pass, detail }); };

function fillRequiredVisible(config: IntakeConfig, answers: IntakeAnswers) {
  for (const step of visibleSteps(config, answers)) {
    for (const f of step.fields) {
      if (!f.required || !fieldVisible(f, answers)) continue;
      const cur = answers[f.key];
      const empty = cur == null || cur === "" || (Array.isArray(cur) && cur.length === 0);
      if (!empty) continue;
      if (f.options?.length) answers[f.key] = f.type === "multiselect" ? [f.options[0].value] : f.options[0].value;
      else answers[f.key] = f.key === "title" ? "Test project" : "Sample answer";
    }
  }
}

async function main() {
  const { data } = await admin.from("intake_config").select("config").eq("is_active", true).order("created_at", { ascending: false }).limit(1).single();
  const config = data!.config as IntakeConfig;
  rec("loaded live intake_config", !!config?.services?.length && !!config?.steps?.length, `${config.services.length} services / ${config.steps.length} steps`);

  // collect EVERY required field key across all branch steps (to prove cross-branch hiding)
  const allRequiredKeys = new Set<string>();
  for (const s of config.steps) for (const f of s.fields) if (f.required) allRequiredKeys.add(f.key);

  for (const svc of config.services) {
    const answers: IntakeAnswers = { service: svc.key };
    fillRequiredVisible(config, answers);

    // 1) every branch SUBMITS once its visible required fields are filled
    rec(`[${svc.key}] submits (allValid)`, allValid(config, answers), Object.keys(answers).join(","));

    // 2) per-step: no visible required field left unfilled
    const stepErrors = visibleSteps(config, answers).flatMap((s) => Object.keys(validateStep(s, answers)));
    rec(`[${svc.key}] zero visible required errors`, stepErrors.length === 0, stepErrors.join(",") || "none");

    // 3) NO hidden-required-field bug: required keys NOT on this path are absent from
    //    answers yet allValid is still true (they never block this branch)
    const visibleKeys = new Set(visibleSteps(config, answers).flatMap((s) => s.fields.filter((f) => fieldVisible(f, answers)).map((f) => f.key)));
    const hiddenRequired = [...allRequiredKeys].filter((k) => !visibleKeys.has(k));
    const noneFilled = hiddenRequired.every((k) => answers[k] == null);
    rec(`[${svc.key}] hidden required fields don't block`, noneFilled && allValid(config, answers), hiddenRequired.length ? `hidden: ${hiddenRequired.join(",")}` : "none hidden");

    // 4) estimator yields a range
    const est = computeEstimate(config, answers);
    rec(`[${svc.key}] estimate computed`, !!est && est.min > 0 && est.max >= est.min, est ? `$${est.min}-$${est.max}` : "none");
  }

  // 5) explicit: web_dev path hides ai's required "systems" but still submits
  {
    const a: IntakeAnswers = { service: "web_dev" };
    fillRequiredVisible(config, a);
    const aiStepVisible = visibleSteps(config, a).some((s) => s.key === "ai");
    rec("[guard] web_dev does NOT show the AI step", !aiStepVisible && a["systems"] == null && allValid(config, a), `aiVisible=${aiStepVisible} systems=${a["systems"] ?? "unset"}`);
  }
  // 6) rush multiplier raises the estimate
  {
    const base: IntakeAnswers = { service: "web_dev" }; fillRequiredVisible(config, base);
    const rush: IntakeAnswers = { ...base, timeline: "rush" };
    const eb = computeEstimate(config, base)!, er = computeEstimate(config, rush)!;
    rec("[budget] rush timeline raises the estimate", er.max > eb.max, `${eb.max} -> ${er.max}`);
  }
  // 7) selecting a paid feature raises the estimate
  {
    const base: IntakeAnswers = { service: "ai_automation" }; fillRequiredVisible(config, base);
    const withFeat: IntakeAnswers = { ...base, features: ["ai_features"] };
    const eb = computeEstimate(config, base)!, ef = computeEstimate(config, withFeat)!;
    rec("[budget] adding a feature raises the estimate", ef.max > eb.max, `${eb.max} -> ${ef.max}`);
  }

  let failed = 0;
  for (const r of results) { console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.check}${r.detail ? `  — ${r.detail}` : ""}`); if (!r.pass) failed++; }
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  if (failed) process.exit(1);
  console.log("Intake logic verified (every branch submits; no hidden-required-field bug). ✓");
}
main().catch((e) => { console.error(e); process.exit(1); });
