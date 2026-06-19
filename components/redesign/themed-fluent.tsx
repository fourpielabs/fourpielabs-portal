"use client";

import * as React from "react";
import { FluentProvider } from "@fluentui/react-components";
import { Moon, Sun } from "lucide-react";
import {
  redesignLightTheme,
  redesignDarkTheme,
  type RedesignMode,
} from "@/lib/redesign/brand-theme";

type Ctx = { mode: RedesignMode; setMode: (m: RedesignMode) => void; toggle: () => void };
const RedesignModeContext = React.createContext<Ctx | null>(null);

/** Read the current preview light/dark mode so glass + field can switch together. */
export function useRedesignMode(): Ctx {
  const ctx = React.useContext(RedesignModeContext);
  if (!ctx) throw new Error("useRedesignMode must be used inside <ThemedFluent>");
  return ctx;
}

/**
 * The redesign theming root. Mounts ONE FluentProvider (warm light/dark themes
 * generated from the amber brand ramp) under the Griffel SSR registry, and carries
 * the `.rd-root` token scope for the glass layer.
 *
 * `defaultMode` is deterministic at SSR (no hydration mismatch); the floating pill
 * is preview-only chrome that lets a reviewer flip light↔dark to confirm BOTH
 * locked themes render. Keystones that are intentionally single-mode (the auth
 * card is always the night-time ember-glass moment) nest their own FluentProvider.
 */
export function ThemedFluent({
  children,
  defaultMode = "light",
}: {
  children: React.ReactNode;
  defaultMode?: RedesignMode;
}) {
  const [mode, setMode] = React.useState<RedesignMode>(defaultMode);
  const toggle = React.useCallback(() => setMode((m) => (m === "light" ? "dark" : "light")), []);
  const value = React.useMemo<Ctx>(() => ({ mode, setMode, toggle }), [mode, toggle]);

  return (
    <RedesignModeContext.Provider value={value}>
      <FluentProvider
        theme={mode === "dark" ? redesignDarkTheme : redesignLightTheme}
        className="rd-root"
        style={{ minHeight: "100dvh", background: "transparent" }}
      >
        {children}
        <ThemeTogglePill mode={mode} onToggle={toggle} />
      </FluentProvider>
    </RedesignModeContext.Provider>
  );
}

function ThemeTogglePill({ mode, onToggle }: { mode: RedesignMode; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${mode === "light" ? "dark" : "light"} theme`}
      className="rd-eyebrow"
      style={{
        position: "fixed",
        right: "1rem",
        bottom: "1rem",
        zIndex: 60,
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.5rem 0.85rem",
        borderRadius: "999px",
        color: mode === "dark" ? "#f3efe7" : "#18181b",
        background: mode === "dark" ? "rgba(26,21,16,0.78)" : "rgba(255,255,255,0.82)",
        border: "1px solid rgba(217,119,6,0.35)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        boxShadow: "0 8px 24px -10px rgba(40,33,24,0.4)",
        cursor: "pointer",
      }}
    >
      {mode === "light" ? <Moon size={14} /> : <Sun size={14} />}
      {mode === "light" ? "Dark" : "Light"}
    </button>
  );
}
