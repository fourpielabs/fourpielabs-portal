"use client";

import Link from "next/link";
import { Clock, ClipboardList, FileText, FolderKanban, Megaphone, Package } from "lucide-react";
import { formatDate } from "@/lib/format";
import { Button, EmberButton, StatusPill, DeltaChip, tokens } from "@/components/redesign/ui";
import { usePanel } from "./ui";

export type OverviewData = {
  base: string;
  isProject: boolean;
  waiting: { firstTitle: string | null; count: number } | null;
  checklist: { pct: number; done: number; total: number; phases: { phase: string; done: number; total: number }[] };
  metrics: { periodLabel: string | null; by: string | null; enterMonth: string; items: { label: string; value: string; delta: number | null; deltaSuffix: string }[] };
  projects: { total: number; active: number; byStatus: { value: string; label: string; count: number }[]; recent: { id: string; title: string; status: string; due: string | null }[] };
  activity: { kind: string; title: string; at: string }[];
};

const ACT: Record<string, { icon: typeof Package; light: { bg: string; fg: string }; dark: { bg: string; fg: string } }> = {
  Deliverable: { icon: Package, light: { bg: "#fef3c7", fg: "#92400e" }, dark: { bg: "rgba(245,158,11,0.16)", fg: "#fcd34d" } },
  Update: { icon: Megaphone, light: { bg: "#dbeafe", fg: "#1d4ed8" }, dark: { bg: "rgba(96,165,250,0.16)", fg: "#bfdbfe" } },
  Report: { icon: FileText, light: { bg: "#dcfce7", fg: "#166534" }, dark: { bg: "rgba(34,197,94,0.16)", fg: "#86efac" } },
};

/** R3 staff client overview (re-skinned, SOLID summary cards inside the glass chrome). */
export function StaffOverviewBody({ data }: { data: OverviewData }) {
  const { panel, fg1, fg2, fg3, onDark, border, mode } = usePanel();
  const { base, isProject } = data;
  const ringCirc = 2 * Math.PI * 30;

  const card: React.CSSProperties = { borderRadius: 18, padding: "1.2rem", display: "flex", flexDirection: "column", gap: "0.9rem" };
  const h3: React.CSSProperties = { margin: 0, fontSize: "0.95rem", fontWeight: 600, color: fg1 };

  const activityCard = (
    <div className={panel} style={card}>
      <h3 style={h3}>Recent activity</h3>
      {data.activity.length === 0 ? (
        <p style={{ display: "flex", alignItems: "center", gap: 8, padding: "1.2rem 0", margin: 0, fontSize: 14, color: fg3 }}><ClipboardList size={16} /> No activity yet.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
          {data.activity.map((a, i) => {
            const cfg = ACT[a.kind] ?? ACT.Update;
            const Icon = cfg.icon;
            const c = onDark ? cfg.dark : cfg.light;
            return (
              <li key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "0.6rem 0", borderTop: i === 0 ? "none" : `1px solid ${border}` }}>
                <span style={{ display: "inline-flex", flexShrink: 0, width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 999, background: c.bg, color: c.fg }}><Icon size={14} /></span>
                <span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, color: fg1 }}>{a.title}</span>
                <span style={{ flexShrink: 0, fontSize: 12, color: fg3 }}>{formatDate(a.at)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {data.waiting && (
        <div className={`rd-glass ${onDark ? "rd-glass--dark" : ""} rd-glass--ember`} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, borderRadius: 16, padding: "0.85rem 1.1rem" }}>
          <span style={{ display: "inline-flex", flexShrink: 0, width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 999, background: onDark ? "rgba(245,158,11,0.18)" : "#fde68a", color: "#92400e" }}><Clock size={15} /></span>
          <span style={{ minWidth: 0, flex: 1, fontSize: 14, color: fg2 }}>
            <strong style={{ color: fg1 }}>Waiting on client</strong> — {data.waiting.firstTitle ?? `${data.waiting.count} deliverable(s)`} awaiting review.
          </span>
          <Button as="a" href={`${base}/deliverables`} appearance="outline" size="small">Open deliverable</Button>
        </div>
      )}

      <div className="rd-overview-grid">
        {isProject ? (
          <>
            <div className={panel} style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ display: "inline-flex", flexShrink: 0, width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 16, background: onDark ? "rgba(245,158,11,0.16)" : "#fef3c7", color: "#b45309" }}><FolderKanban size={24} /></span>
                <div style={{ minWidth: 0 }}>
                  <h3 style={h3}>Projects</h3>
                  <p style={{ margin: 0, fontSize: 12, color: fg3, fontVariantNumeric: "tabular-nums" }}>{data.projects.total} total · {data.projects.active} in flight</p>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                {data.projects.byStatus.map((s) => (
                  <div key={s.value} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={{ color: fg2 }}>{s.label}</span><span style={{ color: fg3, fontVariantNumeric: "tabular-nums" }}>{s.count}</span></div>
                ))}
              </div>
              <Button as="a" href={`${base}/projects`} appearance="outline" size="small">Open projects</Button>
            </div>

            <div className={panel} style={card}>
              <h3 style={h3}>Recent projects</h3>
              {data.projects.recent.length === 0 ? (
                <p style={{ margin: 0, fontSize: 14, color: fg3 }}>No projects yet — create one from the Projects tab.</p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
                  {data.projects.recent.map((p, i) => (
                    <li key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0.55rem 0", borderTop: i === 0 ? "none" : `1px solid ${border}` }}>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, fontWeight: 500, color: fg1 }}>{p.title}</span>
                        {p.due && <span style={{ display: "block", fontSize: 12, color: fg3 }}>Due {formatDate(p.due)}</span>}
                      </span>
                      <StatusPill value={p.status} mode={mode} />
                    </li>
                  ))}
                </ul>
              )}
              <EmberButton as="a" href={`${base}/projects`} size="small">Manage projects</EmberButton>
            </div>
            {activityCard}
          </>
        ) : (
          <>
            <div className={panel} style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="40" cy="40" r="30" fill="none" stroke={onDark ? "rgba(255,255,255,0.1)" : "#f4f4f0"} strokeWidth="7" />
                    <circle cx="40" cy="40" r="30" fill="none" stroke="#d97706" strokeWidth="7" strokeLinecap="round" strokeDasharray={ringCirc} strokeDashoffset={ringCirc * (1 - data.checklist.pct / 100)} />
                  </svg>
                  <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: fg1, fontVariantNumeric: "tabular-nums" }}>{data.checklist.pct}%</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 style={h3}>Checklist progress</h3>
                  <p style={{ margin: 0, fontSize: 12, color: fg3, fontVariantNumeric: "tabular-nums" }}>{data.checklist.done} of {data.checklist.total} steps done</p>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                {data.checklist.phases.map(({ phase, done, total }) => (
                  <div key={phase} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={{ color: fg2 }}>{phase}</span><span style={{ color: fg3, fontVariantNumeric: "tabular-nums" }}>{done}/{total}</span></div>
                ))}
              </div>
              <Button as="a" href={`${base}/checklist`} appearance="outline" size="small">Open checklist</Button>
            </div>

            <div className={panel} style={card}>
              <div>
                <h3 style={h3}>Latest metrics</h3>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: fg3 }}>{data.metrics.periodLabel ? `Entered ${data.metrics.periodLabel}${data.metrics.by ? ` by ${data.metrics.by}` : ""}` : "No entries yet"}</p>
              </div>
              {data.metrics.items.length === 0 ? (
                <p style={{ margin: 0, fontSize: 14, color: fg3 }}>Enter monthly metrics to see a snapshot here.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem 1rem" }}>
                  {data.metrics.items.map((m, i) => (
                    <div key={i}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: fg3 }}>{m.label}</div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span style={{ fontSize: "1.35rem", fontWeight: 600, color: fg1, fontVariantNumeric: "tabular-nums", overflow: "hidden", textOverflow: "ellipsis" }}>{m.value}</span>
                        <DeltaChip delta={m.delta} mode={mode} suffix={m.deltaSuffix} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <EmberButton as="a" href={`${base}/metrics`} size="small">Enter {data.metrics.enterMonth} metrics</EmberButton>
            </div>
            {activityCard}
          </>
        )}
      </div>
      <style>{`.rd-overview-grid{display:grid;gap:1.1rem;grid-template-columns:1fr;} @media(min-width:980px){.rd-overview-grid{grid-template-columns:1fr 1fr 1.25fr;}}`}</style>
    </div>
  );
}
