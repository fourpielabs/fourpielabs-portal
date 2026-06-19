"use client";

import * as React from "react";
import { makeStyles, mergeClasses, tokens } from "@fluentui/react-components";

/**
 * Segmented control — Fluent v9 ships none. Composed as a pill row of buttons on the
 * Warm Obsidian tokens (solid surface; AA in both modes). Mutually exclusive; keyboard
 * arrow navigation via role=tablist/tab. The active segment uses the AA-safe amber.
 */
const useStyles = makeStyles({
  group: {
    display: "inline-flex",
    gap: "2px",
    padding: "3px",
    borderRadius: tokens.borderRadiusXLarge,
    backgroundColor: tokens.colorNeutralBackground3,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  seg: {
    appearance: "none",
    border: "none",
    cursor: "pointer",
    borderRadius: tokens.borderRadiusLarge,
    padding: "5px 14px",
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    fontFamily: tokens.fontFamilyBase,
    backgroundColor: "transparent",
    color: tokens.colorNeutralForeground2,
    transitionProperty: "background-color, color",
    transitionDuration: tokens.durationFast,
    ":hover": { color: tokens.colorNeutralForeground1 },
  },
  active: {
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    ":hover": { color: tokens.colorNeutralForegroundOnBrand },
  },
});

export type SegmentedOption<T extends string = string> = { value: T; label: React.ReactNode };

export function Segmented<T extends string = string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
}) {
  const s = useStyles();
  return (
    <div role="tablist" aria-label={ariaLabel} className={s.group}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={mergeClasses("rd-focus", s.seg, active && s.active)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
