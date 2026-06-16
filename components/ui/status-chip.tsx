import * as React from "react";
import { Check, Clock, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

// Recipe = [text, bg, border, dot]; dot null when an icon/solid is used instead.
type Recipe = {
  label: string;
  text: string;
  bg: string;
  border: string;
  dot?: string | null;
  icon?: "check" | "clock" | "eye-off" | "tri";
  dashed?: boolean;
};

const G = "#57534E", N_BG = "#F4F4F0", N_BD = "#E7E5E0", N_DOT = "#8E8B84";

export const STATUS_MAP: Record<string, Record<string, Recipe>> = {
  deliverable: {
    pending: { label: "Pending", text: G, bg: N_BG, border: N_BD, dot: N_DOT },
    in_progress: { label: "In progress", text: "#92400E", bg: "#FEF3C7", border: "#FDE68A", dot: "#D97706" },
    needs_review: { label: "Needs review", text: "#1D4ED8", bg: "#DBEAFE", border: "#BFDBFE", dot: "#2563EB" },
    delivered: { label: "Delivered", text: "#166534", bg: "#DCFCE7", border: "#BBF7D0", dot: "#15803D" },
  },
  content: {
    idea: { label: "Idea", text: G, bg: N_BG, border: N_BD, dot: N_DOT },
    drafting: { label: "Drafting", text: "#92400E", bg: "#FFFBEB", border: "#FDE68A", dot: "#F59E0B" },
    in_review: { label: "In review", text: "#1D4ED8", bg: "#DBEAFE", border: "#BFDBFE", dot: "#2563EB" },
    approved: { label: "Approved", text: "#115E59", bg: "#CCFBF1", border: "#99F6E4", dot: "#0D9488" },
    scheduled: { label: "Scheduled", text: "#4338CA", bg: "#E0E7FF", border: "#C7D2FE", dot: "#4F46E5" },
    published: { label: "Published", text: "#166534", bg: "#DCFCE7", border: "#BBF7D0", dot: "#15803D" },
  },
  milestone: {
    upcoming: { label: "Upcoming", text: G, bg: "#FFFFFF", border: "#D6D3CD", dot: null },
    in_progress: { label: "In progress", text: "#92400E", bg: "#FEF3C7", border: "#FDE68A", dot: "#D97706" },
    done: { label: "Done", text: "#FFFFFF", bg: "#B45309", border: "#B45309", icon: "check" },
  },
  client: {
    onboarding: { label: "Onboarding", text: "#92400E", bg: "#FEF3C7", border: "#FDE68A", dot: "#D97706" },
    active: { label: "Active", text: "#166534", bg: "#DCFCE7", border: "#BBF7D0", dot: "#15803D" },
    paused: { label: "Paused", text: G, bg: N_BG, border: N_BD, dot: N_DOT },
    churned: { label: "Churned", text: "#991B1B", bg: "#FEF2F2", border: "#FECACA", dot: "#B91C1C" },
  },
  user: {
    active: { label: "Active", text: "#166534", bg: "#DCFCE7", border: "#BBF7D0", dot: "#15803D" },
    pending: { label: "Pending invite", text: "#92400E", bg: "#FFFFFF", border: "#FBBF24", icon: "clock", dashed: true },
    inactive: { label: "Inactive", text: "#A8A5A0", bg: "#FAFAF8", border: "#E7E5E0", dot: null },
  },
  priority: {
    high: { label: "High", text: "#9A3412", bg: "#FFF7ED", border: "#FED7AA", icon: "tri" },
    medium: { label: "Medium", text: "#92400E", bg: "#FFFBEB", border: "#FDE68A", dot: null },
    low: { label: "Low", text: G, bg: N_BG, border: N_BD, dot: null },
  },
  report: {
    draft: { label: "Draft — hidden from client", text: G, bg: N_BG, border: N_BD, icon: "eye-off" },
    published: { label: "Published", text: "#166534", bg: "#DCFCE7", border: "#BBF7D0", dot: "#15803D" },
  },
  project: {
    proposed: { label: "Proposed", text: G, bg: N_BG, border: N_BD, dot: N_DOT },
    active: { label: "Active", text: "#92400E", bg: "#FEF3C7", border: "#FDE68A", dot: "#D97706" },
    in_review: { label: "In review", text: "#1D4ED8", bg: "#DBEAFE", border: "#BFDBFE", dot: "#2563EB" },
    complete: { label: "Complete", text: "#166534", bg: "#DCFCE7", border: "#BBF7D0", dot: "#15803D" },
  },
  task: {
    todo: { label: "To do", text: G, bg: N_BG, border: N_BD, dot: N_DOT },
    in_progress: { label: "In progress", text: "#92400E", bg: "#FEF3C7", border: "#FDE68A", dot: "#D97706" },
    done: { label: "Done", text: "#166534", bg: "#DCFCE7", border: "#BBF7D0", dot: "#15803D" },
  },
};

export function StatusChip({
  kind,
  value,
  label,
  className,
}: {
  kind: keyof typeof STATUS_MAP;
  value: string;
  label?: string;
  className?: string;
}) {
  const r = STATUS_MAP[kind]?.[value];
  if (!r) {
    return (
      <span className={cn("inline-flex items-center rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-2", className)}>
        {label ?? value}
      </span>
    );
  }
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none whitespace-nowrap", className)}
      style={{
        color: r.text,
        background: r.bg,
        border: `${r.dashed ? "1.5px dashed" : "1px solid"} ${r.border}`,
      }}
    >
      {r.icon === "check" && <Check className="size-3" strokeWidth={3} />}
      {r.icon === "clock" && <Clock className="size-3" />}
      {r.icon === "eye-off" && <EyeOff className="size-3" />}
      {r.icon === "tri" && <span aria-hidden style={{ color: "#C2410C" }}>▲</span>}
      {!r.icon && r.dot && (
        <span className="size-1.5 rounded-full" style={{ background: r.dot }} />
      )}
      {label ?? r.label}
    </span>
  );
}
