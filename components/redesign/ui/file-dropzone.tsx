"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { tokens } from "@fluentui/react-components";
import { useRedesignMode } from "@/components/redesign/themed-fluent";

/**
 * Themed drag-and-drop file picker (Warm Obsidian) — a dark-safe replacement for the
 * legacy shadcn FileDropzone (which used light-only Tailwind tokens and rendered
 * white-on-dark inside a mode-aware dialog). Same API (onFile / accept / hint / disabled /
 * selectedName); colors come from Fluent tokens + the redesign mode.
 */
export function FileDropzone({
  onFile,
  accept,
  hint,
  disabled,
  selectedName,
  style,
}: {
  onFile: (file: File | null) => void;
  accept?: string;
  hint?: string;
  disabled?: boolean;
  selectedName?: string | null;
  style?: React.CSSProperties;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const { mode } = useRedesignMode();
  const onDark = mode === "dark";
  const fg1 = tokens.colorNeutralForeground1, fg3 = tokens.colorNeutralForeground3;
  const baseBorder = onDark ? "#3a352d" : "#d6d3cd";
  const dragBg = onDark ? "rgba(245,158,11,0.10)" : "#fffbeb";

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (disabled) return;
        const f = e.dataTransfer.files?.[0] ?? null;
        if (f) onFile(f);
      }}
      className="motion-micro rd-focus"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        cursor: disabled ? "default" : "pointer",
        textAlign: "center",
        borderRadius: 12,
        border: `2px dashed ${drag ? "#d97706" : baseBorder}`,
        background: drag ? dragBg : tokens.colorNeutralBackground1,
        padding: "2rem 1.5rem",
        color: fg1,
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? "none" : undefined,
        ...style,
      }}
    >
      <UploadCloud size={24} color={fg3} aria-hidden />
      <div style={{ fontSize: 14, fontWeight: 500, color: fg1 }}>
        {selectedName ? selectedName : (
          <>Drag a file here, or <span style={{ color: onDark ? "#fcd34d" : "#b45309" }}>browse</span></>
        )}
      </div>
      {hint && <div style={{ fontSize: 12, color: fg3 }}>{hint}</div>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
