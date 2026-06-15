"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";

import { commitCsvAction } from "@/lib/actions/metrics";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/ui/file-dropzone";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type DefLite = { key: string; unit: "number" | "currency" | "percent" | "text" };
type Row = { line: number; metric_key: string; period: string; value: string };

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

const periodRe = /^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/;

export function CsvImport({
  clientId,
  defs,
  currentMonth, // YYYY-MM
}: {
  clientId: string;
  defs: DefLite[];
  currentMonth: string;
}) {
  const router = useRouter();
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
    a.href = url;
    a.download = "metrics-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFile(file: File | null) {
    setRows(null);
    setHeaderError(null);
    setFileName(file?.name ?? null);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result ?? ""));
      if (parsed.length < 1) return setHeaderError("File is empty.");
      const header = parsed[0].map((h) => h.trim().toLowerCase());
      const ki = header.indexOf("metric_key");
      const pi = header.indexOf("period");
      const vi = header.indexOf("value");
      if (ki < 0 || pi < 0 || vi < 0) {
        return setHeaderError(
          'Header must include columns: metric_key, period, value.',
        );
      }
      const out: Row[] = [];
      for (let r = 1; r < parsed.length; r++) {
        out.push({
          line: r + 1,
          metric_key: (parsed[r][ki] ?? "").trim(),
          period: (parsed[r][pi] ?? "").trim(),
          value: (parsed[r][vi] ?? "").trim(),
        });
      }
      setRows(out);
    };
    reader.readAsText(file);
  }

  function rowError(r: Row): string | null {
    const unit = unitByKey.get(r.metric_key);
    if (!unit) return `Unknown metric_key "${r.metric_key}"`;
    if (!periodRe.test(r.period)) return `Bad period "${r.period}" (use YYYY-MM)`;
    if (unit !== "text" && r.value !== "" && Number.isNaN(Number(r.value)))
      return `Value "${r.value}" must be numeric`;
    return null;
  }

  async function commit() {
    if (!rows) return;
    setCommitting(true);
    const res = await commitCsvAction(clientId, rows);
    setCommitting(false);
    if (!res.ok) return toast.error("Import failed", { description: res.error });
    if (res.errors.length === 0) {
      toast.success(`Imported ${res.committed} rows.`);
    } else {
      toast.warning(
        `Imported ${res.committed} rows; ${res.errors.length} skipped (see preview).`,
      );
    }
    setFileName(null);
    setRows(null);
    router.refresh();
  }

  const validCount = rows?.filter((r) => !rowError(r)).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="size-4" /> Download template
        </Button>
      </div>
      <FileDropzone
        onFile={handleFile}
        accept=".csv,text/csv"
        selectedName={fileName}
        hint="CSV with columns: metric_key, period (YYYY-MM), value"
      />
      <p className="text-xs text-ink-3">
        Long format: one row per metric per month. Columns: <code>metric_key</code>,{" "}
        <code>period</code> (YYYY-MM), <code>value</code>. Re-importing a month
        updates existing values (no duplicates).
      </p>

      {headerError && <p className="text-sm text-destructive">{headerError}</p>}

      {rows && (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Line</TableHead>
                  <TableHead>metric_key</TableHead>
                  <TableHead>period</TableHead>
                  <TableHead>value</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const err = rowError(r);
                  return (
                    <TableRow key={r.line} className={err ? "bg-danger-bg" : ""}>
                      <TableCell className="text-xs text-ink-3">{r.line}</TableCell>
                      <TableCell className="font-mono text-xs">{r.metric_key}</TableCell>
                      <TableCell className="font-mono text-xs">{r.period}</TableCell>
                      <TableCell className="font-mono text-xs">{r.value}</TableCell>
                      <TableCell>
                        {err ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-danger-border bg-danger-bg px-2 py-0.5 text-[11px] font-semibold text-danger-text">
                            {err}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-success-border bg-success-bg px-2 py-0.5 text-[11px] font-semibold text-success-text">
                            OK
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <Button onClick={commit} loading={committing} disabled={committing || validCount === 0}>
            <Upload className="size-4" />
            {committing
              ? "Importing…"
              : `Commit ${validCount} valid row${validCount === 1 ? "" : "s"}`}
          </Button>
        </div>
      )}
    </div>
  );
}
