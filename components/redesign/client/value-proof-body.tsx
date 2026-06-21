"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { ArrowDownRight, ArrowUpRight, Sparkles, Target, TrendingUp } from "lucide-react";
import { Eyebrow, tokens } from "@/components/redesign/ui";
import { useRedesignMode } from "@/components/redesign/themed-fluent";
import { ClientPageFrame } from "@/components/redesign/client/page-frame";
import { Stagger, StaggerItem } from "@/components/motion/motion-primitives";
import { useReducedMotion } from "@/lib/motion";
import { formatMetricValue } from "@/lib/format";
import type { ValueProof, ValueProofKpi } from "@/lib/value-proof";

// Recharts stays lazy + isolated (ssr:false — it measures the DOM).
const PerfChart = dynamic(() => import("@/components/redesign/keystones/perf-chart"), { ssr: false });

/** Reduced-motion-safe count-up to a numeric value (~0.7s ease-out cubic). */
function CountUp({ value, fmt }: { value: number; fmt: (n: number) => string }) {
  const reduced = useReducedMotion();
  const [n, setN] = React.useState(reduced ? value : 0);
  React.useEffect(() => {
    if (reduced) { setN(value); return; }
    let raf = 0;
    const start = performance.now(), dur = 700;
    const tick = (t: number) => {
      const p = Math.min((t - start) / dur, 1);
      setN(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced]);
  return <>{fmt(n)}</>;
}

export function ValueProofBody({ data }: { data: ValueProof }) {
  const { mode } = useRedesignMode();
  const onDark = mode === "dark";
  const fg1 = tokens.colorNeutralForeground1, fg2 = tokens.colorNeutralForeground2, fg3 = tokens.colorNeutralForeground3;
  const panel = onDark ? "rd-solid--dark" : "rd-solid";
  const divider = onDark ? "#231f19" : "#f1efe8";
  const card: React.CSSProperties = { borderRadius: 18, padding: "1.15rem 1.2rem" };

  const allKpis = React.useMemo(() => data.categories.flatMap((c) => c.kpis), [data.categories]);
  const [selId, setSelId] = React.useState<string | null>(null);
  const selected = allKpis.find((k) => k.id === selId) ?? allKpis.find((k) => k.trend.some((t) => t.value != null)) ?? allKpis[0] ?? null;

  return (
    <ClientPageFrame width="standard">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", paddingBlock: "clamp(0.5rem,2vw,1rem)" }}>
        <div className="rd-rise" style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <Eyebrow tone={onDark ? "onDark" : "amber"}>Your results</Eyebrow>
          <h1 className="rd-display" style={{ margin: 0, fontSize: "clamp(1.9rem,5vw,2.6rem)", fontWeight: 600, lineHeight: 1.02, color: fg1 }}>
            The proof we&rsquo;re moving your numbers.
          </h1>
          {data.monthLabelCurrent && (
            <p style={{ margin: 0, fontSize: "0.9rem", color: fg3 }}>Latest reporting: {data.monthLabelCurrent}</p>
          )}
        </div>

        {!data.hasData ? (
          <div className={`${panel} rd-rise`} style={{ ...card, padding: "2.5rem 1.4rem", textAlign: "center" }}>
            <span style={{ display: "inline-flex", width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 999, background: onDark ? "rgba(245,158,11,0.16)" : "#fef3c7", color: "#b45309" }}>
              <TrendingUp size={22} />
            </span>
            <h2 className="rd-display" style={{ margin: "0.85rem 0 0.3rem", fontSize: "1.15rem", fontWeight: 600, color: fg1 }}>Your results will appear here</h2>
            <p style={{ margin: 0, fontSize: "0.9rem", color: fg3 }}>As we report your numbers each month, your wins and trends show up right here.</p>
          </div>
        ) : (
          <>
            {/* WINS SUMMARY — the "are we winning?" answer, first */}
            {data.wins.length > 0 && (
              <div className={`${panel} rd-rise`} style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.9rem" }}>
                  <Sparkles size={16} color="#b45309" />
                  <h2 className="rd-display" style={{ margin: 0, fontSize: "1.05rem", fontWeight: 600, color: fg1 }}>This month&rsquo;s wins</h2>
                </div>
                <div className="rd-vp-wins">
                  {data.wins.map((w) => (
                    <div key={w.label} style={{ display: "flex", flexDirection: "column", gap: 4, borderRadius: 14, padding: "0.9rem 1rem", background: onDark ? "rgba(34,197,94,0.1)" : "#ecfdf5", border: `1px solid ${onDark ? "rgba(34,197,94,0.3)" : "#a7f3d0"}` }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "1.5rem", fontWeight: 700, color: onDark ? "#6ee7b7" : "#15803d" }} className="rd-tnum">
                        {w.up ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}{Math.round(Math.abs(w.deltaPct))}%
                      </span>
                      <span style={{ fontSize: "0.85rem", fontWeight: 500, color: fg2 }}>{w.label} {w.up ? "up" : "down"} vs last month</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* KPI CARDS by category — value + delta + target pacing */}
            {data.categories.map((cat) => (
              <div key={cat.key} style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                <div className="rd-eyebrow" style={{ color: fg3 }}>{cat.label}</div>
                <Stagger className="rd-vp-grid">
                  {cat.kpis.map((k) => (
                    <StaggerItem key={k.id} lift>
                      <button
                        type="button"
                        onClick={() => setSelId(k.id)}
                        className={`${panel} rd-focus`}
                        style={{ ...card, width: "100%", textAlign: "left", cursor: "pointer", border: selected?.id === k.id ? `1px solid ${onDark ? "rgba(245,158,11,0.5)" : "#fcd34d"}` : undefined, display: "flex", flexDirection: "column", gap: 8 }}
                        aria-label={`${k.label} trend`}
                      >
                        <span style={{ fontSize: "0.8rem", fontWeight: 600, color: fg3 }}>{k.label}</span>
                        <span style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                          <span className="rd-tnum" style={{ fontSize: "1.6rem", fontWeight: 700, color: fg1, lineHeight: 1 }}>
                            {k.current == null ? "—" : <CountUp value={k.current} fmt={(n) => formatMetricValue(k.unit, n, null)} />}
                          </span>
                          {k.deltaPct != null && k.improved != null && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: "0.82rem", fontWeight: 600, color: k.improved ? (onDark ? "#6ee7b7" : "#15803d") : (onDark ? "#fca5a5" : "#b91c1c") }}>
                              {(k.delta ?? 0) > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{Math.abs(Math.round(k.deltaPct))}%
                            </span>
                          )}
                        </span>
                        {/* TARGET PACING BAR — only when a target is set */}
                        {k.target != null && k.pacingPct != null ? (
                          <span style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 2 }}>
                            <span style={{ height: 6, borderRadius: 999, background: onDark ? "#2a251e" : "#eee9df", overflow: "hidden" }}>
                              <span style={{ display: "block", height: "100%", width: `${Math.round(k.pacingPct * 100)}%`, borderRadius: 999, background: k.onTrack ? "#16a34a" : "#d97706", transition: "width .6s var(--rd-ease-out)" }} />
                            </span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.72rem", color: fg3 }}>
                              <Target size={11} /> {k.onTrack ? "On track" : `${Math.round(k.pacingPct * 100)}% to goal`} · target {formatMetricValue(k.unit, k.target, null)}
                            </span>
                          </span>
                        ) : (
                          <span style={{ fontSize: "0.72rem", color: fg3 }}>vs last month</span>
                        )}
                      </button>
                    </StaggerItem>
                  ))}
                </Stagger>
              </div>
            ))}

            {/* TREND CHART — month-over-month for the selected KPI (solid surface) */}
            {selected && (
              <div className={`${panel} rd-rise`} style={{ borderRadius: 20, padding: "1.2rem" }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: "0.9rem" }}>
                  <h2 className="rd-display" style={{ margin: 0, fontSize: "1.05rem", fontWeight: 600, color: fg1 }}>{selected.label} — month by month</h2>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: "0.9rem" }}>
                  {allKpis.map((k) => {
                    const active = selected.id === k.id;
                    return (
                      <button key={k.id} type="button" onClick={() => setSelId(k.id)} className="rd-focus" style={{ borderRadius: 999, padding: "0.3rem 0.7rem", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? (onDark ? "rgba(245,158,11,0.5)" : "#fcd34d") : divider}`, background: active ? (onDark ? "rgba(245,158,11,0.16)" : "#fef3c7") : "transparent", color: active ? (onDark ? "#fcd34d" : "#92400e") : fg3 }}>
                        {k.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ height: 300 }}>
                  <PerfChart data={selected.trend} mode={mode} reduced={false} unit={selected.unit} />
                </div>
              </div>
            )}

            {/* QUALITATIVE NOTES (text KPIs) */}
            {data.notes.length > 0 && (
              <div className={`${panel} rd-rise`} style={card}>
                <h2 className="rd-display" style={{ margin: "0 0 0.85rem", fontSize: "1.05rem", fontWeight: 600, color: fg1 }}>Notes from your team</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {data.notes.map((nNote) => (
                    <div key={nNote.label}>
                      <div className="rd-eyebrow" style={{ color: fg3, marginBottom: 2 }}>{nNote.label}</div>
                      <p style={{ margin: 0, fontSize: "0.9rem", color: fg2 }}>{nNote.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <style>{`
        .rd-vp-wins{display:grid;gap:0.75rem;grid-template-columns:1fr;}
        @media(min-width:680px){.rd-vp-wins{grid-template-columns:repeat(3,1fr);}}
        .rd-vp-grid{display:grid;gap:0.75rem;grid-template-columns:1fr;}
        @media(min-width:520px){.rd-vp-grid{grid-template-columns:1fr 1fr;}}
        @media(min-width:920px){.rd-vp-grid{grid-template-columns:1fr 1fr 1fr;}}
      `}</style>
    </ClientPageFrame>
  );
}
