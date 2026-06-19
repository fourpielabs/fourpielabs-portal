"use client";

import * as React from "react";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import {
  Dialog, DialogSurface, DialogBody, DialogTitle, DialogActions, DialogTrigger,
  EmberButton, Button, Eyebrow, tokens,
} from "@/components/redesign/ui";
import { useRedesignMode } from "@/components/redesign/themed-fluent";

/**
 * R3 staff workspace kit — the shared ember-glass building blocks every converted
 * per-client tab body reuses, so the dense staff editor surfaces stay byte-consistent
 * (SOLID panels — glass is forbidden on these lists/forms — mode-aware, AA). The form
 * dialogs render on a Fluent DialogSurface (themed by the surrounding FluentScope, so
 * they're dark in dark mode), keeping all RHF/server-action wiring at the call site.
 */
export function usePanel() {
  const { mode } = useRedesignMode();
  const onDark = mode === "dark";
  return {
    mode,
    onDark,
    panel: onDark ? "rd-solid--dark" : "rd-solid",
    fg1: tokens.colorNeutralForeground1,
    fg2: tokens.colorNeutralForeground2,
    fg3: tokens.colorNeutralForeground3,
    brand: tokens.colorBrandForeground1,
    border: onDark ? "#34302a" : "#e7e5e0",
  };
}

/** Compact staff section header: muted count/label at left, primary action at right. */
export function SectionHead({ count, children }: { count: React.ReactNode; children?: React.ReactNode }) {
  const { fg3 } = usePanel();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
      <p style={{ margin: 0, fontSize: "0.85rem", color: fg3 }}>{count}</p>
      {children}
    </div>
  );
}

/** Centered empty-state panel (SOLID). */
export function EmptyPanel({
  icon, title, description, action,
}: {
  icon: React.ReactNode; title: string; description?: string; action?: React.ReactNode;
}) {
  const { panel, fg1, fg3, onDark } = usePanel();
  return (
    <div className={panel} style={{ borderRadius: 20, padding: "3rem 2rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
      <span style={{ display: "grid", placeItems: "center", width: 48, height: 48, borderRadius: 14, background: onDark ? "rgba(245,158,11,0.14)" : "#fef3c7", color: "#b45309" }}>{icon}</span>
      <div className="rd-display" style={{ fontSize: "1.2rem", fontWeight: 600, color: fg1 }}>{title}</div>
      {description && <p style={{ margin: 0, fontSize: "0.9rem", color: fg3, maxWidth: "26rem" }}>{description}</p>}
      {action}
    </div>
  );
}

/** A SOLID list-row card (the D2 row idiom on the new system). */
export function RowCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const { panel } = usePanel();
  return (
    <li className={panel} style={{ borderRadius: 18, padding: "1rem 1.1rem", listStyle: "none", ...style }}>
      {children}
    </li>
  );
}

/** Form field: muted eyebrow label + control + optional error. */
export function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Eyebrow tone="muted">{label}</Eyebrow>
      {children}
      {error && <span style={{ fontSize: 12, color: "#dc2626" }}>{error}</span>}
    </div>
  );
}

/** Two-column field grid (collapses on the narrow dialog). */
export function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>{children}</div>;
}

/**
 * Themed form-dialog shell. Manages open state (so it closes on a successful submit via
 * the `closeSignal` bump), renders the trigger + a Fluent DialogSurface + a <form>.
 * The caller owns onSubmit (RHF handleSubmit) + submitting + submitLabel.
 */
export function FormDialog({
  title, description, trigger, children, onSubmit, submitting, submitLabel, open, onOpenChange,
}: {
  title: string;
  description?: string;
  trigger: React.ReactNode;
  children: React.ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  submitting?: boolean;
  submitLabel: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { fg3 } = usePanel();
  return (
    <Dialog open={open} onOpenChange={(_, d) => onOpenChange(d.open)}>
      <DialogTrigger disableButtonEnhancement>{trigger as React.ReactElement}</DialogTrigger>
      <DialogSurface style={{ maxHeight: "90vh", overflowY: "auto" }}>
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>
          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 10 }}>
            {description && <p style={{ margin: "-4px 0 0", fontSize: 13, color: fg3 }}>{description}</p>}
            {children}
            <DialogActions>
              <EmberButton type="submit" loading={submitting}>{submitLabel}</EmberButton>
            </DialogActions>
          </form>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** Themed destructive-confirm dialog (icon-button trigger → "are you sure"). */
export function ConfirmDelete({
  title = "Delete this?", description, onConfirm, triggerLabel = "Delete",
}: {
  title?: string; description: string; onConfirm: () => void; triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const { fg1, fg3 } = usePanel();
  return (
    <Dialog open={open} onOpenChange={(_, d) => setOpen(d.open)}>
      <DialogTrigger disableButtonEnhancement>
        <button type="button" aria-label={triggerLabel} className="rd-focus" style={{ flexShrink: 0, borderRadius: 8, border: "none", background: "none", cursor: "pointer", color: fg3, padding: 6, display: "inline-flex" }}>
          <Trash2 size={16} />
        </button>
      </DialogTrigger>
      <DialogSurface style={{ maxWidth: 420 }}>
        <DialogBody>
          <DialogTitle style={{ color: fg1 }}>{title}</DialogTitle>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: fg3 }}>{description}</p>
          <DialogActions>
            <Button appearance="subtle" onClick={() => setOpen(false)}>Cancel</Button>
            <EmberButton onClick={() => { setOpen(false); onConfirm(); }} style={{ background: "linear-gradient(180deg,#dc2626,#b91c1c)" }}>Delete</EmberButton>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** Small ghost icon-button used for inline row actions (edit / move / visibility). */
export function IconButton({
  label, onClick, disabled, children,
}: {
  label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode;
}) {
  const { fg3 } = usePanel();
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="rd-focus" style={{ flexShrink: 0, borderRadius: 8, border: "none", background: "none", cursor: disabled ? "default" : "pointer", color: fg3, padding: 6, display: "inline-flex", opacity: disabled ? 0.5 : 1 }}>
      {children}
    </button>
  );
}
