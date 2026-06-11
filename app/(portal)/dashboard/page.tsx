import Link from "next/link";
import { ArrowRight, FileText, Users } from "lucide-react";
import { requireProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { labelOf, PROGRAMS } from "@/lib/constants";
import { initials } from "@/lib/format";
import { ClientDashboard } from "@/components/client/client-dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/ui/status-chip";
import { EmptyState } from "@/components/ui/empty-state";

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
    return (
      <ClientDashboard clientId={profile.client_id} userName={profile.full_name} />
    );
  }

  // staff (admin / team) home
  const supabase = await createClient();
  const isAdmin = profile.role === "admin";
  const firstName = (profile.full_name ?? "there").split(" ")[0];

  const [{ data: clients }, { data: checklist }, { data: deliverables }, { data: updates }] =
    await Promise.all([
      supabase.from("clients").select("id, name, slug, program, status").order("name"),
      supabase.from("checklist_items").select("client_id, is_done").eq("kind", "onboarding"),
      supabase.from("deliverables").select("client_id, created_at").order("created_at", { ascending: false }),
      supabase.from("updates").select("client_id, created_at").order("created_at", { ascending: false }),
    ]);

  // aggregate per-client stats in JS (no N+1)
  const checklistBy = new Map<string, { done: number; total: number }>();
  for (const c of checklist ?? []) {
    const g = checklistBy.get(c.client_id) ?? { done: 0, total: 0 };
    g.total++;
    if (c.is_done) g.done++;
    checklistBy.set(c.client_id, g);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.015em]">
          Welcome, {firstName}
        </h1>
        <p className="text-sm text-ink-2">
          Your 4Pie Labs workspace. Pick a client to get started.
        </p>
      </div>

      {isAdmin && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card size="sm">
            <CardContent className="flex items-center gap-4">
              <span className="inline-flex size-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <Users className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">Users</div>
                <div className="text-xs text-ink-3 tabular-nums">
                  {usersTotal} total
                  {pendingInvites > 0
                    ? ` · ${pendingInvites} pending invite${pendingInvites === 1 ? "" : "s"}`
                    : ""}
                </div>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/users">Manage</Link>
              </Button>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent className="flex items-center gap-4">
              <span className="inline-flex size-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <FileText className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">Audit log</div>
                <div className="text-xs text-ink-3">
                  {lastAudit
                    ? relTime(lastAudit).replace("Active", "Last event")
                    : "No events yet"}
                </div>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/audit">View</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-[11px] font-bold tracking-wider text-ink-3 uppercase">
          {isAdmin ? "All clients" : "Your clients"}
        </h2>
        {!clients || clients.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title={isAdmin ? "No clients yet" : "No assigned clients yet"}
            description={
              isAdmin
                ? "Create your first client to get started."
                : "Once you're assigned to a client, they'll appear here."
            }
            action={
              isAdmin ? (
                <Button asChild size="sm">
                  <Link href="/clients/new">New client</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((c) => {
              const cl = checklistBy.get(c.id);
              return (
                <Link
                  key={c.id}
                  href={`/clients/${c.id}`}
                  className="group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-e2 transition-shadow hover:shadow-e3"
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-sm font-bold text-amber-800">
                      {initials(c.name, null)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold group-hover:text-amber-800">
                        {c.name}
                      </div>
                      <div className="truncate text-xs text-ink-3">{c.slug}</div>
                    </div>
                    <ArrowRight className="size-4 shrink-0 text-ink-faint transition-colors group-hover:text-ink" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="amber">{labelOf(PROGRAMS, c.program)}</Badge>
                    <StatusChip kind="client" value={c.status} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-ink-3 tabular-nums">
                    {cl && (
                      <>
                        <span>
                          Checklist {cl.done}/{cl.total}
                        </span>
                        <span>·</span>
                      </>
                    )}
                    <span>{relTime(lastActivity.get(c.id) ?? null)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
