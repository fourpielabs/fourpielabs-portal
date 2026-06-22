"use client";

import { useState } from "react";
import { Upload, Target } from "lucide-react";

import { formatMonthYear } from "@/lib/format";
import {
  Segmented, Button, BaseModal,
} from "@/components/redesign/ui";
import { DefinitionsManager, type MetricDef } from "./metrics-definitions-manager";
import { MonthlyEntryGrid, type ActiveDef } from "./monthly-entry-grid";
import { CsvImport } from "./csv-import";
import { MetricsCharts, type DefLite, type Entry } from "./metrics-charts";
import { usePanel } from "./ui";

type EntryStatusItem = { period: string; status: string };
type CsvDef = { key: string; unit: "number" | "currency" | "percent" | "text" };

/**
 * R3 metrics workspace (re-skinned orchestrator). Two modes (UI finding #6): "Enter data"
 * (entry grid primary; definitions + status flank it; CSV import is a themed dialog) and
 * "Client preview" (read-only — exactly what the client sees, capped to standard width
 * inside the WIDE metrics tab). Composition/presentation only — same data + actions.
 */
export function MetricsWorkspace({
  clientId, isProject = false, allDefs, activeDefs, currentMonth, initialValues, entryStatus,
  csvDefs, numericDefs, textDefs, histEntries,
}: {
  clientId: string;
  isProject?: boolean;
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
  const { panel, fg1, fg3, onDark } = usePanel();
  const [mode, setMode] = useState<"enter" | "preview">("enter");
  const [csvOpen, setCsvOpen] = useState(false);

  const statusPill = (s: string) => {
    const map = onDark
      ? { complete: { bg: "rgba(34,197,94,0.16)", fg: "#86efac" }, in_progress: { bg: "rgba(245,158,11,0.16)", fg: "#fcd34d" }, empty: { bg: "rgba(255,255,255,0.08)", fg: "#cdc6ba" } }
      : { complete: { bg: "#dcfce7", fg: "#166534" }, in_progress: { bg: "#fef3c7", fg: "#92400e" }, empty: { bg: "#f1efe8", fg: "#57534e" } };
    return map[s as keyof typeof map] ?? map.empty;
  };
  const statusLabel = (s: string) => (s === "complete" ? "Complete" : s === "in_progress" ? "In progress" : "Not started");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Discoverability: tie the staff Metrics tab to the client's Results page. */}
      {isProject && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, borderRadius: 14, border: `1px solid ${onDark ? "rgba(245,158,11,0.3)" : "#fcd34d"}`, background: onDark ? "rgba(245,158,11,0.10)" : "#fffbeb", padding: "0.7rem 0.95rem" }}>
          <Target size={16} style={{ flexShrink: 0, marginTop: 2, color: onDark ? "#fcd34d" : "#b45309" }} />
          <p style={{ margin: 0, fontSize: "0.85rem", color: fg1 }}>
            This is the client’s Results data — define KPIs, enter each month’s numbers, and set
            targets here. That’s what populates their Results page.
          </p>
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
        <Segmented
          ariaLabel="Metrics mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: "enter", label: "Enter data" },
            { value: "preview", label: "Client preview" },
          ]}
        />
        {mode === "enter" && (
          <>
            <Button appearance="outline" icon={<Upload size={16} />} onClick={() => setCsvOpen(true)}>Import CSV</Button>
            <BaseModal isOpen={csvOpen} onClose={() => setCsvOpen(false)} title="Import metrics from CSV" size="lg">
              <CsvImport clientId={clientId} defs={csvDefs} currentMonth={currentMonth} />
            </BaseModal>
          </>
        )}
      </div>

      {mode === "enter" ? (
        <div className="rd-metrics-enter">
          <DefinitionsManager clientId={clientId} definitions={allDefs} />
          <MonthlyEntryGrid clientId={clientId} activeDefs={activeDefs} initialPeriod={currentMonth} initialValues={initialValues} />
          <div className={panel} style={{ borderRadius: 18, padding: "1.2rem" }}>
            <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600, color: fg1 }}>Entry status</h3>
            <ul style={{ listStyle: "none", margin: "0.8rem 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {entryStatus.map((m) => {
                const c = statusPill(m.status);
                return (
                  <li key={m.period} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 13, color: fg1 }}>
                    <span>{formatMonthYear(m.period)}</span>
                    <span style={{ borderRadius: 999, padding: "0.15rem 0.5rem", fontSize: 11, fontWeight: 600, background: c.bg, color: c.fg }}>{statusLabel(m.status)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : (
        <div style={{ marginInline: "auto", width: "100%", maxWidth: "64rem" }}>
          <div className={panel} style={{ borderRadius: 20, padding: "clamp(1.2rem,3vw,1.6rem)" }}>
            <div style={{ marginBottom: "1rem" }}>
              <h3 className="rd-display" style={{ margin: 0, fontSize: "1.3rem", fontWeight: 600, color: fg1 }}>Client preview</h3>
              <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: fg3 }}>Exactly what the client sees on their {isProject ? "Results" : "Performance"} page.</p>
            </div>
            <MetricsCharts numericDefs={numericDefs} textDefs={textDefs} entries={histEntries} />
          </div>
        </div>
      )}

      <style>{`
        .rd-metrics-enter{display:grid;gap:1.25rem;grid-template-columns:1fr;align-items:start;}
        @media(min-width:1080px){.rd-metrics-enter{grid-template-columns:320px 1fr 300px;}}
      `}</style>
    </div>
  );
}
