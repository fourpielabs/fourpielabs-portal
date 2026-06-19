"use client";

import * as React from "react";
import Link from "next/link";
import { m } from "motion/react";
import { ArrowUpRight, Clock } from "lucide-react";
import { Avatar, EmberButton, tokens } from "@/components/redesign/ui";
import { spring } from "@/lib/motion";
import { useRedesignMode } from "@/components/redesign/themed-fluent";
import { Eyebrow, GlassSurface, StatusPill, DeltaChip, Progress } from "@/components/redesign/ui";
import { ClientPageFrame } from "@/components/redesign/client/page-frame";
import { ClientChecklist, type ClientChecklistItem } from "@/components/redesign/client/client-checklist";

export type ProgramDashData = {
  firstName: string;
  programLabel: string;
  monthLabel: string;
  dayLabel: string | null;
  livePill: string;
  reviewCount: number;
  kpis: { label: string; unit: string; curDisplay: string; delta: number | null; beforeDisplay: string | null }[];
  checklist: ClientChecklistItem[];
  milestones: { id: string; title: string; phase_label: string | null; status: string }[];
  msPct: number;
  deliverables: { id: string; title: string; typeLabel: string; status: string }[];
  report: { title: string; summary: string | null } | null;
  updates: { id: string; title: string; body: string | null; pinned: boolean }[];
  partner: { full_name: string | null; email: string | null; avatar_url: string | null } | null;
  commsChannel: string | null;
};

const msBorder = (s: string) => (s === "done" ? "#b45309" : s === "in_progress" ? "#fbbf24" : "#e7e5e0");

export function ProgramDashboard({ data }: { data: ProgramDashData }) {
  const { mode } = useRedesignMode();
  const onDark = mode === "dark";
  const fg1 = tokens.colorNeutralForeground1;
  const fg2 = tokens.colorNeutralForeground2;
  const fg3 = tokens.colorNeutralForeground3;
  const panel = onDark ? "rd-solid--dark" : "rd-solid";
  const divider = onDark ? "#231f19" : "#f1efe8";

  return (
    <ClientPageFrame width="wide">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem", paddingBlock: "clamp(0.5rem,2vw,1rem)" }}>
        {/* greeting */}
        <div className="rd-rise" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "1rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <Eyebrow tone={onDark ? "onDark" : "amber"}>
              {data.programLabel}{data.dayLabel ? ` · ${data.dayLabel}` : ""}
            </Eyebrow>
            <h1 className="rd-display" style={{ margin: 0, fontSize: "clamp(2rem,5vw,3rem)", fontWeight: 600, lineHeight: 1.02, color: fg1 }}>
              Welcome back, {data.firstName}.
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: "0.72rem", fontWeight: 600, padding: "0.35rem 0.7rem", borderRadius: 999, color: onDark ? "#fcd34d" : "#92400e", background: onDark ? "rgba(245,158,11,0.14)" : "#fef3c7", border: `1px solid ${onDark ? "rgba(245,158,11,0.3)" : "#fde68a"}` }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "#d97706" }} /> {data.livePill}
            </span>
            <EmberButton as="a" href="/calls-notes">Book a call</EmberButton>
          </div>
        </div>

        {/* review banner */}
        {data.reviewCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.85rem 1.1rem", borderRadius: 14, background: onDark ? "rgba(245,158,11,0.12)" : "#fffaf0", border: `1px solid ${onDark ? "rgba(245,158,11,0.3)" : "#fde68a"}`, color: onDark ? "#fcd34d" : "#92400e" }}>
            <Clock size={18} />
            <span style={{ fontWeight: 600, fontSize: "0.92rem", flex: 1 }}>
              {data.reviewCount === 1 ? "1 deliverable is waiting on your review." : `${data.reviewCount} deliverables are waiting on your review.`}
            </span>
            <EmberButton as="a" href="/deliverables" size="small">Review now</EmberButton>
          </div>
        )}

        {/* KPI band (glass + scrim) */}
        {data.kpis.length > 0 && (
          <div className="rd-kpi-grid">
            {data.kpis.map((k, i) => (
              <m.div key={k.label} className="rd-rise" whileHover={{ y: -4 }} transition={spring.snappy} style={{ animationDelay: `${i * 60}ms`, height: "100%" }}>
                <Link href="/performance" style={{ textDecoration: "none", display: "block", height: "100%" }}>
                  <GlassSurface dark={onDark} strong ember style={{ borderRadius: 20, padding: "1.2rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.7rem", height: "100%" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <Eyebrow tone={onDark ? "onDark" : "amber"}>{k.label}</Eyebrow>
                      <span style={{ fontSize: "0.66rem", fontWeight: 600, color: fg3 }}>{data.monthLabel}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem", flexWrap: "wrap" }}>
                      <span className="rd-display rd-tnum" style={{ fontSize: "2.1rem", fontWeight: 700, lineHeight: 1, color: fg1 }}>{k.curDisplay}</span>
                      <DeltaChip delta={k.delta} mode={mode} />
                    </div>
                    <span className="rd-tnum" style={{ fontSize: "0.74rem", color: fg3 }}>{k.beforeDisplay ? `vs ${k.beforeDisplay} last month` : data.monthLabel}</span>
                  </GlassSurface>
                </Link>
              </m.div>
            ))}
          </div>
        )}

        {/* main grid */}
        <div className="rd-dash-grid">
          {/* LEFT */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div className={panel} style={{ borderRadius: 20, padding: "1.3rem" }}>
              <h2 className="rd-display" style={{ margin: "0 0 0.75rem", fontSize: "1.15rem", fontWeight: 600, color: fg1 }}>Start here</h2>
              <ClientChecklist items={data.checklist} />
            </div>

            {data.milestones.length > 0 && (
              <div className={panel} style={{ borderRadius: 20, padding: "1.3rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: "0.75rem" }}>
                  <h2 className="rd-display" style={{ margin: 0, fontSize: "1.15rem", fontWeight: 600, color: fg1 }}>Your 90-day program</h2>
                  {data.dayLabel && <StatusPill value="active" label={data.dayLabel} mode={mode} />}
                </div>
                <Progress pct={data.msPct} mode={mode} />
                <div className="rd-ms-grid" style={{ marginTop: "1rem" }}>
                  {data.milestones.slice(0, 8).map((mi) => (
                    <div key={mi.id} style={{ paddingTop: "0.7rem", borderTop: `3px solid ${msBorder(mi.status)}` }}>
                      {mi.phase_label && <div style={{ fontSize: "0.66rem", fontWeight: 600, color: fg3 }}>{mi.phase_label}</div>}
                      <div style={{ fontSize: "0.85rem", fontWeight: 600, color: fg1, margin: "0.15rem 0 0.5rem" }}>{mi.title}</div>
                      <StatusPill value={mi.status} mode={mode} />
                    </div>
                  ))}
                </div>
                <Link href="/program" style={{ display: "inline-block", marginTop: "1rem", fontSize: "0.8rem", fontWeight: 600, color: tokens.colorBrandForeground1, textDecoration: "none" }}>View full program →</Link>
              </div>
            )}

            <div className={panel} style={{ borderRadius: 20, padding: "1.3rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 className="rd-display" style={{ margin: 0, fontSize: "1.15rem", fontWeight: 600, color: fg1 }}>Latest deliverables</h2>
                <Link href="/deliverables" style={{ fontSize: "0.8rem", fontWeight: 600, color: tokens.colorBrandForeground1, textDecoration: "none" }}>View all →</Link>
              </div>
              {data.deliverables.length === 0 ? (
                <p style={{ margin: "0.75rem 0 0", fontSize: "0.88rem", color: fg3 }}>Your deliverables show up here as we ship them.</p>
              ) : (
                <ul style={{ listStyle: "none", margin: "0.5rem 0 0", padding: 0 }}>
                  {data.deliverables.map((d) => (
                    <li key={d.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0.7rem 0", borderTop: `1px solid ${divider}` }}>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, color: fg1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</span>
                        <span style={{ display: "block", fontSize: "0.74rem", color: fg3 }}>{d.typeLabel}</span>
                      </span>
                      <StatusPill value={d.status} mode={mode} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* RIGHT rail */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div className="rd-solid--dark" style={{ borderRadius: 20, padding: "1.4rem", position: "relative", overflow: "hidden" }}>
              <div aria-hidden className="rd-glass--ember" style={{ position: "absolute", inset: 0 }} />
              <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Eyebrow tone="onDark">Latest report</Eyebrow>
                  {data.report && <StatusPill value="published" mode="dark" />}
                </div>
                <p className="rd-display" style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600, lineHeight: 1.15, color: "#f3efe7" }}>
                  {data.report ? data.report.title : "Your first report lands after month 1."}
                </p>
                {data.report?.summary && (
                  <p style={{ margin: 0, fontSize: "0.85rem", lineHeight: 1.5, color: "#cdc6ba", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{data.report.summary}</p>
                )}
                {data.report && (
                  <EmberButton as="a" href="/performance#reports" size="medium" style={{ width: "fit-content" }}>
                    Read report <ArrowUpRight size={16} style={{ marginLeft: 4 }} />
                  </EmberButton>
                )}
              </div>
            </div>

            <div className={panel} style={{ borderRadius: 20, padding: "1.3rem" }}>
              <h2 className="rd-display" style={{ margin: "0 0 0.75rem", fontSize: "1.15rem", fontWeight: 600, color: fg1 }}>Updates</h2>
              {data.updates.length === 0 ? (
                <p style={{ margin: 0, fontSize: "0.88rem", color: fg3 }}>No updates yet.</p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {data.updates.map((u) => (
                    <li key={u.id} style={{ padding: "0.7rem 0", borderTop: `1px solid ${divider}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: "0.88rem", fontWeight: 600, color: fg1 }}>{u.title}</span>
                        {u.pinned && <StatusPill value="active" label="Pinned" mode={mode} />}
                      </div>
                      {u.body && <p style={{ margin: "0.25rem 0 0", fontSize: "0.78rem", color: fg3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{u.body}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {data.partner && (
              <div className={panel} style={{ borderRadius: 20, padding: "1.3rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "1rem" }}>
                  <Avatar name={data.partner.full_name ?? data.partner.email ?? "Partner"} color="brand" size={48} image={data.partner.avatar_url ? { src: data.partner.avatar_url } : undefined} />
                  <div style={{ minWidth: 0 }}>
                    <Eyebrow tone={onDark ? "onDark" : "amber"}>Your partner</Eyebrow>
                    <div style={{ fontSize: "0.95rem", fontWeight: 600, color: fg1, marginTop: 4 }}>{data.partner.full_name ?? data.partner.email}</div>
                    {data.commsChannel && <div style={{ fontSize: "0.76rem", color: fg3 }}>{data.commsChannel}</div>}
                  </div>
                </div>
                <EmberButton as="a" href="/calls-notes" style={{ width: "100%" }}>Book a call</EmberButton>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .rd-kpi-grid { display:grid; gap:1rem; grid-template-columns:repeat(2,1fr); }
        .rd-dash-grid { display:grid; gap:1.25rem; grid-template-columns:1fr; }
        .rd-ms-grid { display:grid; gap:0.75rem 1rem; grid-template-columns:1fr 1fr; }
        @media (min-width:900px){ .rd-kpi-grid{grid-template-columns:repeat(4,1fr);} .rd-dash-grid{grid-template-columns:2fr 1fr;} .rd-ms-grid{grid-template-columns:repeat(4,1fr);} }
      `}</style>
    </ClientPageFrame>
  );
}
