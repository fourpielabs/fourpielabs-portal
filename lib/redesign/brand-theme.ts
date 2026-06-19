/**
 * 4Pie Labs — REDESIGN brand theme (Fluent UI v9).
 *
 * Generated via createLightTheme/createDarkTheme from a single amber brand ramp
 * (the Theme Designer approach), then narrowly overridden for two reasons:
 *
 *  1. WARMTH — Fluent's stock neutrals are cool greys. The 4Pie palette is warm
 *     (ivory / umber / charcoal), so the neutral surface + stroke + text tokens
 *     that components actually paint with (Card, Input, Field, Badge, Divider…)
 *     are re-pointed at warm equivalents. Everything else is left to Fluent.
 *
 *  2. AA ON THE ACCENT — white text on the *bright* brand amber (#d97706) is only
 *     3.19:1 and FAILS WCAG AA. So the *interactive* amber differs by mode:
 *       · light: brand[80] = #b45309 (amber-700) as the button/link fill → white
 *         text is 7.0:1. (This mirrors the live app, which already darkened its
 *         CTA to #b45309 for exactly this reason.)
 *       · dark:  the bright #d97706 fill is kept for pop on obsidian, but its
 *         on-brand text is flipped to charcoal #1a1410 → 5.48:1.
 *     The bright #d97706 / #f59e0b live in GLINTS, GRADIENTS and the hero — never
 *     as a white-text background.
 *
 * This module is pure data + the two Fluent factory calls (no React); it is only
 * ever imported from the client FluentProvider wrapper.
 */
import {
  createLightTheme,
  createDarkTheme,
  type BrandVariants,
  type Theme,
} from "@fluentui/react-components";

/**
 * Amber brand ramp (Fluent 16 stops, darkest→lightest). Anchored on the existing
 * Tailwind amber scale so the redesign stays recognisably 4Pie:
 *   80  = #b45309 (amber-700)  → the AA-safe interactive amber (white text 7:1)
 *   100 = #d97706 (amber-600)  → the decorative brand hue (hero, glints, dark CTA)
 *   120 = #f59e0b (amber-500)  → the "ember" highlight
 */
export const amberBrandRamp: BrandVariants = {
  10: "#2a0f02",
  20: "#451a03",
  30: "#5c2606",
  40: "#78350f",
  50: "#85400f",
  60: "#92400e",
  70: "#a34a0a",
  80: "#b45309",
  90: "#c8650a",
  100: "#d97706",
  110: "#ea8b07",
  120: "#f59e0b",
  130: "#fbbf24",
  140: "#fcd34d",
  150: "#fde68a",
  160: "#fef3c7",
};

/** Raw brand hexes referenced by the glass + hero layers (kept in sync here). */
export const brandHex = {
  ember: "#f59e0b",
  accent: "#d97706",
  accentDeep: "#b45309",
  ink: "#1a1410",
  inkOnDark: "#f3efe7",
  obsidian: "#1c1813",
  ivory: "#fcfbf7",
} as const;

// --- LIGHT -------------------------------------------------------------------
const baseLight = createLightTheme(amberBrandRamp);

export const redesignLightTheme: Theme = {
  ...baseLight,
  // warm neutral surfaces (components paint with these)
  colorNeutralBackground1: "#ffffff", // cards, inputs, popovers
  colorNeutralBackground1Hover: "#fbf9f4",
  colorNeutralBackground1Pressed: "#f3f0e9",
  colorNeutralBackground2: "#f7f5f0", // subtle fills
  colorNeutralBackground3: "#f1efe8",
  colorNeutralBackgroundDisabled: "#f3f1ea",
  // warm strokes
  colorNeutralStroke1: "#e2dfd8",
  colorNeutralStroke2: "#ece9e2",
  colorNeutralStroke3: "#f1efe8",
  colorNeutralStrokeAccessible: "#6f6c66", // AA 4.5:1 on white — focus/strong dividers
  // warm text (already AA; nudged warm)
  colorNeutralForeground1: "#18181b",
  colorNeutralForeground2: "#44413c",
  colorNeutralForeground3: "#6f6c66", // AA 4.5:1 on #ffffff and #f7f5f0
  // amber links/foreground at the AA-safe deep stop
  colorBrandForeground1: "#b45309",
  colorBrandForeground2: "#92400e",
  colorBrandForegroundLink: "#b45309",
  colorBrandForegroundLinkHover: "#92400e",
  colorCompoundBrandForeground1: "#b45309",
  colorCompoundBrandForeground1Hover: "#92400e",
  colorCompoundBrandStroke: "#b45309",
  // ring
  colorStrokeFocus2: "#b45309",
};

// --- DARK --------------------------------------------------------------------
const baseDark = createDarkTheme(amberBrandRamp);

export const redesignDarkTheme: Theme = {
  ...baseDark,
  // warm obsidian surfaces
  colorNeutralBackground1: "#1c1813", // cards, inputs on dark
  colorNeutralBackground1Hover: "#241f18",
  colorNeutralBackground1Pressed: "#2b261d",
  colorNeutralBackground2: "#16120d",
  colorNeutralBackground3: "#241f18",
  colorNeutralBackgroundDisabled: "#201b15",
  // warm strokes
  colorNeutralStroke1: "#37322a",
  colorNeutralStroke2: "#2c2820",
  colorNeutralStroke3: "#231f19",
  colorNeutralStrokeAccessible: "#a8a29a",
  // warm off-white text (AA on obsidian)
  colorNeutralForeground1: "#f3efe7", // 12:1 on #1c1813
  colorNeutralForeground2: "#d8d2c7",
  colorNeutralForeground3: "#b3aca0", // AA 7.6:1 on #1c1813
  // bright amber CTA on dark, but with CHARCOAL on-brand text (5.48:1)
  colorBrandBackground: "#d97706",
  colorBrandBackgroundHover: "#ea8b07",
  colorBrandBackgroundPressed: "#b45309",
  colorBrandBackgroundSelected: "#c8650a",
  colorNeutralForegroundOnBrand: "#1a1410",
  // amber text/links on dark use the bright, AA-safe-on-dark stops
  colorBrandForeground1: "#fbbf24", // 9.6:1 on #1c1813
  colorBrandForeground2: "#fcd34d",
  colorBrandForegroundLink: "#fbbf24",
  colorBrandForegroundLinkHover: "#fcd34d",
  colorCompoundBrandForeground1: "#fbbf24",
  colorCompoundBrandForeground1Hover: "#fcd34d",
  colorCompoundBrandStroke: "#f59e0b",
  colorStrokeFocus2: "#fbbf24",
};

export type RedesignMode = "light" | "dark";
