"use client";

import * as React from "react";
import { CheckSquare, FolderKanban, Plus, Sparkles } from "lucide-react";
import { tokens } from "@/components/redesign/ui";
import { Eyebrow, StatusPill, EmberButton, Button } from "@/components/redesign/ui";
import { formatDate } from "@/lib/format";
import { useRedesignMode } from "@/components/redesign/themed-fluent";
import { ClientPageFrame } from "@/components/redesign/client/page-frame";
import { ProjectDialog, type ProjectRow } from "@/components/client/project-dialog";

type Deliverable = { id: string; title: string; typeLabel: string; status: string };
export type BoardTask = { id: string; title: string; status: string; due_date: string | null };
export type BoardProject = ProjectRow & { due_date: string | null };

export type ProjectsData = {
  firstName: string;
  clientName: string | null;
  projects: BoardProject[];
  deliverablesByProject: Record<string, Deliverable[]>;
  tasks: BoardTask[];
};

const PRIORITY_TONE: Record<string, { fg: string; bg: string }> = {
  urgent: { fg: "#9a3412", bg: "#fff7ed" },
  high: { fg: "#92400e", bg: "#fffbeb" },
  medium: { fg: "#57534e", bg: "#f4f4f0" },
  low: { fg: "#6f6c66", bg: "#f4f4f0" },
};

/**
 * R2 PROJECT-client board — the client adds/tracks their own projects. INVARIANT:
 * project status is a READ-ONLY chip (clients can never set it); status/due_date are
 * staff-only. The write path is the existing ProjectDialog (create_project /
 * update_project RPCs), reused verbatim — only the board presentation is new.
 */
export function ProjectsBoard({ data }: { data: ProjectsData }) {
  const { mode } = useRedesignMode();
  const onDark = mode === "dark";
  const fg1 = tokens.colorNeutralForeground1;
  const fg2 = tokens.colorNeutralForeground2;
  const fg3 = tokens.colorNeutralForeground3;
  const panel = onDark ? "rd-solid--dark" : "rd-solid";
  const divider = onDark ? "#231f19" : "#f1efe8";

  const priorityPill = (p: string) => {
    const t = PRIORITY_TONE[p] ?? PRIORITY_TONE.medium;
    const fg = onDark ? "#fcd34d" : t.fg;
    const bg = onDark ? "rgba(245,158,11,0.14)" : t.bg;
    return (
      <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "0.25rem 0.55rem", borderRadius: 999, color: fg, background: bg, textTransform: "capitalize" }}>
        {p}
      </span>
    );
  };

  return (
    <ClientPageFrame width="standard">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem", paddingBlock: "clamp(0.5rem,2vw,1rem)" }}>
        <div className="rd-rise" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "1rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <Eyebrow tone={onDark ? "onDark" : "amber"}>Your projects{data.clientName ? ` · ${data.clientName}` : ""}</Eyebrow>
            <h1 className="rd-display" style={{ margin: 0, fontSize: "clamp(2rem,5vw,3rem)", fontWeight: 600, lineHeight: 1.02, color: fg1 }}>
              Welcome back, {data.firstName}.
            </h1>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <EmberButton as="a" href="/intake" icon={<Sparkles size={16} />}>Start a project</EmberButton>
            <ProjectDialog trigger={<Button appearance="outline" icon={<Plus size={16} />}>Quick add</Button>} />
          </div>
        </div>

        {/* open to-dos (incl. the auto-created "Pending assets" task) */}
        {data.tasks.length > 0 && (
          <div className={`${panel} rd-rise`} style={{ borderRadius: 18, padding: "1.1rem 1.2rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.75rem" }}>
              <CheckSquare size={16} color="#b45309" />
              <h2 className="rd-display" style={{ margin: 0, fontSize: "1.02rem", fontWeight: 600, color: fg1 }}>Your to-dos</h2>
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              {data.tasks.map((t) => (
                <li key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0.5rem 0", borderTop: `1px solid ${divider}` }}>
                  <span style={{ minWidth: 0, fontSize: "0.88rem", color: fg1 }}>{t.title}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {t.due_date && <span style={{ fontSize: "0.74rem", color: fg3 }}>{formatDate(t.due_date)}</span>}
                    <StatusPill value={t.status} mode={mode} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.projects.length === 0 ? (
          <div className={panel} style={{ borderRadius: 20, padding: "3rem 2rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ display: "grid", placeItems: "center", width: 48, height: 48, borderRadius: 14, background: onDark ? "rgba(245,158,11,0.14)" : "#fef3c7", color: "#b45309" }}>
              <FolderKanban size={22} />
            </span>
            <div className="rd-display" style={{ fontSize: "1.25rem", fontWeight: 600, color: fg1 }}>No projects yet</div>
            <p style={{ margin: 0, fontSize: "0.9rem", color: fg3, maxWidth: "24rem" }}>Start your first project — our quick intake captures everything and books your kickoff.</p>
            <EmberButton as="a" href="/intake" icon={<Sparkles size={16} />}>Start a project</EmberButton>
          </div>
        ) : (
          <div className="rd-proj-grid">
            {data.projects.map((p, i) => {
              const dels = data.deliverablesByProject[p.id] ?? [];
              return (
                <div key={p.id} className={`${panel} rd-rise`} style={{ borderRadius: 20, padding: "1.3rem", display: "flex", flexDirection: "column", gap: "0.85rem", animationDelay: `${i * 50}ms` }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <h3 className="rd-display" style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600, color: fg1 }}>{p.title}</h3>
                      {(p.target_date || p.due_date) && (
                        <p style={{ margin: "0.25rem 0 0", fontSize: "0.76rem", color: fg3, display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                          {p.target_date && <span style={{ color: fg2 }}>Your target {formatDate(p.target_date)}</span>}
                          {p.due_date && <span>· Due {formatDate(p.due_date)}</span>}
                        </p>
                      )}
                    </div>
                    <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      {/* READ-ONLY status — clients never set project status */}
                      <StatusPill value={p.status} mode={mode} />
                      {priorityPill(p.priority)}
                    </div>
                  </div>
                  {p.description && <p style={{ margin: 0, fontSize: "0.88rem", color: fg2 }}>{p.description}</p>}
                  {dels.length > 0 && (
                    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                      {dels.map((d) => (
                        <li key={d.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0.5rem 0", borderTop: `1px solid ${divider}` }}>
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, color: fg1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</span>
                            <span style={{ display: "block", fontSize: "0.72rem", color: fg3 }}>{d.typeLabel}</span>
                          </span>
                          <StatusPill value={d.status} mode={mode} />
                        </li>
                      ))}
                    </ul>
                  )}
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <ProjectDialog project={p} trigger={<Button appearance="subtle" size="small">Edit</Button>} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <style>{`
        .rd-proj-grid { display:grid; gap:1rem; grid-template-columns:1fr; }
        @media (min-width:900px){ .rd-proj-grid{grid-template-columns:1fr 1fr;} }
      `}</style>
    </ClientPageFrame>
  );
}
