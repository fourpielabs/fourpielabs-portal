"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { tokens } from "@fluentui/react-components";
import { Shell, AmbientField, Measure, Eyebrow, GlassSurface } from "@/components/redesign/ui";
import { useRedesignMode } from "@/components/redesign/themed-fluent";

const KEYSTONES = [
  {
    href: "/redesign-preview/login",
    label: "Keystone · Auth",
    title: "The way in",
    body: "An ember-glass sign-in card floating over the live hero. Proves glass + a single-mode immersive moment.",
  },
  {
    href: "/redesign-preview/dashboard",
    title: "The room",
    label: "Keystone · Client dashboard",
    body: "A glass KPI band and chrome over readable, solid content. Proves glass-with-scrim beside disciplined data.",
  },
  {
    href: "/redesign-preview/performance",
    title: "The numbers",
    label: "Keystone · Data-dense",
    body: "Charts and a month-by-month table on solid surfaces. Proves the system holds where glass is forbidden.",
  },
];

export default function RedesignPreviewIndex() {
  const { mode } = useRedesignMode();
  const onDark = mode === "dark";

  return (
    <Shell>
      <AmbientField mode={mode} />
      <Measure
        width="standard"
        style={{
          position: "relative",
          zIndex: 1,
          paddingBlock: "clamp(3rem, 10vh, 7rem)",
          display: "flex",
          flexDirection: "column",
          gap: "3rem",
        }}
      >
        <div className="rd-rise">
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "40rem" }}>
            <Eyebrow tone={onDark ? "onDark" : "amber"}>4Pie Labs — Redesign R0</Eyebrow>
            <h1
              className="rd-display"
              style={{
                margin: 0,
                fontSize: "clamp(2.4rem, 6vw, 4rem)",
                lineHeight: 1.02,
                fontWeight: 600,
                color: tokens.colorNeutralForeground1,
              }}
            >
              A measurement room
              <br />
              for your marketing.
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: "1.05rem",
                lineHeight: 1.5,
                maxWidth: "34rem",
                color: tokens.colorNeutralForeground2,
              }}
            >
              Three keystone screens on the new system — Fluent UI v9, a warm ember-glass skin,
              and an immersive full-viewport shell. Built to read your real data, change nothing
              underneath, and earn the rest of the rebuild.
            </p>
          </div>
        </div>

        <div className="rd-keystone-grid">
          {KEYSTONES.map((k, i) => (
            <div key={k.href} className="rd-rise rd-lift" style={{ animationDelay: `${i * 70}ms`, height: "100%" }}>
              <Link href={k.href} style={{ textDecoration: "none", display: "block", height: "100%" }}>
                <GlassSurface
                  dark={onDark}
                  ember
                  style={{
                    height: "100%",
                    borderRadius: 24,
                    padding: "1.5rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >
                  <Eyebrow tone={onDark ? "onDark" : "amber"}>{k.label}</Eyebrow>
                  <div
                    className="rd-display"
                    style={{ fontSize: "1.6rem", fontWeight: 600, color: tokens.colorNeutralForeground1 }}
                  >
                    {k.title}
                  </div>
                  <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5, color: tokens.colorNeutralForeground2, flex: 1 }}>
                    {k.body}
                  </p>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      color: tokens.colorBrandForeground1,
                    }}
                  >
                    Open keystone <ArrowUpRight size={16} />
                  </span>
                </GlassSurface>
              </Link>
            </div>
          ))}
        </div>

        <div className="rd-rise">
          <p style={{ margin: 0, fontSize: "0.8rem", lineHeight: 1.6, color: tokens.colorNeutralForeground3, maxWidth: "44rem" }}>
            Flip the Dark / Light pill (bottom-right) to confirm both locked themes render. Every
            glass surface honors <code>prefers-reduced-transparency</code> and{" "}
            <code>prefers-reduced-motion</code> by falling back to an opaque solid with no blur.
          </p>
        </div>
      </Measure>

      <style>{`
        .rd-keystone-grid {
          display: grid;
          gap: 1.25rem;
          grid-template-columns: 1fr;
        }
        @media (min-width: 768px) {
          .rd-keystone-grid { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>
    </Shell>
  );
}
