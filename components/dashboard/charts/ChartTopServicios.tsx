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

interface ChartTopServiciosProps {
  data: { nombre: string; cantidad: number; total: number }[];
  color: string;
}

export default function ChartTopServicios({
  data,
  color,
}: ChartTopServiciosProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-[13px] text-text-secondary font-display">
          Sin servicios registrados
        </p>
      </div>
    );
  }

  const top5 = data.slice(0, 5);

  // Truncate long names
  const chartData = top5.map((d) => ({
    ...d,
    shortName: d.nombre.length > 12 ? d.nombre.slice(0, 12) + "…" : d.nombre,
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
            dataKey="shortName"
            tick={{ fontSize: 11, fontFamily: "Syne", fill: "#0A0A0F" }}
            axisLine={false}
            tickLine={false}
            width={100}
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
                fill={color}
                opacity={1 - i * 0.15}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
