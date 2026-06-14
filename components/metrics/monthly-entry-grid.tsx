"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";

import {
  getMonthEntriesAction,
  saveMonthEntriesAction,
} from "@/lib/actions/metrics";
import { Button } from "@/components/ui/button";
import { labelOf, METRIC_UNITS } from "@/lib/constants";
import { formatMonthYear } from "@/lib/format";

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
      <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center text-sm text-ink-3">
        No active metric definitions. Add some in the Definitions tab first.
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-e2">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-row-divider px-5 py-4">
        <div>
          <div className="text-sm font-semibold">Monthly entry</div>
          <div className="text-[11.5px] text-ink-3">Tab moves down the column</div>
        </div>
        <div className="relative inline-flex h-9 items-center gap-1.5 rounded-full border border-border-strong bg-surface px-3.5 text-[13px] font-semibold transition-colors hover:border-ink has-[input:focus-visible]:border-ink">
          <span>{monthName || "Select month"}</span>
          <ChevronDown className="size-3.5 text-ink-3" aria-hidden />
          <input
            type="month"
            value={period}
            onChange={(e) => onMonthChange(e.target.value)}
            aria-label="Select month"
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </div>
      </div>

      <div className="relative">
        {loading && (
          <div className="px-5 py-3 text-sm text-ink-3">Loading…</div>
        )}
        <div className="flex flex-col">
          {activeDefs.map((d) => {
            const dirty = (values[d.id] ?? "") !== (saved[d.id] ?? "");
            const err = errors[d.id];
            return (
              <div
                key={d.id}
                className={`grid grid-cols-[1fr_72px_140px] items-start gap-3 border-b border-row-divider px-5 py-2.5 sm:grid-cols-[1fr_80px_150px] ${dirty ? "bg-[var(--unsaved-bg)]" : ""}`}
              >
                <span className="self-center text-[13px] font-medium">
                  {d.label}
                  {dirty && <span className="ml-1.5 text-[10.5px] text-amber-700">· unsaved</span>}
                </span>
                <span className="self-center text-[11px] text-ink-3">
                  {labelOf(METRIC_UNITS, d.unit).toLowerCase()}
                </span>
                <div className="flex flex-col gap-1">
                  <input
                    type={d.unit === "text" ? "text" : "text"}
                    inputMode={d.unit === "text" ? undefined : "decimal"}
                    value={values[d.id] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [d.id]: e.target.value }))}
                    aria-invalid={!!err}
                    className={`h-9 rounded-[10px] border bg-surface px-3 text-right text-[13.5px] font-semibold tabular-nums outline-none transition-all focus:border-amber-600 focus:shadow-[0_0_0_3px_rgba(217,119,6,0.18)] ${
                      err
                        ? "border-danger-solid shadow-[0_0_0_3px_rgba(220,38,38,0.12)]"
                        : dirty
                          ? "border-amber-400"
                          : "border-border-strong"
                    } ${d.unit === "text" ? "text-left font-normal" : ""}`}
                  />
                  {err && <span className="text-[11px] font-medium text-danger-text">{err}</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* sticky save bar */}
        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border bg-surface px-5 py-3 shadow-[0_-4px_12px_rgba(24,24,27,0.04)]">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800">
            <span className="size-1.5 rounded-full bg-amber-600" />
            {dirtyCount} unsaved
            {errorCount > 0 && ` · ${errorCount} error${errorCount === 1 ? "" : "s"}`}
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={dirtyCount === 0 || saving}
              onClick={() => setValues({ ...saved })}
            >
              Discard
            </Button>
            <Button
              size="sm"
              loading={saving}
              disabled={dirtyCount === 0 || errorCount > 0 || saving}
              onClick={onSave}
            >
              {saving ? "Saving…" : `Save ${monthShort}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
