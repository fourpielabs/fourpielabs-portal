"use client";

import { Markdown } from "@/components/markdown";
import { DownloadButton } from "@/components/files/download-button";
import { Badge } from "@/components/ui/badge";

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
  if (reports.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Your first report lands after month 1.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {reports.map((r) => (
        <div key={r.id} className="rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{r.title}</span>
              {(r.period_start || r.period_end) && (
                <Badge variant="secondary" className="text-[10px]">
                  {r.period_start ?? "—"} → {r.period_end ?? "—"}
                </Badge>
              )}
            </div>
            {r.pdf_path && (
              <DownloadButton clientId={clientId} path={r.pdf_path} label="PDF" />
            )}
          </div>
          {r.summary && (
            <div className="pt-3">
              <Markdown>{r.summary}</Markdown>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
