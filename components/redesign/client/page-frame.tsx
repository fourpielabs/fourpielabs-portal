"use client";

import * as React from "react";
import { FluentScope, useRedesignMode } from "@/components/redesign/themed-fluent";
import { AmbientField, Measure } from "@/components/redesign/ui";

/**
 * The wrapper every CONVERTED client body uses. The R1 ClientShell renders page
 * bodies OUTSIDE FluentProvider (so unconverted Tailwind bodies stay untouched), so
 * a converted body opts INTO the system here: a FluentScope (theme + .rd-root glass
 * tokens) + a full-bleed mode-aware ambient field behind + a readable measure for the
 * content. The field is fixed so it sits behind the sticky glass chrome too.
 */
export function ClientPageFrame({
  children,
  width = "standard",
}: {
  children: React.ReactNode;
  width?: "text" | "standard" | "wide";
}) {
  const { mode } = useRedesignMode();
  return (
    <FluentScope>
      <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0 }}>
        <AmbientField mode={mode} />
      </div>
      <Measure width={width} style={{ position: "relative", zIndex: 1 }}>
        {children}
      </Measure>
    </FluentScope>
  );
}
