"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ListChecks, MessageSquare, Plus, User } from "lucide-react";

import { setTaskStatusAction } from "@/lib/actions/tasks-client";
import { TASK_STATUSES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { TaskMember } from "@/lib/tasks";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClientTaskDialog } from "./client-task-dialog";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Stagger, StaggerItem } from "@/components/motion/motion-primitives";

export type ClientTaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  assignee_id: string | null;
  assigneeName: string | null;
  due_date: string | null;
  source_message_id: string | null;
};

export function ClientTaskBoard({
  tasks: initialTasks,
  members,
}: {
  tasks: ClientTaskRow[];
  members: TaskMember[];
}) {
  // local copy so a status change paints INSTANTLY (optimistic); the server prop
  // re-syncs on any real refresh/navigation. Reconcile/revert on error.
  const [tasks, setTasks] = useState(initialTasks);
  // Re-sync local optimistic state when the server prop changes (after refresh) — the
  // React-blessed "adjust state during render" pattern (no effect, no cascading render).
  const [prevTasks, setPrevTasks] = useState(initialTasks);
  if (initialTasks !== prevTasks) {
    setPrevTasks(initialTasks);
    setTasks(initialTasks);
  }

  async function setStatus(id: string, status: ClientTaskRow["status"]) {
    const prev = tasks;
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, status } : t))); // <100ms
    const res = await setTaskStatusAction(id, status);
    if (!res.ok) {
      setTasks(prev); // revert
      toast.error("Couldn't update", { description: res.error });
    }
  }

  const addBtn = (
    <ClientTaskDialog
      members={members}
      trigger={
        <Button>
          <Plus className="size-4" /> Add task
        </Button>
      }
    />
  );

  return (
    <PageContainer width="standard" stack>
      <PageHeader
        title="Tasks"
        description="What we're working on together — yours and ours."
        actions={tasks.length > 0 ? addBtn : undefined}
      />

      {tasks.length === 0 ? (
        <EmptyState
          icon={<ListChecks />}
          title="No tasks yet"
          description="Add a task for your team, or we'll add the ones we need from you."
          action={addBtn}
        />
      ) : (
        <Stagger as="ul" className="grid items-stretch gap-4 lg:grid-cols-2">
          {tasks.map((t) => (
            <StaggerItem as="li" key={t.id}>
              <Card className="h-full">
                <CardContent className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{t.title}</span>
                      <StatusChip kind="task" value={t.status} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-ink-3">
                      <span className="inline-flex items-center gap-1">
                        <User className="size-3" />
                        {t.assigneeName ?? "Unassigned"}
                      </span>
                      {t.due_date && <span>Due {formatDate(t.due_date)}</span>}
                      {t.source_message_id && (
                        <Link
                          href="/messages"
                          className="inline-flex items-center gap-1 text-ink-3 hover:text-ink"
                        >
                          <MessageSquare className="size-3" /> from a message
                        </Link>
                      )}
                    </div>
                    {t.description && <p className="pt-1 text-sm text-ink-2">{t.description}</p>}
                  </div>
                  <Select
                    value={t.status}
                    onValueChange={(s) => setStatus(t.id, s as ClientTaskRow["status"])}
                  >
                    <SelectTrigger size="sm" className="w-[8.5rem] shrink-0" aria-label={`Status for ${t.title}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_STATUSES.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </PageContainer>
  );
}
