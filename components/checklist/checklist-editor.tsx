"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  CircleCheck,
  Circle,
  Eye,
  EyeOff,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import {
  deleteChecklistItemAction,
  moveChecklistItemAction,
  setChecklistVisibleAction,
  toggleChecklistDoneAction,
} from "@/lib/actions/checklist";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ChecklistItemDialog } from "./checklist-item-dialog";

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
    if (!g) {
      g = { phase, items: [] };
      groups.push(g);
    }
    g.items.push(it);
  }
  return groups;
}

function KindPanel({
  clientId,
  kind,
  items,
}: {
  clientId: string;
  kind: "onboarding" | "offboarding";
  items: ChecklistItem[];
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

  const done = items.filter((i) => i.is_done).length;
  const groups = groupByPhase([...items].sort((a, b) => a.sort_order - b.sort_order));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {items.length === 0
            ? "No items yet."
            : `${done}/${items.length} done`}
        </p>
        <ChecklistItemDialog
          clientId={clientId}
          kind={kind}
          trigger={
            <Button size="sm">
              <Plus className="size-4" /> Add item
            </Button>
          }
        />
      </div>

      {groups.map((g) => (
        <div key={g.phase} className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">{g.phase}</h3>
          <ul className="divide-y rounded-lg border">
            {g.items.map((it) => (
              <li
                key={it.id}
                className="flex flex-wrap items-center gap-2 p-3 sm:flex-nowrap"
              >
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(toggleChecklistDoneAction(clientId, it.id, !it.is_done))
                  }
                  className="shrink-0 text-primary disabled:opacity-50"
                  aria-label={it.is_done ? "Mark not done" : "Mark done"}
                >
                  {it.is_done ? (
                    <CircleCheck className="size-5" />
                  ) : (
                    <Circle className="size-5 text-muted-foreground" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div
                    className={
                      it.is_done ? "text-muted-foreground line-through" : ""
                    }
                  >
                    {it.title}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {it.assignee}
                    </Badge>
                    {!it.visible_to_client && (
                      <Badge variant="outline" className="text-[10px]">
                        hidden
                      </Badge>
                    )}
                    {it.link_url && (
                      <Button asChild variant="ghost" size="sm">
                        <a href={it.link_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="size-3" /> Link
                        </a>
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    onClick={() => run(moveChecklistItemAction(clientId, it.id, "up"))}
                    aria-label="Move up"
                  >
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    onClick={() =>
                      run(moveChecklistItemAction(clientId, it.id, "down"))
                    }
                    aria-label="Move down"
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    onClick={() =>
                      run(
                        setChecklistVisibleAction(
                          clientId,
                          it.id,
                          !it.visible_to_client,
                        ),
                      )
                    }
                    aria-label="Toggle visibility"
                  >
                    {it.visible_to_client ? (
                      <Eye className="size-4" />
                    ) : (
                      <EyeOff className="size-4" />
                    )}
                  </Button>
                  <ChecklistItemDialog
                    clientId={clientId}
                    kind={kind}
                    item={it}
                    trigger={
                      <Button variant="ghost" size="icon" aria-label="Edit">
                        <Pencil className="size-4" />
                      </Button>
                    }
                  />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Delete">
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this item?</AlertDialogTitle>
                        <AlertDialogDescription>
                          &ldquo;{it.title}&rdquo; will be permanently removed.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            run(deleteChecklistItemAction(clientId, it.id))
                          }
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function ChecklistEditor({
  clientId,
  items,
}: {
  clientId: string;
  items: ChecklistItem[];
}) {
  const onboarding = items.filter((i) => i.kind === "onboarding");
  const offboarding = items.filter((i) => i.kind === "offboarding");

  return (
    <Tabs defaultValue="onboarding">
      <TabsList>
        <TabsTrigger value="onboarding">
          Onboarding ({onboarding.length})
        </TabsTrigger>
        <TabsTrigger value="offboarding">
          Off-boarding ({offboarding.length})
        </TabsTrigger>
      </TabsList>
      <TabsContent value="onboarding" className="pt-4">
        <KindPanel clientId={clientId} kind="onboarding" items={onboarding} />
      </TabsContent>
      <TabsContent value="offboarding" className="pt-4">
        <KindPanel clientId={clientId} kind="offboarding" items={offboarding} />
      </TabsContent>
    </Tabs>
  );
}
