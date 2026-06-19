"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ListChecks, MessageSquare, Plus, User } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { TaskMember } from "@/lib/tasks";
import { Eyebrow, StatusPill, EmberButton, Button, tokens } from "@/components/redesign/ui";
import { useRedesignMode } from "@/components/redesign/themed-fluent";
import { ClientPageFrame } from "@/components/redesign/client/page-frame";
import { type ClientTaskRow } from "@/components/tasks/client-task-board";
import { ClientTaskDialog } from "@/components/tasks/client-task-dialog";
import { TaskDetailDialog } from "@/components/redesign/staff/task-detail-dialog";

export type { ClientTaskRow };

/**
 * R2 client task board (re-skinned). INVARIANTS preserved: task status is a READ-ONLY
 * chip (no client status-write); NO timer/time-tracking anywhere (staff-only); the RLS
 * query already excludes invisible/internal tasks, so the ?task= detail can only open a
 * row in this list. Add + detail go through the existing ClientTaskDialog (create_task)
 * and TaskDetailDialog (role="client" → editable title/description only + checklist),
 * reused verbatim — the write paths are unchanged.
 */
export function TaskBoard({ tasks, members }: { tasks: ClientTaskRow[]; members: TaskMember[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const { mode } = useRedesignMode();
  const onDark = mode === "dark";
  const fg1 = tokens.colorNeutralForeground1;
  const fg2 = tokens.colorNeutralForeground2;
  const fg3 = tokens.colorNeutralForeground3;
  const panel = onDark ? "rd-solid--dark" : "rd-solid";

  const openId = params.get("task");
  const openTask = openId ? tasks.find((t) => t.id === openId) ?? null : null;

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
          {tasks.length > 0 && addBtn}
        </div>

        {tasks.length === 0 ? (
          <div className={panel} style={{ borderRadius: 20, padding: "3rem 2rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ display: "grid", placeItems: "center", width: 48, height: 48, borderRadius: 14, background: onDark ? "rgba(245,158,11,0.14)" : "#fef3c7", color: "#b45309" }}><ListChecks size={22} /></span>
            <div className="rd-display" style={{ fontSize: "1.25rem", fontWeight: 600, color: fg1 }}>No tasks yet</div>
            <p style={{ margin: 0, fontSize: "0.9rem", color: fg3, maxWidth: "24rem" }}>Add a task for your team, or we&apos;ll add the ones we need from you.</p>
            {addBtn}
          </div>
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
          <TaskDetailDialog task={openTask} role="client" members={members} checklist={openTask.checklist} open onOpenChange={(v) => { if (!v) router.push("/tasks", { scroll: false }); }} />
        )}
      </div>
      <style>{`.rd-task-grid{display:grid;gap:1rem;grid-template-columns:1fr;} @media(min-width:900px){.rd-task-grid{grid-template-columns:1fr 1fr;}}`}</style>
    </ClientPageFrame>
  );
}
