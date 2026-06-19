"use client";

import * as React from "react";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { usePanel, EmptyPanel } from "./ui";

/** One computed audit row, fully shaped by the server page (no fetching here). */
export type AuditRow = {
  id: string;
  time: string;
  actorId: string | null;
  actorName: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  clientId: string | null;
  clientName: string | null;
  metadata: unknown;
};

/** Render metadata as keyed key:value pills (legible vs raw JSON) — mode-aware. */
function MetaPills({ metadata }: { metadata: unknown }) {
  const { fg2, fg3, onDark } = usePanel();
  const entries =
    metadata && typeof metadata === "object"
      ? Object.entries(metadata as Record<string, unknown>)
      : [];
  if (entries.length === 0) return <span style={{ color: fg3 }}>—</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {entries.map(([k, v]) => (
        <span
          key={k}
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            gap: 4,
            borderRadius: 6,
            padding: "0.1rem 0.35rem",
            fontSize: "0.69rem",
            lineHeight: 1.3,
            color: fg2,
            background: onDark ? "rgba(255,255,255,0.06)" : "#f1efe8",
          }}
        >
          <span style={{ color: fg3 }}>{k}:</span>
          <span>{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * R3 admin audit body (re-skin of the table in app/(portal)/admin/audit/page.tsx) — the
 * DENSEST staff surface, so it stays compact + SOLID (glass forbidden). Desktop = the
 * mode-aware Th/Td SOLID table idiom (sticky-free here; warm dividers); mobile = SOLID
 * cards. The action chip links re-run the filter; actor → /admin/users; client →
 * /clients/{id} (admin-only page, so links never leak — same note as the original).
 * Presentation only — the page owns all data fetching + the requireRole guard.
 */
export function AuditBody({
  rows,
  clientFilter,
}: {
  rows: AuditRow[];
  clientFilter?: string;
}) {
  const { panel, fg1, fg2, fg3, brand, onDark, border } = usePanel();
  const divider = onDark ? "#2c2820" : "#f1efe8";
  const headBg = onDark ? "#1c1813" : "#ffffff";

  const actionHref = (a: string) =>
    `/admin/audit?action=${encodeURIComponent(a)}${clientFilter ? `&client=${clientFilter}` : ""}`;

  if (rows.length === 0) {
    return (
      <EmptyPanel
        icon={<Inbox size={22} />}
        title="No audit entries match"
        description="Try clearing the filters."
      />
    );
  }

  // The action chip — a small mono pill that re-runs the filter.
  const actionChip = (action: string) => (
    <Link
      href={actionHref(action)}
      className="rd-focus rd-tnum"
      style={{
        display: "inline-flex",
        borderRadius: 999,
        border: `1px solid ${border}`,
        background: onDark ? "rgba(255,255,255,0.05)" : "#f7f6f2",
        padding: "0.15rem 0.5rem",
        fontSize: "0.69rem",
        fontFamily: "var(--font-mono, ui-monospace, monospace)",
        color: fg2,
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}
    >
      {action}
    </Link>
  );

  const linkStyle: React.CSSProperties = { color: fg1, textDecoration: "none" };

  return (
    <>
      {/* desktop: dense SOLID table */}
      <div
        className={panel}
        style={{ borderRadius: 20, padding: 0, overflow: "hidden", display: "none" }}
        data-audit-desktop
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 880 }}>
            <thead>
              <tr>
                <Th fg={fg3} bg={headBg}>When</Th>
                <Th fg={fg3} bg={headBg}>Actor</Th>
                <Th fg={fg3} bg={headBg}>Action</Th>
                <Th fg={fg3} bg={headBg}>Entity</Th>
                <Th fg={fg3} bg={headBg}>Client</Th>
                <Th fg={fg3} bg={headBg}>Details</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l, idx) => (
                <tr key={l.id}>
                  <Td fg={fg3} border={idx === 0 ? undefined : divider} className="rd-tnum">
                    {l.time}
                  </Td>
                  <Td fg={fg1} border={idx === 0 ? undefined : divider}>
                    {l.actorId ? (
                      <Link href="/admin/users" className="rd-focus" style={linkStyle}>
                        {l.actorName}
                      </Link>
                    ) : (
                      <span style={{ color: fg3 }}>system</span>
                    )}
                  </Td>
                  <Td fg={fg1} border={idx === 0 ? undefined : divider}>
                    {actionChip(l.action)}
                  </Td>
                  <Td fg={fg2} border={idx === 0 ? undefined : divider}>
                    {l.entity ? (
                      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5 }}>
                        <span>{l.entity}</span>
                        {l.entityId && (
                          <span
                            className="rd-tnum"
                            style={{ fontSize: "0.68rem", color: fg3 }}
                            title={l.entityId}
                          >
                            {l.entityId.slice(0, 8)}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span style={{ color: fg3 }}>—</span>
                    )}
                  </Td>
                  <Td fg={fg1} border={idx === 0 ? undefined : divider}>
                    {l.clientId ? (
                      <Link href={`/clients/${l.clientId}`} className="rd-focus" style={linkStyle}>
                        {l.clientName ?? "—"}
                      </Link>
                    ) : (
                      <span style={{ color: fg3 }}>—</span>
                    )}
                  </Td>
                  <Td
                    fg={fg2}
                    border={idx === 0 ? undefined : divider}
                    style={{ maxWidth: "22rem", whiteSpace: "normal" }}
                  >
                    <MetaPills metadata={l.metadata} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* mobile: SOLID cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }} data-audit-mobile>
        {rows.map((l) => (
          <div key={l.id} className={panel} style={{ borderRadius: 16, padding: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              {actionChip(l.action)}
              <span className="rd-tnum" style={{ flexShrink: 0, fontSize: "0.72rem", color: fg3 }}>
                {l.time}
              </span>
            </div>
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.25rem 0.75rem", fontSize: "0.8rem", color: fg3 }}>
              <span>
                by{" "}
                {l.actorId ? (
                  <Link href="/admin/users" className="rd-focus" style={{ color: fg2, textDecoration: "none" }}>
                    {l.actorName}
                  </Link>
                ) : (
                  "system"
                )}
              </span>
              {l.clientId && (
                <Link href={`/clients/${l.clientId}`} className="rd-focus" style={{ color: fg2, textDecoration: "none" }}>
                  {l.clientName ?? "—"}
                </Link>
              )}
              {l.entity && (
                <span style={{ color: fg3 }}>
                  {l.entity}
                  {l.entityId && (
                    <span className="rd-tnum" style={{ marginLeft: 4, color: brand }} title={l.entityId}>
                      {l.entityId.slice(0, 8)}
                    </span>
                  )}
                </span>
              )}
            </div>
            <div style={{ marginTop: 8 }}>
              <MetaPills metadata={l.metadata} />
            </div>
          </div>
        ))}
      </div>

      {/* responsive split: table ≥768px, cards below (mirrors the original md: breakpoint) */}
      <style>{`
        @media (min-width: 768px) {
          [data-audit-desktop] { display: block !important; }
          [data-audit-mobile] { display: none !important; }
        }
      `}</style>
    </>
  );
}

/* --- mode-aware table primitives (mirrors metrics-charts.tsx Th/Td, compact) --- */

function Th({ children, fg, bg }: { children: React.ReactNode; fg: string; bg: string }) {
  return (
    <th
      className="rd-eyebrow"
      style={{
        textAlign: "left",
        padding: "0.55rem 0.85rem",
        color: fg,
        fontSize: "0.6rem",
        whiteSpace: "nowrap",
        background: bg,
        position: "sticky",
        top: 0,
        zIndex: 1,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  fg,
  border,
  style,
  className,
}: {
  children: React.ReactNode;
  fg: string;
  border?: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <td
      className={className}
      style={{
        padding: "0.55rem 0.85rem",
        fontSize: "0.8rem",
        color: fg,
        verticalAlign: "top",
        borderTop: border ? `1px solid ${border}` : undefined,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </td>
  );
}
