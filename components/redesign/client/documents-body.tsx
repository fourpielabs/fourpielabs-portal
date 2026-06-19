"use client";

import * as React from "react";
import { FileText } from "lucide-react";
import { Eyebrow, tokens } from "@/components/redesign/ui";
import { useRedesignMode } from "@/components/redesign/themed-fluent";
import { ClientPageFrame } from "@/components/redesign/client/page-frame";
import { DownloadButton } from "@/components/redesign/client/download-button";

export type DocCategory = { label: string; files: { id: string; name: string; size: string | null; path: string }[] };

/** R2 client documents — categorized SOLID lists + signed-URL downloads (getSignedUrlAction
 *  preserved). Both client types. */
export function DocumentsBody({ categories, clientId }: { categories: DocCategory[]; clientId: string }) {
  const { mode } = useRedesignMode();
  const onDark = mode === "dark";
  const fg1 = tokens.colorNeutralForeground1, fg3 = tokens.colorNeutralForeground3;
  const panel = onDark ? "rd-solid--dark" : "rd-solid";
  const divider = onDark ? "#231f19" : "#f1efe8";
  const empty = categories.every((c) => c.files.length === 0);

  return (
    <ClientPageFrame width="standard">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", paddingBlock: "clamp(0.5rem,2vw,1rem)" }}>
        <div className="rd-rise" style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <Eyebrow tone={onDark ? "onDark" : "amber"}>Documents</Eyebrow>
          <h1 className="rd-display" style={{ margin: 0, fontSize: "clamp(1.9rem,5vw,2.6rem)", fontWeight: 600, lineHeight: 1.02, color: fg1 }}>
            Your agreements, forms &amp; files.
          </h1>
        </div>
        {empty ? (
          <div className={panel} style={{ borderRadius: 20, padding: "3rem 2rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ display: "grid", placeItems: "center", width: 48, height: 48, borderRadius: 14, background: onDark ? "rgba(245,158,11,0.14)" : "#fef3c7", color: "#b45309" }}><FileText size={22} /></span>
            <div className="rd-display" style={{ fontSize: "1.25rem", fontWeight: 600, color: fg1 }}>No documents yet</div>
            <p style={{ margin: 0, fontSize: "0.9rem", color: fg3 }}>Your agreements, forms, and shared files will appear here.</p>
          </div>
        ) : (
          categories.filter((c) => c.files.length > 0).map((cat) => (
            <div key={cat.label} className="rd-rise" style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <Eyebrow tone="muted">{cat.label}</Eyebrow>
              <ul className={panel} style={{ listStyle: "none", margin: 0, padding: 0, borderRadius: 18, overflow: "hidden" }}>
                {cat.files.map((f, i) => (
                  <li key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0.85rem 1.1rem", borderTop: i === 0 ? "none" : `1px solid ${divider}` }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "0.9rem", fontWeight: 500, color: fg1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                      {f.size && <div style={{ fontSize: "0.74rem", color: fg3 }}>{f.size}</div>}
                    </div>
                    <DownloadButton clientId={clientId} path={f.path} />
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </ClientPageFrame>
  );
}
