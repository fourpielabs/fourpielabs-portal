"use client";

import * as React from "react";
import {
  Button as FluentButton,
  Spinner,
  makeStyles,
  mergeClasses,
  type ButtonProps,
} from "@fluentui/react-components";

/**
 * R1 Button layer.
 *
 * `Button` = Fluent Button (full state set — default/hover/active/disabled + Tabster
 * focus — come from Fluent + the Warm Obsidian theme) plus a `loading` state Fluent
 * lacks (spinner in the icon slot + disabled + aria-busy). Per R0: the AA-safe amber
 * is `appearance="primary"` (theme maps it to #b45309 light / bright-fill+charcoal dark).
 *
 * `EmberButton` = the ONE bespoke CTA: the deep amber gradient (--amber-cta) + ember
 * shadow + white text (AA ≥7:1 in BOTH modes). This is the single place we spend the
 * gradient — everything else uses the flat themed appearances.
 */
export function Button({
  loading = false,
  icon,
  disabled,
  children,
  ...props
}: ButtonProps & { loading?: boolean }) {
  return (
    <FluentButton
      {...props}
      icon={loading ? <Spinner size="tiny" /> : icon}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {children}
    </FluentButton>
  );
}

const useEmber = makeStyles({
  root: {
    backgroundImage: "var(--amber-cta)",
    backgroundColor: "#b45309",
    color: "#ffffff",
    border: "none",
    boxShadow: "var(--shadow-amber)",
    ":hover": { backgroundImage: "var(--amber-cta-hover)", color: "#ffffff" },
    ":hover:active": { backgroundImage: "var(--amber-cta-hover)", color: "#ffffff" },
  },
});

export function EmberButton({
  loading = false,
  icon,
  disabled,
  className,
  children,
  ...props
}: ButtonProps & { loading?: boolean }) {
  const s = useEmber();
  return (
    <FluentButton
      appearance="primary"
      {...props}
      className={mergeClasses(s.root, className)}
      icon={loading ? <Spinner size="tiny" /> : icon}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {children}
    </FluentButton>
  );
}
