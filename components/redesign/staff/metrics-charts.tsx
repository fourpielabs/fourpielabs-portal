"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { LineChart } from "lucide-react";

import { formatMonthShort, monthsBetween } from "@/lib/format";
import { useRedesignMode } from "@/components/redesign/themed-fluent";
import { Select, DeltaChip } from "@/components/redesign/ui";
import { usePanel, EmptyPanel } from "./ui";

// Recharts loads only when the chart actually renders (client-only), off the route's
// initial JS. An inert spacer holds the chart's space while the chunk arrives (mirrors
// the keystones/performance.tsx dynamic-import loader — no shared-class dependency).
const MetricsLineChart = dynamic(
  () => import("./metrics-line-chart").then((m) => m.MetricsLineChart),
  { ssr: false, loading: () => <div style={{ height: "100%", width: "100%" }} aria-hidden /> },
);

// Re-export the shared types so the orchestrator/page keep one import shape.
export type { DefLite, Entry } from "@/components/metrics/metrics-charts";
import type { DefLite, Entry } from "@/components/metrics/metrics-charts";

/**
 * R3 client-preview surface (re-skin of components/metrics/metrics-charts.tsx) — what
 * the client sees on Performance, shown to staff as a preview. SOLID panels only (glass
 * is forbidden on dense data); mode-aware throughout. Numeric metrics → an amber
 * area/line chart (D4 §05 gradient, themed for light AND dark); text metrics → a SOLID
 * mode-aware monthly table. All data shaping (axis windowing, maps, ordering) verbatim.
 */
export function MetricsCharts({
  numericDefs,
  textDefs,
  entries,
}: {
  numericDefs: DefLite[];
  textDefs: DefLite[];
  entries: Entry[];
}) {
  const { mode } = useRedesignMode();
  const { panel, fg1, fg2, fg3, onDark } = usePanel();
  const divider = onDark ? "#2c2820" : "#f1efe8";

  const [selected, setSelected] = useState(numericDefs[0]?.id ?? "");

  // Window the axis to the months that actually have data (first → latest).
  const axis = useMemo(() => {
    const present = [...new Set(entries.map((e) => e.period))].sort();
    if (present.length === 0) return [];
    return monthsBetween(present[0], present[present.length - 1]);
  }, [entries]);

  const numericMap = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const e of entries) m.set(`${e.definition_id}|${e.period}`, e.value_numeric);
    return m;
  }, [entries]);

  const textMap = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const e of entries) m.set(`${e.definition_id}|${e.period}`, e.value_text);
    return m;
  }, [entries]);

  const chartData = axis.map((p) => ({
    period: formatMonthShort(p),
    value: numericMap.get(`${selected}|${p}`) ?? null,
  }));

  const textColumns = [...axis].reverse(); // newest first
  const numericColumns = [...axis].reverse(); // newest first
  const selectedDef = numericDefs.find((d) => d.id === selected);
  const rangeCaption = axis.length
    ? `${formatMonthShort(axis[0])} – ${formatMonthShort(axis[axis.length - 1])}`
    : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* NUMERIC TREND (solid panel) */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
          <div>
            <h3 className="rd-display" style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.01em", color: fg1 }}>
              {selectedDef?.label ?? "Numeric trend"}
            </h3>
            {rangeCaption && <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: fg3 }}>{rangeCaption}</p>}
          </div>
          {numericDefs.length > 0 && (
            <div style={{ minWidth: 220 }}>
              <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
                {numericDefs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>

        {numericDefs.length === 0 || axis.length === 0 ? (
          <EmptyPanel
            icon={<LineChart size={22} />}
            title="No performance data yet"
            description="Your performance charts show up here once we start tracking your numbers."
          />
        ) : (
          <div
            role="img"
            aria-label="Performance trend chart — the same monthly figures are listed in the table below"
            className={panel}
            style={{ height: 320, width: "100%", borderRadius: 20, padding: "1.1rem" }}
          >
            <MetricsLineChart data={chartData} mode={mode} />
          </div>
        )}
      </div>

      {/* MONTH BY MONTH (solid panel; the AA worst-case surface) */}
      {numericDefs.length > 0 && numericColumns.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div>
            <h3 className="rd-display" style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.01em", color: fg1 }}>
              Month by month
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: fg3 }}>Newest first · ▲▼ vs prior month</p>
          </div>
          <div className={panel} style={{ borderRadius: 20, padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="rd-tnum" style={{ borderCollapse: "collapse", width: "100%", minWidth: 640 }}>
                <thead>
                  <tr>
                    <Th sticky bg={onDark ? "#1c1813" : "#ffffff"} fg={fg3}>Month</Th>
                    {numericDefs.map((d) => (
                      <Th key={d.id} align="right" fg={fg3}>{d.label}</Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {numericColumns.map((p, idx) => {
                    const isLatest = idx === 0;
                    const isFirst = idx === numericColumns.length - 1;
                    const prevP = numericColumns[idx + 1];
                    return (
                      <tr key={p} style={{ background: isLatest ? (onDark ? "rgba(245,158,11,0.08)" : "#fffaf0") : "transparent" }}>
                        <Td
                          sticky
                          bg={isLatest ? (onDark ? "#221c14" : "#fffaf0") : onDark ? "#1c1813" : "#ffffff"}
                          fg={fg1}
                          bold
                          border={idx === 0 ? undefined : divider}
                        >
                          {formatMonthShort(p)}
                          {isFirst && (
                            <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 400, color: fg3 }}>first full month</span>
                          )}
                        </Td>
                        {numericDefs.map((d) => {
                          const cur = numericMap.get(`${d.id}|${p}`);
                          const prior = isFirst ? null : (numericMap.get(`${d.id}|${prevP}`) ?? null);
                          const delta = cur != null && prior != null ? cur - prior : null;
                          return (
                            <Td key={d.id} align="right" fg={fg1} border={idx === 0 ? undefined : divider}>
                              <span>{cur != null ? cur.toLocaleString() : "—"}</span>
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
        </div>
      )}

      {/* HIGHLIGHTS BY MONTH — text metrics (solid) */}
      {textDefs.length > 0 && axis.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <h3 className="rd-display" style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.01em", color: fg1 }}>
            Highlights by month
          </h3>
          <div className={panel} style={{ borderRadius: 20, padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 640 }}>
                <thead>
                  <tr>
                    <Th sticky bg={onDark ? "#1c1813" : "#ffffff"} fg={fg3}>Metric</Th>
                    {textColumns.map((p) => (
                      <Th key={p} fg={fg3}>{formatMonthShort(p)}</Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {textDefs.map((d, rowIdx) => (
                    <tr key={d.id}>
                      <Td sticky bg={onDark ? "#1c1813" : "#ffffff"} fg={fg1} bold border={rowIdx === 0 ? undefined : divider}>
                        {d.label}
                      </Td>
                      {textColumns.map((p) => (
                        <Td key={p} fg={fg2} border={rowIdx === 0 ? undefined : divider} style={{ minWidth: 160, whiteSpace: "normal", verticalAlign: "top" }}>
                          {textMap.get(`${d.id}|${p}`) || "—"}
                        </Td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* --- mode-aware table primitives (mirrors keystones/performance.tsx Th/Td) --- */

function Th({
  children,
  align = "left",
  sticky,
  bg,
  fg,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  sticky?: boolean;
  bg?: string;
  fg: string;
}) {
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
