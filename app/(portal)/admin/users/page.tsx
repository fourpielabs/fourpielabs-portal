import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/guards";
import { labelOf, ROLES } from "@/lib/constants";
import { InviteForm } from "@/components/admin/invite-form";
import { UserActiveToggle } from "@/components/admin/user-active-toggle";
import { PendingInviteActions } from "@/components/admin/pending-invite-actions";
import { StatusChip } from "@/components/ui/status-chip";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminUsersPage() {
  const me = await requireRole(["admin"]);
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const [{ data: profiles }, { data: clients }, { data: assignments }, authList] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, role, is_active, client_id")
        .order("role")
        .order("full_name"),
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("client_assignments").select("user_id, client_id"),
      adminClient.auth.admin.listUsers({ perPage: 1000 }),
    ]);

  // pending = invited but never accepted (no email_confirmed_at on the auth user)
  const confirmed = new Map(
    (authList.data?.users ?? []).map((u) => [u.id, Boolean(u.email_confirmed_at)]),
  );
  const isPending = (p: { id: string; is_active: boolean }) =>
    p.is_active && confirmed.get(p.id) === false;

  const clientName = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const assignedByUser = new Map<string, string[]>();
  for (const a of assignments ?? []) {
    const list = assignedByUser.get(a.user_id) ?? [];
    list.push(clientName.get(a.client_id) ?? "—");
    assignedByUser.set(a.user_id, list);
  }

  function scopeFor(p: { id: string; role: string; client_id: string | null }) {
    if (p.role === "client")
      return p.client_id ? (clientName.get(p.client_id) ?? "—") : "—";
    if (p.role === "team") {
      const list = assignedByUser.get(p.id) ?? [];
      return list.length ? list.join(", ") : "No assignments";
    }
    return "All clients";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.015em]">Users</h1>
        <p className="text-sm text-ink-2">
          Invite users, manage roles &amp; access, and deactivate accounts.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invite a user</CardTitle>
          <CardDescription>
            Sends a Supabase invitation. Client invites require a client. If a
            send fails you&apos;ll see a specific reason (and it&apos;s recorded
            in the audit log).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteForm clients={clients ?? []} />
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Access</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(profiles ?? []).map((p) => {
              const pending = isPending(p);
              const self = p.id === me.id;
              const statusValue = !p.is_active ? "inactive" : pending ? "pending" : "active";
              return (
                <TableRow
                  key={p.id}
                  className={
                    pending ? "bg-[var(--pending-row)]" : !p.is_active ? "opacity-60" : ""
                  }
                >
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      <span className={!p.is_active ? "text-ink-faint line-through" : ""}>
                        {p.full_name ?? "—"}
                      </span>
                      {self && (
                        <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-ink-2">
                          You
                        </span>
                      )}
                    </span>
                    <div className="text-xs text-ink-3">{p.email}</div>
                  </TableCell>
                  <TableCell>{labelOf(ROLES, p.role)}</TableCell>
                  <TableCell className="max-w-[16rem] text-sm text-ink-3">
                    {scopeFor(p)}
                  </TableCell>
                  <TableCell>
                    <StatusChip kind="user" value={statusValue} />
                  </TableCell>
                  <TableCell className="text-right">
                    {pending ? (
                      <PendingInviteActions
                        userId={p.id}
                        label={p.full_name ?? p.email ?? "this user"}
                      />
                    ) : (
                      <UserActiveToggle
                        userId={p.id}
                        isActive={p.is_active}
                        isSelf={p.id === me.id}
                        label={p.full_name ?? p.email ?? "this user"}
                      />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
