import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { labelOf, PROGRAMS } from "@/lib/constants";
import { initials } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/ui/status-chip";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ClientsPage() {
  // team workspace list — clients are redirected to /dashboard
  const profile = await requireRole(["admin", "team"]);
  const supabase = await createClient();

  // RLS scopes both reads: admin sees all, team sees assigned clients only.
  const [{ data: clients }, { data: checklist }] = await Promise.all([
    supabase.from("clients").select("id, name, slug, program, status").order("name"),
    supabase.from("checklist_items").select("client_id, is_done").eq("kind", "onboarding"),
  ]);

  const isAdmin = profile.role === "admin";
  const checklistBy = new Map<string, { done: number; total: number }>();
  for (const c of checklist ?? []) {
    const g = checklistBy.get(c.client_id) ?? { done: 0, total: 0 };
    g.total++;
    if (c.is_done) g.done++;
    checklistBy.set(c.client_id, g);
  }
  const stat = (id: string) => {
    const g = checklistBy.get(id);
    return g ? `${g.done}/${g.total}` : "—";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-[-0.015em]">Clients</h1>
          <p className="text-sm text-ink-2">
            {isAdmin ? "All clients." : "Clients you're assigned to."}
          </p>
        </div>
        {isAdmin && (
          <Button asChild>
            <Link href="/clients/new">New client</Link>
          </Button>
        )}
      </div>

      {!clients || clients.length === 0 ? (
        <EmptyState
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
        <>
          {/* desktop: designed table */}
          <div className="hidden overflow-hidden rounded-2xl border border-border shadow-e1 sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Checklist</TableHead>
                  <TableHead className="text-right">Manage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/clients/${c.id}`} className="flex items-center gap-3">
                        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-[11px] font-bold text-amber-800">
                          {initials(c.name, null)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{c.name}</span>
                          <span className="block truncate text-xs text-ink-3">{c.slug}</span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="amber">{labelOf(PROGRAMS, c.program)}</Badge>
                    </TableCell>
                    <TableCell>
                      <StatusChip kind="client" value={c.status} />
                    </TableCell>
                    <TableCell className="tabular-nums text-ink-2">{stat(c.id)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/clients/${c.id}`}>Open</Link>
                      </Button>
                      {isAdmin && (
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/clients/${c.id}/settings`}>Settings</Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* mobile: cards */}
          <div className="grid gap-4 sm:hidden">
            {clients.map((c) => (
              <Link
                key={c.id}
                href={`/clients/${c.id}`}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-e1"
              >
                <div className="flex items-start gap-3">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-xs font-bold text-amber-800">
                    {initials(c.name, null)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{c.name}</div>
                    <div className="truncate text-xs text-ink-3">{c.slug}</div>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-ink-faint" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="amber">{labelOf(PROGRAMS, c.program)}</Badge>
                  <StatusChip kind="client" value={c.status} />
                  <span className="text-xs text-ink-3 tabular-nums">Checklist {stat(c.id)}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
