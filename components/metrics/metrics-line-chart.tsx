"use client";

// The ONLY Recharts importer. Split out + loaded via next/dynamic (ssr:false) from
// metrics-charts.tsx, so Recharts (~150KB) is a lazy chunk fetched on demand when the
// chart renders — it's off the initial JS of /performance and /metrics, and never
// touches any other route.
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
}: {
  data: { period: string; value: number | null }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id="k3-amberfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D97706" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#D97706" stopOpacity={0} />
          </linearGradient>
        </defs>
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
        <ReferenceLine x={data[data.length - 1]?.period} stroke="#D6D3CD" strokeDasharray="3 3" />
        <Area
          type="monotone"
          dataKey="value"
          stroke="none"
          fill="url(#k3-amberfill)"
          connectNulls
          isAnimationActive={false}
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
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
