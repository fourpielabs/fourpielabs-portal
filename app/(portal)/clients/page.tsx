import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { ClientsListBody, type ClientRow } from "@/components/redesign/staff/clients-list-body";

export default async function ClientsPage() {
  // team workspace list — clients are redirected to /dashboard
  const profile = await requireRole(["admin", "team"]);
  const supabase = await createClient();

  // RLS scopes both reads: admin sees all, team sees assigned clients only.
  const [{ data: clients }, { data: checklist }, { data: projects }] = await Promise.all([
    supabase.from("clients").select("id, name, slug, program, client_type, status, logo_url").order("name"),
    supabase.from("checklist_items").select("client_id, is_done").eq("kind", "onboarding"),
    supabase.from("projects").select("client_id, status"),
  ]);

  const isAdmin = profile.role === "admin";
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
  // Per-client progress: project clients show project count/active; program clients show checklist.
  const progress = (c: { id: string; client_type?: string | null }) => {
    if (c.client_type === "project") {
      const g = projectsBy.get(c.id);
      if (!g || g.total === 0) return "No projects";
      return `${g.total} project${g.total === 1 ? "" : "s"}${g.active ? ` · ${g.active} active` : ""}`;
    }
    const g = checklistBy.get(c.id);
    return g ? `${g.done}/${g.total}` : "—";
  };

  const rows: ClientRow[] = (clients ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    program: c.program,
    client_type: c.client_type,
    status: c.status,
    logo_url: c.logo_url,
    progress: progress(c),
  }));

  return <ClientsListBody clients={rows} isAdmin={isAdmin} />;
}
