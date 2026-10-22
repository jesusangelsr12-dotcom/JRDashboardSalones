"use client";

import { formatMoney } from "@/lib/calculations";

interface Fila {
  nombre: string;
  total: number;
  detalle?: string;
}

// Ranking con barras horizontales (top servicios / top gastos)
export default function BarrasHorizontales({ filas, color, vacio }: { filas: Fila[]; color: string; vacio: string }) {
  if (filas.length === 0) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-[13px] text-text-secondary">{vacio}</p>
      </div>
    );
  }
  const max = Math.max(...filas.map((f) => f.total), 1);
  return (
    <div className="flex flex-col gap-3 mt-3">
      {filas.map((f, i) => (
        <div key={f.nombre}>
          <div className="flex justify-between gap-2 text-[13px]">
            <span className="flex gap-2 min-w-0">
              <span className="w-3.5 flex-shrink-0 text-[12px] font-numbers font-bold text-text-secondary">{i + 1}</span>
              <span className="truncate text-text-primary">{f.nombre}</span>
            </span>
            <span className="font-numbers font-bold text-text-primary flex-shrink-0">{formatMoney(f.total)}</span>
          </div>
          <div className="h-[7px] bg-bg rounded-full mt-1.5 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(f.total / max) * 100}%`, backgroundColor: color }} />
          </div>
          {f.detalle && <p className="text-[11px] text-text-secondary mt-0.5">{f.detalle}</p>}
        </div>
      ))}
    </div>
  );
}
