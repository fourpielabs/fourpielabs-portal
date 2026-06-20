import { requireProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { labelOf, PROGRAMS } from "@/lib/constants";
import { ClientDashboardR2 } from "@/components/redesign/client/client-dashboard";
import { StaffHomeBody, type StaffHomeData } from "@/components/redesign/staff/staff-home-body";

function relTime(iso: string | null): string {
  if (!iso) return "No activity yet";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Active today";
  if (days === 1) return "Active yesterday";
  if (days < 30) return `Active ${days}d ago`;
  return `Active ${Math.floor(days / 30)}mo ago`;
}

export default async function DashboardPage() {
  const profile = await requireProfile();

  if (profile.role === "client" && profile.client_id) {
    return <ClientDashboardR2 clientId={profile.client_id} userName={profile.full_name} />;
  }

  // staff (admin / team) home
  const supabase = await createClient();
  const isAdmin = profile.role === "admin";
  const firstName = (profile.full_name ?? "there").split(" ")[0];

  const [{ data: clients }, { data: checklist }, { data: deliverables }, { data: updates }, { data: projects }] =
    await Promise.all([
      supabase.from("clients").select("id, name, slug, program, client_type, status, logo_url").order("name"),
      supabase.from("checklist_items").select("client_id, is_done").eq("kind", "onboarding"),
      supabase.from("deliverables").select("client_id, created_at").order("created_at", { ascending: false }),
      supabase.from("updates").select("client_id, created_at").order("created_at", { ascending: false }),
      supabase.from("projects").select("client_id, status"),
    ]);

  // aggregate per-client stats in JS (no N+1)
  const checklistBy = new Map<string, { done: number; total: number }>();
  for (const c of checklist ?? []) {
    const g = checklistBy.get(c.client_id) ?? { done: 0, total: 0 };
    g.total++;
    if (c.is_done) g.done++;
    checklistBy.set(c.client_id, g);
  }
  const projectsBy = new Map<string, { total: number; active: number }>();
  for (const p of projects ?? []) {
    const g = projectsBy.get(p.client_id) ?? { total: 0, active: 0 };
    g.total++;
    if (p.status === "active" || p.status === "in_review") g.active++;
    projectsBy.set(p.client_id, g);
  }
  const lastActivity = new Map<string, string>();
  for (const row of [...(deliverables ?? []), ...(updates ?? [])]) {
    const cur = lastActivity.get(row.client_id);
    if (!cur || row.created_at > cur) lastActivity.set(row.client_id, row.created_at);
  }

  // admin-only entry-card stats
  let usersTotal = 0;
  let pendingInvites = 0;
  let lastAudit: string | null = null;
  if (isAdmin) {
    const adminClient = createAdminClient();
    const [{ data: profiles }, authList, { data: audit }] = await Promise.all([
      supabase.from("profiles").select("id, is_active"),
      adminClient.auth.admin.listUsers({ perPage: 1000 }),
      supabase.from("audit_log").select("created_at").order("created_at", { ascending: false }).limit(1),
    ]);
    usersTotal = profiles?.length ?? 0;
    const confirmed = new Map(
      (authList.data?.users ?? []).map((u) => [u.id, Boolean(u.email_confirmed_at)]),
    );
    pendingInvites = (profiles ?? []).filter(
      (p) => p.is_active && confirmed.get(p.id) === false,
    ).length;
    lastAudit = audit?.[0]?.created_at ?? null;
  }

  const homeData: StaffHomeData = {
    firstName,
    isAdmin,
    usersTotal,
    pendingInvites,
    lastAuditLabel: lastAudit ? relTime(lastAudit).replace("Active", "Last event") : null,
    clients: (clients ?? []).map((c) => {
      const cl = checklistBy.get(c.id);
      const pj = projectsBy.get(c.id);
      const isProj = c.client_type === "project";
      const meta = isProj
        ? pj && pj.total > 0
          ? `${pj.total} project${pj.total === 1 ? "" : "s"}${pj.active ? ` · ${pj.active} active` : ""}`
          : null
        : cl
          ? `Checklist ${cl.done}/${cl.total}`
          : null;
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        logoUrl: c.logo_url,
        isProject: isProj,
        programLabel: labelOf(PROGRAMS, c.program),
        status: c.status,
        meta,
        activity: relTime(lastActivity.get(c.id) ?? null),
      };
    }),
  };

  return <StaffHomeBody data={homeData} />;
}
