"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  getMonthEntriesAction,
  saveMonthEntriesAction,
} from "@/lib/actions/metrics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ActiveDef = {
  id: string;
  key: string;
  label: string;
  unit: "number" | "currency" | "percent" | "text";
};

export function MonthlyEntryGrid({
  clientId,
  activeDefs,
  initialPeriod, // YYYY-MM
  initialValues, // id -> string
}: {
  clientId: string;
  activeDefs: ActiveDef[];
  initialPeriod: string;
  initialValues: Record<string, string>;
}) {
  const router = useRouter();
  const [period, setPeriod] = useState(initialPeriod);
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
      if (!e) {
        next[d.id] = "";
      } else if (d.unit === "text") {
        next[d.id] = e.text ?? "";
      } else {
        next[d.id] = e.numeric === null ? "" : String(e.numeric);
      }
    }
    setValues(next);
  }

  async function onSave() {
    if (!period) return toast.error("Pick a month first.");
    setSaving(true);
    const payload = activeDefs.map((d) => ({
      definition_id: d.id,
      value: values[d.id] ?? "",
    }));
    const res = await saveMonthEntriesAction(clientId, `${period}-01`, payload);
    setSaving(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    toast.success(`Saved metrics for ${period}.`);
    router.refresh();
  }

  if (activeDefs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
        No active metric definitions. Add some in the Definitions tab first.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="me-month">Month</Label>
          <Input
            id="me-month"
            type="month"
            value={period}
            onChange={(e) => onMonthChange(e.target.value)}
            className="w-44"
          />
        </div>
        {loading && (
          <span className="pb-2 text-sm text-muted-foreground">Loading…</span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {activeDefs.map((d) => (
          <div key={d.id} className="space-y-1">
            <Label htmlFor={`m-${d.id}`} className="text-sm">
              {d.label}
              <span className="ml-1 text-xs text-muted-foreground">({d.unit})</span>
            </Label>
            <Input
              id={`m-${d.id}`}
              type={d.unit === "text" ? "text" : "number"}
              inputMode={d.unit === "text" ? undefined : "decimal"}
              value={values[d.id] ?? ""}
              onChange={(e) =>
                setValues((v) => ({ ...v, [d.id]: e.target.value }))
              }
            />
          </div>
        ))}
      </div>

      <Button onClick={onSave} disabled={saving || loading}>
        {saving ? "Saving…" : "Save month"}
      </Button>
    </div>
  );
}
