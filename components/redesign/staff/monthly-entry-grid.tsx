"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, TableProperties } from "lucide-react";

import {
  getMonthEntriesAction,
  saveMonthEntriesAction,
} from "@/lib/actions/metrics";
import { Input, Button, EmberButton } from "@/components/redesign/ui";
import { labelOf, METRIC_UNITS } from "@/lib/constants";
import { formatMonthYear } from "@/lib/format";
import { usePanel, EmptyPanel } from "./ui";

export type ActiveDef = {
  id: string;
  key: string;
  label: string;
  unit: "number" | "currency" | "percent" | "text";
};

function fieldError(unit: string, raw: string): string | null {
  if (unit === "text") return null;
  const v = raw.trim();
  if (v === "") return null;
  if (Number.isNaN(Number(v))) return "Enter a number.";
  return null;
}

/** R3 staff monthly-entry grid (re-skinned, SOLID panel). All wiring verbatim. */
export function MonthlyEntryGrid({
  clientId,
  activeDefs,
  initialPeriod,
  initialValues,
}: {
  clientId: string;
  activeDefs: ActiveDef[];
  initialPeriod: string; // YYYY-MM
  initialValues: Record<string, string>;
}) {
  const router = useRouter();
  const { panel, fg1, fg3, onDark, border, brand } = usePanel();
  const [period, setPeriod] = useState(initialPeriod);
  const [saved, setSaved] = useState<Record<string, string>>(initialValues);
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const monthName = period ? formatMonthYear(`${period}-01`) : "";
  const monthShort = monthName.split(" ")[0];

  const { dirtyCount, errorCount, errors } = useMemo(() => {
    const errs: Record<string, string | null> = {};
    let dirty = 0;
    let err = 0;
    for (const d of activeDefs) {
      const cur = values[d.id] ?? "";
      if (cur !== (saved[d.id] ?? "")) dirty++;
      const e = fieldError(d.unit, cur);
      errs[d.id] = e;
      if (e) err++;
    }
    return { dirtyCount: dirty, errorCount: err, errors: errs };
  }, [activeDefs, values, saved]);

  async function onMonthChange(ym: string) {
    setPeriod(ym);
    if (!ym) return;
    setLoading(true);
    const res = await getMonthEntriesAction(clientId, `${ym}-01`);
    setLoading(false);
    if (!res.ok) return toast.error("Couldn't load month", { description: res.error });
    const next: Record<string, string> = {};
    for (const d of activeDefs) {
      const e = res.entries[d.id];
      next[d.id] = !e ? "" : d.unit === "text" ? (e.text ?? "") : e.numeric === null ? "" : String(e.numeric);
    }
    setSaved(next);
    setValues(next);
  }

  async function onSave() {
    if (!period || errorCount > 0) return;
    setSaving(true);
    const payload = activeDefs.map((d) => ({ definition_id: d.id, value: values[d.id] ?? "" }));
    const res = await saveMonthEntriesAction(clientId, `${period}-01`, payload);
    setSaving(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    setSaved({ ...values });
    toast.success(`Saved metrics for ${monthName}.`);
    router.refresh();
  }

  if (activeDefs.length === 0) {
    return (
      <EmptyPanel
        icon={<TableProperties size={22} />}
        title="No active metric definitions"
        description="Add some in the Definitions tab first, then you can record values here."
      />
    );
  }

  // ── mode-aware accents ──────────────────────────────────────────────
  const unsavedBg = onDark ? "rgba(245,158,11,0.10)" : "#fffaf0";
  const amberText = onDark ? "#fcd34d" : "#92400e";
  const amberDot = onDark ? "#fbbf24" : "#d97706";
  const dangerText = onDark ? "#fca5a5" : "#b91c1c";
  const dangerBd = onDark ? "rgba(248,113,113,0.6)" : "#dc2626";
  const amberBd = onDark ? "rgba(251,191,36,0.55)" : "#fbbf24";
  const pillBg = onDark ? "rgba(255,255,255,0.04)" : "#ffffff";
  const divider = onDark ? "rgba(255,255,255,0.06)" : "#efece5";
  const barBg = onDark ? "rgba(20,18,16,0.85)" : "rgba(255,255,255,0.9)";

  return (
    <div className={panel} style={{ borderRadius: 20, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* header + month-picker pill */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", padding: "1rem 1.25rem", borderBottom: `1px solid ${divider}` }}>
        <div>
          <div style={{ fontSize: "0.9rem", fontWeight: 600, color: fg1 }}>Monthly entry</div>
          <div style={{ fontSize: "0.72rem", color: fg3 }}>Tab moves down the column</div>
        </div>
        <label
          className="rd-month-pill rd-focus"
          style={{
            position: "relative",
            display: "inline-flex",
            height: 36,
            alignItems: "center",
            gap: 6,
            borderRadius: 999,
            border: `1px solid ${border}`,
            background: pillBg,
            padding: "0 0.9rem",
            fontSize: "0.8rem",
            fontWeight: 600,
            color: fg1,
            cursor: "pointer",
            transition: "border-color 0.15s ease",
          }}
        >
          <span>{monthName || "Select month"}</span>
          <ChevronDown size={14} style={{ color: fg3 }} aria-hidden />
          <input
            type="month"
            value={period}
            onChange={(e) => onMonthChange(e.target.value)}
            aria-label="Select month"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "pointer", opacity: 0, border: "none", padding: 0, margin: 0 }}
          />
        </label>
      </div>

      <div style={{ position: "relative" }}>
        {loading && (
          <div style={{ padding: "0.7rem 1.25rem", fontSize: "0.85rem", color: fg3 }}>Loading…</div>
        )}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {activeDefs.map((d) => {
            const dirty = (values[d.id] ?? "") !== (saved[d.id] ?? "");
            const err = errors[d.id];
            const isText = d.unit === "text";
            return (
              <div
                key={d.id}
                className="rd-entry-row"
                style={{
                  alignItems: "start",
                  gap: 12,
                  padding: "0.6rem 1.25rem",
                  borderBottom: `1px solid ${divider}`,
                  background: dirty ? unsavedBg : "transparent",
                }}
              >
                <span style={{ alignSelf: "center", fontSize: "0.82rem", fontWeight: 500, color: fg1 }}>
                  {d.label}
                  {dirty && <span style={{ marginLeft: 6, fontSize: "0.65rem", fontWeight: 600, color: amberText }}>· unsaved</span>}
                </span>
                <span style={{ alignSelf: "center", fontSize: "0.7rem", color: fg3 }}>
                  {labelOf(METRIC_UNITS, d.unit).toLowerCase()}
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <Input
                    value={values[d.id] ?? ""}
                    onChange={(_, data) => setValues((v) => ({ ...v, [d.id]: data.value }))}
                    inputMode={isText ? undefined : "decimal"}
                    aria-invalid={!!err || undefined}
                    aria-label={`${d.label} value`}
                    input={{
                      style: {
                        textAlign: isText ? "left" : "right",
                        fontWeight: isText ? 400 : 600,
                        fontVariantNumeric: "tabular-nums",
                      },
                    }}
                    style={{ borderColor: err ? dangerBd : dirty ? amberBd : border }}
                  />
                  {err && <span style={{ fontSize: "0.7rem", fontWeight: 500, color: dangerText }}>{err}</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* sticky save bar */}
        <div
          style={{
            position: "sticky",
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "0.7rem 1.25rem",
            borderTop: `1px solid ${border}`,
            background: barBg,
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.75rem", fontWeight: 500, color: dirtyCount > 0 ? amberText : fg3 }}>
            {dirtyCount > 0 && <span style={{ width: 6, height: 6, borderRadius: 999, background: amberDot }} />}
            {dirtyCount} unsaved
            {errorCount > 0 && ` · ${errorCount} error${errorCount === 1 ? "" : "s"}`}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              appearance="subtle"
              size="small"
              disabled={dirtyCount === 0 || saving}
              onClick={() => setValues({ ...saved })}
            >
              Discard
            </Button>
            <EmberButton
              size="small"
              loading={saving}
              disabled={dirtyCount === 0 || errorCount > 0 || saving}
              onClick={onSave}
            >
              {saving ? "Saving…" : `Save ${monthShort}`}
            </EmberButton>
          </div>
        </div>
      </div>

      <style>{`
        .rd-month-pill:hover{border-color:${brand} !important;}
        .rd-month-pill:focus-within{border-color:${brand} !important;}
        .rd-entry-row{display:grid;grid-template-columns:1fr 72px 140px;}
        @media(min-width:640px){.rd-entry-row{grid-template-columns:1fr 80px 150px;}}
      `}</style>
    </div>
  );
}
