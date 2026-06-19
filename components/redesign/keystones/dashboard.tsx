"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Clock } from "lucide-react";
import { Avatar, Button, tokens } from "@fluentui/react-components";

import { useRedesignMode } from "@/components/redesign/themed-fluent";
import { Shell, AmbientField, Measure, Eyebrow, GlassSurface } from "@/components/redesign/ui";
import { m } from "motion/react";
import { StatusPill, DeltaChip, Progress } from "@/components/redesign/data-ui";
import { spring } from "@/lib/motion";
import { PreviewChrome, LivePill } from "@/components/redesign/chrome";

export type DashData = {
  firstName: string;
  programLabel: string;
  monthLabel: string;
  dayLabel: string | null;
  livePill: string;
  reviewCount: number;
  kpis: { label: string; unit: string; curDisplay: string; delta: number | null; beforeDisplay: string | null }[];
  checklist: { id: string; phase_label: string | null; title: string; assignee: "client" | "team"; is_done: boolean }[];
  milestones: { id: string; title: string; phase_label: string | null; status: string }[];
  msDone: number;
  msPct: number;
  deliverables: { id: string; title: string; typeLabel: string; status: string }[];
  report: { title: string; summary: string | null } | null;
  updates: { id: string; title: string; body: string | null; pinned: boolean }[];
  partner: { full_name: string | null; email: string | null; avatar_url: string | null } | null;
  commsChannel: string | null;
};

export function RedesignDashboard({ data }: { data: DashData }) {
  const { mode } = useRedesignMode();
  const onDark = mode === "dark";
  const fg1 = tokens.colorNeutralForeground1;
  const fg2 = tokens.colorNeutralForeground2;
  const fg3 = tokens.colorNeutralForeground3;
  const checklistDone = data.checklist.filter((c) => c.is_done).length;

  return (
    <Shell>
      <AmbientField mode={mode} />

      {/* GLASS CHROME (glass allowed: nav/chrome) */}
      <PreviewChrome
        active="Dashboard"
        onDark={onDark}
        avatarName={data.firstName}
        avatarSrc={data.partner?.avatar_url}
        rightSlot={<LivePill label={data.livePill} onDark={onDark} />}
      />

      <Measure
        width="wide"
        style={{ position: "relative", zIndex: 1, paddingBlock: "clamp(1.75rem, 4vw, 2.75rem)", display: "flex", flexDirection: "column", gap: "1.75rem" }}
      >
        {/* greeting */}
        <div className="rd-rise">
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "1rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <Eyebrow tone={onDark ? "onDark" : "amber"}>
                {data.programLabel}
                {data.dayLabel ? ` · ${data.dayLabel}` : ""}
              </Eyebrow>
              <h1 className="rd-display" style={{ margin: 0, fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 600, lineHeight: 1.02, color: fg1 }}>
                Welcome back, {data.firstName}.
              </h1>
            </div>
            <Button appearance="primary" size="large" as="a" href="#">
              Book a call
            </Button>
          </div>
        </div>

        {/* review banner */}
        {data.reviewCount > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.85rem 1.1rem",
              borderRadius: 14,
              background: onDark ? "rgba(245,158,11,0.12)" : "#fffaf0",
              border: `1px solid ${onDark ? "rgba(245,158,11,0.3)" : "#fde68a"}`,
              color: onDark ? "#fcd34d" : "#92400e",
            }}
          >
            <Clock size={18} />
            <span style={{ fontWeight: 600, fontSize: "0.92rem", flex: 1 }}>
              {data.reviewCount === 1
                ? "1 deliverable is waiting on your review."
                : `${data.reviewCount} deliverables are waiting on your review.`}
            </span>
            <Button appearance="primary" size="small" as="a" href="#">
              Review now
            </Button>
          </div>
        )}

        {/* KPI BAND — the signature glass-with-scrim surfaces */}
        {data.kpis.length > 0 && (
          <div className="rd-kpi-grid">
            {data.kpis.map((k, i) => (
              <m.div
                key={k.label}
                className="rd-rise"
                whileHover={{ y: -4 }}
                transition={spring.snappy}
                style={{ animationDelay: `${i * 60}ms`, height: "100%" }}
              >
                <GlassSurface
                  dark={onDark}
                  strong
                  ember
                  style={{ borderRadius: 20, padding: "1.2rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.7rem", height: "100%" }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <Eyebrow tone={onDark ? "onDark" : "amber"}>{k.label}</Eyebrow>
                    <span style={{ fontSize: "0.66rem", fontWeight: 600, color: fg3 }}>{data.monthLabel}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem", flexWrap: "wrap" }}>
                    <span className="rd-display rd-tnum" style={{ fontSize: "2.1rem", fontWeight: 700, lineHeight: 1, color: fg1 }}>
                      {k.curDisplay}
                    </span>
                    <DeltaChip delta={k.delta} mode={mode} />
                  </div>
                  <span style={{ fontSize: "0.74rem", color: fg3 }} className="rd-tnum">
                    {k.beforeDisplay ? `vs ${k.beforeDisplay} last month` : data.monthLabel}
                  </span>
                </GlassSurface>
              </m.div>
            ))}
          </div>
        )}

        {/* main grid */}
        <div className="rd-dash-grid">
          {/* LEFT */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <Panel mode={mode}>
              <SectionTitle fg={fg1}>Start here</SectionTitle>
              <p style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", color: fg3 }} className="rd-tnum">
                {checklistDone} of {data.checklist.length} done · read-only preview
              </p>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
                {data.checklist.slice(0, 6).map((item) => (
                  <li
                    key={item.id}
                    style={{ display: "flex", alignItems: "center", gap: "0.7rem", padding: "0.6rem 0", borderTop: `1px solid ${onDark ? "#231f19" : "#f1efe8"}` }}
                  >
                    <span
                      aria-hidden
                      style={{
                        flexShrink: 0,
                        width: 20,
                        height: 20,
                        borderRadius: 999,
                        display: "grid",
                        placeItems: "center",
                        background: item.is_done ? "#b45309" : "transparent",
                        border: item.is_done ? "none" : `2px solid ${onDark ? "#37322a" : "#d6d3cd"}`,
                        color: "#fff",
                      }}
                    >
                      {item.is_done && <Check size={12} strokeWidth={3} />}
                    </span>
                    <span style={{ flex: 1, fontSize: "0.9rem", color: item.is_done ? fg3 : fg1, textDecoration: item.is_done ? "line-through" : "none" }}>
                      {item.title}
                    </span>
                    <StatusPill value={item.assignee === "client" ? "You" : "4Pie"} label={item.assignee === "client" ? "You" : "4Pie"} mode={mode} />
                  </li>
                ))}
              </ul>
            </Panel>

            {data.milestones.length > 0 && (
              <Panel mode={mode}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: "0.75rem" }}>
                  <SectionTitle fg={fg1} noMargin>Your 90-day program</SectionTitle>
                  {data.dayLabel && <StatusPill value="active" label={data.dayLabel} mode={mode} />}
                </div>
                <Progress pct={data.msPct} mode={mode} />
                <div className="rd-ms-grid" style={{ marginTop: "1rem" }}>
                  {data.milestones.slice(0, 8).map((m) => (
                    <div key={m.id} style={{ paddingTop: "0.7rem", borderTop: `3px solid ${msBorder(m.status)}` }}>
                      {m.phase_label && <div style={{ fontSize: "0.66rem", fontWeight: 600, color: fg3 }}>{m.phase_label}</div>}
                      <div style={{ fontSize: "0.85rem", fontWeight: 600, color: fg1, margin: "0.15rem 0 0.5rem" }}>{m.title}</div>
                      <StatusPill value={m.status} mode={mode} />
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            <Panel mode={mode}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <SectionTitle fg={fg1} noMargin>Latest deliverables</SectionTitle>
                <LinkArrow>View all</LinkArrow>
              </div>
              {data.deliverables.length === 0 ? (
                <p style={{ margin: "0.75rem 0 0", fontSize: "0.88rem", color: fg3 }}>
                  Your deliverables show up here as we ship them.
                </p>
              ) : (
                <ul style={{ listStyle: "none", margin: "0.5rem 0 0", padding: 0 }}>
                  {data.deliverables.map((d) => (
                    <li key={d.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0.7rem 0", borderTop: `1px solid ${onDark ? "#231f19" : "#f1efe8"}` }}>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: "0.9rem", fontWeight: 500, color: fg1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</span>
                        <span style={{ display: "block", fontSize: "0.74rem", color: fg3 }}>{d.typeLabel}</span>
                      </span>
                      <StatusPill value={d.status} mode={mode} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          {/* RIGHT RAIL */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* report — intentional dark solid card in both modes (the "report" motif) */}
            <div className="rd-solid--dark" style={{ borderRadius: 20, padding: "1.4rem", display: "flex", flexDirection: "column", gap: "0.9rem", position: "relative", overflow: "hidden" }}>
              <div aria-hidden className="rd-glass--ember" style={{ position: "absolute", inset: 0 }} />
              <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Eyebrow tone="onDark">Latest report</Eyebrow>
                  {data.report && <StatusPill value="published" mode="dark" />}
                </div>
                <div>
                  <p className="rd-display" style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600, lineHeight: 1.15, color: "#f3efe7" }}>
                    {data.report ? data.report.title : "Your first report lands after month 1."}
                  </p>
                  {data.report?.summary && (
                    <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem", lineHeight: 1.5, color: "#cdc6ba", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {data.report.summary}
                    </p>
                  )}
                </div>
                {data.report && (
                  <Button appearance="primary" size="medium" as="a" href="#" style={{ width: "fit-content" }}>
                    Read report <ArrowUpRight size={16} style={{ marginLeft: 4 }} />
                  </Button>
                )}
              </div>
            </div>

            <Panel mode={mode}>
              <SectionTitle fg={fg1}>Updates</SectionTitle>
              {data.updates.length === 0 ? (
                <p style={{ margin: 0, fontSize: "0.88rem", color: fg3 }}>No updates yet.</p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {data.updates.map((u) => (
                    <li key={u.id} style={{ padding: "0.7rem 0", borderTop: `1px solid ${onDark ? "#231f19" : "#f1efe8"}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: "0.88rem", fontWeight: 600, color: fg1 }}>{u.title}</span>
                        {u.pinned && <StatusPill value="active" label="Pinned" mode={mode} />}
                      </div>
                      {u.body && (
                        <p style={{ margin: "0.25rem 0 0", fontSize: "0.78rem", color: fg3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{u.body}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {data.partner && (
              <Panel mode={mode}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "1rem" }}>
                  <Avatar name={data.partner.full_name ?? data.partner.email ?? "Partner"} color="brand" size={48} image={data.partner.avatar_url ? { src: data.partner.avatar_url } : undefined} />
                  <div style={{ minWidth: 0 }}>
                    <Eyebrow tone={onDark ? "onDark" : "amber"}>Your partner</Eyebrow>
                    <div style={{ fontSize: "0.95rem", fontWeight: 600, color: fg1, marginTop: 4 }}>{data.partner.full_name ?? data.partner.email}</div>
                    {data.commsChannel && <div style={{ fontSize: "0.76rem", color: fg3 }}>{data.commsChannel}</div>}
                  </div>
                </div>
                <Button appearance="primary" style={{ width: "100%" }} as="a" href="#">Book a call</Button>
              </Panel>
            )}
          </div>
        </div>
      </Measure>

      <style>{`
        .rd-kpi-grid { display: grid; gap: 1rem; grid-template-columns: repeat(2, 1fr); }
        .rd-dash-grid { display: grid; gap: 1.25rem; grid-template-columns: 1fr; }
        .rd-ms-grid { display: grid; gap: 0.75rem 1rem; grid-template-columns: 1fr 1fr; }
        @media (min-width: 900px) {
          .rd-kpi-grid { grid-template-columns: repeat(4, 1fr); }
          .rd-dash-grid { grid-template-columns: 2fr 1fr; }
          .rd-ms-grid { grid-template-columns: repeat(4, 1fr); }
        }
        @media (max-width: 720px) { .rd-nav { display: none !important; } }
      `}</style>
    </Shell>
  );
}

function Panel({ mode, children, style }: { mode: "light" | "dark"; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className={mode === "dark" ? "rd-solid--dark" : "rd-solid"} style={{ borderRadius: 20, padding: "1.3rem", ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ children, fg, noMargin }: { children: React.ReactNode; fg: string; noMargin?: boolean }) {
  return (
    <h2 className="rd-display" style={{ margin: noMargin ? 0 : "0 0 0.75rem", fontSize: "1.15rem", fontWeight: 600, color: fg }}>
      {children}
    </h2>
  );
}

function LinkArrow({ children }: { children: React.ReactNode }) {
  return (
    <Link href="#" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.8rem", fontWeight: 600, color: tokens.colorBrandForeground1, textDecoration: "none" }}>
      {children} <ArrowUpRight size={14} />
    </Link>
  );
}

function msBorder(status: string): string {
  if (status === "done") return "#b45309";
  if (status === "in_progress") return "#fbbf24";
  return "#e7e5e0";
}
