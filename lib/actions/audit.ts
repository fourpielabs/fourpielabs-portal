"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { formatDateTime } from "@/lib/format";

export type AuditExportFilters = {
  client?: string;
  action?: string;
  from?: string; // YYYY-MM-DD inclusive
  to?: string; // YYYY-MM-DD inclusive
};

type ExportResult =
  | { ok: true; csv: string; filename: string; count: number }
  | { ok: false; error: string };

// RFC-4180-ish escaping: quote fields containing comma/quote/newline/CR; double inner quotes.
function csvField(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const csvRow = (cells: unknown[]) => cells.map(csvField).join(",");

// Cap a single export so a compliance pull can't accidentally stream the entire table.
const EXPORT_CAP = 10_000;

/**
 * Staff/ADMIN-ONLY audit CSV export. Runs through the SAME requireRole(["admin"]) gate +
 * the RLS-protected user-scoped client as viewing the audit log — a client/team-without-
 * access cannot call it (the audit_log_admin_select policy denies non-admin reads anyway).
 * Exports the FILTERED set (client + action + date range), not the whole table.
 *
 * NOTE: the schema does NOT capture a request IP (no audit_log.ip column; logAudit records
 * actor/action/entity/client/metadata/created_at). The "Details" column carries the
 * metadata JSON shown in the audit view; there is no IP field to export.
 */
export async function exportAuditCsvAction(filters: AuditExportFilters): Promise<ExportResult> {
  await requireRole(["admin"]); // server-side gate — never UI-only
  const supabase = await createClient();

  let query = supabase
    .from("audit_log")
    .select("id, actor_id, action, entity, entity_id, client_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(EXPORT_CAP);
  if (filters.client) query = query.eq("client_id", filters.client);
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.from) query = query.gte("created_at", `${filters.from}T00:00:00.000Z`);
  if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59.999Z`);

  const { data: logs, error } = await query;
  if (error) return { ok: false, error: error.message };

  const [{ data: clients }, { data: profiles }] = await Promise.all([
    supabase.from("clients").select("id, name"),
    supabase.from("profiles").select("id, full_name, email"),
  ]);
  const clientName = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const actorName = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? p.email ?? "—"]));

  const header = ["When", "Actor", "Action", "Entity", "Entity ID", "Client", "Details"];
  const lines = [csvRow(header)];
  for (const l of logs ?? []) {
    lines.push(
      csvRow([
        formatDateTime(l.created_at),
        l.actor_id ? (actorName.get(l.actor_id) ?? "—") : "—",
        l.action,
        l.entity ?? "",
        l.entity_id ?? "",
        l.client_id ? (clientName.get(l.client_id) ?? "—") : "",
        l.metadata && Object.keys(l.metadata).length ? JSON.stringify(l.metadata) : "",
      ]),
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const range = filters.from || filters.to ? `_${filters.from ?? "start"}_${filters.to ?? stamp}` : "";
  return { ok: true, csv: lines.join("\r\n"), filename: `audit-log${range}_${stamp}.csv`, count: (logs ?? []).length };
}
