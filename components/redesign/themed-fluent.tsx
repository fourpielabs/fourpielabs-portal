"use client";

import * as React from "react";
import { FluentProvider } from "@fluentui/react-components";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  redesignLightTheme,
  redesignDarkTheme,
  type RedesignMode,
} from "@/lib/redesign/brand-theme";

type Ctx = { mode: RedesignMode; setMode: (m: RedesignMode) => void; toggle: () => void };
const RedesignModeContext = React.createContext<Ctx | null>(null);
const STORAGE_KEY = "rd-mode";

/** Read the current preview light/dark mode so glass + field can switch together. */
export function useRedesignMode(): Ctx {
  const ctx = React.useContext(RedesignModeContext);
  if (!ctx) throw new Error("useRedesignMode must be used inside <RedesignModeProvider>");
  return ctx;
}

/**
 * Mode context ONLY (no FluentProvider). `defaultMode` is deterministic at SSR (no
 * hydration mismatch); the persisted choice is read from localStorage after mount.
 * Used at the portal layout so the chrome FluentScopes + the in-shell toggle share
 * one mode without wrapping the (still-Tailwind) page bodies in FluentProvider.
 */
export function RedesignModeProvider({
  children,
  defaultMode = "light",
}: {
  children: React.ReactNode;
  defaultMode?: RedesignMode;
}) {
  const [mode, setModeState] = React.useState<RedesignMode>(defaultMode);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark") setModeState(saved);
    } catch {}
  }, []);

  const setMode = React.useCallback((m: RedesignMode) => {
    setModeState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {}
  }, []);
  const toggle = React.useCallback(
    () => setMode(mode === "light" ? "dark" : "light"),
    [mode, setMode],
  );
  const value = React.useMemo<Ctx>(() => ({ mode, setMode, toggle }), [mode, setMode, toggle]);

  return <RedesignModeContext.Provider value={value}>{children}</RedesignModeContext.Provider>;
}

/**
 * A FluentProvider scope reading the current mode. Background is transparent so the
 * glass surfaces inside (and the page background behind) show through — this is what
 * lets us wrap ONLY chrome regions without painting over the app body.
 */
export function FluentScope({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { mode } = useRedesignMode();
  return (
    <FluentProvider
      theme={mode === "dark" ? redesignDarkTheme : redesignLightTheme}
      // `rd-fluentscope` keeps the background transparent — BUG: Fluent's
      // `applyStylesToPortals` copies only the CLASSNAME (not the inline `style`) onto a
      // menu/popover's portal wrapper, so the clone would inherit `fui-FluentProvider`'s
      // opaque `colorNeutralBackground1` and paint a full-bleed cover over the page (the
      // "user menu blanks the screen" bug). A class reaches the clone; inline style doesn't.
      className={cn("rd-root", "rd-fluentscope", className)}
      style={{ background: "transparent", ...style }}
    >
      {children}
    </FluentProvider>
  );
}

/**
 * In-shell Dark/Light toggle (promoted from the R0 floating pill). `tone` styles it
 * for a light or dark chrome surface; it's icon-only + labelled for a11y.
 */
export function ThemeToggle({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  const { mode, toggle } = useRedesignMode();
  const dark = tone === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${mode === "light" ? "dark" : "light"} theme`}
      className={cn(
        "rd-focus inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
        dark
          ? "text-[#cdc6ba] hover:bg-white/[0.08] hover:text-[#f3efe7]"
          : "text-ink-2 hover:bg-surface-2 hover:text-ink",
        className,
      )}
    >
      {mode === "light" ? <Moon className="size-[18px]" strokeWidth={1.8} /> : <Sun className="size-[18px]" strokeWidth={1.8} />}
    </button>
  );
}

/**
 * The R0 preview theming root: mode context + ONE FluentProvider wrapping everything
 * (fine for the preview, whose pages paint their own full-bleed field over it) + the
 * floating toggle pill. The real app uses RedesignModeProvider + per-chrome FluentScope
 * instead, so `showTogglePill` defaults on only for the preview.
 */
export function ThemedFluent({
  children,
  defaultMode = "light",
  showTogglePill = true,
}: {
  children: React.ReactNode;
  defaultMode?: RedesignMode;
  showTogglePill?: boolean;
}) {
  return (
    <RedesignModeProvider defaultMode={defaultMode}>
      <FluentScope style={{ minHeight: "100dvh" }}>
        {children}
        {showTogglePill && <ThemeTogglePill />}
      </FluentScope>
    </RedesignModeProvider>
  );
}

function ThemeTogglePill() {
  const { mode, toggle } = useRedesignMode();
  return (
    <button
      type="button"
      onClick={toggle}
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
