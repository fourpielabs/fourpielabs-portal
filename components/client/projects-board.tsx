import { FolderKanban, Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { labelOf, DELIVERABLE_TYPES, PROJECT_STATUSES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { Greeting } from "@/components/client/greeting";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";
import { ProjectDialog, type ProjectRow } from "./project-dialog";

// Project status pill styles (StatusChip has no `project` kind; kept local).
const STATUS_STYLE: Record<string, string> = {
  proposed: "border-border-strong bg-surface text-ink-2",
  active: "border-amber-200 bg-amber-100 text-amber-800",
  in_review: "border-amber-200 bg-amber-50 text-amber-700",
  complete: "border-success-border bg-success-bg text-success-text",
};

type DeliverableMini = {
  id: string;
  title: string;
  type: string;
  status: string;
  project_id: string | null;
};

/** Client dashboard variant for `project` clients — a board of their own
 * projects with an Add-project control. Writes go through the create_project /
 * update_project RPCs (see lib/actions/projects.ts); reads are RLS-scoped. */
export async function ProjectsBoard({
  userName,
}: {
  clientId: string;
  userName: string | null;
}) {
  const supabase = await createClient();
  const [{ data: client }, { data: projects }, { data: deliverables }] =
    await Promise.all([
      supabase.from("client_clients").select("name").maybeSingle(),
      supabase
        .from("projects")
        .select("id, title, description, status, due_date, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("deliverables")
        .select("id, title, type, status, project_id")
        .order("created_at", { ascending: false }),
    ]);

  const list = (projects ?? []) as ProjectRow[];
  const byProject = new Map<string, DeliverableMini[]>();
  for (const d of (deliverables ?? []) as DeliverableMini[]) {
    if (!d.project_id) continue;
    const arr = byProject.get(d.project_id) ?? [];
    arr.push(d);
    byProject.set(d.project_id, arr);
  }

  const firstName = (userName ?? "there").split(" ")[0];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Greeting name={firstName} monthLabel="" />
          <p className="mt-1 text-sm text-ink-2">
            <span className="font-semibold">Your projects</span>
            {client?.name && <span className="text-ink-3"> · {client.name}</span>}
          </p>
        </div>
        <ProjectDialog
          trigger={
            <Button>
              <Plus className="size-4" /> Add project
            </Button>
          }
        />
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<FolderKanban />}
          title="No projects yet"
          description="Add your first project and we'll take it from there."
          action={
            <ProjectDialog
              trigger={
                <Button size="sm">
                  <Plus className="size-4" /> Add project
                </Button>
              }
            />
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.map((p) => {
            const dels = byProject.get(p.id) ?? [];
            return (
              <Card key={p.id}>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-semibold tracking-[-0.01em]">
                        {p.title}
                      </h3>
                      {p.due_date && (
                        <p className="text-xs text-ink-3">Due {formatDate(p.due_date)}</p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLE[p.status] ?? STATUS_STYLE.proposed}`}
                    >
                      {labelOf(PROJECT_STATUSES, p.status)}
                    </span>
                  </div>
                  {p.description && <p className="text-sm text-ink-2">{p.description}</p>}
                  {dels.length > 0 && (
                    <ul className="flex flex-col">
                      {dels.map((d) => (
                        <li
                          key={d.id}
                          className="flex items-center justify-between gap-2 border-b border-row-divider py-2 last:border-0"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{d.title}</span>
                            <span className="block text-xs text-ink-3">
                              {labelOf(DELIVERABLE_TYPES, d.type)}
                            </span>
                          </span>
                          <StatusChip kind="deliverable" value={d.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex justify-end">
                    <ProjectDialog
                      project={p}
                      trigger={
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
