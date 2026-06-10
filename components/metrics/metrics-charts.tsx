"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

const ym = (p: string) => p.slice(0, 7);

export function MetricsCharts({
  numericDefs,
  textDefs,
  periods,
  entries,
}: {
  numericDefs: DefLite[];
  textDefs: DefLite[];
  periods: string[]; // ascending
  entries: Entry[];
}) {
  const [selected, setSelected] = useState(numericDefs[0]?.id ?? "");

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

  const chartData = periods.map((p) => ({
    period: ym(p),
    value: numericMap.get(`${selected}|${p}`) ?? null,
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium">Numeric trend</h3>
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
        {numericDefs.length === 0 || periods.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            Charts appear once you have numeric metrics with monthly entries.
          </div>
        ) : (
          <div className="h-72 w-full rounded-lg border p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--chart-2)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {textDefs.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Text metrics by month</h3>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card">Metric</TableHead>
                  {periods.map((p) => (
                    <TableHead key={p} className="whitespace-nowrap">
                      {ym(p)}
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
                    {periods.map((p) => (
                      <TableCell key={p} className="text-sm text-muted-foreground">
                        {textMap.get(`${d.id}|${p}`) ?? "—"}
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
