"use client";

import * as React from "react";
import { Markdown } from "@/components/markdown";
import { Eyebrow, StatusPill, tokens } from "@/components/redesign/ui";
import { useRedesignMode } from "@/components/redesign/themed-fluent";
import { ClientPageFrame } from "@/components/redesign/client/page-frame";

type KV = { label: string; value: string };
export type ProgramData = {
  details: KV[];
  guidelines: KV[];
  milestones: { id: string; title: string; description: string | null; phase_label: string | null; status: string }[];
  whatsIncluded: string | null;
  whatsNotIncluded: string | null;
};

const msBorder = (s: string) => (s === "done" ? "#b45309" : s === "in_progress" ? "#fbbf24" : "#e7e5e0");

export function ProgramBody({ data }: { data: ProgramData }) {
  const { mode } = useRedesignMode();
  const onDark = mode === "dark";
  const fg1 = tokens.colorNeutralForeground1, fg2 = tokens.colorNeutralForeground2, fg3 = tokens.colorNeutralForeground3;
  const panel = onDark ? "rd-solid--dark" : "rd-solid";
  const divider = onDark ? "#231f19" : "#f1efe8";
  const cardStyle: React.CSSProperties = { borderRadius: 20, padding: "1.3rem" };
  const title = (t: string) => <h2 className="rd-display" style={{ margin: "0 0 0.85rem", fontSize: "1.15rem", fontWeight: 600, color: fg1 }}>{t}</h2>;

  return (
    <ClientPageFrame width="standard">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", paddingBlock: "clamp(0.5rem,2vw,1rem)" }}>
        <div className="rd-rise" style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <Eyebrow tone={onDark ? "onDark" : "amber"}>Your program</Eyebrow>
          <h1 className="rd-display" style={{ margin: 0, fontSize: "clamp(1.9rem,5vw,2.6rem)", fontWeight: 600, lineHeight: 1.02, color: fg1 }}>
            Everything your engagement covers.
          </h1>
        </div>

        <div className={`${panel} rd-rise`} style={cardStyle}>
          {title("Details")}
          <dl className="rd-kv">
            {data.details.map((d) => (
              <div key={d.label} style={{ display: "flex", justifyContent: "space-between", gap: 16, borderBottom: `1px solid ${divider}`, padding: "0.4rem 0" }}>
                <dt style={{ fontSize: "0.85rem", color: fg3 }}>{d.label}</dt>
                <dd style={{ margin: 0, fontSize: "0.85rem", fontWeight: 500, color: fg1 }}>{d.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className={`${panel} rd-rise`} style={cardStyle}>
          {title("Your journey")}
          {data.milestones.length === 0 ? (
            <p style={{ margin: 0, fontSize: "0.88rem", color: fg3 }}>Your roadmap will appear here shortly.</p>
          ) : (
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {data.milestones.map((m) => (
                <li key={m.id} style={{ display: "flex", gap: 12, justifyContent: "space-between", borderRadius: 12, border: `1px solid ${divider}`, borderLeft: `4px solid ${msBorder(m.status)}`, padding: 12 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: "0.9rem", fontWeight: 600, color: fg1 }}>{m.title}</span>
                      {m.phase_label && <span style={{ fontSize: "0.74rem", color: fg3 }}>{m.phase_label}</span>}
                    </div>
                    {m.description && <p style={{ margin: "0.25rem 0 0", fontSize: "0.84rem", color: fg2 }}>{m.description}</p>}
                  </div>
                  <StatusPill value={m.status} mode={mode} />
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="rd-incl-grid">
          <div className={`${panel} rd-rise`} style={cardStyle}>
            {title("What's included")}
            {data.whatsIncluded ? <div className="rd-prose"><Markdown>{data.whatsIncluded}</Markdown></div> : <p style={{ margin: 0, color: fg3 }}>—</p>}
          </div>
          <div className={`${panel} rd-rise`} style={cardStyle}>
            {title("What's not included")}
            {data.whatsNotIncluded ? <div className="rd-prose"><Markdown>{data.whatsNotIncluded}</Markdown></div> : <p style={{ margin: 0, color: fg3 }}>—</p>}
          </div>
        </div>

        {data.guidelines.length > 0 && (
          <div className={`${panel} rd-rise`} style={cardStyle}>
            {title("Working together")}
            <dl className="rd-incl-grid">
              {data.guidelines.map((d) => (
                <div key={d.label}>
                  <dt style={{ fontSize: "0.74rem", color: fg3 }}>{d.label}</dt>
                  <dd style={{ margin: "0.15rem 0 0", fontSize: "0.88rem", color: fg1 }}>{d.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
      <style>{`.rd-incl-grid{display:grid;gap:1rem 1.5rem;grid-template-columns:1fr;} @media(min-width:760px){.rd-incl-grid{grid-template-columns:1fr 1fr;}}`}</style>
    </ClientPageFrame>
  );
}
