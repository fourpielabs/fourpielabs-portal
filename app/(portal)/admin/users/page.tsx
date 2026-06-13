import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/guards";
import { labelOf, ROLES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "@/components/ui/person-avatar";
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
        .select("id, full_name, email, role, is_active, client_id, avatar_url")
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

  const lastActive = new Map(
    (authList.data?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null]),
  );
  const pendingCount = (profiles ?? []).filter(isPending).length;

  const rolePill = (role: string) =>
    role === "admin"
      ? "bg-ink text-white"
      : role === "team"
        ? "bg-surface-2 text-ink-2"
        : "border border-border-strong bg-surface text-ink-2";

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
        <h1 className="font-display text-[28px] font-semibold tracking-[-0.015em]">Users</h1>
        <p className="text-[13px] text-ink-2 tabular-nums">
          {(profiles ?? []).length} users · {pendingCount} pending invite
          {pendingCount === 1 ? "" : "s"}
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

      <div className="overflow-x-auto rounded-2xl border border-border shadow-e2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Access</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last active</TableHead>
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
                    <span className="flex items-center gap-[11px]">
                      <PersonAvatar
                        name={p.full_name}
                        email={p.email}
                        src={p.avatar_url}
                        size="md"
                        className={cn(
                          "shrink-0",
                          pending && "after:border-dashed after:border-amber-400",
                          !p.is_active && "opacity-70",
                        )}
                      />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className={!p.is_active ? "text-ink-faint line-through" : ""}>
                            {p.full_name ?? "—"}
                          </span>
                          {self && (
                            <span className="rounded-full bg-amber-100 px-[7px] py-[1.5px] text-[9.5px] font-bold tracking-[0.05em] text-amber-800 uppercase">
                              You
                            </span>
                          )}
                        </span>
                        <span className="block text-xs text-ink-3">{p.email}</span>
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-full px-2.5 py-[3px] text-[11px] font-semibold ${rolePill(p.role)}`}>
                      {labelOf(ROLES, p.role)}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[16rem] text-[13px] text-ink-3">
                    {scopeFor(p)}
                  </TableCell>
                  <TableCell>
                    <StatusChip kind="user" value={statusValue} />
                  </TableCell>
                  <TableCell className="text-[13px] text-ink-3 tabular-nums">
                    {lastActive.get(p.id) ? formatDate(lastActive.get(p.id)!) : "—"}
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
