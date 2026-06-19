"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, Users } from "lucide-react";
import { tokens } from "@fluentui/react-components";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRedesignMode } from "@/components/redesign/themed-fluent";
import { Button } from "@/components/redesign/ui";

export type ClientChecklistItem = {
  id: string;
  phase_label: string | null;
  title: string;
  link_url: string | null;
  assignee: "client" | "team";
  is_done: boolean;
};

function groupByPhase(items: ClientChecklistItem[]) {
  const groups: { phase: string; items: ClientChecklistItem[] }[] = [];
  for (const it of items) {
    const phase = it.phase_label ?? "Your steps";
    let g = groups.find((x) => x.phase === phase);
    if (!g) (g = { phase, items: [] }), groups.push(g);
    g.items.push(it);
  }
  return groups;
}

/**
 * R2 client onboarding checklist — re-skinned to the Warm Obsidian tokens, mode-aware.
 * Logic preserved verbatim from components/client/client-checklist.tsx: the ONLY client
 * write path is the toggle_checklist_item RPC (optimistic flip + revert on error); team
 * rows auto-count as done and are not togglable.
 */
export function ClientChecklist({ items: initialItems }: { items: ClientChecklistItem[] }) {
  const { mode } = useRedesignMode();
  const onDark = mode === "dark";
  const [items, setItems] = useState(initialItems);
  const [prevItems, setPrevItems] = useState(initialItems);
  if (initialItems !== prevItems) {
    setPrevItems(initialItems);
    setItems(initialItems);
  }
  const [pending, setPending] = useState<string | null>(null);

  const isRowDone = (i: ClientChecklistItem) => (i.assignee === "team" ? true : i.is_done);
  const done = items.filter(isRowDone).length;
  const total = items.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const complete = total > 0 && done === total;
  const [expanded, setExpanded] = useState(!complete);
  const groups = groupByPhase(items);
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>(() =>
    groups[0] ? { [groups[0].phase]: true } : {},
  );
  const togglePhase = (phase: string) => setOpenPhases((p) => ({ ...p, [phase]: !p[phase] }));

  const flip = (id: string) =>
    setItems((xs) => xs.map((it) => (it.id === id ? { ...it, is_done: !it.is_done } : it)));

  async function toggle(id: string) {
    setPending(id);
    flip(id);
    const supabase = createClient();
    const { error } = await supabase.rpc("toggle_checklist_item", { item_id: id });
    setPending(null);
    if (error) {
      flip(id);
      toast.error("Couldn't update", { description: error.message });
    }
  }

  const fg1 = tokens.colorNeutralForeground1;
  const fg2 = tokens.colorNeutralForeground2;
  const fg3 = tokens.colorNeutralForeground3;
  const track = onDark ? "rgba(255,255,255,0.1)" : "#ece9e2";
  const divider = onDark ? "#231f19" : "#f1efe8";

  if (total === 0)
    return <p style={{ fontSize: 14, color: fg3 }}>Your onboarding steps will appear here shortly.</p>;

  if (complete && !expanded)
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 12, padding: "0.85rem 1rem", background: onDark ? "rgba(34,197,94,0.14)" : "#dcfce7" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: onDark ? "#86efac" : "#166534" }}>
          <Check size={16} strokeWidth={2.5} /> Onboarding complete — you&apos;re all set.
        </span>
        <button type="button" onClick={() => setExpanded(true)} className="rd-focus" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: onDark ? "#86efac" : "#166534", textDecoration: "underline" }}>
          Review
        </button>
      </div>
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: fg2 }} className="rd-tnum">{done} of {total} done</span>
          {complete && (
            <button type="button" onClick={() => setExpanded(false)} className="rd-focus" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: fg3 }}>Hide</button>
          )}
        </div>
        <div style={{ height: 6, borderRadius: 999, overflow: "hidden", background: track }}>
          <div style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: "linear-gradient(90deg,#b45309,#f59e0b)", transition: "width 250ms ease-out" }} />
        </div>
      </div>

      {groups.map((g) => {
        const phaseOpen = openPhases[g.phase] ?? false;
        const phaseDone = g.items.filter(isRowDone).length;
        return (
          <div key={g.phase} style={{ display: "flex", flexDirection: "column" }}>
            <button type="button" onClick={() => togglePhase(g.phase)} aria-expanded={phaseOpen} className="rd-focus rd-eyebrow" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "none", border: "none", cursor: "pointer", padding: "6px 0", color: fg3 }}>
              <span>{g.phase}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span className="rd-tnum" style={{ fontSize: 11, color: fg3 }}>{phaseDone}/{g.items.length}</span>
                <ChevronDown size={16} className={cn("motion-state", phaseOpen && "rotate-180")} />
              </span>
            </button>
            <div style={{ display: "grid", gridTemplateRows: phaseOpen ? "1fr" : "0fr", transition: "grid-template-rows var(--duration-med) var(--ease-in-out)" }}>
              <div style={{ overflow: "hidden" }}>
                <div style={{ display: "flex", flexDirection: "column", paddingTop: 4 }}>
                  {g.items.map((it) => {
                    const team = it.assignee === "team";
                    const checked = isRowDone(it);
                    const busy = pending === it.id;
                    return (
                      <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "0.6rem 0", borderTop: `1px solid ${divider}` }}>
                        {team ? (
                          <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 999, display: "grid", placeItems: "center", border: `1px dashed ${onDark ? "#37322a" : "#d6d3cd"}`, color: fg3 }}>
                            <Users size={12} />
                          </span>
                        ) : (
                          <button type="button" disabled={busy} onClick={() => toggle(it.id)} aria-label={checked ? "Mark not done" : "Mark done"} className="rd-focus" style={{ flexShrink: 0, background: "none", border: "none", cursor: busy ? "default" : "pointer", padding: 0, opacity: busy ? 0.6 : 1, borderRadius: 999 }}>
                            {checked ? (
                              <span style={{ display: "grid", placeItems: "center", width: 24, height: 24, borderRadius: 999, background: "#b45309", color: "#fff", animation: "tickPop 300ms var(--spring-tick)" }}>
                                <Check size={14} strokeWidth={3} />
                              </span>
                            ) : (
                              <span style={{ display: "block", width: 24, height: 24, borderRadius: 999, border: `1.5px solid ${onDark ? "#37322a" : "#d6d3cd"}` }} />
                            )}
                          </button>
                        )}
                        <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: team ? fg2 : fg1 }}>{it.title}</span>
                        {team ? (
                          <span style={{ fontSize: 12, fontStyle: "italic", color: fg3 }}>We&apos;ll take care of this.</span>
                        ) : it.link_url ? (
                          <Button as="a" href={it.link_url} target="_blank" rel="noreferrer" size="small" appearance="primary">Open</Button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
