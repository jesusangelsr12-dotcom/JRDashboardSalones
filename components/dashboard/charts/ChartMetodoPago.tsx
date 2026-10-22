"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { formatMoney } from "@/lib/calculations";
import { METODO_COLOR } from "@/components/ui/Primitives";

interface ChartMetodoPagoProps {
  data: { metodo: string; total: number }[];
}

export default function ChartMetodoPago({ data }: ChartMetodoPagoProps) {
  if (data.length === 0 || data.every((d) => d.total === 0)) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-[13px] text-text-secondary">Sin datos de pago</p>
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.total, 0);

  return (
    <div className="flex items-center gap-4 mt-3">
      {/* Donut */}
      <div className="relative w-36 h-36 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="total" nameKey="metodo" cx="50%" cy="50%" innerRadius={44} outerRadius={64} strokeWidth={2} stroke="#FFFFFF">
              {data.map((entry) => (
                <Cell key={entry.metodo} fill={METODO_COLOR[entry.metodo] || "#7A5F6E"} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[11px] text-text-secondary">Total</span>
          <span className="font-numbers text-[15px] font-bold text-text-primary">{formatMoney(total)}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-2.5 flex-1 min-w-0">
        {data.map((entry) => {
          const pct = total > 0 ? ((entry.total / total) * 100).toFixed(0) : "0";
          return (
            <div key={entry.metodo}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[12.5px] font-display font-semibold text-text-primary">
                  <span className="w-[9px] h-[9px] rounded-[3px]" style={{ backgroundColor: METODO_COLOR[entry.metodo] || "#7A5F6E" }} />
                  {entry.metodo}
                </span>
                <span className="text-[13px] font-numbers font-bold text-text-primary">{formatMoney(entry.total)}</span>
              </div>
              <p className="text-[11.5px] font-numbers text-text-secondary ml-[17px]">{pct}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
