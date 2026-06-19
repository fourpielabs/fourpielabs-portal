"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Package, Pencil, Plus, ExternalLink } from "lucide-react";

import {
  setDeliverableStatusAction, setDeliverableVisibilityAction, deleteDeliverableAction,
} from "@/lib/actions/deliverables";
import { DELIVERABLE_TYPES, DELIVERABLE_STATUSES, labelOf } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { Select, Button } from "@/components/redesign/ui";
import { DeliverableDialog, type DeliverableRow, type ProjectOption } from "./deliverable-form-dialog";
import { StaffDownloadButton } from "./download-button";
import { usePanel, EmptyPanel, ConfirmDelete, IconButton } from "./ui";

/** R3 staff deliverables manager (re-skinned, SOLID cards). All wiring verbatim. */
export function DeliverablesList({
  clientId, deliverables, projects = [], clientType = "program",
}: {
  clientId: string;
  deliverables: DeliverableRow[];
  projects?: ProjectOption[];
  clientType?: "program" | "project";
}) {
  const router = useRouter();
  const { panel, fg1, fg2, fg3, onDark, border } = usePanel();
  const [pending, setPending] = useState(false);
  const projectTitle = new Map(projects.map((p) => [p.id, p.title]));

  async function run(p: Promise<{ ok: boolean; error?: string }>) {
    setPending(true);
    const res = await p;
    setPending(false);
    if (!res.ok) return toast.error("Action failed", { description: res.error });
    router.refresh();
  }

  const addBtn = (
    <DeliverableDialog clientId={clientId} projects={projects} clientType={clientType} trigger={<Button appearance="primary" icon={<Plus size={16} />}>New deliverable</Button>} />
  );
  const pillBase: React.CSSProperties = { fontSize: 10, fontWeight: 700, padding: "0.15rem 0.45rem", borderRadius: 999, whiteSpace: "nowrap" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
        <p style={{ margin: 0, fontSize: "0.85rem", color: fg3 }}>
          {deliverables.length === 0 ? "No deliverables yet." : `${deliverables.length} deliverable${deliverables.length === 1 ? "" : "s"}`}
        </p>
        {addBtn}
      </div>

      {deliverables.length === 0 ? (
        <EmptyPanel icon={<Package size={22} />} title="No deliverables yet" description="Track everything you're delivering — drafts, links, and files." action={addBtn} />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.7rem" }}>
          {deliverables.map((d) => (
            <li key={d.id} className={panel} style={{ borderRadius: 18, padding: "1rem 1.1rem", display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 12 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600, color: fg1 }}>{d.title}</span>
                  <span style={{ ...pillBase, background: onDark ? "rgba(255,255,255,0.08)" : "#f1efe8", color: fg3 }}>{labelOf(DELIVERABLE_TYPES, d.type)}</span>
                  {!d.visible_to_client && <span style={{ ...pillBase, background: "transparent", color: fg3, border: `1px solid ${border}` }}>hidden</span>}
                  {d.client_approved_at && <span style={{ ...pillBase, background: onDark ? "rgba(34,197,94,0.16)" : "#dcfce7", color: onDark ? "#86efac" : "#166534" }}>Client approved</span>}
                  {d.project_id && projectTitle.get(d.project_id) && <span style={{ ...pillBase, background: onDark ? "rgba(245,158,11,0.16)" : "#fef3c7", color: onDark ? "#fcd34d" : "#92400e" }}>{projectTitle.get(d.project_id)}</span>}
                  {d.due_date && <span style={{ fontSize: 12, color: fg3 }}>due {formatDate(d.due_date)}</span>}
                </div>
                {d.description && <p style={{ margin: "0.35rem 0 0", fontSize: "0.85rem", color: fg2 }}>{d.description}</p>}
                {(d.preview_url || d.file_path) && (
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, paddingTop: "0.6rem" }}>
                    {d.preview_url && (
                      <Button as="a" href={d.preview_url} target="_blank" rel="noreferrer" appearance="outline" size="small" icon={<ExternalLink size={14} />} iconPosition="after">Preview</Button>
                    )}
                    {d.file_path && <StaffDownloadButton clientId={clientId} path={d.file_path} label="File" />}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                <Select value={d.status} onChange={(e) => run(setDeliverableStatusAction(clientId, d.id, e.target.value as DeliverableRow["status"]))} aria-label={`Status for ${d.title}`} style={{ minWidth: "8.5rem" }}>
                  {DELIVERABLE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
                <IconButton label="Toggle visibility" disabled={pending} onClick={() => run(setDeliverableVisibilityAction(clientId, d.id, !d.visible_to_client))}>{d.visible_to_client ? <Eye size={16} /> : <EyeOff size={16} />}</IconButton>
                <DeliverableDialog clientId={clientId} deliverable={d} projects={projects} clientType={clientType} trigger={<button type="button" aria-label="Edit" className="rd-focus" style={{ flexShrink: 0, borderRadius: 8, border: "none", background: "none", cursor: "pointer", color: fg3, padding: 6, display: "inline-flex" }}><Pencil size={16} /></button>} />
                <ConfirmDelete title="Delete deliverable?" description={`“${d.title}” and any attached file will be removed.`} onConfirm={() => run(deleteDeliverableAction(clientId, d.id))} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
