"use client";

import * as React from "react";
import { Check, Plus } from "lucide-react";
import { Eyebrow, StatusPill, tokens } from "@/components/redesign/ui";
import { useRedesignMode } from "@/components/redesign/themed-fluent";
import { ClientPageFrame } from "@/components/redesign/client/page-frame";

type KV = { label: string; value: string };
export type AssignedProgram = { key: string; name: string; eyebrow: string | null; tagline: string | null; is_parallel: boolean };
export type IncludedService = { label: string; description: string | null; category: string; programName: string };
export type NotIncludedService = { label: string; description: string | null; programName: string };

export type ProgramData = {
  programs: AssignedProgram[];
  details: KV[];
  guidelines: KV[];
  milestones: { id: string; title: string; description: string | null; phase_label: string | null; status: string }[];
  included: IncludedService[];
  notIncluded: NotIncludedService[];
};

// friendly section headers for the catalog `category` values
const CATEGORY_LABELS: Record<string, string> = {
  seo: "SEO & website",
  gbp: "Google Business Profile",
  content: "Content",
  aeo: "Answer Engine Optimization",
  ads: "Advertising",
  ai: "AI & automation",
  crm: "CRM",
  social: "Social",
  strategy: "Strategy & reviews",
  exclusivity: "Market exclusivity",
};
const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);
const catLabel = (c: string) => CATEGORY_LABELS[c] ?? c;

const msBorder = (s: string) => (s === "done" ? "#b45309" : s === "in_progress" ? "#fbbf24" : "#e7e5e0");

export function ProgramBody({ data }: { data: ProgramData }) {
  const { mode } = useRedesignMode();
  const onDark = mode === "dark";
  const fg1 = tokens.colorNeutralForeground1, fg2 = tokens.colorNeutralForeground2, fg3 = tokens.colorNeutralForeground3;
  const panel = onDark ? "rd-solid--dark" : "rd-solid";
  const divider = onDark ? "#231f19" : "#f1efe8";
  const cardStyle: React.CSSProperties = { borderRadius: 20, padding: "1.3rem" };
  const title = (t: string) => <h2 className="rd-display" style={{ margin: "0 0 0.85rem", fontSize: "1.15rem", fontWeight: 600, color: fg1 }}>{t}</h2>;

  // group included services by category in the catalog's canonical order
  const grouped = React.useMemo(() => {
    const m = new Map<string, IncludedService[]>();
    for (const s of data.included) {
      const arr = m.get(s.category) ?? [];
      arr.push(s);
      m.set(s.category, arr);
    }
    return [...m.entries()].sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a[0]); const ib = CATEGORY_ORDER.indexOf(b[0]);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }, [data.included]);

  return (
    <ClientPageFrame width="standard">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", paddingBlock: "clamp(0.5rem,2vw,1rem)" }}>
        <div className="rd-rise" style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <Eyebrow tone={onDark ? "onDark" : "amber"}>Your program</Eyebrow>
          <h1 className="rd-display" style={{ margin: 0, fontSize: "clamp(1.9rem,5vw,2.6rem)", fontWeight: 600, lineHeight: 1.02, color: fg1 }}>
            Everything we&rsquo;re doing to make you the obvious choice in your area.
          </h1>
        </div>

        {/* program identity card(s) — name + category eyebrow + tagline, per assigned program */}
        {data.programs.length > 0 && (
          <div className="rd-incl-grid">
            {data.programs.map((p) => (
              <div key={p.key} className={`${panel} rd-rise`} style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 6 }}>
                <Eyebrow tone={onDark ? "onDark" : "amber"}>{p.eyebrow ?? "Program"}</Eyebrow>
                <div className="rd-display" style={{ fontSize: "1.5rem", fontWeight: 600, color: fg1, lineHeight: 1.1 }}>{p.name}</div>
                {p.tagline && <p style={{ margin: 0, fontSize: "0.9rem", color: fg2 }}>{p.tagline}</p>}
              </div>
            ))}
          </div>
        )}

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

        {/* What's included — catalog-driven, grouped by category, read-only */}
        <div className={`${panel} rd-rise`} style={cardStyle}>
          {title("What's included")}
          {grouped.length === 0 ? (
            <p style={{ margin: 0, fontSize: "0.88rem", color: fg3 }}>Your included services will appear here.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
              {grouped.map(([cat, items]) => (
                <div key={cat}>
                  <div className="rd-eyebrow" style={{ marginBottom: 8, color: fg3 }}>{catLabel(cat)}</div>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                    {items.map((s) => (
                      <li key={s.label} style={{ display: "flex", gap: 10 }}>
                        <span style={{ flexShrink: 0, display: "inline-flex", width: 20, height: 20, marginTop: 1, alignItems: "center", justifyContent: "center", borderRadius: 999, background: onDark ? "rgba(245,158,11,0.18)" : "#fef3c7", color: "#b45309" }}>
                          <Check size={13} strokeWidth={2.5} />
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "0.92rem", fontWeight: 600, color: fg1 }}>{s.label}</div>
                          {s.description && <p style={{ margin: "0.1rem 0 0", fontSize: "0.84rem", color: fg2 }}>{s.description}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Available to add — derived from the catalog (services on programs the client doesn't have) */}
        {data.notIncluded.length > 0 && (
          <div className={`${panel} rd-rise`} style={cardStyle}>
            {title("Available to add")}
            <p style={{ margin: "0 0 0.85rem", fontSize: "0.84rem", color: fg3 }}>Ready when you are — these come with a bigger program.</p>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {data.notIncluded.map((s) => (
                <li key={s.label} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${divider}`, padding: "0.4rem 0" }}>
                  <span style={{ display: "inline-flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                    <Plus size={13} strokeWidth={2.5} style={{ flexShrink: 0, color: fg3 }} />
                    <span style={{ fontSize: "0.88rem", color: fg2 }}>{s.label}</span>
                  </span>
                  <span style={{ fontSize: "0.74rem", fontWeight: 600, color: fg3, whiteSpace: "nowrap" }}>Available on {s.programName}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={`${panel} rd-rise`} style={cardStyle}>
          {title("Your 90-day roadmap")}
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
