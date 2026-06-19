"use client";

import { MessageSquare } from "lucide-react";
import { tokens } from "@/components/redesign/ui";
import { useRedesignMode } from "@/components/redesign/themed-fluent";
import { ClientPageFrame } from "@/components/redesign/client/page-frame";

export function MessagesEmpty() {
  const { mode } = useRedesignMode();
  const onDark = mode === "dark";
  return (
    <ClientPageFrame width="standard">
      <div className={onDark ? "rd-solid--dark" : "rd-solid"} style={{ borderRadius: 20, padding: "3rem 2rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", marginTop: "1rem" }}>
        <span style={{ display: "grid", placeItems: "center", width: 48, height: 48, borderRadius: 14, background: onDark ? "rgba(245,158,11,0.14)" : "#fef3c7", color: "#b45309" }}><MessageSquare size={22} /></span>
        <div className="rd-display" style={{ fontSize: "1.25rem", fontWeight: 600, color: tokens.colorNeutralForeground1 }}>No conversation yet</div>
        <p style={{ margin: 0, fontSize: "0.9rem", color: tokens.colorNeutralForeground3 }}>Your message thread will appear here.</p>
      </div>
    </ClientPageFrame>
  );
}
