import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { formatDateTime } from "@/lib/format";
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

/** Render metadata as keyed key:value pills (legible vs raw JSON). */
function MetaPills({ metadata }: { metadata: unknown }) {
  const entries =
    metadata && typeof metadata === "object"
      ? Object.entries(metadata as Record<string, unknown>)
      : [];
  if (entries.length === 0) return <span className="text-ink-3">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([k, v]) => (
        <span key={k} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-2">
          <span className="text-ink-3">{k}:</span>{" "}
          {typeof v === "object" ? JSON.stringify(v) : String(v)}
        </span>
      ))}
    </div>
  );
}

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

  // Audit is admin-only (requireRole above), so admins can reach every client +
  // /admin/users — these links never 404/leak. If team access is ever added,
  // gate the client link to assigned clients.
  const actionHref = (a: string) =>
    `/admin/audit?action=${encodeURIComponent(a)}${clientFilter ? `&client=${clientFilter}` : ""}`;

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
        <>
          {/* desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-border shadow-e2 md:block">
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
                      {formatDateTime(l.created_at)}
                    </TableCell>
                    <TableCell className="text-[13px]">
                      {l.actor_id ? (
                        <Link href="/admin/users" className="hover:text-amber-700">
                          {actorName.get(l.actor_id) ?? "—"}
                        </Link>
                      ) : (
                        <span className="text-ink-3">system</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={actionHref(l.action)}
                        className="inline-block rounded-full border border-border bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-ink-2 hover:border-ink hover:text-ink"
                      >
                        {l.action}
                      </Link>
                    </TableCell>
                    <TableCell className="text-[13px]">
                      {l.client_id ? (
                        <Link href={`/clients/${l.client_id}`} className="hover:text-amber-700">
                          {clientName.get(l.client_id) ?? "—"}
                        </Link>
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[20rem]">
                      <MetaPills metadata={l.metadata} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {logs.map((l) => (
              <div
                key={l.id}
                className="rounded-2xl border border-border bg-surface p-4 shadow-e1"
              >
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={actionHref(l.action)}
                    className="rounded-full border border-border bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-ink-2"
                  >
                    {l.action}
                  </Link>
                  <span className="shrink-0 text-xs text-ink-3">
                    {formatDateTime(l.created_at)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-3">
                  <span>
                    by{" "}
                    {l.actor_id ? (
                      <Link href="/admin/users" className="text-ink-2 hover:text-amber-700">
                        {actorName.get(l.actor_id) ?? "—"}
                      </Link>
                    ) : (
                      "system"
                    )}
                  </span>
                  {l.client_id && (
                    <Link
                      href={`/clients/${l.client_id}`}
                      className="text-ink-2 hover:text-amber-700"
                    >
                      {clientName.get(l.client_id) ?? "—"}
                    </Link>
                  )}
                </div>
                <div className="mt-2">
                  <MetaPills metadata={l.metadata} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
