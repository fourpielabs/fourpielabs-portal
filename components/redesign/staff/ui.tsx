"use client";

import * as React from "react";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import {
  BaseModal, EmberButton, Button, Eyebrow, AmbientField, tokens,
} from "@/components/redesign/ui";
import { FluentScope, useRedesignMode } from "@/components/redesign/themed-fluent";

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

/**
 * The frame every TOP-LEVEL staff page (clients list, admin/users, admin/audit, new
 * client) opts into — these render OUTSIDE the per-client WorkspaceChrome, so they need
 * their own FluentScope + ambient field + a readable container. (Per-client tab bodies
 * are already inside the chrome's FluentScope and must NOT use this.)
 */
export function StaffPageFrame({
  children, max = "75rem",
}: {
  children: React.ReactNode; max?: string;
}) {
  const { mode } = useRedesignMode();
  return (
    <FluentScope>
      <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <AmbientField mode={mode} />
      </div>
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: max, marginInline: "auto", paddingInline: "var(--rd-page-px)", paddingBlock: "clamp(1rem,3vw,1.75rem)", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {children}
      </div>
    </FluentScope>
  );
}

/** Page heading for a top-level staff page (eyebrow-display title + description + actions). */
export function StaffPageHeader({
  title, description, actions,
}: {
  title: string; description?: React.ReactNode; actions?: React.ReactNode;
}) {
  const { fg1, fg3 } = usePanel();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "1rem" }}>
      <div style={{ minWidth: 0 }}>
        <h1 className="rd-display" style={{ margin: 0, fontSize: "clamp(1.5rem,3.5vw,2rem)", fontWeight: 600, color: fg1, lineHeight: 1.05 }}>{title}</h1>
        {description && <p style={{ margin: "0.3rem 0 0", fontSize: "0.9rem", color: fg3 }}>{description}</p>}
      </div>
      {actions}
    </div>
  );
}

/** A SOLID titled panel (heading + optional description + body) — for form sections. */
export function TitledPanel({
  title, description, children,
}: {
  title: string; description?: React.ReactNode; children: React.ReactNode;
}) {
  const { panel, fg1, fg3 } = usePanel();
  return (
    <section className={panel} style={{ borderRadius: 20, padding: "clamp(1.1rem,2.5vw,1.5rem)" }}>
      <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: fg1 }}>{title}</h2>
      {description && <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", color: fg3 }}>{description}</p>}
      <div style={{ marginTop: "1rem" }}>{children}</div>
    </section>
  );
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
 * the `closeSignal` bump), renders the trigger + a BaseModal wrapping the <form> (the
 * pinned footer submit drives the form via form-id association).
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
  const formId = React.useId();
  return (
    <>
      {/* trigger rendered outside the modal (BaseModal is fully controlled); the click
          bubbles up from the caller's button to open. display:contents keeps layout intact. */}
      <span style={{ display: "contents" }} onClick={() => onOpenChange(true)}>{trigger}</span>
      <BaseModal
        isOpen={open}
        onClose={() => onOpenChange(false)}
        title={title}
        footer={<EmberButton type="submit" form={formId} loading={submitting}>{submitLabel}</EmberButton>}
      >
        {/* form lives in the body; the pinned footer submit drives it via form-id
            association. All RHF/validation/server-action wiring is unchanged. */}
        <form id={formId} onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {description && <p style={{ margin: "-4px 0 0", fontSize: 13, color: fg3 }}>{description}</p>}
          {children}
        </form>
      </BaseModal>
    </>
  );
}

/** Themed destructive-confirm dialog (icon-button trigger → "are you sure"). */
export function ConfirmDelete({
  title = "Delete this?", description, onConfirm, triggerLabel = "Delete",
}: {
  title?: string; description: string; onConfirm: () => void; triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const { fg3 } = usePanel();
  return (
    <>
      <button type="button" aria-label={triggerLabel} onClick={() => setOpen(true)} className="rd-focus" style={{ flexShrink: 0, borderRadius: 8, border: "none", background: "none", cursor: "pointer", color: fg3, padding: 6, display: "inline-flex" }}>
        <Trash2 size={16} />
      </button>
      <BaseModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={title}
        size="sm"
        footer={<>
          <Button appearance="subtle" onClick={() => setOpen(false)}>Cancel</Button>
          <EmberButton onClick={() => { setOpen(false); onConfirm(); }} style={{ background: "linear-gradient(180deg,#dc2626,#b91c1c)" }}>Delete</EmberButton>
        </>}
      >
        <p style={{ margin: 0, fontSize: 14, color: fg3 }}>{description}</p>
      </BaseModal>
    </>
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
