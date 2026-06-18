"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AnimatePresence, m } from "motion/react";
import { ListChecks, Plus, Trash2 } from "lucide-react";

import { spring, useReducedMotion } from "@/lib/motion";
import type { TaskChecklistItem } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  addChecklistItemAction,
  toggleChecklistItemAction,
  editChecklistItemAction,
  deleteChecklistItemAction,
  staffAddChecklistItemAction,
  staffToggleChecklistItemAction,
  staffEditChecklistItemAction,
  staffDeleteChecklistItemAction,
} from "@/lib/actions/task-checklist";

/** Compact progress badge (bar + n/total) for a task card — auto-hides with no items. */
export function TaskChecklistProgress({
  items,
  className,
}: {
  items: TaskChecklistItem[];
  className?: string;
}) {
  const total = items.length;
  if (total === 0) return null;
  const done = items.filter((i) => i.is_done).length;
  const pct = Math.round((done / total) * 100);
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
        <span
          className="block h-full rounded-full bg-amber-600 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="inline-flex items-center gap-1 tabular-nums">
        <ListChecks className="size-3" /> {done}/{total}
      </span>
    </span>
  );
}

/**
 * SUBTASKS — checklist-style items under a parent task, rendered in the detail
 * dialog's SUBTASKS slot for BOTH roles. CLIENT writes go through the SECURITY
 * DEFINER RPCs (own-client + the parent task must be visible_to_client); STAFF write
 * directly under the for-all policies. Optimistic add / toggle / rename / remove, a
 * parent done/total progress bar on top, phase-3 motion (reduced-motion respected).
 *
 * The internal-thread boundary is INHERITED: a client only ever reaches this for a
 * task already in their RLS-scoped list (own + visible_to_client), and every client
 * RPC re-validates that gate — so there is no client path to an item under an
 * internal / invisible / cross-client task.
 */
export function TaskChecklist({
  taskId,
  role,
  clientId,
  items: incoming,
}: {
  taskId: string;
  role: "client" | "staff";
  clientId?: string;
  items: TaskChecklistItem[];
}) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const isStaff = role === "staff";

  const [items, setItems] = useState(incoming);
  // Re-sync when the server prop changes (router.refresh / a different task opens) —
  // "adjust state during render", no effect.
  const [prev, setPrev] = useState(incoming);
  if (incoming !== prev) {
    setPrev(incoming);
    setItems(incoming);
  }

  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const done = items.filter((i) => i.is_done).length;
  const total = items.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  async function add() {
    const title = newTitle.trim();
    if (!title || adding) return;
    setAdding(true);
    const res = isStaff
      ? await staffAddChecklistItemAction(clientId!, taskId, title)
      : await addChecklistItemAction(taskId, title);
    setAdding(false);
    if (!res.ok) {
      toast.error("Couldn't add subtask", { description: res.error });
      return;
    }
    setNewTitle("");
    router.refresh();
  }

  async function toggle(item: TaskChecklistItem) {
    const next = !item.is_done;
    setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, is_done: next } : x))); // optimistic
    const res = isStaff
      ? await staffToggleChecklistItemAction(clientId!, item.id, next)
      : await toggleChecklistItemAction(item.id);
    if (!res.ok) {
      setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, is_done: item.is_done } : x)));
      toast.error("Couldn't update subtask", { description: res.error });
    } else {
      router.refresh();
    }
  }

  async function saveEdit(item: TaskChecklistItem) {
    const title = editTitle.trim();
    setEditId(null);
    if (!title || title === item.title) return;
    setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, title } : x))); // optimistic
    const res = isStaff
      ? await staffEditChecklistItemAction(clientId!, item.id, title)
      : await editChecklistItemAction(item.id, title);
    if (!res.ok) {
      toast.error("Couldn't rename subtask", { description: res.error });
      router.refresh();
    }
  }

  async function remove(item: TaskChecklistItem) {
    setItems((xs) => xs.filter((x) => x.id !== item.id)); // optimistic
    const res = isStaff
      ? await staffDeleteChecklistItemAction(clientId!, item.id)
      : await deleteChecklistItemAction(item.id);
    if (!res.ok) {
      toast.error("Couldn't delete subtask", { description: res.error });
    }
    router.refresh();
  }

  const row = (item: TaskChecklistItem) => (
    <div className="group flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-surface-2">
      <Checkbox checked={item.is_done} onCheckedChange={() => toggle(item)} aria-label={item.title} />
      {editId === item.id ? (
        <Input
          value={editTitle}
          autoFocus
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={() => saveEdit(item)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              saveEdit(item);
            }
            if (e.key === "Escape") setEditId(null);
          }}
          className="h-7 flex-1"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setEditId(item.id);
            setEditTitle(item.title);
          }}
          className={cn(
            "flex-1 truncate text-left text-sm",
            item.is_done && "text-ink-3 line-through",
          )}
        >
          {item.title}
        </button>
      )}
      <button
        type="button"
        onClick={() => remove(item)}
        aria-label={`Delete subtask ${item.title}`}
        className="shrink-0 rounded-md p-1 text-ink-3 opacity-0 transition hover:text-rose-600 focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );

  return (
    <div className="space-y-2.5 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Subtasks</span>
        {total > 0 && (
          <span className="text-xs tabular-nums text-ink-3">
            {done}/{total}
          </span>
        )}
      </div>

      {total > 0 && (
        <div
          className="h-1.5 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Subtasks completed"
        >
          <div className="h-full rounded-full bg-amber-600 transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      )}

      <ul className="space-y-0.5">
        {reduced ? (
          items.map((item) => <li key={item.id}>{row(item)}</li>)
        ) : (
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <m.li
                key={item.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={spring.snappy}
                className="overflow-hidden"
              >
                {row(item)}
              </m.li>
            ))}
          </AnimatePresence>
        )}
      </ul>

      <div className="flex items-center gap-2 pt-0.5">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add a subtask…"
          className="h-8 flex-1"
        />
        <Button type="button" size="sm" variant="outline" onClick={add} loading={adding} disabled={!newTitle.trim()}>
          <Plus className="size-4" /> Add
        </Button>
      </div>
    </div>
  );
}
