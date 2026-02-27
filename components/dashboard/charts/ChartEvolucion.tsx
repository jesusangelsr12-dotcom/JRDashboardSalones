"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatMoney } from "@/lib/calculations";

interface ChartEvolucionProps {
  data: { mes: string; total: number }[];
  color: string;
}

export default function ChartEvolucion({ data, color }: ChartEvolucionProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-[13px] text-text-secondary font-display">
          Sin datos disponibles
        </p>
      </div>
    );
  }

  return (
    <div className="h-52 -ml-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="fillGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#E2E2E8"
            vertical={false}
          />
          <XAxis
            dataKey="mes"
            tick={{ fontSize: 10, fontFamily: "DM Mono", fill: "#7C7C8A" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fontFamily: "DM Mono", fill: "#7C7C8A" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            width={40}
          />
          <Tooltip
            formatter={(value: number) => [formatMoney(value), "Ingresos"]}
            contentStyle={{
              backgroundColor: "#0A0A0F",
              border: "none",
              borderRadius: 10,
              padding: "8px 12px",
              fontFamily: "DM Mono",
              fontSize: 12,
            }}
            labelStyle={{ color: "#7C7C8A", fontSize: 10, fontFamily: "Syne" }}
            itemStyle={{ color: "#FFFFFF" }}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke={color}
            strokeWidth={2.5}
            fill="url(#fillGradient)"
            dot={false}
            activeDot={{
              r: 5,
              fill: color,
              stroke: "#FFFFFF",
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
