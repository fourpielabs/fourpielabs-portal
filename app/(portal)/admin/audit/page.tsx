import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { formatDateTime } from "@/lib/format";
import { AUDIT_ACTIONS } from "@/lib/audit-actions";
import { AuditFilters } from "@/components/redesign/staff/audit-filters";
import { AuditBody, type AuditRow } from "@/components/redesign/staff/audit-body";
import { StaffPageFrame, StaffPageHeader } from "@/components/redesign/staff/ui";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; action?: string; from?: string; to?: string }>;
}) {
  await requireRole(["admin"]);
  const { client: clientFilter, action: actionFilter, from, to } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("audit_log")
    .select("id, actor_id, action, entity, entity_id, client_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (clientFilter) query = query.eq("client_id", clientFilter);
  if (actionFilter) query = query.eq("action", actionFilter);
  if (from) query = query.gte("created_at", `${from}T00:00:00.000Z`);
  if (to) query = query.lte("created_at", `${to}T23:59:59.999Z`);

  const [{ data: logs }, { data: clients }, { data: profiles }] =
    await Promise.all([
      query,
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("profiles").select("id, full_name, email"),
    ]);

  const clientName = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const actorName = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name ?? p.email ?? "—"]),
  );

  // Shape the serialisable rows for the client body (presentation only; the
  // requireRole guard + RLS-scoped reads stay here). Audit is admin-only, so the
  // actor → /admin/users + client → /clients/{id} links never 404/leak.
  const rows: AuditRow[] = (logs ?? []).map((l) => ({
    id: l.id,
    time: formatDateTime(l.created_at),
    actorId: l.actor_id,
    actorName: l.actor_id ? (actorName.get(l.actor_id) ?? "—") : "—",
    action: l.action,
    entity: l.entity,
    entityId: l.entity_id,
    clientId: l.client_id,
    clientName: l.client_id ? (clientName.get(l.client_id) ?? "—") : null,
    metadata: l.metadata,
  }));

  return (
    <StaffPageFrame max="90rem">
      <StaffPageHeader
        title="Audit log"
        description="Every mutation, newest first (latest 200)."
      />

      <AuditFilters
        clients={clients ?? []}
        actions={AUDIT_ACTIONS}
        current={{ client: clientFilter, action: actionFilter, from, to }}
      />

      <AuditBody rows={rows} clientFilter={clientFilter} />
    </StaffPageFrame>
  );
}
