"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, Lock } from "lucide-react";
import { tokens } from "@/components/redesign/ui";
import { useRedesignMode } from "@/components/redesign/themed-fluent";
import { Conversation } from "@/components/redesign/client/conversation";
import type { ThreadMessage } from "@/lib/actions/messages";
import type { TaskMember } from "@/lib/tasks";

/**
 * R3 staff DUAL-THREAD messaging body — restyle only. The internal-thread BOUNDARY is
 * unchanged: the page (requireClientAccess → staff/admin only) decides which threads
 * exist and which is active; RLS gates the internal thread; the bare Conversation
 * renders only the active thread it's handed and runs RLS-scoped actions. Nothing here
 * widens visibility. The Client/Internal split keeps the unmissable who-can-see treatment.
 */
export function StaffMessages({
  clientId, activeId, isInternal, hasActive, me, members, initialMessages,
}: {
  clientId: string;
  activeId: string | null;
  isInternal: boolean;
  hasActive: boolean;
  me: { id: string; name: string };
  members: TaskMember[];
  initialMessages: ThreadMessage[];
}) {
  const { mode } = useRedesignMode();
  const onDark = mode === "dark";
  const fg3 = tokens.colorNeutralForeground3;
  const base = `/clients/${clientId}/messages`;

  const tab = (active: boolean, internalTab: boolean): React.CSSProperties => {
    const amber = { on: { bg: onDark ? "rgba(245,158,11,0.2)" : "#fef3c7", bd: onDark ? "rgba(245,158,11,0.5)" : "#fcd34d", fg: onDark ? "#fcd34d" : "#92400e" }, off: { bg: onDark ? "rgba(245,158,11,0.08)" : "#fffaf0", bd: onDark ? "rgba(245,158,11,0.25)" : "#fde68a", fg: onDark ? "#fbbf24" : "#9a3412" } };
    const emerald = { on: { bg: onDark ? "rgba(34,197,94,0.2)" : "#dcfce7", bd: onDark ? "rgba(34,197,94,0.5)" : "#86efac", fg: onDark ? "#86efac" : "#166534" }, off: { bg: onDark ? "rgba(34,197,94,0.08)" : "#ecfdf5", bd: onDark ? "rgba(34,197,94,0.25)" : "#a7f3d0", fg: onDark ? "#6ee7b7" : "#15803d" } };
    const p = (internalTab ? amber : emerald)[active ? "on" : "off"];
    return { display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, border: `1px solid ${p.bd}`, background: p.bg, color: p.fg, padding: "0.4rem 0.85rem", fontSize: "0.82rem", fontWeight: 600, textDecoration: "none" };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <Link href={base} className="rd-focus" style={tab(!isInternal, false)}><Eye size={15} /> Client thread</Link>
        <Link href={`${base}?tab=internal`} className="rd-focus" style={tab(isInternal, true)}><Lock size={15} /> Internal</Link>
        <span style={{ marginLeft: 4, fontSize: "0.76rem", color: fg3 }}>
          {isInternal ? "Staff-only — the client cannot see this thread." : "Shared with the client."}
        </span>
      </div>

      {hasActive && activeId ? (
        <Conversation
          key={activeId}
          bare
          threadId={activeId}
          notifLink={isInternal ? `${base}?tab=internal` : base}
          currentUserId={me.id}
          currentUserName={me.name}
          initialMessages={initialMessages}
          audience={isInternal ? "internal" : "shared"}
          taskContext={{ role: "staff", clientId, members }}
        />
      ) : (
        <p style={{ fontSize: "0.88rem", color: fg3 }}>Thread not found.</p>
      )}
    </div>
  );
}
