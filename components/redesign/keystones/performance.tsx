"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { tokens } from "@fluentui/react-components";

import { useRedesignMode } from "@/components/redesign/themed-fluent";
import { Shell, AmbientField, Measure, Eyebrow } from "@/components/redesign/ui";
import { PreviewChrome, LivePill } from "@/components/redesign/chrome";
import { StatusPill, DeltaChip } from "@/components/redesign/data-ui";
import { useReducedMotion } from "@/lib/motion";
import { formatMetricValue, formatMonthShort, monthsBetween } from "@/lib/format";
import type { ChartPoint } from "./perf-chart";

const PerfChart = dynamic(() => import("./perf-chart"), {
  ssr: false,
  loading: () => <div style={{ height: "100%" }} aria-hidden />,
});

export type PerfData = {
  firstName: string;
  avatarSrc: string | null;
  numericDefs: { id: string; label: string; unit: string }[];
  textDefs: { id: string; label: string; unit: string }[];
  entries: { definition_id: string; period: string; value_numeric: number | null; value_text: string | null }[];
  competitors: {
    id: string;
    name: string;
    niche: string | null;
    followers: number | null;
    avgViews: number | null;
    topFormat: string | null;
    hook: string | null;
    working: string | null;
    gap: string | null;
    play: string | null;
    priority: string;
  }[];
  reports: { id: string; title: string; periodLabel: string | null; summary: string | null }[];
};

export function RedesignPerformance({ data }: { data: PerfData }) {
  const { mode } = useRedesignMode();
  const reduced = useReducedMotion() === true;
  const onDark = mode === "dark";
  const fg1 = tokens.colorNeutralForeground1;
  const fg2 = tokens.colorNeutralForeground2;
  const fg3 = tokens.colorNeutralForeground3;
  const panelClass = onDark ? "rd-solid--dark" : "rd-solid";
  const divider = onDark ? "#2c2820" : "#f1efe8";

  const [selected, setSelected] = React.useState(data.numericDefs[0]?.id ?? "");

  const axis = React.useMemo(() => {
    const present = [...new Set(data.entries.map((e) => e.period))].sort();
    if (present.length === 0) return [];
    return monthsBetween(present[0], present[present.length - 1]);
  }, [data.entries]);

  const numericMap = React.useMemo(() => {
    const m = new Map<string, number | null>();
    for (const e of data.entries) m.set(`${e.definition_id}|${e.period}`, e.value_numeric);
    return m;
  }, [data.entries]);

  const textMap = React.useMemo(() => {
    const m = new Map<string, string | null>();
    for (const e of data.entries) m.set(`${e.definition_id}|${e.period}`, e.value_text);
    return m;
  }, [data.entries]);

  const selectedDef = data.numericDefs.find((d) => d.id === selected);
  const chartData: ChartPoint[] = axis.map((p) => ({
    period: formatMonthShort(p),
    value: numericMap.get(`${selected}|${p}`) ?? null,
  }));
  const rowsNewestFirst = [...axis].reverse();

  return (
    <Shell>
      <AmbientField mode={mode} />
      <PreviewChrome
        active="Performance"
        onDark={onDark}
        avatarName={data.firstName}
        avatarSrc={data.avatarSrc}
        rightSlot={<LivePill label="Live · updated monthly" onDark={onDark} />}
      />

      <Measure width="wide" style={{ position: "relative", zIndex: 1, paddingBlock: "clamp(1.75rem, 4vw, 2.75rem)", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div className="rd-rise">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <Eyebrow tone={onDark ? "onDark" : "amber"}>Performance</Eyebrow>
            <h1 className="rd-display" style={{ margin: 0, fontSize: "clamp(1.9rem, 5vw, 2.8rem)", fontWeight: 600, lineHeight: 1.02, color: fg1 }}>
              Your numbers, live.
            </h1>
            <p style={{ margin: 0, fontSize: "0.98rem", color: fg2, maxWidth: "40rem" }}>
              Fresh metrics on the first of every month, straight from the sources we track. Glass
              stops at the door here — the data sits on solid, high-contrast surfaces.
            </p>
          </div>
        </div>

        {data.numericDefs.length === 0 ? (
          <div className={panelClass} style={{ borderRadius: 20, padding: "2rem", color: fg3 }}>
            No performance data yet — your first numbers land after month one.
          </div>
        ) : (
          <>
            {/* CHART (solid panel) */}
            <div className={panelClass} style={{ borderRadius: 20, padding: "1.3rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {data.numericDefs.map((d) => {
                  const active = d.id === selected;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setSelected(d.id)}
                      className="rd-tnum"
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        padding: "0.35rem 0.8rem",
                        borderRadius: 999,
                        cursor: "pointer",
                        color: active ? "#fff" : fg2,
                        background: active ? "#b45309" : "transparent",
                        border: `1px solid ${active ? "#b45309" : onDark ? "#37322a" : "#e2dfd8"}`,
                      }}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ height: 320, width: "100%" }}>
                <PerfChart data={chartData} mode={mode} reduced={reduced} unit={selectedDef?.unit ?? "number"} />
              </div>
            </div>

            {/* DENSE TABLE (solid panel; the AA worst-case surface) */}
            <div className={panelClass} style={{ borderRadius: 20, padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "1.1rem 1.3rem 0" }}>
                <Eyebrow tone="muted">Month by month</Eyebrow>
              </div>
              <div style={{ overflowX: "auto", marginTop: "0.75rem" }}>
                <table className="rd-tnum" style={{ borderCollapse: "collapse", width: "100%", minWidth: 640 }}>
                  <thead>
                    <tr>
                      <Th sticky bg={onDark ? "#1c1813" : "#ffffff"} fg={fg3}>Month</Th>
                      {data.numericDefs.map((d) => (
                        <Th key={d.id} align="right" fg={fg3}>{d.label}</Th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rowsNewestFirst.map((period, idx) => {
                      const isLatest = idx === 0;
                      const prevPeriod = axis[axis.length - 1 - idx - 1]; // older neighbour
                      return (
                        <tr key={period} style={{ background: isLatest ? (onDark ? "rgba(245,158,11,0.08)" : "#fffaf0") : "transparent" }}>
                          <Td sticky bg={isLatest ? (onDark ? "#221c14" : "#fffaf0") : onDark ? "#1c1813" : "#ffffff"} fg={fg1} bold>
                            {formatMonthShort(period)}
                          </Td>
                          {data.numericDefs.map((d) => {
                            const cur = numericMap.get(`${d.id}|${period}`) ?? null;
                            const prior = prevPeriod != null ? numericMap.get(`${d.id}|${prevPeriod}`) ?? null : null;
                            const delta = cur != null && prior != null ? cur - prior : null;
                            return (
                              <Td key={d.id} align="right" fg={fg1} border={divider}>
                                <span>{cur != null ? formatMetricValue(d.unit, cur, null) : "—"}</span>
                                {delta != null && (
                                  <span style={{ marginLeft: 6 }}>
                                    <DeltaChip delta={delta} mode={mode} />
                                  </span>
                                )}
                              </Td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* TEXT HIGHLIGHTS (solid) */}
            {data.textDefs.length > 0 && (
              <div className={panelClass} style={{ borderRadius: 20, padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "1.1rem 1.3rem 0" }}>
                  <Eyebrow tone="muted">Highlights by month</Eyebrow>
                </div>
                <div style={{ overflowX: "auto", marginTop: "0.75rem" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 640 }}>
                    <thead>
                      <tr>
                        <Th sticky bg={onDark ? "#1c1813" : "#ffffff"} fg={fg3}>Metric</Th>
                        {rowsNewestFirst.map((p) => (
                          <Th key={p} fg={fg3}>{formatMonthShort(p)}</Th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.textDefs.map((d) => (
                        <tr key={d.id}>
                          <Td sticky bg={onDark ? "#1c1813" : "#ffffff"} fg={fg1} bold>{d.label}</Td>
                          {rowsNewestFirst.map((p) => (
                            <Td key={p} fg={fg2} border={divider} style={{ minWidth: 160 }}>
                              {textMap.get(`${d.id}|${p}`) || "—"}
                            </Td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* COMPETITORS (solid cards) */}
        {data.competitors.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            <h2 className="rd-display" style={{ margin: 0, fontSize: "1.3rem", fontWeight: 600, color: fg1 }}>Competitors</h2>
            <div className="rd-comp-grid">
              {data.competitors.map((c) => (
                <div key={c.id} className={panelClass} style={{ borderRadius: 18, padding: "1.2rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: fg1 }}>{c.name}</div>
                      {c.niche && <div style={{ fontSize: "0.76rem", color: fg3 }}>{c.niche}</div>}
                    </div>
                    <StatusPill value={c.priority} label={`${c.priority} priority`} mode={mode} />
                  </div>
                  {(c.followers != null || c.avgViews != null) && (
                    <div style={{ display: "flex", gap: "1.5rem" }} className="rd-tnum">
                      {c.followers != null && <Stat label="Followers" value={c.followers.toLocaleString()} fg1={fg1} fg3={fg3} />}
                      {c.avgViews != null && <Stat label="Avg views" value={c.avgViews.toLocaleString()} fg1={fg1} fg3={fg3} />}
                    </div>
                  )}
                  {c.working && <p style={{ margin: 0, fontSize: "0.85rem", color: fg2 }}><span style={{ color: fg3 }}>What&apos;s working: </span>{c.working}</p>}
                  {c.play && (
                    <div style={{ borderRadius: 12, padding: "0.7rem 0.85rem", background: onDark ? "rgba(245,158,11,0.1)" : "#fffaf0", border: `1px solid ${onDark ? "rgba(245,158,11,0.24)" : "#fde68a"}` }}>
                      <div className="rd-eyebrow" style={{ color: onDark ? "#fcd34d" : "#92400e" }}>Our play</div>
                      <p style={{ margin: "0.3rem 0 0", fontSize: "0.85rem", color: onDark ? "#fcd34d" : "#9a3412" }}>{c.play}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REPORTS (solid) */}
        {data.reports.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            <h2 className="rd-display" style={{ margin: 0, fontSize: "1.3rem", fontWeight: 600, color: fg1 }}>Reports</h2>
            <div className={panelClass} style={{ borderRadius: 18, padding: "0.4rem 0.4rem" }}>
              {data.reports.map((r, i) => (
                <div key={r.id} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "0.85rem 1rem", borderTop: i === 0 ? "none" : `1px solid ${divider}` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontWeight: 600, color: fg1 }}>{r.title}</span>
                    <StatusPill value="published" mode={mode} />
                  </div>
                  {r.periodLabel && <span style={{ fontSize: "0.76rem", color: fg3 }}>{r.periodLabel}</span>}
                  {r.summary && <p style={{ margin: 0, fontSize: "0.85rem", color: fg2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.summary}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </Measure>

      <style>{`
        .rd-comp-grid { display: grid; gap: 1rem; grid-template-columns: 1fr; }
        @media (min-width: 760px) { .rd-comp-grid { grid-template-columns: 1fr 1fr; } }
      `}</style>
    </Shell>
  );
}

function Th({ children, align = "left", sticky, bg, fg }: { children: React.ReactNode; align?: "left" | "right"; sticky?: boolean; bg?: string; fg: string }) {
  return (
    <th
      className="rd-eyebrow"
      style={{
        textAlign: align,
        padding: "0.6rem 1rem",
        color: fg,
        fontSize: "0.62rem",
        whiteSpace: "nowrap",
        position: sticky ? "sticky" : undefined,
        left: sticky ? 0 : undefined,
        background: sticky ? bg : undefined,
        zIndex: sticky ? 1 : undefined,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  sticky,
  bg,
  fg,
  bold,
  border,
  style,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  sticky?: boolean;
  bg?: string;
  fg: string;
  bold?: boolean;
  border?: string;
  style?: React.CSSProperties;
}) {
  return (
    <td
      style={{
        textAlign: align,
        padding: "0.7rem 1rem",
        fontSize: "0.85rem",
        color: fg,
        fontWeight: bold ? 600 : 400,
        borderTop: border ? `1px solid ${border}` : undefined,
        position: sticky ? "sticky" : undefined,
        left: sticky ? 0 : undefined,
        background: sticky ? bg : undefined,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </td>
  );
}

function Stat({ label, value, fg1, fg3 }: { label: string; value: string; fg1: string; fg3: string }) {
  return (
    <div>
      <div className="rd-eyebrow" style={{ color: fg3 }}>{label}</div>
      <div style={{ fontSize: "0.95rem", fontWeight: 600, color: fg1, marginTop: 4 }}>{value}</div>
    </div>
  );
}
