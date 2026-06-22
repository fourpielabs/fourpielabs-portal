"use client";

import * as React from "react";
import { Dropdown, Option, tokens } from "@fluentui/react-components";

/**
 * Themed Select — a DROP-IN replacement for the native-style Select, keeping the
 * exact call-site API (`value` / `defaultValue` / `onChange(e)` reading
 * `e.target.value`, plus `<option>` children) so none of the ~34 call sites change.
 *
 * Pointer-adaptive (confirmed decision):
 *   - FINE pointer (desktop, mouse): Fluent's `Dropdown` — a themed, accessible
 *     Listbox popup that matches Warm Obsidian in light + dark.
 *   - COARSE pointer (touch / phones): the NATIVE `<select>`, so the open list is the
 *     reliable OS picker (the Fluent popup is finicky on touch). The closed trigger is
 *     still themed with Fluent tokens so it reads as the same control.
 *
 * The choice is made from `(pointer: coarse)` via useSyncExternalStore — SSR + first
 * client render assume FINE (desktop themed listbox), so there's no hydration mismatch;
 * a touch device swaps to native right after mount. All call sites are controlled
 * (value/onChange), so the swap never affects form state.
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

// SSR-safe coarse-pointer detection: server snapshot is always `false` (fine pointer →
// themed listbox), so the markup matches on hydration; the client subscribes to the
// media query and a touch device re-renders to the native picker.
function useCoarsePointer(): boolean {
  return React.useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(pointer: coarse)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );
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
  const coarse = useCoarsePointer();

  const emit = (v: string) => {
    if (value === undefined) setInternal(v);
    // emit both the native-event shape (e.target.value) AND Fluent's (data.value)
    onChange?.({ target: { value: v } }, { value: v });
  };

  // TOUCH / coarse pointer → native <select> (reliable OS picker), themed closed trigger.
  if (coarse) {
    const nativeStyle: React.CSSProperties = {
      width: "100%",
      minWidth: 0,
      fontFamily: "inherit",
      fontSize: 14,
      lineHeight: 1.4,
      minHeight: 32,
      padding: "5px 10px",
      borderRadius: tokens.borderRadiusMedium,
      border: `1px solid ${tokens.colorNeutralStroke1}`,
      background: tokens.colorNeutralBackground1,
      color: tokens.colorNeutralForeground1,
      ...style,
    };
    return (
      <select
        id={id}
        name={name}
        aria-label={ariaLabel}
        disabled={disabled}
        {...(value !== undefined ? { value: current } : { defaultValue: defaultValue ?? opts[0]?.value ?? "" })}
        onChange={(ev) => emit(ev.target.value)}
        style={nativeStyle}
      >
        {opts.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.text}
          </option>
        ))}
      </select>
    );
  }

  // FINE pointer (desktop) → Fluent Dropdown (themed Listbox popup).
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
      onOptionSelect={(_, d) => emit(d.optionValue ?? "")}
    >
      {opts.map((o) => (
        <Option key={o.value} value={o.value} text={o.text} disabled={o.disabled}>
          {o.label}
        </Option>
      ))}
    </Dropdown>
  );
}
