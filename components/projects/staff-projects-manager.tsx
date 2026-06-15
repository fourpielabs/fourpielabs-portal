"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FolderKanban, Pencil, Plus, Trash2 } from "lucide-react";

import {
  staffSetProjectStatusAction,
  staffDeleteProjectAction,
} from "@/lib/actions/projects";
import { PROJECT_STATUSES, DELIVERABLE_TYPES, labelOf } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ProjectFormDialog, type StaffProjectRow } from "./project-form-dialog";

export type ProjectDeliverable = {
  id: string;
  title: string;
  type: string;
  status: string;
  visible_to_client: boolean;
};
export type StaffProject = StaffProjectRow & { deliverables: ProjectDeliverable[] };

export function StaffProjectsManager({
  clientId,
  projects,
}: {
  clientId: string;
  projects: StaffProject[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function run(p: Promise<{ ok: boolean; error?: string }>) {
    setPending(true);
    const res = await p;
    setPending(false);
    if (!res.ok) return toast.error("Action failed", { description: res.error });
    router.refresh();
  }

  const newBtn = (
    <ProjectFormDialog
      clientId={clientId}
      trigger={
        <Button size="sm">
          <Plus className="size-4" /> New project
        </Button>
      }
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-3">
          {projects.length === 0
            ? "No projects yet."
            : `${projects.length} project${projects.length === 1 ? "" : "s"}`}
        </p>
        {newBtn}
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban />}
          title="No projects yet"
          description="Create a project for this client, then attach deliverables to it from the Deliverables tab."
          action={newBtn}
        />
      ) : (
        <ul className="space-y-3">
          {projects.map((p) => (
            <li
              key={p.id}
              className="rounded-2xl border border-border bg-surface p-4 shadow-e1 transition-shadow hover:shadow-e2"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{p.title}</span>
                    <StatusChip kind="project" value={p.status} />
                  </div>
                  {(p.start_date || p.due_date) && (
                    <div className="pt-1 text-xs text-ink-3">
                      {p.start_date && `Start ${formatDate(p.start_date)}`}
                      {p.start_date && p.due_date && " · "}
                      {p.due_date && `Due ${formatDate(p.due_date)}`}
                    </div>
                  )}
                  {p.description && (
                    <p className="pt-1 text-sm text-ink-3">{p.description}</p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Select
                    value={p.status}
                    onValueChange={(s) =>
                      run(
                        staffSetProjectStatusAction(
                          clientId,
                          p.id,
                          s as StaffProjectRow["status"],
                        ),
                      )
                    }
                  >
                    <SelectTrigger size="sm" className="w-[8.5rem]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_STATUSES.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ProjectFormDialog
                    clientId={clientId}
                    project={p}
                    trigger={
                      <Button variant="ghost" size="icon" aria-label="Edit">
                        <Pencil className="size-4" />
                      </Button>
                    }
                  />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Delete" disabled={pending}>
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete project?</AlertDialogTitle>
                        <AlertDialogDescription>
                          &ldquo;{p.title}&rdquo; will be removed. Attached
                          deliverables are kept (just unlinked).
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => run(staffDeleteProjectAction(clientId, p.id))}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              <div className="mt-3 border-t border-row-divider pt-3">
                <div className="text-[11px] font-bold tracking-wider text-ink-3 uppercase">
                  Deliverables
                </div>
                {p.deliverables.length === 0 ? (
                  <p className="pt-1 text-sm text-ink-3">
                    None attached yet — attach from the Deliverables tab.
                  </p>
                ) : (
                  <ul className="pt-1">
                    {p.deliverables.map((d) => (
                      <li
                        key={d.id}
                        className="flex items-center justify-between gap-2 py-1.5 text-sm"
                      >
                        <span className="min-w-0 truncate">
                          {d.title}{" "}
                          <span className="text-ink-3">
                            · {labelOf(DELIVERABLE_TYPES, d.type)}
                          </span>
                          {!d.visible_to_client && (
                            <span className="text-ink-faint"> · hidden</span>
                          )}
                        </span>
                        <StatusChip kind="deliverable" value={d.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
