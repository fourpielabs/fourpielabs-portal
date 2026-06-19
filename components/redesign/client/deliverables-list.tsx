"use client";

import * as React from "react";
import { ExternalLink, Package } from "lucide-react";
import { Badge, Button, Eyebrow, StatusPill, tokens } from "@/components/redesign/ui";
import { formatDate } from "@/lib/format";
import { labelOf, DELIVERABLE_TYPES } from "@/lib/constants";
import { useRedesignMode } from "@/components/redesign/themed-fluent";
import { ClientPageFrame } from "@/components/redesign/client/page-frame";
import { DeliverableApprove } from "@/components/redesign/client/deliverable-approve";
import { DownloadButton } from "@/components/redesign/client/download-button";

export type DeliverableRow = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  due_date: string | null;
  delivered_at: string | null;
  preview_url: string | null;
  file_path: string | null;
  client_approved_at: string | null;
};

/** R2 client deliverables — SOLID cards (glass forbidden on this dense list). Status is
 *  a READ-ONLY chip; the only client writes are approve + signed-URL download. */
export function DeliverablesList({ deliverables, clientId }: { deliverables: DeliverableRow[]; clientId: string }) {
  const { mode } = useRedesignMode();
  const onDark = mode === "dark";
  const fg1 = tokens.colorNeutralForeground1;
  const fg2 = tokens.colorNeutralForeground2;
  const fg3 = tokens.colorNeutralForeground3;
  const panel = onDark ? "rd-solid--dark" : "rd-solid";

  return (
    <ClientPageFrame width="standard">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", paddingBlock: "clamp(0.5rem,2vw,1rem)" }}>
        <div className="rd-rise" style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <Eyebrow tone={onDark ? "onDark" : "amber"}>Deliverables</Eyebrow>
          <h1 className="rd-display" style={{ margin: 0, fontSize: "clamp(1.9rem,5vw,2.6rem)", fontWeight: 600, lineHeight: 1.02, color: fg1 }}>
            Everything we&apos;re creating for you.
          </h1>
        </div>

        {deliverables.length === 0 ? (
          <div className={panel} style={{ borderRadius: 20, padding: "3rem 2rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ display: "grid", placeItems: "center", width: 48, height: 48, borderRadius: 14, background: onDark ? "rgba(245,158,11,0.14)" : "#fef3c7", color: "#b45309" }}><Package size={22} /></span>
            <div className="rd-display" style={{ fontSize: "1.25rem", fontWeight: 600, color: fg1 }}>Nothing here yet</div>
            <p style={{ margin: 0, fontSize: "0.9rem", color: fg3 }}>Your deliverables will appear here as we ship them.</p>
          </div>
        ) : (
          <ul className="rd-deliv-grid" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {deliverables.map((d, i) => (
              <li key={d.id} className={`${panel} rd-rise`} style={{ borderRadius: 20, padding: "1.3rem", animationDelay: `${i * 45}ms` }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: "0.95rem", fontWeight: 600, color: fg1 }}>{d.title}</span>
                      <Badge appearance="tint" color="informative" size="small">{labelOf(DELIVERABLE_TYPES, d.type)}</Badge>
                    </div>
                    {d.description && <p style={{ margin: "0.35rem 0 0", fontSize: "0.85rem", color: fg2 }}>{d.description}</p>}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: "0.4rem", fontSize: "0.74rem", color: fg3 }}>
                      {d.due_date && <span>Due {formatDate(d.due_date)}</span>}
                      {d.delivered_at && <span>Delivered {formatDate(d.delivered_at)}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                    {/* READ-ONLY status — clients never set deliverable status */}
                    <StatusPill value={d.status} mode={mode} />
                    {(d.status === "needs_review" || d.client_approved_at) && (
                      <DeliverableApprove id={d.id} approved={!!d.client_approved_at} />
                    )}
                    {d.preview_url && (
                      <Button as="a" href={d.preview_url} target="_blank" rel="noreferrer" appearance="outline" size="small" icon={<ExternalLink size={14} />} iconPosition="after">
                        Preview
                      </Button>
                    )}
                    {d.file_path && <DownloadButton clientId={clientId} path={d.file_path} />}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <style>{`.rd-deliv-grid{display:grid;gap:1rem;grid-template-columns:1fr;} @media(min-width:900px){.rd-deliv-grid{grid-template-columns:1fr 1fr;}}`}</style>
    </ClientPageFrame>
  );
}
