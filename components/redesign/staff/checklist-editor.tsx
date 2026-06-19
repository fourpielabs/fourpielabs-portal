"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, CircleCheck, Circle, Eye, EyeOff, ExternalLink, Pencil, Plus } from "lucide-react";

import {
  deleteChecklistItemAction, moveChecklistItemAction, setChecklistVisibleAction, toggleChecklistDoneAction,
} from "@/lib/actions/checklist";
import { Segmented, EmberButton, tokens } from "@/components/redesign/ui";
import { ChecklistItemDialog } from "./checklist-item-dialog";
import { usePanel, EmptyPanel, ConfirmDelete, IconButton } from "./ui";

export type ChecklistItem = {
  id: string;
  kind: "onboarding" | "offboarding";
  phase_label: string | null;
  title: string;
  link_url: string | null;
  assignee: "client" | "team";
  sort_order: number;
  is_done: boolean;
  visible_to_client: boolean;
};

function groupByPhase(items: ChecklistItem[]) {
  const groups: { phase: string; items: ChecklistItem[] }[] = [];
  for (const it of items) {
    const phase = it.phase_label ?? "Other";
    let g = groups.find((x) => x.phase === phase);
    if (!g) { g = { phase, items: [] }; groups.push(g); }
    g.items.push(it);
  }
  return groups;
}

function KindPanel({ clientId, kind, items }: { clientId: string; kind: "onboarding" | "offboarding"; items: ChecklistItem[] }) {
  const router = useRouter();
  const { panel, fg1, fg3, onDark, border } = usePanel();
  const [pending, setPending] = useState(false);

  async function run(p: Promise<{ ok: boolean; error?: string }>) {
    setPending(true);
    const res = await p;
    setPending(false);
    if (!res.ok) return toast.error("Action failed", { description: res.error });
    router.refresh();
  }

  const done = items.filter((i) => i.is_done).length;
  const groups = groupByPhase([...items].sort((a, b) => a.sort_order - b.sort_order));
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>(() => (groups[0] ? { [groups[0].phase]: true } : {}));
  const togglePhase = (phase: string) => setOpenPhases((p) => ({ ...p, [phase]: !p[phase] }));

  const addBtn = (
    <ChecklistItemDialog clientId={clientId} kind={kind} trigger={<EmberButton icon={<Plus size={16} />}>Add item</EmberButton>} />
  );
  const pillBase: React.CSSProperties = { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "0.15rem 0.45rem", borderRadius: 999 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
        <p style={{ margin: 0, fontSize: "0.85rem", color: fg3 }}>{items.length === 0 ? "No items yet." : `${done}/${items.length} done`}</p>
        {addBtn}
      </div>

      {items.length === 0 ? (
        <EmptyPanel icon={<CircleCheck size={22} />} title="No items yet" description="Add the steps this client needs to complete." action={addBtn} />
      ) : (
        groups.map((g) => {
          const phaseOpen = openPhases[g.phase] ?? false;
          const phaseDone = g.items.filter((i) => i.is_done).length;
          return (
            <div key={g.phase} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button type="button" onClick={() => togglePhase(g.phase)} aria-expanded={phaseOpen} className="rd-focus" style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 8, border: "none", background: "none", cursor: "pointer", padding: "0.2rem 0.1rem", textAlign: "left" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: fg3 }}>{g.phase}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "0.74rem", color: fg3, fontVariantNumeric: "tabular-nums" }}>{phaseDone}/{g.items.length}</span>
                  <ChevronDown size={16} color={fg3} style={{ transform: phaseOpen ? "rotate(180deg)" : "none", transition: "transform var(--rd-dur-med,.2s) ease" }} />
                </span>
              </button>
              <div style={{ display: "grid", gridTemplateRows: phaseOpen ? "1fr" : "0fr", transition: "grid-template-rows var(--rd-dur-med,.2s) ease" }}>
                <div style={{ overflow: "hidden" }}>
                  <ul className={panel} style={{ listStyle: "none", margin: 0, padding: 0, borderRadius: 16, overflow: "hidden" }}>
                    {g.items.map((it, idx) => (
                      <li key={it.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "0.8rem 0.95rem", borderTop: idx === 0 ? "none" : `1px solid ${border}` }}>
                        <IconButton label={it.is_done ? "Mark not done" : "Mark done"} disabled={pending} onClick={() => run(toggleChecklistDoneAction(clientId, it.id, !it.is_done))}>
                          {it.is_done ? <CircleCheck size={20} color="#16a34a" /> : <Circle size={20} color={fg3} />}
                        </IconButton>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ color: it.is_done ? fg3 : fg1, textDecoration: it.is_done ? "line-through" : "none", fontSize: "0.9rem" }}>{it.title}</div>
                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, paddingTop: 4 }}>
                            <span style={{ ...pillBase, background: onDark ? "rgba(255,255,255,0.08)" : "#f1efe8", color: fg3 }}>{it.assignee}</span>
                            {!it.visible_to_client && <span style={{ ...pillBase, background: "transparent", color: fg3, border: `1px solid ${border}` }}>hidden</span>}
                            {it.link_url && (
                              <a href={it.link_url} target="_blank" rel="noreferrer" className="rd-focus" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: tokens.colorBrandForeground1, textDecoration: "none" }}>
                                <ExternalLink size={12} /> Link
                              </a>
                            )}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexShrink: 0, alignItems: "center", gap: 2 }}>
                          <IconButton label="Move up" disabled={pending} onClick={() => run(moveChecklistItemAction(clientId, it.id, "up"))}><ChevronUp size={16} /></IconButton>
                          <IconButton label="Move down" disabled={pending} onClick={() => run(moveChecklistItemAction(clientId, it.id, "down"))}><ChevronDown size={16} /></IconButton>
                          <IconButton label="Toggle visibility" disabled={pending} onClick={() => run(setChecklistVisibleAction(clientId, it.id, !it.visible_to_client))}>{it.visible_to_client ? <Eye size={16} /> : <EyeOff size={16} />}</IconButton>
                          <ChecklistItemDialog clientId={clientId} kind={kind} item={it} trigger={<button type="button" aria-label="Edit" className="rd-focus" style={{ flexShrink: 0, borderRadius: 8, border: "none", background: "none", cursor: "pointer", color: fg3, padding: 6, display: "inline-flex" }}><Pencil size={16} /></button>} />
                          <ConfirmDelete title="Delete this item?" description={`“${it.title}” will be permanently removed.`} onConfirm={() => run(deleteChecklistItemAction(clientId, it.id))} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export function ChecklistEditor({ clientId, items }: { clientId: string; items: ChecklistItem[] }) {
  const onboarding = items.filter((i) => i.kind === "onboarding");
  const offboarding = items.filter((i) => i.kind === "offboarding");
  const [kind, setKind] = useState<"onboarding" | "offboarding">("onboarding");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
      <Segmented
        ariaLabel="Checklist kind"
        options={[
          { value: "onboarding", label: `Onboarding (${onboarding.length})` },
          { value: "offboarding", label: `Off-boarding (${offboarding.length})` },
        ]}
        value={kind}
        onChange={setKind}
      />
      <KindPanel key={kind} clientId={clientId} kind={kind} items={kind === "onboarding" ? onboarding : offboarding} />
    </div>
  );
}
