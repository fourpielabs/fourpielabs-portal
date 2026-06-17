"use client";

import { useState } from "react";
import { Markdown } from "@/components/markdown";
import { DownloadButton } from "@/components/files/download-button";
import { StatusChip } from "@/components/ui/status-chip";
import { formatReportPeriod } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText } from "lucide-react";

export type ClientReport = {
  id: string;
  title: string;
  period_start: string | null;
  period_end: string | null;
  summary: string | null;
  pdf_path: string | null;
};

export function ClientReports({
  clientId,
  reports,
}: {
  clientId: string;
  reports: ClientReport[];
}) {
  const [selectedId, setSelectedId] = useState(reports[0]?.id ?? null);

  if (reports.length === 0) {
    return (
      <EmptyState
        icon={<FileText />}
        title="No reports yet"
        description="Your first report lands after month 1."
      />
    );
  }

  const selected = reports.find((r) => r.id === selectedId) ?? reports[0];
  const selectedPeriod = formatReportPeriod(selected.period_start, selected.period_end);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_2fr] lg:items-start">
      {/* list */}
      <ul className="flex flex-col gap-1.5">
        {reports.map((r) => {
          const active = r.id === selected.id;
          const period = formatReportPeriod(r.period_start, r.period_end);
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSelectedId(r.id)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                  active
                    ? "border-border border-l-[3px] border-l-amber-600 bg-amber-50"
                    : "border-border hover:bg-bg"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">{r.title}</span>
                  <StatusChip kind="report" value="published" label="Published" />
                </div>
                {period && <div className="mt-0.5 text-xs text-ink-3">{period}</div>}
              </button>
            </li>
          );
        })}
      </ul>

      {/* viewer */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-e2">
        <div className="text-[11px] font-bold tracking-wider text-amber-700 uppercase">
          Report
        </div>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <h3 className="font-display text-2xl font-semibold tracking-[-0.01em]">
            {selected.title}
          </h3>
          {selected.pdf_path && (
            <DownloadButton clientId={clientId} path={selected.pdf_path} label="Download PDF" />
          )}
        </div>
        {selectedPeriod && <p className="mt-0.5 text-[12.5px] text-ink-3">{selectedPeriod}</p>}
        {selected.summary ? (
          <div className="mt-4">
            <Markdown>{selected.summary}</Markdown>
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-3">No written summary for this report.</p>
        )}
      </div>
    </div>
  );
}
