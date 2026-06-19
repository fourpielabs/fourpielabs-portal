"use client";

import { FileUpload } from "./file-upload";
import { FilesList } from "./files-list";
import { usePanel } from "./ui";

// Re-export the row type so the page keeps one import shape.
export type { FileRow } from "./files-list";
import type { FileRow } from "./files-list";

/**
 * R3 staff Files tab body — a SOLID titled panel (re-skinning the old Card/CardHeader
 * upload wrapper) holding the document upload form, then a "Documents" heading + the
 * files list. Rendered inside the workspace chrome's FluentScope, so it just renders
 * content. All wiring lives in the children (upload + visibility/delete actions, verbatim).
 */
export function FilesBody({
  clientId,
  files,
}: {
  clientId: string;
  files: FileRow[];
}) {
  const { panel, fg1, fg3 } = usePanel();

  const title: React.CSSProperties = { margin: 0, fontSize: "1.1rem", fontWeight: 600, color: fg1 };
  const desc: React.CSSProperties = { margin: "0.25rem 0 0", fontSize: "0.9rem", color: fg3 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <section className={panel} style={{ borderRadius: 20, padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div>
          <h2 className="rd-display" style={title}>Upload a document</h2>
          <p style={desc}>Files stay private unless &ldquo;Visible to client&rdquo; is on. Downloads are short-lived signed links.</p>
        </div>
        <FileUpload clientId={clientId} />
      </section>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h2 className="rd-display" style={{ margin: 0, fontSize: "1.15rem", fontWeight: 600, color: fg1 }}>Documents</h2>
        <FilesList clientId={clientId} files={files} />
      </div>
    </div>
  );
}
