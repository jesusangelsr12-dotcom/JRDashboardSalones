"use client";

import { formatMoney } from "@/lib/calculations";

interface BolsaCardProps {
  nombre: string;
  porcentaje: number;
  color: string;
  montoSemana: number;
  acumulado: number;
  gastosAsignados?: number;
}

export default function BolsaCard({
  nombre,
  porcentaje,
  color,
  montoSemana,
  acumulado,
  gastosAsignados = 0,
}: BolsaCardProps) {
  return (
    <div className="bg-surface rounded-[18px] border border-border px-3.5 py-3">
      <div className="flex items-center gap-2.5">
        <span className="w-3 h-3 rounded-[4px] flex-shrink-0" style={{ backgroundColor: color }} />
        <div className="flex-1 min-w-0">
          <h4 className="text-[14px] font-display font-bold text-text-primary leading-tight truncate">{nombre}</h4>
          <p className="text-[11.5px] text-text-secondary">{porcentaje}% del libre</p>
        </div>
        <span className="text-[12px] font-numbers font-bold bg-bg border border-border px-2 py-0.5 rounded-full">{porcentaje}%</span>
      </div>

      <div className={`grid gap-2 mt-2.5 ${gastosAsignados > 0 ? "grid-cols-3" : "grid-cols-2"}`}>
        <Cifra label="Esta semana" valor={formatMoney(montoSemana)} />
        <Cifra label="Acumulado" valor={formatMoney(acumulado)} />
        {gastosAsignados > 0 && <Cifra label="Gastos" valor={`−${formatMoney(gastosAsignados)}`} negativo />}
      </div>

      <div className="mt-2.5 h-1 bg-bg rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${porcentaje}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function Cifra({ label, valor, negativo }: { label: string; valor: string; negativo?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-[0.05em] text-text-secondary font-display font-semibold">{label}</p>
      <p className={`font-numbers text-[17px] font-bold leading-tight whitespace-nowrap ${negativo ? "text-sale" : "text-text-primary"}`}>
        {valor}
      </p>
    </div>
  );
}
