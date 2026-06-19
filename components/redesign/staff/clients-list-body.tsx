"use client";

import * as React from "react";
import { ArrowRight, Users } from "lucide-react";

import { labelOf, PROGRAMS } from "@/lib/constants";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Button, StatusPill } from "@/components/redesign/ui";
import { useRedesignMode } from "@/components/redesign/themed-fluent";
import { StaffPageFrame, StaffPageHeader, EmptyPanel, usePanel } from "./ui";

/**
 * R3 staff clients list (re-skin of app/(portal)/clients/page.tsx). Presentation only —
 * the page.tsx server component keeps all data fetching, RLS-scoped reads, and the
 * per-client progress computation; this body just renders the serialisable rows.
 *
 * Desktop → the mode-aware SOLID Th/Td table idiom (sticky header, warm dividers, no
 * glass). Mobile → SOLID link cards (mirrors the old responsive split). Program clients
 * get an amber pill, project clients a neutral pill; status → StatusPill.
 */
export type ClientRow = {
  id: string;
  name: string;
  slug: string;
  program: string;
  client_type: string | null;
  status: string;
  logo_url: string | null;
  /** Precomputed in page.tsx: project clients → project count/active; program → checklist "done/total". */
  progress: string;
};

export function ClientsListBody({
  clients,
  isAdmin,
}: {
  clients: ClientRow[];
  isAdmin: boolean;
}) {
  const { mode } = useRedesignMode();
  const { panel, fg1, fg2, fg3, onDark, border } = usePanel();
  const isEmpty = clients.length === 0;

  const newClientBtn = (
    <Button as="a" href="/clients/new" appearance="primary">
      New client
    </Button>
  );

  // amber pill (program) / neutral pill (project)
  const programPill: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    fontSize: "0.72rem",
    fontWeight: 600,
    lineHeight: 1,
    padding: "0.3rem 0.6rem",
    borderRadius: 999,
    whiteSpace: "nowrap",
    background: onDark ? "rgba(245,158,11,0.16)" : "#fef3c7",
    color: onDark ? "#fcd34d" : "#92400e",
    border: `1px solid ${onDark ? "rgba(245,158,11,0.34)" : "#fde68a"}`,
  };
  const projectPill: React.CSSProperties = {
    ...programPill,
    background: onDark ? "rgba(255,255,255,0.08)" : "#f1efe8",
    color: onDark ? "#cdc6ba" : "#57534e",
    border: `1px solid ${onDark ? "rgba(255,255,255,0.16)" : "#e2dfd8"}`,
  };
  const kindPill = (c: ClientRow) =>
    c.client_type === "project" ? (
      <span style={projectPill}>Project</span>
    ) : (
      <span style={programPill}>{labelOf(PROGRAMS, c.program)}</span>
    );

  return (
    <StaffPageFrame max="75rem">
      <StaffPageHeader
        title="Clients"
        description={isAdmin ? "All clients." : "Clients you're assigned to."}
        actions={isAdmin ? newClientBtn : undefined}
      />

      {isEmpty ? (
        <EmptyPanel
          icon={<Users size={22} />}
          title={isAdmin ? "No clients yet" : "No assigned clients yet"}
          description={
            isAdmin
              ? "Create your first client to get started."
              : "Once you're assigned to a client, they'll appear here."
          }
          action={isAdmin ? newClientBtn : undefined}
        />
      ) : (
        <>
          {/* desktop: SOLID Th/Td table */}
          <div className="rd-clients-table">
            <div className={panel} style={{ borderRadius: 20, padding: 0, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 720 }}>
                  <thead>
                    <tr>
                      <Th sticky bg={onDark ? "#1c1813" : "#ffffff"} fg={fg3}>Client</Th>
                      <Th fg={fg3}>Program</Th>
                      <Th fg={fg3}>Status</Th>
                      <Th fg={fg3}>Progress</Th>
                      <Th align="right" fg={fg3}>Manage</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((c, idx) => {
                      const bd = idx === 0 ? undefined : border;
                      return (
                        <tr key={c.id}>
                          <Td sticky bg={onDark ? "#1c1813" : "#ffffff"} fg={fg1} border={bd}>
                            <a
                              href={`/clients/${c.id}`}
                              className="rd-focus"
                              style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit" }}
                            >
                              <PersonAvatar name={c.name} src={c.logo_url} square size="md" className="shrink-0" />
                              <span style={{ minWidth: 0 }}>
                                <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600, color: fg1 }}>{c.name}</span>
                                <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.78rem", color: fg3 }}>{c.slug}</span>
                              </span>
                            </a>
                          </Td>
                          <Td fg={fg1} border={bd}>{kindPill(c)}</Td>
                          <Td fg={fg1} border={bd}><StatusPill value={c.status} mode={mode} /></Td>
                          <Td fg={fg2} border={bd} style={{ fontVariantNumeric: "tabular-nums" }}>{c.progress}</Td>
                          <Td align="right" fg={fg1} border={bd}>
                            <span style={{ display: "inline-flex", justifyContent: "flex-end", gap: 4, whiteSpace: "nowrap" }}>
                              <Button as="a" href={`/clients/${c.id}`} appearance="subtle" size="small">Open</Button>
                              {isAdmin && (
                                <Button as="a" href={`/clients/${c.id}/settings`} appearance="subtle" size="small">Settings</Button>
                              )}
                            </span>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* mobile: SOLID cards */}
          <div className="rd-clients-cards">
            {clients.map((c) => (
              <a
                key={c.id}
                href={`/clients/${c.id}`}
                className={`${panel} rd-focus`}
                style={{ display: "flex", flexDirection: "column", gap: 12, borderRadius: 18, padding: "1rem 1.1rem", textDecoration: "none", color: "inherit" }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <PersonAvatar name={c.name} src={c.logo_url} square size="lg" className="shrink-0" />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600, color: fg1 }}>{c.name}</div>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.78rem", color: fg3 }}>{c.slug}</div>
                  </div>
                  <ArrowRight size={16} style={{ flexShrink: 0, color: fg3 }} />
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                  {kindPill(c)}
                  <StatusPill value={c.status} mode={mode} />
                  <span style={{ fontSize: "0.78rem", color: fg3, fontVariantNumeric: "tabular-nums" }}>
                    {c.client_type === "project" ? c.progress : `Checklist ${c.progress}`}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </>
      )}

      <style>{`
        .rd-clients-table{display:none;}
        .rd-clients-cards{display:grid;gap:1rem;grid-template-columns:1fr;}
        @media(min-width:640px){
          .rd-clients-table{display:block;}
          .rd-clients-cards{display:none;}
        }
      `}</style>
    </StaffPageFrame>
  );
}

/* --- mode-aware table primitives (mirrors metrics-charts.tsx Th/Td) --- */

function Th({
  children,
  align = "left",
  sticky,
  bg,
  fg,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  sticky?: boolean;
  bg?: string;
  fg: string;
}) {
  return (
    <th
      className="rd-eyebrow"
      style={{
        textAlign: align,
        padding: "0.6rem 1rem",
        color: fg,
        fontSize: "0.62rem",
        whiteSpace: "nowrap",
        position: sticky ? "sticky" : undefined,
        left: sticky ? 0 : undefined,
        background: sticky ? bg : undefined,
        zIndex: sticky ? 1 : undefined,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  sticky,
  bg,
  fg,
  border,
  style,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  sticky?: boolean;
  bg?: string;
  fg: string;
  border?: string;
  style?: React.CSSProperties;
}) {
  return (
    <td
      style={{
        textAlign: align,
        padding: "0.7rem 1rem",
        fontSize: "0.85rem",
        color: fg,
        borderTop: border ? `1px solid ${border}` : undefined,
        position: sticky ? "sticky" : undefined,
        left: sticky ? 0 : undefined,
        background: sticky ? bg : undefined,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </td>
  );
}
