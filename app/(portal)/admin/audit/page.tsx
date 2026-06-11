import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ACTIONS = [
  "client.created",
  "client.updated",
  "client.status_changed",
  "user.invited",
  "user.invite_failed",
  "user.deactivated",
  "user.reactivated",
  "assignment.created",
  "assignment.removed",
  "password_reset.requested",
  "password_reset.failed",
];

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs";

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
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-muted-foreground">
          Every mutation, newest first (latest 200).
        </p>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-lg border p-4"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="client" className="text-xs text-muted-foreground">
            Client
          </label>
          <select
            id="client"
            name="client"
            defaultValue={clientFilter ?? ""}
            className={selectClass}
          >
            <option value="">All clients</option>
            {(clients ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="action" className="text-xs text-muted-foreground">
            Action
          </label>
          <select
            id="action"
            name="action"
            defaultValue={actionFilter ?? ""}
            className={selectClass}
          >
            <option value="">All actions</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm">
          Filter
        </Button>
        {(clientFilter || actionFilter) && (
          <Button asChild variant="ghost" size="sm">
            <a href="/admin/audit">Clear</a>
          </Button>
        )}
      </form>

      {!logs || logs.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          No audit entries match.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
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
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(l.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm">
                    {l.actor_id ? (actorName.get(l.actor_id) ?? "—") : "system"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{l.action}</TableCell>
                  <TableCell className="text-sm">
                    {l.client_id ? (clientName.get(l.client_id) ?? "—") : "—"}
                  </TableCell>
                  <TableCell className="max-w-[18rem] truncate font-mono text-xs text-muted-foreground">
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
