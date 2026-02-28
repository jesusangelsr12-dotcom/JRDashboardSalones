"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatMoney } from "@/lib/calculations";

interface ChartTopGastosProps {
  data: { descripcion: string; cantidad: number; total: number }[];
  color: string;
}

export default function ChartTopGastos({
  data,
  color,
}: ChartTopGastosProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-[13px] text-text-secondary font-display">
          Sin gastos registrados
        </p>
      </div>
    );
  }

  const top5 = data.slice(0, 5);

  const chartData = top5.map((d) => ({
    ...d,
    nombre: d.descripcion,
  }));

  return (
    <div className="h-52 -ml-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" barCategoryGap="20%">
          <XAxis
            type="number"
            tick={{ fontSize: 10, fontFamily: "DM Mono", fill: "#7C7C8A" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          />
          <YAxis
            type="category"
            dataKey="nombre"
            tick={{ fontSize: 10, fontFamily: "Syne", fill: "#0A0A0F" }}
            axisLine={false}
            tickLine={false}
            width={110}
          />
          <Tooltip
            formatter={(value: number) => [formatMoney(value), "Total"]}
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
          <Bar dataKey="total" radius={[0, 6, 6, 0]}>
            {chartData.map((_, i) => (
              <Cell
                key={i}
                fill="#EF4444"
                opacity={1 - i * 0.15}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
