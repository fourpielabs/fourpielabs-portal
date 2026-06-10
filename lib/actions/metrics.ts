"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import {
  metricDefinitionSchema,
  type MetricDefinitionValues,
} from "@/lib/schemas";

type Result = { ok: true } | { ok: false; error: string };
const revalidate = (clientId: string) => {
  revalidatePath(`/clients/${clientId}/metrics`);
  revalidatePath(`/clients/${clientId}`);
};

// ---- definitions ------------------------------------------------------------

export async function createMetricDefinitionAction(
  clientId: string,
  values: MetricDefinitionValues,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const parsed = metricDefinitionSchema.safeParse(values);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;
  const supabase = await createClient();

  const { data: last } = await supabase
    .from("metric_definitions")
    .select("sort_order")
    .eq("client_id", clientId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("metric_definitions")
    .insert({
      client_id: clientId,
      key: v.key,
      label: v.label,
      unit: v.unit,
      is_active: v.is_active,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505")
      return { ok: false, error: `Key "${v.key}" already exists for this client.` };
    return { ok: false, error: error.message };
  }
  await logAudit({
    actorId: me.id,
    action: "metric_definition.created",
    entity: "metric_definition",
    entityId: data.id,
    clientId,
    metadata: { key: v.key, unit: v.unit },
  });
  revalidate(clientId);
  return { ok: true };
}

export async function updateMetricDefinitionAction(
  clientId: string,
  id: string,
  values: MetricDefinitionValues,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const parsed = metricDefinitionSchema.safeParse(values);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("metric_definitions")
    .update({ key: v.key, label: v.label, unit: v.unit, is_active: v.is_active })
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) {
    if (error.code === "23505")
      return { ok: false, error: `Key "${v.key}" already exists for this client.` };
    return { ok: false, error: error.message };
  }
  await logAudit({
    actorId: me.id,
    action: "metric_definition.updated",
    entity: "metric_definition",
    entityId: id,
    clientId,
  });
  revalidate(clientId);
  return { ok: true };
}

export async function setMetricDefinitionActiveAction(
  clientId: string,
  id: string,
  active: boolean,
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("metric_definitions")
    .update({ is_active: active })
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorId: me.id,
    action: active ? "metric_definition.reactivated" : "metric_definition.deactivated",
    entity: "metric_definition",
    entityId: id,
    clientId,
  });
  revalidate(clientId);
  return { ok: true };
}

export async function moveMetricDefinitionAction(
  clientId: string,
  id: string,
  direction: "up" | "down",
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("metric_definitions")
    .select("id, sort_order")
    .eq("id", id)
    .eq("client_id", clientId)
    .single();
  if (!current) return { ok: false, error: "Definition not found" };
  let q = supabase
    .from("metric_definitions")
    .select("id, sort_order")
    .eq("client_id", clientId);
  q =
    direction === "up"
      ? q.lt("sort_order", current.sort_order)
      : q.gt("sort_order", current.sort_order);
  const { data: neighbor } = await q
    .order("sort_order", { ascending: direction === "down" })
    .limit(1)
    .maybeSingle();
  if (!neighbor) return { ok: true };
  await supabase
    .from("metric_definitions")
    .update({ sort_order: neighbor.sort_order })
    .eq("id", current.id)
    .eq("client_id", clientId);
  await supabase
    .from("metric_definitions")
    .update({ sort_order: current.sort_order })
    .eq("id", neighbor.id)
    .eq("client_id", clientId);

  await logAudit({
    actorId: me.id,
    action: "metric_definition.reordered",
    entity: "metric_definition",
    entityId: id,
    clientId,
    metadata: { direction },
  });
  revalidate(clientId);
  return { ok: true };
}

// ---- entries ----------------------------------------------------------------

function normalizePeriod(input: string): string | null {
  const m = input.trim().match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return `${m[1]}-${m[2]}-01`; // metric periods are first-of-month
}

/** Fetch a month's entries keyed by definition_id. */
export async function getMonthEntriesAction(
  clientId: string,
  period: string,
): Promise<
  | { ok: true; entries: Record<string, { numeric: number | null; text: string | null }> }
  | { ok: false; error: string }
> {
  await requireClientAccess(clientId);
  const p = normalizePeriod(period);
  if (!p) return { ok: false, error: "Invalid period" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("metric_entries")
    .select("definition_id, value_numeric, value_text")
    .eq("client_id", clientId)
    .eq("period", p);
  if (error) return { ok: false, error: error.message };
  const entries: Record<string, { numeric: number | null; text: string | null }> = {};
  for (const e of data ?? [])
    entries[e.definition_id] = { numeric: e.value_numeric, text: e.value_text };
  return { ok: true, entries };
}

/**
 * Upsert a whole month at once (one row per definition). Upsert on
 * (definition_id, period) so re-entering a month UPDATES rather than duplicates.
 */
export async function saveMonthEntriesAction(
  clientId: string,
  period: string,
  values: { definition_id: string; value: string }[],
): Promise<Result> {
  const me = await requireClientAccess(clientId);
  const p = normalizePeriod(period);
  if (!p) return { ok: false, error: "Invalid period" };
  const supabase = await createClient();

  const { data: defs } = await supabase
    .from("metric_definitions")
    .select("id, unit")
    .eq("client_id", clientId);
  const unitById = new Map((defs ?? []).map((d) => [d.id, d.unit]));

  const rows = values
    .filter((v) => unitById.has(v.definition_id))
    .map((v) => {
      const unit = unitById.get(v.definition_id);
      const raw = v.value.trim();
      const isText = unit === "text";
      const numeric =
        !isText && raw !== "" && !Number.isNaN(Number(raw)) ? Number(raw) : null;
      return {
        client_id: clientId,
        definition_id: v.definition_id,
        period: p,
        value_numeric: isText ? null : numeric,
        value_text: isText ? (raw === "" ? null : raw) : null,
        created_by: me.id,
      };
    });

  if (rows.length === 0) return { ok: true };

  const { error } = await supabase
    .from("metric_entries")
    .upsert(rows, { onConflict: "definition_id,period" });
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: me.id,
    action: "metric_entries.saved",
    entity: "metric_entries",
    clientId,
    metadata: { period: p, count: rows.length },
  });
  revalidate(clientId);
  return { ok: true };
}

/** Commit parsed CSV rows; validates each and reports per-row errors. */
export async function commitCsvAction(
  clientId: string,
  rows: { line: number; metric_key: string; period: string; value: string }[],
): Promise<
  | { ok: true; committed: number; errors: { line: number; message: string }[] }
  | { ok: false; error: string }
> {
  const me = await requireClientAccess(clientId);
  const supabase = await createClient();

  const { data: defs } = await supabase
    .from("metric_definitions")
    .select("id, key, unit")
    .eq("client_id", clientId);
  const byKey = new Map((defs ?? []).map((d) => [d.key, d]));

  const errors: { line: number; message: string }[] = [];
  const valid: Record<string, unknown>[] = [];

  for (const r of rows) {
    const def = byKey.get(r.metric_key.trim());
    if (!def) {
      errors.push({ line: r.line, message: `Unknown metric_key "${r.metric_key}"` });
      continue;
    }
    const p = normalizePeriod(r.period);
    if (!p) {
      errors.push({ line: r.line, message: `Bad period "${r.period}" (use YYYY-MM)` });
      continue;
    }
    const raw = r.value.trim();
    if (def.unit !== "text" && raw !== "" && Number.isNaN(Number(raw))) {
      errors.push({
        line: r.line,
        message: `Value "${r.value}" must be numeric for ${def.key}`,
      });
      continue;
    }
    valid.push({
      client_id: clientId,
      definition_id: def.id,
      period: p,
      value_numeric: def.unit === "text" ? null : raw === "" ? null : Number(raw),
      value_text: def.unit === "text" ? (raw === "" ? null : raw) : null,
      created_by: me.id,
    });
  }

  if (valid.length > 0) {
    const { error } = await supabase
      .from("metric_entries")
      .upsert(valid, { onConflict: "definition_id,period" });
    if (error) return { ok: false, error: error.message };
    await logAudit({
      actorId: me.id,
      action: "metric_entries.csv_import",
      entity: "metric_entries",
      clientId,
      metadata: { committed: valid.length, errors: errors.length },
    });
    revalidate(clientId);
  }

  return { ok: true, committed: valid.length, errors };
}
