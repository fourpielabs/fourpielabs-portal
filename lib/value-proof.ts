/**
 * Value Proof dashboard — pure derivation of OUTCOMES from the program-KPI store
 * (metric_definitions + metric_entries). NO time/hours data ever flows here — this
 * module only reads KPI definitions + entries.
 *
 * "Program-appropriate" is automatic: the caller passes the client's ACTIVE
 * metric_definitions, which IS the P2-resolved/materialized program KPI set for
 * program clients (and the staff-defined set for project clients). So a client only
 * ever sees the KPIs their program tracks — never empty ad cards.
 */
import { formatMetricValue, monthsBetween } from "@/lib/format";

export type ValueProofDef = {
  id: string;
  key: string;
  label: string;
  unit: string;
  target: number | null;
};
export type ValueProofEntry = {
  definition_id: string;
  period: string;
  value_numeric: number | null;
  value_text: string | null;
};

export type TrendPoint = { period: string; value: number | null };
export type ValueProofKpi = {
  id: string;
  key: string;
  label: string;
  unit: string;
  current: number | null;
  currentPeriod: string | null;
  prior: number | null;
  delta: number | null;
  deltaPct: number | null;
  improved: boolean | null; // delta in the "good" direction (null = no comparison)
  lowerIsBetter: boolean;
  target: number | null;
  pacingPct: number | null; // 0..1+ progress toward target (capped at 1 for the bar)
  onTrack: boolean | null;
  trend: TrendPoint[];
  display: string; // current value, unit-formatted
};
export type ValueProofWin = { label: string; deltaPct: number; up: boolean; text: string };
export type ValueProofTextNote = { label: string; value: string; period: string };
export type ValueProofCategory = { key: string; label: string; kpis: ValueProofKpi[] };
export type ValueProof = {
  hasData: boolean;
  monthLabelCurrent: string | null;
  wins: ValueProofWin[];
  categories: ValueProofCategory[];
  notes: ValueProofTextNote[];
};

// Lower value = better outcome (so a DROP is a win). Extensible by key.
const LOWER_IS_BETTER = new Set(["cost_per_lead", "blended_cost_per_lead"]);
export const isLowerBetter = (key: string) => LOWER_IS_BETTER.has(key);

// Category grouping — ordered top-funnel → business outcome so the story reads well.
const CATEGORY_ORDER: { key: string; label: string; keys: string[] }[] = [
  { key: "visibility", label: "Visibility & SEO", keys: ["top3_keywords", "map_pack_keywords", "organic_traffic", "aeo_citations"] },
  { key: "local", label: "Google Business", keys: ["gbp_calls", "profile_visits"] },
  { key: "social", label: "Social reach", keys: ["total_views", "follower_count", "follower_growth", "inbound_dms"] },
  { key: "ads", label: "Advertising", keys: ["ad_spend", "ad_conversions"] },
  { key: "leads", label: "Leads & conversions", keys: ["leads", "calls_tracked", "sales_calls_booked", "new_clients_closed", "cost_per_lead", "blended_cost_per_lead"] },
  { key: "revenue", label: "Revenue", keys: ["revenue_attributed", "pipeline_value", "revenue_this_month"] },
];
const categoryOf = (key: string) => CATEGORY_ORDER.find((c) => c.keys.includes(key))?.key ?? "other";

const pad = (n: number) => String(n).padStart(2, "0");
const monthLabel = (period: string) => {
  const d = new Date(period);
  return isNaN(d.getTime()) ? period : d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

export function buildValueProof(defs: ValueProofDef[], entries: ValueProofEntry[]): ValueProof {
  const numByDefPeriod = new Map<string, number | null>();
  const textByDefPeriod = new Map<string, string | null>();
  let minPeriod: string | null = null;
  let maxPeriod: string | null = null;
  for (const e of entries) {
    numByDefPeriod.set(`${e.definition_id}|${e.period}`, e.value_numeric);
    textByDefPeriod.set(`${e.definition_id}|${e.period}`, e.value_text);
    if (e.value_numeric != null || (e.value_text ?? "") !== "") {
      if (!minPeriod || e.period < minPeriod) minPeriod = e.period;
      if (!maxPeriod || e.period > maxPeriod) maxPeriod = e.period;
    }
  }
  const axis = minPeriod && maxPeriod ? monthsBetween(minPeriod, maxPeriod) : [];

  const numericDefs = defs.filter((d) => d.unit !== "text");
  const textDefs = defs.filter((d) => d.unit === "text");

  const kpis: ValueProofKpi[] = numericDefs.map((d) => {
    const trend: TrendPoint[] = axis.map((p) => ({ period: p, value: numByDefPeriod.get(`${d.id}|${p}`) ?? null }));
    const filled = trend.filter((t) => t.value != null);
    const last = filled.length ? filled[filled.length - 1] : null;
    const prevFilled = filled.length > 1 ? filled[filled.length - 2] : null;
    const current = last?.value ?? null;
    const prior = prevFilled?.value ?? null;
    const delta = current != null && prior != null ? current - prior : null;
    const deltaPct = delta != null && prior != null && prior !== 0 ? (delta / Math.abs(prior)) * 100 : null;
    const lowerIsBetter = isLowerBetter(d.key);
    const improved = delta == null || delta === 0 ? (delta === 0 ? false : null) : lowerIsBetter ? delta < 0 : delta > 0;
    let pacingPct: number | null = null;
    let onTrack: boolean | null = null;
    if (d.target != null && current != null && d.target !== 0) {
      pacingPct = lowerIsBetter ? (current > 0 ? Math.min(d.target / current, 1) : 1) : Math.min(current / d.target, 1);
      onTrack = lowerIsBetter ? current <= d.target : current >= d.target;
    }
    return {
      id: d.id, key: d.key, label: d.label, unit: d.unit,
      current, currentPeriod: last ? axis.find((p) => numByDefPeriod.get(`${d.id}|${p}`) === last.value) ?? null : null,
      prior, delta, deltaPct, improved, lowerIsBetter,
      target: d.target, pacingPct, onTrack, trend,
      display: formatMetricValue(d.unit, current, null),
    };
  });

  // categories (ordered; only non-empty groups)
  const categories: ValueProofCategory[] = [];
  for (const c of CATEGORY_ORDER) {
    const group = kpis.filter((k) => categoryOf(k.key) === c.key);
    if (group.length) categories.push({ key: c.key, label: c.label, kpis: group });
  }
  const other = kpis.filter((k) => categoryOf(k.key) === "other");
  if (other.length) categories.push({ key: "other", label: "Other", kpis: other });

  // wins — top improvements (period-over-period, in the good direction), plain language
  const wins: ValueProofWin[] = kpis
    .filter((k) => k.improved === true && k.deltaPct != null)
    .sort((a, b) => Math.abs(b.deltaPct!) - Math.abs(a.deltaPct!))
    .slice(0, 3)
    .map((k) => {
      const up = (k.delta ?? 0) > 0; // raw movement direction
      const pct = Math.round(Math.abs(k.deltaPct!));
      return { label: k.label, deltaPct: k.deltaPct!, up, text: `${k.label} ${up ? "up" : "down"} ${pct}%` };
    });

  // qualitative notes (text KPIs) — latest value, not cards/wins
  const notes: ValueProofTextNote[] = [];
  for (const d of textDefs) {
    let latest: { value: string; period: string } | null = null;
    for (const p of axis) {
      const v = textByDefPeriod.get(`${d.id}|${p}`);
      if (v && v.trim()) latest = { value: v, period: p };
    }
    if (latest) notes.push({ label: d.label, value: latest.value, period: latest.period });
  }

  const hasData = entries.some((e) => e.value_numeric != null || (e.value_text ?? "") !== "");
  return { hasData, monthLabelCurrent: maxPeriod ? monthLabel(maxPeriod) : null, wins, categories, notes };
}
