import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { formatDate } from "@/lib/format";
import { AuditFilters } from "@/components/admin/audit-filters";
import { EmptyState } from "@/components/ui/empty-state";
import { AUDIT_ACTIONS } from "@/lib/audit-actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; action?: string }>;
}) {
  await requireRole(["admin"]);
  const { client: clientFilter, action: actionFilter } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("audit_log")
    .select("id, actor_id, action, entity, entity_id, client_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (clientFilter) query = query.eq("client_id", clientFilter);
  if (actionFilter) query = query.eq("action", actionFilter);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.015em]">Audit log</h1>
        <p className="text-sm text-ink-2">Every mutation, newest first (latest 200).</p>
      </div>

      <AuditFilters
        clients={clients ?? []}
        actions={AUDIT_ACTIONS}
        current={{ client: clientFilter, action: actionFilter }}
      />

      {!logs || logs.length === 0 ? (
        <EmptyState title="No audit entries match" description="Try clearing the filters." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border shadow-e2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap text-xs text-ink-3">
                    {formatDate(l.created_at)}
                  </TableCell>
                  <TableCell className="text-[13px]">
                    {l.actor_id ? (actorName.get(l.actor_id) ?? "—") : "system"}
                  </TableCell>
                  <TableCell>
                    <span className="inline-block rounded-full border border-border bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-ink-2">
                      {l.action}
                    </span>
                  </TableCell>
                  <TableCell className="text-[13px]">
                    {l.client_id ? (clientName.get(l.client_id) ?? "—") : "—"}
                  </TableCell>
                  <TableCell
                    className="max-w-[18rem] truncate font-mono text-xs text-ink-3"
                    title={
                      l.metadata && Object.keys(l.metadata).length
                        ? JSON.stringify(l.metadata)
                        : undefined
                    }
                  >
                    {l.metadata && Object.keys(l.metadata).length
                      ? JSON.stringify(l.metadata)
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
