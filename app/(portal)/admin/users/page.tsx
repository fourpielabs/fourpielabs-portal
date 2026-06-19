import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/guards";
import { formatRelative } from "@/lib/format";
import { StaffPageFrame, StaffPageHeader } from "@/components/redesign/staff/ui";
import { UsersBody, type UserRow } from "@/components/redesign/staff/users-body";

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

  const confirmed = new Map(
    (authList.data?.users ?? []).map((u) => [u.id, Boolean(u.email_confirmed_at)]),
  );
  const isPending = (p: { id: string; is_active: boolean }) =>
    p.is_active && confirmed.get(p.id) === false;
  const lastActive = new Map(
    (authList.data?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null]),
  );

  const clientName = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const assignedByUser = new Map<string, string[]>();
  for (const a of assignments ?? []) {
    const list = assignedByUser.get(a.user_id) ?? [];
    list.push(clientName.get(a.client_id) ?? "—");
    assignedByUser.set(a.user_id, list);
  }
  function scopeFor(p: { id: string; role: string; client_id: string | null }) {
    if (p.role === "client") return p.client_id ? (clientName.get(p.client_id) ?? "—") : "—";
    if (p.role === "team") {
      const list = assignedByUser.get(p.id) ?? [];
      return list.length ? list.join(", ") : "No assignments";
    }
    return "All clients";
  }

  const all = profiles ?? [];
  const pendingCount = all.filter(isPending).length;
  const rows: UserRow[] = all.map((p) => {
    const pending = isPending(p);
    const la = lastActive.get(p.id);
    return {
      id: p.id,
      name: p.full_name,
      email: p.email,
      role: p.role,
      avatar_url: p.avatar_url,
      isActive: p.is_active,
      pending,
      isSelf: p.id === me.id,
      statusValue: !p.is_active ? "inactive" : pending ? "pending" : "active",
      scope: scopeFor(p),
      lastActive: la ? formatRelative(la) : null,
    };
  });

  return (
    <StaffPageFrame max="90rem">
      <StaffPageHeader
        title="Users"
        description={`${all.length} users · ${pendingCount} pending invite${pendingCount === 1 ? "" : "s"}`}
      />
      <UsersBody users={rows} />
    </StaffPageFrame>
  );
}
