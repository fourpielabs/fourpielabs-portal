"use client";

import * as React from "react";
import { tokens } from "@fluentui/react-components";
import { useRedesignMode } from "@/components/redesign/themed-fluent";

/**
 * Themed single-date field — a dark-safe replacement for the legacy shadcn DatePicker
 * (Popover + react-day-picker), which was light-only and rendered white-on-dark inside a
 * mode-aware dialog. This is a native <input type="date"> styled with Warm Obsidian
 * tokens; `colorScheme` follows the mode so the native control + calendar popup theme
 * correctly in light AND dark (and it's reliable on touch). Same contract as before:
 * value/onChange round-trip the native "YYYY-MM-DD" string — a 1:1 swap, no schema change.
 */
export function DateField({
  value,
  onChange,
  id,
  disabled,
  style,
}: {
  value: string | null | undefined;
  onChange: (iso: string) => void;
  id?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const { mode } = useRedesignMode();
  return (
    <input
      type="date"
      id={id}
      disabled={disabled}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        fontFamily: "inherit",
        fontSize: 14,
        lineHeight: 1.4,
        minHeight: 32,
        padding: "5px 10px",
        borderRadius: tokens.borderRadiusMedium,
        border: `1px solid ${tokens.colorNeutralStroke1}`,
        background: tokens.colorNeutralBackground1,
        color: tokens.colorNeutralForeground1,
        colorScheme: mode === "dark" ? "dark" : "light",
        ...style,
      }}
    />
  );
}
