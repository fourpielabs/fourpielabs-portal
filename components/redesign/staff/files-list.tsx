"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, FileText } from "lucide-react";

import { setFileVisibilityAction, deleteFileAction } from "@/lib/actions/files";
import { FILE_CATEGORIES, labelOf } from "@/lib/constants";
import { StaffDownloadButton } from "./download-button";
import { usePanel, EmptyPanel, ConfirmDelete, IconButton } from "./ui";

export type FileRow = {
  id: string;
  name: string;
  category: string;
  storage_path: string;
  size_bytes: number | null;
  visible_to_client: boolean;
};

function fmtSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** R3 staff documents list (re-skinned, SOLID rows grouped by category). Wiring verbatim. */
export function FilesList({
  clientId,
  files,
}: {
  clientId: string;
  files: FileRow[];
}) {
  const router = useRouter();
  const { panel, fg1, fg3, onDark, border } = usePanel();
  const [pending, setPending] = useState(false);

  async function run(p: Promise<{ ok: boolean; error?: string }>) {
    setPending(true);
    const res = await p;
    setPending(false);
    if (!res.ok) return toast.error("Action failed", { description: res.error });
    router.refresh();
  }

  if (files.length === 0) {
    return (
      <EmptyPanel
        icon={<FileText size={22} />}
        title="No documents yet"
        description="Upload agreements, invoices, brand assets, and more."
      />
    );
  }

  const categories = FILE_CATEGORIES.map((c) => c.value).filter((cat) =>
    files.some((f) => f.category === cat),
  );

  const pillBase: React.CSSProperties = { fontSize: 10, fontWeight: 700, padding: "0.15rem 0.45rem", borderRadius: 999, whiteSpace: "nowrap" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {categories.map((cat) => (
        <div key={cat} style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <h3 style={{ margin: 0, fontSize: "0.85rem", fontWeight: 600, color: fg3 }}>
            {labelOf(FILE_CATEGORIES, cat)}
          </h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {files
              .filter((f) => f.category === cat)
              .map((f) => (
                <li
                  key={f.id}
                  className={panel}
                  style={{ borderRadius: 18, padding: "0.85rem 1.1rem", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600, color: fg1 }}>{f.name}</span>
                      {!f.visible_to_client && <span style={{ ...pillBase, background: "transparent", color: fg3, border: `1px solid ${border}` }}>hidden</span>}
                    </div>
                    {f.size_bytes && <span style={{ display: "block", paddingTop: "0.2rem", fontSize: 12, color: fg3, fontVariantNumeric: "tabular-nums" }}>{fmtSize(f.size_bytes)}</span>}
                  </div>
                  <div style={{ display: "flex", flexShrink: 0, alignItems: "center", gap: 4 }}>
                    <StaffDownloadButton clientId={clientId} path={f.storage_path} />
                    <IconButton
                      label="Toggle visibility"
                      disabled={pending}
                      onClick={() => run(setFileVisibilityAction(clientId, f.id, !f.visible_to_client))}
                    >
                      {f.visible_to_client ? <Eye size={16} /> : <EyeOff size={16} />}
                    </IconButton>
                    <ConfirmDelete
                      title="Delete file?"
                      description={`“${f.name}” will be removed from storage.`}
                      onConfirm={() => run(deleteFileAction(clientId, f.id))}
                    />
                  </div>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
