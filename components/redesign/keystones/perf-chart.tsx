"use client";

import * as React from "react";
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

export type ChartPoint = { period: string; value: number | null };

/**
 * The performance line/area chart. Lives on a SOLID panel (glass is forbidden on
 * dense data). Loaded ssr:false by the parent (recharts measures the DOM), and
 * `isAnimationActive` is gated on reduced-motion. Colors switch with the mode.
 */
export default function PerfChart({
  data,
  mode,
  reduced,
  unit,
}: {
  data: ChartPoint[];
  mode: "light" | "dark";
  reduced: boolean;
  unit: string;
}) {
  const onDark = mode === "dark";
  const grid = onDark ? "#2c2820" : "#f1efe8";
  const axis = onDark ? "#b3aca0" : "#6f6c66";
  const last = [...data].reverse().find((d) => d.value != null);

  const fmt = (v: number) =>
    unit === "currency" ? `$${v.toLocaleString()}` : unit === "percent" ? `${v}%` : v.toLocaleString();

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -6 }}>
        <defs>
          <linearGradient id="rd-amberfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d97706" stopOpacity={onDark ? 0.34 : 0.22} />
            <stop offset="100%" stopColor="#d97706" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={grid} />
        <XAxis dataKey="period" tick={{ fontSize: 11, fill: axis }} tickLine={false} axisLine={{ stroke: grid }} />
        <YAxis tick={{ fontSize: 11, fill: axis }} width={44} tickLine={false} axisLine={false} tickFormatter={(v) => fmt(Number(v))} />
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
          formatter={(v) => [fmt(Number(v ?? 0)), "Value"]}
          cursor={{ stroke: "#d97706", strokeOpacity: 0.4 }}
        />
        {last && (
          <ReferenceLine
            x={last.period}
            stroke="#d97706"
            strokeDasharray="4 4"
            strokeOpacity={0.5}
          />
        )}
        <Area
          type="monotone"
          dataKey="value"
          stroke="none"
          fill="url(#rd-amberfill)"
          connectNulls
          isAnimationActive={!reduced}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#d97706"
          strokeWidth={2.5}
          dot={{ r: 3.5, fill: "#d97706", strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          connectNulls
          isAnimationActive={!reduced}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
