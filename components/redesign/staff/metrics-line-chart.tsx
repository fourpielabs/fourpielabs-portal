"use client";

// The ONLY Recharts importer for the R3 client-preview surface. Split out + loaded via
// next/dynamic (ssr:false) from this folder's metrics-charts.tsx, so Recharts (~150KB)
// stays a lazy chunk fetched on demand when the chart renders — off the initial JS of
// the metrics workspace. This is the re-skin of components/metrics/metrics-line-chart.tsx:
// SAME area+line shape, but the axes/grid/tooltip/gradient are now MODE-AWARE, mirroring
// the D4 §05 amber area-fill treatment from components/redesign/keystones/perf-chart.tsx.
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function MetricsLineChart({
  data,
  mode = "light",
}: {
  data: { period: string; value: number | null }[];
  mode?: "light" | "dark";
}) {
  const onDark = mode === "dark";
  // Mirror perf-chart.tsx exactly: warm grid + warm axis text, brand amber line/area.
  const grid = onDark ? "#2c2820" : "#f1efe8";
  const axis = onDark ? "#b3aca0" : "#6f6c66";
  const last = [...data].reverse().find((d) => d.value != null);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -6 }}>
        <defs>
          {/* D4 §05 amber area-fill gradient (mode-aware top opacity, fades to 0). */}
          <linearGradient id="rd-metrics-amberfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d97706" stopOpacity={onDark ? 0.34 : 0.22} />
            <stop offset="100%" stopColor="#d97706" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={grid} />
        <XAxis
          dataKey="period"
          tick={{ fontSize: 11, fill: axis }}
          tickLine={false}
          axisLine={{ stroke: grid }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: axis }}
          width={44}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => Number(v).toLocaleString()}
        />
        <Tooltip
          contentStyle={{
            background: "#18130d",
            border: "1px solid #3a332a",
            borderRadius: 12,
            color: "#f3efe7",
            fontSize: 12,
          }}
          labelStyle={{ color: "#fcd34d", fontWeight: 700 }}
          itemStyle={{ color: "#f3efe7" }}
          formatter={(v) => [Number(v ?? 0).toLocaleString(), "Value"]}
          cursor={{ stroke: "#d97706", strokeOpacity: 0.4 }}
        />
        {last && (
          <ReferenceLine x={last.period} stroke="#d97706" strokeDasharray="4 4" strokeOpacity={0.5} />
        )}
        <Area
          type="monotone"
          dataKey="value"
          stroke="none"
          fill="url(#rd-metrics-amberfill)"
          connectNulls
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#d97706"
          strokeWidth={2.5}
          strokeLinecap="round"
          dot={{ r: 3.5, fill: "#d97706", strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          connectNulls
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
