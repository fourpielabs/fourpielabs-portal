"use client";

import Link from "next/link";
import { ArrowRight, FileText, Users } from "lucide-react";
import { Button, EmberButton, StatusPill, Eyebrow, tokens } from "@/components/redesign/ui";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { StaffPageFrame, usePanel, EmptyPanel } from "./ui";

export type StaffHomeData = {
  firstName: string;
  isAdmin: boolean;
  usersTotal: number;
  pendingInvites: number;
  lastAuditLabel: string | null;
  clients: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    isProject: boolean;
    programLabel: string;
    status: string;
    meta: string | null;
    activity: string;
  }[];
};

/**
 * R-fix: the staff/admin home, converted onto the mode-aware redesign system (was the only
 * staff body still on light-only Tailwind, so toggling dark recoloured the sidebar but not
 * this page). SOLID cards inside StaffPageFrame's ambient field — presentation only; the
 * server page keeps all data fetching + role logic.
 */
export function StaffHomeBody({ data }: { data: StaffHomeData }) {
  const { panel, fg1, fg3, onDark, mode } = usePanel();
  const { isAdmin } = data;

  const statCard = (icon: React.ReactNode, title: string, sub: string, href: string, cta: string) => (
    <div className={panel} style={{ borderRadius: 18, padding: "1.1rem 1.2rem", display: "flex", alignItems: "center", gap: 14 }}>
      <span style={{ display: "inline-flex", flexShrink: 0, width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14, background: onDark ? "rgba(245,158,11,0.16)" : "#fef3c7", color: "#b45309" }}>{icon}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: "0.95rem", fontWeight: 600, color: fg1 }}>{title}</div>
        <div style={{ fontSize: "0.78rem", color: fg3, fontVariantNumeric: "tabular-nums" }}>{sub}</div>
      </div>
      <Button as="a" href={href} appearance="outline" size="small">{cta}</Button>
    </div>
  );

  return (
    <StaffPageFrame max="75rem">
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        <Eyebrow tone={onDark ? "onDark" : "amber"}>4Pie Labs workspace</Eyebrow>
        <h1 className="rd-display" style={{ margin: 0, fontSize: "clamp(1.75rem,4vw,2.4rem)", fontWeight: 600, lineHeight: 1.04, color: fg1 }}>
          Welcome, {data.firstName}
        </h1>
        <p style={{ margin: 0, fontSize: "0.9rem", color: fg3 }}>Pick a client to get started.</p>
      </div>

      {isAdmin && (
        <div className="rd-home-stats">
          {statCard(<Users size={20} />, "Users", `${data.usersTotal} total${data.pendingInvites > 0 ? ` · ${data.pendingInvites} pending invite${data.pendingInvites === 1 ? "" : "s"}` : ""}`, "/admin/users", "Manage")}
          {statCard(<FileText size={20} />, "Audit log", data.lastAuditLabel ?? "No events yet", "/admin/audit", "View")}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <h2 className="rd-eyebrow" style={{ margin: 0, color: fg3 }}>{isAdmin ? "All clients" : "Your clients"}</h2>
        {data.clients.length === 0 ? (
          <EmptyPanel
            icon={<Users size={22} />}
            title={isAdmin ? "No clients yet" : "No assigned clients yet"}
            description={isAdmin ? "Create your first client to get started." : "Once you're assigned to a client, they'll appear here."}
            action={isAdmin ? <EmberButton as="a" href="/clients/new" size="small">New client</EmberButton> : undefined}
          />
        ) : (
          <div className="rd-home-grid rd-stagger">
            {data.clients.map((c) => (
              <Link key={c.id} href={`/clients/${c.id}`} className={`${panel} rd-lift`} style={{ display: "flex", flexDirection: "column", gap: 12, borderRadius: 18, padding: "1.15rem", textDecoration: "none" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <PersonAvatar name={c.name} src={c.logoUrl} square size="lg" className="shrink-0" />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600, color: fg1 }}>{c.name}</div>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: fg3 }}>{c.slug}</div>
                  </div>
                  <ArrowRight size={16} style={{ flexShrink: 0, color: fg3 }} />
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: 999, background: c.isProject ? (onDark ? "rgba(255,255,255,0.08)" : "#f1efe8") : (onDark ? "rgba(245,158,11,0.16)" : "#fef3c7"), color: c.isProject ? fg3 : (onDark ? "#fcd34d" : "#92400e") }}>
                    {c.isProject ? "Project" : c.programLabel}
                  </span>
                  <StatusPill value={c.status} mode={mode} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: fg3, fontVariantNumeric: "tabular-nums" }}>
                  {c.meta && <><span>{c.meta}</span><span>·</span></>}
                  <span>{c.activity}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      <style>{`
        .rd-home-stats { display: grid; gap: 1rem; grid-template-columns: 1fr; }
        @media (min-width: 640px) { .rd-home-stats { grid-template-columns: 1fr 1fr; } }
        .rd-home-grid { display: grid; gap: 1rem; grid-template-columns: 1fr; }
        @media (min-width: 640px) { .rd-home-grid { grid-template-columns: 1fr 1fr; } }
        @media (min-width: 1024px) { .rd-home-grid { grid-template-columns: 1fr 1fr 1fr; } }
      `}</style>
    </StaffPageFrame>
  );
}
