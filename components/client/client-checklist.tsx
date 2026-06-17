"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

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
    if (!g) {
      g = { phase, items: [] };
      groups.push(g);
    }
    g.items.push(it);
  }
  return groups;
}

export function ClientChecklist({
  items: initialItems,
}: {
  items: ClientChecklistItem[];
}) {
  // local copy → the checkbox flips INSTANTLY; the server prop re-syncs on refresh.
  const [items, setItems] = useState(initialItems);
  // Re-sync when the server prop changes (after refresh) — "adjust state during render".
  const [prevItems, setPrevItems] = useState(initialItems);
  if (initialItems !== prevItems) {
    setPrevItems(initialItems);
    setItems(initialItems);
  }
  const [pending, setPending] = useState<string | null>(null);

  // team rows always count as done (the agency handles them) — design spec
  const isRowDone = (i: ClientChecklistItem) =>
    i.assignee === "team" ? true : i.is_done;
  const done = items.filter(isRowDone).length;
  const total = items.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const complete = total > 0 && done === total;
  const [expanded, setExpanded] = useState(!complete);
  const groups = groupByPhase(items);
  // accordion: first phase open, the rest collapsed
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>(() =>
    groups[0] ? { [groups[0].phase]: true } : {},
  );
  const togglePhase = (phase: string) =>
    setOpenPhases((p) => ({ ...p, [phase]: !p[phase] }));

  const flip = (id: string) =>
    setItems((xs) => xs.map((it) => (it.id === id ? { ...it, is_done: !it.is_done } : it)));

  async function toggle(id: string) {
    setPending(id);
    flip(id); // optimistic — instant checkbox
    const supabase = createClient();
    const { error } = await supabase.rpc("toggle_checklist_item", { item_id: id });
    setPending(null);
    if (error) {
      flip(id); // revert
      toast.error("Couldn't update", { description: error.message });
    }
  }

  if (total === 0) {
    return (
      <p className="text-sm text-ink-3">
        Your onboarding steps will appear here shortly.
      </p>
    );
  }

  if (complete && !expanded) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl bg-success-bg px-4 py-3.5">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-success-text">
          <Check className="size-4" strokeWidth={2.5} />
          Onboarding complete — you&apos;re all set.
        </span>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-xs font-semibold text-success-text underline underline-offset-2"
        >
          Review
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-ink-2">
            {done} of {total} done
          </span>
          {complete && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-xs font-semibold text-ink-3 hover:text-ink"
            >
              Hide
            </button>
          )}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-amber-600 transition-[width] duration-[250ms] ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {groups.map((g) => {
        const phaseOpen = openPhases[g.phase] ?? false;
        const phaseDone = g.items.filter(isRowDone).length;
        return (
        <div key={g.phase} className="flex flex-col">
          <button
            type="button"
            onClick={() => togglePhase(g.phase)}
            aria-expanded={phaseOpen}
            className="motion-micro -mx-2 flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2"
          >
            <span className="text-[11px] font-bold tracking-wider text-ink-3 uppercase">
              {g.phase}
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[11px] tabular-nums text-ink-faint">
                {phaseDone}/{g.items.length}
              </span>
              <ChevronDown
                className={cn(
                  "motion-state size-4 text-ink-3",
                  phaseOpen && "rotate-180",
                )}
              />
            </span>
          </button>
          <div
            className="grid"
            style={{
              gridTemplateRows: phaseOpen ? "1fr" : "0fr",
              transition: "grid-template-rows var(--duration-med) var(--ease-in-out)",
            }}
          >
           <div className="overflow-hidden">
            <div className="flex flex-col gap-1 pt-1">
          {g.items.map((it) => {
            const team = it.assignee === "team";
            const checked = isRowDone(it);
            const busy = pending === it.id;
            return (
              <div
                key={it.id}
                className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5"
              >
                {team ? (
                  <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed border-border-strong bg-bg text-ink-3">
                    <Users className="size-3" />
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => toggle(it.id)}
                    aria-label={checked ? "Mark not done" : "Mark done"}
                    className="-m-2.5 inline-flex shrink-0 items-center justify-center rounded-full p-2.5 disabled:opacity-60"
                  >
                    {checked ? (
                      <span
                        className="inline-flex size-6 items-center justify-center rounded-full bg-amber-600 text-white"
                        style={{ animation: "tickPop 300ms var(--spring-tick)" }}
                      >
                        <Check className="size-3.5" strokeWidth={3} />
                      </span>
                    ) : (
                      <span className="size-6 rounded-full border-[1.5px] border-border-strong bg-surface" />
                    )}
                  </button>
                )}

                <span
                  className={`flex-1 text-sm font-medium ${team ? "text-ink-2" : "text-ink"}`}
                >
                  {it.title}
                </span>

                {team ? (
                  <span className="text-xs text-ink-3 italic">
                    We&apos;ll take care of this.
                  </span>
                ) : it.link_url ? (
                  <Button asChild size="sm">
                    <a href={it.link_url} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  </Button>
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
