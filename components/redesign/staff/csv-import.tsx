"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";

import { commitCsvAction } from "@/lib/actions/metrics";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Button, EmberButton } from "@/components/redesign/ui";
import { usePanel } from "./ui";

type DefLite = { key: string; unit: "number" | "currency" | "percent" | "text" };
type Row = { line: number; metric_key: string; period: string; value: string };

// CSV parse + validation (verbatim from the old csv-import — logic untouched).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = ""; let row: string[] = []; let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

const periodRe = /^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/;

/** R3 CSV import (re-skinned). Template + parse + preview + per-row errors + commit verbatim. */
export function CsvImport({ clientId, defs, currentMonth }: { clientId: string; defs: DefLite[]; currentMonth: string }) {
  const router = useRouter();
  const { fg1, fg3, onDark, border } = usePanel();
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const unitByKey = new Map(defs.map((d) => [d.key, d.unit]));

  function downloadTemplate() {
    const lines = ["metric_key,period,value"];
    for (const d of defs) lines.push(`${d.key},${currentMonth},`);
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "metrics-template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function handleFile(file: File | null) {
    setRows(null); setHeaderError(null); setFileName(file?.name ?? null);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result ?? ""));
      if (parsed.length < 1) return setHeaderError("File is empty.");
      const header = parsed[0].map((h) => h.trim().toLowerCase());
      const ki = header.indexOf("metric_key"), pi = header.indexOf("period"), vi = header.indexOf("value");
      if (ki < 0 || pi < 0 || vi < 0) return setHeaderError("Header must include columns: metric_key, period, value.");
      const out: Row[] = [];
      for (let r = 1; r < parsed.length; r++) {
        out.push({ line: r + 1, metric_key: (parsed[r][ki] ?? "").trim(), period: (parsed[r][pi] ?? "").trim(), value: (parsed[r][vi] ?? "").trim() });
      }
      setRows(out);
    };
    reader.readAsText(file);
  }

  function rowError(r: Row): string | null {
    const unit = unitByKey.get(r.metric_key);
    if (!unit) return `Unknown metric_key "${r.metric_key}"`;
    if (!periodRe.test(r.period)) return `Bad period "${r.period}" (use YYYY-MM)`;
    if (unit !== "text" && r.value !== "" && Number.isNaN(Number(r.value))) return `Value "${r.value}" must be numeric`;
    return null;
  }

  async function commit() {
    if (!rows) return;
    setCommitting(true);
    const res = await commitCsvAction(clientId, rows);
    setCommitting(false);
    if (!res.ok) return toast.error("Import failed", { description: res.error });
    if (res.errors.length === 0) toast.success(`Imported ${res.committed} rows.`);
    else toast.warning(`Imported ${res.committed} rows; ${res.errors.length} skipped (see preview).`);
    setFileName(null); setRows(null); router.refresh();
  }

  const validCount = rows?.filter((r) => !rowError(r)).length ?? 0;
  const th: React.CSSProperties = { textAlign: "left", padding: "0.5rem 0.6rem", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: fg3, borderBottom: `1px solid ${border}`, whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "0.45rem 0.6rem", fontSize: 12, fontFamily: "var(--font-mono, monospace)", color: fg1, borderBottom: `1px solid ${border}` };
  const okPill = onDark ? { bg: "rgba(34,197,94,0.16)", fg: "#86efac" } : { bg: "#dcfce7", fg: "#166534" };
  const errPill = onDark ? { bg: "rgba(239,68,68,0.16)", fg: "#fca5a5" } : { bg: "#fbeae3", fg: "#b23a1e" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <Button appearance="outline" size="small" icon={<Download size={14} />} onClick={downloadTemplate}>Download template</Button>
      </div>
      <FileDropzone onFile={handleFile} accept=".csv,text/csv" selectedName={fileName} hint="CSV with columns: metric_key, period (YYYY-MM), value" />
      <p style={{ margin: 0, fontSize: 12, color: fg3 }}>
        Long format: one row per metric per month. Columns: <code>metric_key</code>, <code>period</code> (YYYY-MM), <code>value</code>. Re-importing a month updates existing values (no duplicates).
      </p>

      {headerError && <p style={{ margin: 0, fontSize: 13, color: "#dc2626" }}>{headerError}</p>}

      {rows && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ overflowX: "auto", borderRadius: 12, border: `1px solid ${border}` }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr><th style={th}>Line</th><th style={th}>metric_key</th><th style={th}>period</th><th style={th}>value</th><th style={th}>Status</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const err = rowError(r);
                  const p = err ? errPill : okPill;
                  return (
                    <tr key={r.line} style={err ? { background: onDark ? "rgba(239,68,68,0.08)" : "#fdf2ee" } : undefined}>
                      <td style={{ ...td, color: fg3 }}>{r.line}</td>
                      <td style={td}>{r.metric_key}</td>
                      <td style={td}>{r.period}</td>
                      <td style={td}>{r.value}</td>
                      <td style={td}>
                        <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "0.15rem 0.5rem", fontSize: 11, fontWeight: 600, background: p.bg, color: p.fg }}>{err ?? "OK"}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <EmberButton onClick={commit} loading={committing} disabled={committing || validCount === 0} icon={<Upload size={16} />}>
            {committing ? "Importing…" : `Commit ${validCount} valid row${validCount === 1 ? "" : "s"}`}
          </EmberButton>
        </div>
      )}
    </div>
  );
}
