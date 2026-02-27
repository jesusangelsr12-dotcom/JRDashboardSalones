"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { formatMoney } from "@/lib/calculations";

interface ChartMetodoPagoProps {
  data: { metodo: string; total: number }[];
}

const COLORS: Record<string, string> = {
  Efectivo: "#10B981",
  Tarjeta: "#6366F1",
  Transferencia: "#F59E0B",
};

export default function ChartMetodoPago({ data }: ChartMetodoPagoProps) {
  if (data.length === 0 || data.every((d) => d.total === 0)) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-[13px] text-text-secondary font-display">
          Sin datos de pago
        </p>
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.total, 0);

  return (
    <div className="flex items-center gap-4">
      {/* Donut */}
      <div className="w-36 h-36 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="metodo"
              cx="50%"
              cy="50%"
              innerRadius={38}
              outerRadius={60}
              strokeWidth={2}
              stroke="#FFFFFF"
            >
              {data.map((entry) => (
                <Cell
                  key={entry.metodo}
                  fill={COLORS[entry.metodo] || "#7C7C8A"}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="space-y-3 flex-1">
        {data.map((entry) => {
          const pct = total > 0 ? ((entry.total / total) * 100).toFixed(0) : "0";
          return (
            <div key={entry.metodo}>
              <div className="flex items-center gap-2 mb-0.5">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    backgroundColor: COLORS[entry.metodo] || "#7C7C8A",
                  }}
                />
                <span className="text-[12px] font-display text-text-primary">
                  {entry.metodo}
                </span>
              </div>
              <p className="text-[13px] font-numbers font-medium text-text-primary ml-[18px]">
                {formatMoney(entry.total)}{" "}
                <span className="text-[11px] text-text-secondary">{pct}%</span>
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
