/**
 * Intake wizard — config-as-data types + PURE logic (visibility, validation,
 * budget, brief). The config lives in the DB (intake_config), so staff adjust the
 * steps/branches/budget without code. These helpers drive the generic renderer.
 *
 * CRITICAL invariant (the "can't submit" bug guard): required-field validation
 * runs ONLY over fields that are VISIBLE on the current path (stepVisible +
 * fieldVisible). A required field on a branch step is required only when that
 * branch is shown — so every path's required fields are reachable + submittable.
 */
export type ShowIf = { field: string; equals: string };
export type IntakeOption = { value: string; label: string; addMin?: number; addMax?: number; mult?: number };
export type IntakeFieldType = "service" | "text" | "textarea" | "select" | "radio" | "multiselect" | "date" | "assets";
export type IntakeField = {
  key: string;
  type: IntakeFieldType;
  label: string;
  required?: boolean;
  placeholder?: string;
  help?: string;
  default?: string;
  options?: IntakeOption[];
  showIf?: ShowIf;
};
export type IntakeStep = { key: string; title: string; showIf?: ShowIf; fields: IntakeField[] };
export type IntakeService = { key: string; label: string; desc?: string; estimateMin: number; estimateMax: number };
export type IntakeConfig = {
  kickoff?: { calLink?: string; note?: string };
  services: IntakeService[];
  steps: IntakeStep[];
};
export type IntakeAnswers = Record<string, string | string[] | undefined>;
export type IntakeAsset = { name: string; path: string };

const matches = (rule: ShowIf | undefined, answers: IntakeAnswers) =>
  !rule || answers[rule.field] === rule.equals;

export const stepVisible = (step: IntakeStep, answers: IntakeAnswers) => matches(step.showIf, answers);
export const fieldVisible = (field: IntakeField, answers: IntakeAnswers) => matches(field.showIf, answers);
export const visibleSteps = (config: IntakeConfig, answers: IntakeAnswers) =>
  config.steps.filter((s) => stepVisible(s, answers));

const isEmpty = (v: string | string[] | undefined) =>
  v == null || (Array.isArray(v) ? v.length === 0 : String(v).trim() === "");

/** Errors for the VISIBLE required fields of a step. Hidden fields never block. */
export function validateStep(step: IntakeStep, answers: IntakeAnswers): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of step.fields) {
    if (f.required && fieldVisible(f, answers) && isEmpty(answers[f.key])) errors[f.key] = `${f.label} is required`;
  }
  return errors;
}

/** True only if every visible step validates — the real "can I submit?" answer. */
export function allValid(config: IntakeConfig, answers: IntakeAnswers): boolean {
  return visibleSteps(config, answers).every((s) => Object.keys(validateStep(s, answers)).length === 0);
}

const asArray = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : v ? [v] : []);

/** Live budget estimate: service base + selected option add-ons, × any rush mult. */
export function computeEstimate(config: IntakeConfig, answers: IntakeAnswers): { min: number; max: number } | null {
  const svc = config.services.find((s) => s.key === answers.service);
  if (!svc) return null;
  let min = svc.estimateMin, max = svc.estimateMax, mult = 1;
  for (const step of visibleSteps(config, answers)) {
    for (const f of step.fields) {
      if (!fieldVisible(f, answers) || !f.options) continue;
      if (f.type !== "multiselect" && f.type !== "radio") continue;
      const sel = asArray(answers[f.key]);
      for (const opt of f.options) {
        if (!sel.includes(opt.value)) continue;
        min += opt.addMin ?? 0;
        max += opt.addMax ?? 0;
        if (opt.mult) mult = Math.max(mult, opt.mult);
      }
    }
  }
  return { min: Math.round(min * mult), max: Math.round(max * mult) };
}

const fmtMoney = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
export const formatEstimate = (e: { min: number; max: number } | null) =>
  e ? `${fmtMoney(e.min)} – ${fmtMoney(e.max)}` : "—";

/** A human label for an answer value (resolves option labels). */
function answerLabel(field: IntakeField | undefined, value: string): string {
  return field?.options?.find((o) => o.value === value)?.label ?? value;
}

/** Compose a readable project brief from the answers (the structured context). */
export function buildBrief(config: IntakeConfig, answers: IntakeAnswers, estimate: { min: number; max: number } | null): string {
  const svc = config.services.find((s) => s.key === answers.service);
  const lines: string[] = [];
  if (svc) lines.push(`**Service:** ${svc.label}`);
  if (answers.goal) lines.push(`\n**Goal**\n${answers.goal}`);
  const fieldByKey = new Map<string, IntakeField>();
  for (const s of config.steps) for (const f of s.fields) fieldByKey.set(f.key, f);

  const detailKeys = ["tech_stack", "has_domain", "hosting", "current_stack", "systems", "data_sensitivity", "branding_scope", "have_brand", "features", "timeline"];
  const details: string[] = [];
  for (const k of detailKeys) {
    const v = answers[k];
    if (isEmpty(v)) continue;
    const f = fieldByKey.get(k);
    const text = Array.isArray(v) ? v.map((x) => answerLabel(f, x)).join(", ") : answerLabel(f, String(v));
    details.push(`- ${f?.label ?? k}: ${text}`);
  }
  if (details.length) lines.push(`\n**Details**\n${details.join("\n")}`);
  if (answers.notes) lines.push(`\n**Notes**\n${answers.notes}`);
  if (estimate) lines.push(`\n**Estimated range (to confirm on the call):** ${formatEstimate(estimate)}`);
  return lines.join("\n");
}
