"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleCheck, Circle, ExternalLink } from "lucide-react";

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

export function ClientChecklist({ items }: { items: ClientChecklistItem[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  const done = items.filter((i) => i.is_done).length;
  const total = items.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const groups = groupByPhase(items);

  async function toggle(id: string) {
    setPending(id);
    const supabase = createClient();
    const { error } = await supabase.rpc("toggle_checklist_item", {
      item_id: id,
    });
    setPending(null);
    if (error) {
      toast.error("Couldn't update", { description: error.message });
      return;
    }
    router.refresh();
  }

  if (total === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Your onboarding steps will appear here shortly.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-sm font-medium">
          {done}/{total}
        </span>
      </div>

      {groups.map((g) => (
        <div key={g.phase} className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">{g.phase}</h3>
          <ul className="divide-y rounded-lg border">
            {g.items.map((it) => {
              const tickable = it.assignee === "client";
              return (
                <li key={it.id} className="flex items-center gap-3 p-3">
                  <button
                    type="button"
                    disabled={!tickable || pending === it.id}
                    onClick={() => tickable && toggle(it.id)}
                    className={
                      tickable
                        ? "shrink-0 text-primary disabled:opacity-50"
                        : "shrink-0 cursor-default"
                    }
                    aria-label={
                      tickable
                        ? it.is_done
                          ? "Mark not done"
                          : "Mark done"
                        : "Handled by your team"
                    }
                  >
                    {it.is_done ? (
                      <CircleCheck className="size-5" />
                    ) : (
                      <Circle className="size-5 text-muted-foreground" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className={it.is_done ? "text-muted-foreground line-through" : ""}>
                      {it.title}
                    </div>
                    {!tickable && (
                      <span className="text-xs text-muted-foreground">
                        We&apos;ll take care of this
                      </span>
                    )}
                  </div>

                  {it.link_url && (
                    <Button asChild variant="outline" size="sm">
                      <a href={it.link_url} target="_blank" rel="noreferrer">
                        Open <ExternalLink className="size-3" />
                      </a>
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
