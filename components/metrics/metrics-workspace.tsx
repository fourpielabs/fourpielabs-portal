"use client";

import { useState } from "react";
import { Upload } from "lucide-react";

import { formatMonthYear } from "@/lib/format";
import { SegmentedControl } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DefinitionsManager,
  type MetricDef,
} from "@/components/metrics/definitions-manager";
import {
  MonthlyEntryGrid,
  type ActiveDef,
} from "@/components/metrics/monthly-entry-grid";
import { CsvImport } from "@/components/metrics/csv-import";
import {
  MetricsCharts,
  type DefLite,
  type Entry,
} from "@/components/metrics/metrics-charts";

type EntryStatusItem = { period: string; status: string };
type CsvDef = { key: string; unit: "number" | "currency" | "percent" | "text" };

const statusChip = (s: string) =>
  s === "complete"
    ? "border border-success-border bg-success-bg text-success-text"
    : s === "in_progress"
      ? "border border-amber-200 bg-amber-100 text-amber-800"
      : "border border-border text-ink-3";
const statusLabel = (s: string) =>
  s === "complete" ? "Complete" : s === "in_progress" ? "In progress" : "Not started";

/**
 * Metrics editor, split into two modes (finding #6): "Enter data" (the entry grid is
 * the primary surface; definitions + status flank it; CSV import lives in the header
 * as a dialog) and "Client preview" (read-only — exactly what the client sees, capped
 * to the client's `standard` width inside the `wide` tab). Presentation/composition
 * only — same data, actions, and import logic.
 */
export function MetricsWorkspace({
  clientId,
  allDefs,
  activeDefs,
  currentMonth,
  initialValues,
  entryStatus,
  csvDefs,
  numericDefs,
  textDefs,
  histEntries,
}: {
  clientId: string;
  allDefs: MetricDef[];
  activeDefs: ActiveDef[];
  currentMonth: string;
  initialValues: Record<string, string>;
  entryStatus: EntryStatusItem[];
  csvDefs: CsvDef[];
  numericDefs: DefLite[];
  textDefs: DefLite[];
  histEntries: Entry[];
}) {
  const [mode, setMode] = useState<"enter" | "preview">("enter");
  const [csvOpen, setCsvOpen] = useState(false);

  return (
    <div className="section-stack">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          value={mode}
          onValueChange={setMode}
          options={[
            { value: "enter", label: "Enter data" },
            { value: "preview", label: "Client preview" },
          ]}
        />
        {mode === "enter" && (
          <Dialog open={csvOpen} onOpenChange={setCsvOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Upload className="size-4" /> Import CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Import metrics from CSV</DialogTitle>
              </DialogHeader>
              <CsvImport clientId={clientId} defs={csvDefs} currentMonth={currentMonth} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {mode === "enter" ? (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr_300px] lg:items-start">
          <DefinitionsManager clientId={clientId} definitions={allDefs} />
          <MonthlyEntryGrid
            clientId={clientId}
            activeDefs={activeDefs}
            initialPeriod={currentMonth}
            initialValues={initialValues}
          />
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-e2">
            <h3 className="text-sm font-semibold">Entry status</h3>
            <ul className="mt-3 flex flex-col gap-2">
              {entryStatus.map((m) => (
                <li key={m.period} className="flex items-center justify-between gap-2 text-[13px]">
                  <span>{formatMonthYear(m.period)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusChip(m.status)}`}>
                    {statusLabel(m.status)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-standard">
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-e2 sm:p-6">
            <div className="mb-4">
              <h3 className="font-display text-xl font-semibold tracking-[-0.01em]">Client preview</h3>
              <p className="text-[12.5px] text-ink-3">
                Exactly what the client sees on their Performance page.
              </p>
            </div>
            <MetricsCharts numericDefs={numericDefs} textDefs={textDefs} entries={histEntries} />
          </div>
        </div>
      )}
    </div>
  );
}
