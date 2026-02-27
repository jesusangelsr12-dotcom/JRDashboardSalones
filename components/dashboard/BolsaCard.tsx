"use client";

import { formatMoney } from "@/lib/calculations";

interface BolsaCardProps {
  nombre: string;
  porcentaje: number;
  color: string;
  montoSemana: number;
  acumulado: number;
}

export default function BolsaCard({
  nombre,
  porcentaje,
  color,
  montoSemana,
  acumulado,
}: BolsaCardProps) {
  return (
    <div className="relative overflow-hidden bg-surface rounded-card border border-border p-4">
      {/* Color accent left edge */}
      <div
        className="absolute top-0 left-0 w-1 h-full"
        style={{ backgroundColor: color }}
      />

      <div className="flex items-start justify-between mb-3 ml-2">
        <div>
          <h4 className="text-[14px] font-display font-semibold text-text-primary leading-tight">
            {nombre}
          </h4>
          <p className="text-[11px] font-mono text-text-secondary mt-0.5">
            {porcentaje}% del libre
          </p>
        </div>

        {/* Percentage badge */}
        <div
          className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium"
          style={{
            backgroundColor: color + "14",
            color: color,
          }}
        >
          {porcentaje}%
        </div>
      </div>

      {/* Amounts */}
      <div className="grid grid-cols-2 gap-3 ml-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.06em] text-text-secondary font-display mb-0.5">
            Esta semana
          </p>
          <p className="font-numbers text-lg font-medium text-text-primary leading-tight">
            {formatMoney(montoSemana)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.06em] text-text-secondary font-display mb-0.5">
            Acumulado
          </p>
          <p className="font-numbers text-lg font-medium leading-tight" style={{ color }}>
            {formatMoney(acumulado)}
          </p>
        </div>
      </div>

      {/* Subtle fill indicator */}
      <div className="mt-3 ml-2 h-1 bg-bg rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${porcentaje}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}
