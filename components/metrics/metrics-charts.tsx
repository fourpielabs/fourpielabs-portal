"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMonthShort, monthsBetween } from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type DefLite = {
  id: string;
  label: string;
  unit: "number" | "currency" | "percent" | "text";
};
export type Entry = {
  definition_id: string;
  period: string;
  value_numeric: number | null;
  value_text: string | null;
};

export function MetricsCharts({
  numericDefs,
  textDefs,
  entries,
}: {
  numericDefs: DefLite[];
  textDefs: DefLite[];
  entries: Entry[];
}) {
  const [selected, setSelected] = useState(numericDefs[0]?.id ?? "");

  // Window the axis to the months that actually have data (first → latest).
  const axis = useMemo(() => {
    const present = [...new Set(entries.map((e) => e.period))].sort();
    if (present.length === 0) return [];
    return monthsBetween(present[0], present[present.length - 1]);
  }, [entries]);

  const numericMap = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const e of entries) m.set(`${e.definition_id}|${e.period}`, e.value_numeric);
    return m;
  }, [entries]);

  const textMap = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const e of entries) m.set(`${e.definition_id}|${e.period}`, e.value_text);
    return m;
  }, [entries]);

  const chartData = axis.map((p) => ({
    period: formatMonthShort(p),
    value: numericMap.get(`${selected}|${p}`) ?? null,
  }));

  const textColumns = [...axis].reverse(); // newest first
  const numericColumns = [...axis].reverse(); // newest first
  const selectedDef = numericDefs.find((d) => d.id === selected);
  const rangeCaption = axis.length
    ? `${formatMonthShort(axis[0])} – ${formatMonthShort(axis[axis.length - 1])}`
    : "";

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-semibold tracking-[-0.01em]">
              {selectedDef?.label ?? "Numeric trend"}
            </h3>
            {rangeCaption && <p className="text-[12.5px] text-ink-3">{rangeCaption}</p>}
          </div>
          {numericDefs.length > 0 && (
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger size="sm" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {numericDefs.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {numericDefs.length === 0 || axis.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            Charts appear once you have numeric metrics with monthly entries.
          </div>
        ) : (
          <div className="h-72 w-full rounded-lg border p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid vertical={false} stroke="#F4F4F0" />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 11, fill: "#8E8B84" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#8E8B84" }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    background: "#18181B",
                    border: "none",
                    borderRadius: 10,
                    color: "#fff",
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#A8A8A3" }}
                  itemStyle={{ color: "#FBBF24" }}
                />
                <ReferenceLine
                  x={chartData[chartData.length - 1]?.period}
                  stroke="#D6D3CD"
                  strokeDasharray="3 3"
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#D97706"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  dot={{ r: 4, fill: "#fff", stroke: "#D97706", strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: "#D97706", stroke: "#fff", strokeWidth: 2 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {numericDefs.length > 0 && numericColumns.length > 0 && (
        <div className="space-y-2">
          <div>
            <h3 className="font-display text-xl font-semibold tracking-[-0.01em]">Month by month</h3>
            <p className="text-[12.5px] text-ink-3">Newest first · ▲▼ vs prior month</p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-border shadow-e2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-bg">Month</TableHead>
                  {numericDefs.map((d) => (
                    <TableHead key={d.id} className="text-right whitespace-nowrap">
                      {d.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {numericColumns.map((p, idx) => {
                  const isLatest = idx === 0;
                  const isFirst = idx === numericColumns.length - 1;
                  const prevP = numericColumns[idx + 1];
                  return (
                    <TableRow key={p} className={isLatest ? "bg-amber-50" : ""}>
                      <TableCell className={`sticky left-0 font-medium whitespace-nowrap ${isLatest ? "bg-amber-50" : "bg-surface"}`}>
                        {formatMonthShort(p)}
                        {isFirst && (
                          <span className="ml-1.5 text-[10px] text-ink-3">first full month</span>
                        )}
                      </TableCell>
                      {numericDefs.map((d) => {
                        const cur = numericMap.get(`${d.id}|${p}`);
                        const prior = isFirst ? null : (numericMap.get(`${d.id}|${prevP}`) ?? null);
                        const delta = cur != null && prior != null ? cur - prior : null;
                        const up = (delta ?? 0) > 0;
                        return (
                          <TableCell key={d.id} className="text-right tabular-nums">
                            {cur != null ? cur.toLocaleString() : "—"}
                            {delta != null && delta !== 0 && (
                              <span className={`ml-1 text-[11px] ${up ? "text-success-text" : "text-danger-text"}`}>
                                {up ? "▲" : "▼"}{Math.abs(delta).toLocaleString()}
                              </span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {textDefs.length > 0 && axis.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display text-xl font-semibold tracking-[-0.01em]">Highlights by month</h3>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card">Metric</TableHead>
                  {textColumns.map((p) => (
                    <TableHead key={p} className="whitespace-nowrap">
                      {formatMonthShort(p)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {textDefs.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="sticky left-0 bg-card font-medium">
                      {d.label}
                    </TableCell>
                    {textColumns.map((p) => (
                      <TableCell key={p} className="min-w-40 align-top text-sm text-muted-foreground">
                        {textMap.get(`${d.id}|${p}`) || "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
