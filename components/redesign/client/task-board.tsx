"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Columns3, List, ListChecks, MessageSquare, Plus, User } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { TaskMember } from "@/lib/tasks";
import { Eyebrow, StatusPill, EmberButton, Button, tokens } from "@/components/redesign/ui";
import { useRedesignMode } from "@/components/redesign/themed-fluent";
import { ClientPageFrame } from "@/components/redesign/client/page-frame";
import { type ClientTaskRow } from "@/components/tasks/client-task-board";
import { ClientTaskDialog } from "@/components/tasks/client-task-dialog";
import { TaskDetailDialog, type TaskDep } from "@/components/redesign/staff/task-detail-dialog";

// @hello-pangea/dnd is heavy → the board lands in its own lazy chunk (ssr:false).
const TaskKanban = dynamic(() => import("./task-kanban").then((m) => m.TaskKanban), { ssr: false });

type Dep = { id: string; task_id: string; blocked_by_task_id: string };
export type { ClientTaskRow };

/** ViewToggle — shared List/Board switch (both roles). */
export function ViewToggle({ view, onChange, onDark }: { view: "list" | "board"; onChange: (v: "list" | "board") => void; onDark: boolean }) {
  const border = onDark ? "#34302a" : "#e7e5e0";
  const btn = (v: "list" | "board", icon: React.ReactNode, label: string) => (
    <button type="button" onClick={() => onChange(v)} aria-pressed={view === v} className="rd-focus" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0.35rem 0.7rem", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", border: "none", background: view === v ? (onDark ? "rgba(245,158,11,0.16)" : "#fef3c7") : "transparent", color: view === v ? (onDark ? "#fcd34d" : "#92400e") : (onDark ? "#b3aca0" : "#6f6c66") }}>
      {icon} {label}
    </button>
  );
  return <div style={{ display: "inline-flex", borderRadius: 999, border: `1px solid ${border}`, overflow: "hidden" }}>{btn("list", <List size={14} />, "List")}{btn("board", <Columns3 size={14} />, "Board")}</div>;
}

/**
 * R2 client task board (re-skinned). INVARIANTS preserved: task status is a READ-ONLY
 * chip (no client status-write); NO timer/time-tracking anywhere (staff-only); the RLS
 * query already excludes invisible/internal tasks, so the ?task= detail can only open a
 * row in this list. Add + detail go through the existing ClientTaskDialog (create_task)
 * and TaskDetailDialog (role="client" → editable title/description only + checklist),
 * reused verbatim — the write paths are unchanged.
 */
export function TaskBoard({ tasks, members, deps = [] }: { tasks: ClientTaskRow[]; members: TaskMember[]; deps?: Dep[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const { mode } = useRedesignMode();
  const onDark = mode === "dark";
  const fg1 = tokens.colorNeutralForeground1;
  const fg2 = tokens.colorNeutralForeground2;
  const fg3 = tokens.colorNeutralForeground3;
  const panel = onDark ? "rd-solid--dark" : "rd-solid";
  const [view, setView] = React.useState<"list" | "board">("list");

  const openId = params.get("task");
  const openTask = openId ? tasks.find((t) => t.id === openId) ?? null : null;
  const titleById = new Map(tasks.map((t) => [t.id, { title: t.title, status: t.status as string }]));
  const openDeps: TaskDep[] = openTask
    ? deps.filter((d) => d.task_id === openTask.id).map((d) => ({ id: d.id, blocker_id: d.blocked_by_task_id, title: titleById.get(d.blocked_by_task_id)?.title ?? "—", status: titleById.get(d.blocked_by_task_id)?.status ?? "todo" }))
    : [];

  const addBtn = <ClientTaskDialog members={members} trigger={<EmberButton icon={<Plus size={16} />}>Add task</EmberButton>} />;

  return (
    <ClientPageFrame width="standard">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", paddingBlock: "clamp(0.5rem,2vw,1rem)" }}>
        <div className="rd-rise" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "1rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <Eyebrow tone={onDark ? "onDark" : "amber"}>Tasks</Eyebrow>
            <h1 className="rd-display" style={{ margin: 0, fontSize: "clamp(1.9rem,5vw,2.6rem)", fontWeight: 600, lineHeight: 1.02, color: fg1 }}>
              What we&apos;re working on together.
            </h1>
          </div>
          {tasks.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <ViewToggle view={view} onChange={setView} onDark={onDark} />
              {addBtn}
            </div>
          )}
        </div>

        {tasks.length === 0 ? (
          <div className={panel} style={{ borderRadius: 20, padding: "3rem 2rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ display: "grid", placeItems: "center", width: 48, height: 48, borderRadius: 14, background: onDark ? "rgba(245,158,11,0.14)" : "#fef3c7", color: "#b45309" }}><ListChecks size={22} /></span>
            <div className="rd-display" style={{ fontSize: "1.25rem", fontWeight: 600, color: fg1 }}>No tasks yet</div>
            <p style={{ margin: 0, fontSize: "0.9rem", color: fg3, maxWidth: "24rem" }}>Add a task for your team, or we&apos;ll add the ones we need from you.</p>
            {addBtn}
          </div>
        ) : view === "board" ? (
          <TaskKanban
            role="client"
            tasks={tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, assigneeName: t.assigneeName, due_date: t.due_date, is_milestone: t.is_milestone, blocked_by_client: t.blocked_by_client, client_signed_off_at: t.client_signed_off_at }))}
            deps={deps.map((d) => ({ task_id: d.task_id, blocked_by_task_id: d.blocked_by_task_id }))}
            onOpen={(id) => router.push(`/tasks?task=${id}`, { scroll: false })}
          />
        ) : (
          <ul className="rd-task-grid" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {tasks.map((t, i) => {
              const done = t.checklist.filter((c) => c.is_done).length;
              return (
                <li key={t.id} className="rd-rise" style={{ animationDelay: `${i * 45}ms` }}>
                  <Link href={`/tasks?task=${t.id}`} scroll={false} aria-label={`Open task ${t.title}`} className={`${panel} rd-lift`} style={{ display: "block", borderRadius: 20, padding: "1.2rem", textDecoration: "none" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: "0.95rem", fontWeight: 600, color: fg1 }}>{t.title}</span>
                      {/* READ-ONLY status — staff-controlled */}
                      <StatusPill value={t.status} mode={mode} />
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem", marginTop: "0.45rem", fontSize: "0.74rem", color: fg3 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><User size={12} /> {t.assigneeName ?? "Unassigned"}</span>
                      {t.due_date && <span>Due {formatDate(t.due_date)}</span>}
                      {t.source_message_id && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><MessageSquare size={12} /> from a message</span>}
                      {t.checklist.length > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><ListChecks size={12} /> {done}/{t.checklist.length}</span>}
                    </div>
                    {t.description && <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem", color: fg2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.description}</p>}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {openTask && (
          <TaskDetailDialog task={openTask} role="client" members={members} checklist={openTask.checklist} deps={openDeps} open onOpenChange={(v) => { if (!v) router.push("/tasks", { scroll: false }); }} />
        )}
      </div>
      <style>{`.rd-task-grid{display:grid;gap:1rem;grid-template-columns:1fr;} @media(min-width:900px){.rd-task-grid{grid-template-columns:1fr 1fr;}}`}</style>
    </ClientPageFrame>
  );
}
