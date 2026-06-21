"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Dialog, DialogSurface, DialogBody, DialogTitle, tokens } from "@fluentui/react-components";
import { FluentScope } from "@/components/redesign/themed-fluent";

/**
 * BaseModal — the canonical Warm Obsidian dialog shell, extracted from the
 * task-detail dialog (the one fixed for overflow). ONE source of truth for dialog
 * chrome so every modal sizes, scrolls, and themes identically.
 *
 * Master DNA reproduced verbatim:
 *   - Surface: width = clamped to the viewport, maxHeight 88vh, flex column,
 *     border-box — so it always fits (incl. 390w mobile).
 *   - The SINGLE scroll region is the inner content div (overflowY auto / overflowX
 *     hidden / minHeight 0 / flex 1) — no double scrollbars, no horizontal overflow.
 *   - Header (title + close) and footer are flexShrink:0 → pinned; only the body scrolls.
 *   - SOLID surface: Fluent's DialogSurface paints colorNeutralBackground1 (opaque) —
 *     dialogs are solid per the design rules (glass is forbidden on dialogs); the
 *     rd-fluentscope transparency is scoped to .rd-fluentscope, never .fui-DialogSurface.
 *   - Chrome (bg / radius / shadow / padding) comes from the Warm Obsidian FluentProvider
 *     theme (redesignLight/DarkTheme) → light + dark for free via tokens, NOT dark: classes.
 *
 * a11y: Fluent Dialog (modalType "modal") gives focus trap + Esc-to-close + focus
 * restore (Tabster) — we don't reinvent it. The close "X" is labeled. Reduced
 * motion/transparency follow Fluent's own handling (solid surface, theme motion).
 *
 * Self-theming: wraps its Dialog in FluentScope so it renders correctly anywhere
 * (the harness, or a page body outside a frame), not only inside a page-frame scope.
 */
const WIDTHS = {
  sm: "min(440px, 92vw)",
  md: "min(600px, 92vw)",
  lg: "min(820px, 94vw)",
} as const;

export type BaseModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Optional visible heading. When omitted, a visually-hidden title is rendered for a11y. */
  title?: React.ReactNode;
  /** Optional pinned footer (e.g. submit/cancel actions). */
  footer?: React.ReactNode;
  /** sm = confirms (440) · md = forms, the default (600) · lg = dense (820). */
  size?: keyof typeof WIDTHS;
  children: React.ReactNode;
};

const srOnly: React.CSSProperties = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" };

export function BaseModal({ isOpen, onClose, title, footer, size = "md", children }: BaseModalProps) {
  const width = WIDTHS[size];
  const fg1 = tokens.colorNeutralForeground1, fg3 = tokens.colorNeutralForeground3;
  return (
    <FluentScope>
      <Dialog open={isOpen} onOpenChange={(_, d) => { if (!d.open) onClose(); }}>
        <DialogSurface style={{ width, maxWidth: width, maxHeight: "88vh", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
          <DialogBody style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1, gap: 0 }}>
            {/* header — pinned (title + labeled close) */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexShrink: 0, paddingBottom: title ? 14 : 0 }}>
              {title ? (
                <DialogTitle style={{ margin: 0, fontSize: "1.15rem", fontWeight: 600, lineHeight: 1.25, color: fg1 }}>{title}</DialogTitle>
              ) : (
                <DialogTitle style={srOnly}>Dialog</DialogTitle>
              )}
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="rd-focus"
                style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, marginTop: -2, marginRight: -4, borderRadius: 8, border: "none", background: "transparent", color: fg3, cursor: "pointer" }}
              >
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>

            {/* body — the SINGLE scroll region. overflowWrap so a long URL/token wraps
                instead of forcing horizontal overflow; minWidth:0 lets flex children shrink. */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", overflowX: "hidden", minHeight: 0, minWidth: 0, flex: 1, paddingRight: 4, overflowWrap: "anywhere" }}>
              {children}
            </div>

            {/* footer — pinned */}
            {footer && (
              <div style={{ flexShrink: 0, paddingTop: 16, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                {footer}
              </div>
            )}
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </FluentScope>
  );
}
