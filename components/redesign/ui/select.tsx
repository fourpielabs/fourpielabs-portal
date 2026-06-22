"use client";

import * as React from "react";
import { Dropdown, Option } from "@fluentui/react-components";

/**
 * Themed Select — a DROP-IN replacement for the native-style Select, keeping the
 * exact call-site API (`value` / `defaultValue` / `onChange(e)` reading
 * `e.target.value`, plus `<option>` children) so none of the ~34 call sites change.
 *
 * Why: the native <select>'s OPEN option list is rendered by the OS and can't be
 * themed. This renders on Fluent's Dropdown (a themed, accessible Listbox popup), so
 * the open list now matches Warm Obsidian in light + dark. Keyboard + focus + a11y
 * come from Fluent Dropdown. (Tradeoff: on touch devices this is a themed popup, not
 * the native OS picker.)
 */
type Opt = { value: string; label: React.ReactNode; text: string; disabled?: boolean };

function parseOptions(children: React.ReactNode): Opt[] {
  const out: Opt[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    // accept <option> elements (and fragments of them)
    if (child.type === "option") {
      const p = child.props as { value?: string; children?: React.ReactNode; disabled?: boolean };
      const value = String(p.value ?? "");
      const label = p.children;
      out.push({ value, label, text: typeof label === "string" ? label : value, disabled: p.disabled });
    } else if (child.type === React.Fragment) {
      out.push(...parseOptions((child.props as { children?: React.ReactNode }).children));
    }
  });
  return out;
}

export type SelectProps = {
  value?: string;
  defaultValue?: string;
  onChange?: (e: { target: { value: string } }, data: { value: string }) => void;
  children?: React.ReactNode;
  disabled?: boolean;
  id?: string;
  name?: string;
  "aria-label"?: string;
  style?: React.CSSProperties;
};

export function Select({ value, defaultValue, onChange, children, disabled, id, name, style, ...rest }: SelectProps) {
  const ariaLabel = rest["aria-label"];
  const opts = React.useMemo(() => parseOptions(children), [children]);
  const [internal, setInternal] = React.useState<string>(defaultValue ?? opts[0]?.value ?? "");
  const current = value ?? internal;
  const selected = opts.find((o) => o.value === current);
  const display = selected ? selected.text : "";

  return (
    <Dropdown
      id={id}
      name={name}
      aria-label={ariaLabel}
      disabled={disabled}
      style={{ width: "100%", minWidth: 0, ...style }}
      value={display}
      selectedOptions={[current]}
      onOptionSelect={(_, d) => {
        const v = d.optionValue ?? "";
        if (value === undefined) setInternal(v);
        // emit both the native-event shape (e.target.value) AND Fluent's (data.value)
        onChange?.({ target: { value: v } }, { value: v });
      }}
    >
      {opts.map((o) => (
        <Option key={o.value} value={o.value} text={o.text} disabled={o.disabled}>
          {o.label}
        </Option>
      ))}
    </Dropdown>
  );
}
