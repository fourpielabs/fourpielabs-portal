"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FolderKanban, Pencil, Plus } from "lucide-react";

import {
  staffSetProjectStatusAction,
  staffDeleteProjectAction,
} from "@/lib/actions/projects";
import { PROJECT_STATUSES, DELIVERABLE_TYPES, labelOf } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { Select, EmberButton, StatusPill } from "@/components/redesign/ui";
import { usePanel, EmptyPanel, ConfirmDelete } from "@/components/redesign/staff/ui";
import { ProjectFormDialog, type StaffProjectRow } from "./project-form-dialog";

export type ProjectDeliverable = {
  id: string;
  title: string;
  type: string;
  status: string;
  visible_to_client: boolean;
};
export type StaffProject = StaffProjectRow & { deliverables: ProjectDeliverable[] };

const PRIORITY_TONE: Record<string, { light: string; dark: string; fg: string; fgDark: string }> = {
  low: { light: "#f1efe8", dark: "rgba(255,255,255,0.08)", fg: "#6f6c66", fgDark: "#b3aca0" },
  medium: { light: "#fef3c7", dark: "rgba(245,158,11,0.16)", fg: "#92400e", fgDark: "#fcd34d" },
  high: { light: "#ffedd5", dark: "rgba(249,115,22,0.18)", fg: "#9a3412", fgDark: "#fdba74" },
  urgent: { light: "#fee2e2", dark: "rgba(220,38,38,0.18)", fg: "#b91c1c", fgDark: "#fca5a5" },
};

/**
 * STAFF projects manager (Warm Obsidian / Fluent), converted off the legacy Tailwind body
 * so it reads in light AND dark. Staff status changes + delete go through the SAME actions
 * (staffSetProjectStatusAction / staffDeleteProjectAction); project create/edit via the
 * converted ProjectFormDialog; delete via the type-safe ConfirmDelete kit. Logic unchanged.
 */
export function StaffProjectsManager({
  clientId,
  projects,
}: {
  clientId: string;
  projects: StaffProject[];
}) {
  const router = useRouter();
  const { mode, panel, fg1, fg2, fg3, onDark, border } = usePanel();
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
      trigger={<EmberButton icon={<Plus size={16} />}>New project</EmberButton>}
    />
  );

  const priorityBadge = (value: string) => {
    const t = PRIORITY_TONE[value] ?? PRIORITY_TONE.medium;
    return (
      <span style={{ fontSize: 11, fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: 999, textTransform: "capitalize", background: onDark ? t.dark : t.light, color: onDark ? t.fgDark : t.fg }}>
        {value}
      </span>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
        <p style={{ margin: 0, fontSize: "0.85rem", color: fg3 }}>
          {projects.length === 0 ? "No projects yet." : `${projects.length} project${projects.length === 1 ? "" : "s"}`}
        </p>
        {newBtn}
      </div>

      {projects.length === 0 ? (
        <EmptyPanel
          icon={<FolderKanban size={22} />}
          title="No projects yet"
          description="Create a project for this client, then attach deliverables to it from the Deliverables tab."
          action={newBtn}
        />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.7rem" }}>
          {projects.map((p) => (
            <li key={p.id} className={panel} style={{ borderRadius: 18, padding: "1rem 1.1rem" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600, color: fg1 }}>{p.title}</span>
                    <StatusPill value={p.status} mode={mode} />
                    {priorityBadge(p.priority)}
                  </div>
                  {(p.start_date || p.due_date || p.target_date) && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0 0.5rem", paddingTop: 4, fontSize: 12, color: fg3 }}>
                      {p.start_date && <span>Start {formatDate(p.start_date)}</span>}
                      {p.due_date && <span>· Due {formatDate(p.due_date)}</span>}
                      {p.target_date && <span style={{ color: fg2 }}>· Client target {formatDate(p.target_date)}</span>}
                    </div>
                  )}
                  {p.description && <p style={{ margin: "0.4rem 0 0", fontSize: "0.85rem", color: fg3 }}>{p.description}</p>}
                </div>

                <div style={{ display: "flex", flexShrink: 0, alignItems: "center", gap: 4 }}>
                  <Select
                    value={p.status}
                    onChange={(e) => run(staffSetProjectStatusAction(clientId, p.id, e.target.value as StaffProjectRow["status"]))}
                    aria-label={`Status for ${p.title}`}
                    style={{ minWidth: "8.5rem" }}
                  >
                    {PROJECT_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                  <ProjectFormDialog
                    clientId={clientId}
                    project={p}
                    trigger={
                      <button type="button" aria-label="Edit" className="rd-focus" style={{ flexShrink: 0, borderRadius: 8, border: "none", background: "none", cursor: "pointer", color: fg3, padding: 6, display: "inline-flex" }}>
                        <Pencil size={16} />
                      </button>
                    }
                  />
                  <ConfirmDelete
                    title="Delete project?"
                    description={`"${p.title}" will be removed. Attached deliverables are kept (just unlinked).`}
                    onConfirm={() => run(staffDeleteProjectAction(clientId, p.id))}
                  />
                </div>
              </div>

              <div style={{ marginTop: 12, borderTop: `1px solid ${border}`, paddingTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: fg3 }}>Deliverables</div>
                {p.deliverables.length === 0 ? (
                  <p style={{ margin: "4px 0 0", fontSize: 14, color: fg3 }}>None attached yet — attach from the Deliverables tab.</p>
                ) : (
                  <ul style={{ listStyle: "none", margin: "4px 0 0", padding: 0 }}>
                    {p.deliverables.map((d) => (
                      <li key={d.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "6px 0", fontSize: 14 }}>
                        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: fg1 }}>
                          {d.title} <span style={{ color: fg3 }}>· {labelOf(DELIVERABLE_TYPES, d.type)}</span>
                          {!d.visible_to_client && <span style={{ color: fg3 }}> · hidden</span>}
                        </span>
                        <StatusPill value={d.status} mode={mode} />
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
