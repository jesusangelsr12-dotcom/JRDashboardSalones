"use client";

import { formatMoney } from "@/lib/calculations";

interface ChartEvolucionProps {
  data: { mes: string; total: number }[];
  // El último mes va en curso: se dibuja rayado para no leerlo como mes completo
  ultimoParcial?: boolean;
}

function compacto(v: number): string {
  if (v >= 100000) return `$${Math.round(v / 1000)}k`;
  if (v >= 1000) return `$${(v / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return formatMoney(v);
}

export default function ChartEvolucion({ data, ultimoParcial = false }: ChartEvolucionProps) {
  if (data.length === 0 || data.every((d) => d.total === 0)) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-[13px] text-text-secondary">Sin datos disponibles</p>
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.total), 1);
  const ALTO = 130;
  return (
    <div className="flex items-end gap-2 mt-4" role="img" aria-label="Ingresos por mes">
      {data.map((d, i) => {
        const parcial = ultimoParcial && i === data.length - 1;
        return (
          <div key={`${d.mes}-${i}`} className="flex-1 min-w-0 flex flex-col items-center gap-1.5" title={`${d.mes}: ${formatMoney(d.total)}`}>
            <span className="text-[11px] font-numbers font-bold text-text-primary whitespace-nowrap">{compacto(d.total)}</span>
            <span
              className={`w-full rounded-t-[8px] rounded-b-[3px] ${parcial ? "barra-parcial" : "bg-rosa/85"}`}
              style={{ height: Math.max(3, (d.total / max) * ALTO) }}
            />
            <span className="text-[11px] text-text-secondary text-center leading-tight min-h-[28px]">
              {d.mes}
              {parcial && (
                <>
                  <br />
                  en curso
                </>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
