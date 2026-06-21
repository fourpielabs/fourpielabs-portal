"use client";

import * as React from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { CalendarDays, Flag, Link2, Lock, ShieldCheck, User } from "lucide-react";
import { tokens, StatusPill } from "@/components/redesign/ui";
import { useRedesignMode } from "@/components/redesign/themed-fluent";
import { TASK_STATUSES } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export type KanbanTask = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "review" | "done";
  assigneeName: string | null;
  due_date: string | null;
  is_milestone?: boolean;
  blocked_by_client?: boolean;
  client_signed_off_at?: string | null;
};
export type KanbanDep = { task_id: string; blocked_by_task_id: string };

const COLS = TASK_STATUSES.map((s) => ({ key: s.value, label: s.label }));

/**
 * Role-aware Kanban. STAFF: drag cards between columns → onStatusChange (the
 * existing staff status path). CLIENT: read-only — no DragDropContext is rendered,
 * so there is NO drag-to-write (the task-status lock; clients only SEE the columns).
 * @hello-pangea/dnd gives keyboard + screen-reader drag for the staff board. The
 * component is dynamically imported by its parents (ssr:false) so the dnd lib stays
 * in a lazy chunk.
 */
export function TaskKanban({
  tasks, deps, role, onStatusChange, onOpen,
}: {
  tasks: KanbanTask[];
  deps: KanbanDep[];
  role: "staff" | "client";
  onStatusChange?: (id: string, status: KanbanTask["status"]) => void;
  onOpen: (id: string) => void;
}) {
  const { mode } = useRedesignMode();
  const onDark = mode === "dark";
  const fg1 = tokens.colorNeutralForeground1, fg3 = tokens.colorNeutralForeground3;
  const colBg = onDark ? "rgba(255,255,255,0.03)" : "#faf9f5";
  const border = onDark ? "#34302a" : "#e7e5e0";

  // a task is dependency-blocked if any of its blockers isn't done yet
  const statusById = React.useMemo(() => new Map(tasks.map((t) => [t.id, t.status])), [tasks]);
  const blockedBy = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const d of deps) if (statusById.get(d.blocked_by_task_id) && statusById.get(d.blocked_by_task_id) !== "done") m.set(d.task_id, (m.get(d.task_id) ?? 0) + 1);
    return m;
  }, [deps, statusById]);

  const byStatus = (s: string) => tasks.filter((t) => t.status === s);

  function onDragEnd(r: DropResult) {
    if (!r.destination) return;
    const to = r.destination.droppableId as KanbanTask["status"];
    const from = r.source.droppableId;
    if (to === from) return;
    onStatusChange?.(r.draggableId, to);
  }

  const card = (t: KanbanTask, dragging = false) => {
    const depCount = blockedBy.get(t.id) ?? 0;
    return (
      <div
        onClick={() => onOpen(t.id)}
        className={onDark ? "rd-solid--dark" : "rd-solid"}
        style={{ borderRadius: 12, padding: "0.7rem 0.8rem", display: "flex", flexDirection: "column", gap: 6, cursor: "pointer", boxShadow: dragging ? "0 12px 28px -12px rgba(40,33,24,0.45)" : undefined, border: dragging ? `1px solid #d97706` : `1px solid ${border}` }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
          {t.is_milestone && <Flag size={13} style={{ flexShrink: 0, marginTop: 3, color: "#b45309" }} aria-label="Milestone" />}
          <span style={{ fontSize: "0.86rem", fontWeight: 600, color: fg1, lineHeight: 1.25 }}>{t.title}</span>
        </div>
        {/* indicators */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {t.blocked_by_client && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 800, letterSpacing: ".02em", padding: "0.12rem 0.4rem", borderRadius: 999, background: onDark ? "rgba(220,38,38,0.18)" : "#fef2f2", color: onDark ? "#fca5a5" : "#b91c1c", border: `1px solid ${onDark ? "rgba(220,38,38,0.4)" : "#fecaca"}` }}><Lock size={10} /> BLOCKED BY CLIENT</span>
          )}
          {depCount > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, padding: "0.12rem 0.4rem", borderRadius: 999, background: onDark ? "rgba(255,255,255,0.06)" : "#f1efe8", color: fg3 }} title="Waiting on a dependency"><Link2 size={10} /> Blocked · {depCount}</span>
          )}
          {t.client_signed_off_at && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, padding: "0.12rem 0.4rem", borderRadius: 999, background: onDark ? "rgba(34,197,94,0.16)" : "#dcfce7", color: onDark ? "#6ee7b7" : "#15803d" }}><ShieldCheck size={10} /> Signed off</span>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.2rem 0.7rem", fontSize: 11, color: fg3 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><User size={11} /> {t.assigneeName ?? "Unassigned"}</span>
          {t.due_date && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><CalendarDays size={11} /> {formatDate(t.due_date)}</span>}
        </div>
      </div>
    );
  };

  const column = (key: string, label: string, children: React.ReactNode, count: number) => (
    <div style={{ minWidth: 248, flex: "1 1 248px", borderRadius: 16, background: colBg, border: `1px solid ${border}`, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.7rem 0.85rem", borderBottom: `1px solid ${border}` }}>
        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: fg1, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</span>
        <span style={{ fontSize: "0.72rem", fontWeight: 700, color: fg3, background: onDark ? "rgba(255,255,255,0.06)" : "#fff", borderRadius: 999, padding: "0.1rem 0.45rem" }}>{count}</span>
      </div>
      {children}
    </div>
  );

  // CLIENT — read-only: render columns + cards with NO DnD context (no write path)
  if (role === "client") {
    return (
      <div className="rd-kanban-scroll" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
        {COLS.map((c) => {
          const items = byStatus(c.key);
          return column(c.key, c.label, (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10, minHeight: 60 }}>
              {items.length === 0 ? <p style={{ margin: 0, fontSize: 12, color: fg3, textAlign: "center", padding: "0.6rem 0" }}>—</p> : items.map((t) => <div key={t.id}>{card(t)}</div>)}
            </div>
          ), items.length);
        })}
      </div>
    );
  }

  // STAFF — draggable
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="rd-kanban-scroll" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
        {COLS.map((c) => {
          const items = byStatus(c.key);
          return (
            <React.Fragment key={c.key}>
              {column(c.key, c.label, (
                <Droppable droppableId={c.key}>
                  {(provided, snapshot) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10, minHeight: 60, background: snapshot.isDraggingOver ? (onDark ? "rgba(245,158,11,0.07)" : "#fffaf0") : "transparent", borderRadius: 12, transition: "background .15s" }}>
                      {items.map((t, i) => (
                        <Draggable key={t.id} draggableId={t.id} index={i}>
                          {(dp, ds) => (
                            <div ref={dp.innerRef} {...dp.draggableProps} {...dp.dragHandleProps} style={dp.draggableProps.style as React.CSSProperties}>
                              {card(t, ds.isDragging)}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              ), items.length)}
            </React.Fragment>
          );
        })}
      </div>
    </DragDropContext>
  );
}
