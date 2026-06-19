"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { tokens } from "@fluentui/react-components";
import { useRedesignMode } from "@/components/redesign/themed-fluent";
import { Shell, AmbientField, Measure, Eyebrow, GlassSurface } from "@/components/redesign/ui";

/**
 * Graceful, in-voice state for the data keystones when the signed-in account can't
 * supply the data the keystone reads (e.g. staff viewing a client-only screen, or
 * a project client where the keystone previews a program client). An empty screen
 * is an invitation to act — so it says what to do, not just what's missing.
 */
export function PreviewNotice({ title, body }: { title: string; body: string }) {
  const { mode } = useRedesignMode();
  const onDark = mode === "dark";
  return (
    <Shell>
      <AmbientField mode={mode} />
      <Measure
        width="text"
        style={{ position: "relative", zIndex: 1, minHeight: "100dvh", display: "grid", placeItems: "center" }}
      >
        <GlassSurface
          dark={onDark}
          ember
          style={{ borderRadius: 24, padding: "2rem", display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <Eyebrow tone={onDark ? "onDark" : "amber"}>Redesign preview</Eyebrow>
          <h1 className="rd-display" style={{ margin: 0, fontSize: "1.7rem", fontWeight: 600, color: tokens.colorNeutralForeground1 }}>
            {title}
          </h1>
          <p style={{ margin: 0, color: tokens.colorNeutralForeground2, lineHeight: 1.5 }}>{body}</p>
          <Link
            href="/redesign-preview"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, color: tokens.colorBrandForeground1, fontWeight: 600, textDecoration: "none" }}
          >
            <ArrowLeft size={16} /> Back to keystones
          </Link>
        </GlassSurface>
      </Measure>
    </Shell>
  );
}
