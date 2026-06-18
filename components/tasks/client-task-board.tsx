"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ListChecks, MessageSquare, Plus, User } from "lucide-react";

import { formatDate } from "@/lib/format";
import type { TaskMember, TaskChecklistItem } from "@/lib/tasks";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";
import { ClientTaskDialog } from "./client-task-dialog";
import { TaskDetailDialog } from "./task-detail-dialog";
import { TaskChecklistProgress } from "./task-checklist";
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
  sourceThreadType: "client_shared" | "internal" | null;
  createdByName: string | null;
  created_at: string;
  checklist: TaskChecklistItem[];
};

export function ClientTaskBoard({
  tasks,
  members,
}: {
  tasks: ClientTaskRow[];
  members: TaskMember[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  // `?task={id}` opens the detail for a row already in this RLS-scoped list (a task
  // the client can't see never reaches the list → opening it is a natural no-op).
  const openId = params.get("task");
  const openTask = openId ? tasks.find((t) => t.id === openId) ?? null : null;

  // Task status is STAFF-controlled: clients see it read-only (the StatusChip) and have
  // no status-write path. In the detail they may edit title + description only.
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
            <StaggerItem as="li" key={t.id} lift className="block">
              <Link
                href={`/tasks?task=${t.id}`}
                scroll={false}
                className="block h-full"
                aria-label={`Open task ${t.title}`}
              >
                <Card className="h-full transition-shadow hover:shadow-e3">
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
                          <span className="inline-flex items-center gap-1">
                            <MessageSquare className="size-3" /> from a message
                          </span>
                        )}
                        <TaskChecklistProgress items={t.checklist} />
                      </div>
                      {t.description && (
                        <p className="line-clamp-2 pt-1 text-sm text-ink-2">{t.description}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      )}

      {openTask && (
        <TaskDetailDialog
          task={openTask}
          role="client"
          members={members}
          checklist={openTask.checklist}
          open
          onOpenChange={(v) => {
            if (!v) router.push("/tasks", { scroll: false });
          }}
        />
      )}
    </PageContainer>
  );
}
