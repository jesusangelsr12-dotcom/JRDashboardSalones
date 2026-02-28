"use client";

import type { ResumenSemanal as ResumenType } from "@/lib/types";
import KpiCard from "./KpiCard";
import MetodoBreakdown from "./MetodoBreakdown";

interface ResumenSemanalProps {
  resumen: ResumenType;
  salonColor: string;
}

export default function ResumenSemanal({
  resumen,
  salonColor,
}: ResumenSemanalProps) {
  return (
    <section>
      {/* KPI grid: 2 columns */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Ingresos — full width hero */}
        <KpiCard
          label="Ingresos"
          value={resumen.ingresos}
          accentColor={salonColor}
          variant="large"
        />

        {/* Gastos fijos */}
        <KpiCard
          label="Gastos fijos"
          value={resumen.gastosFijos}
          negative
        />

        {/* Gastos variables (info, no restan de libre) */}
        <KpiCard
          label="Gastos en bolsas"
          value={resumen.gastosVariables}
          negative
        />

        {/* Dinero libre — full width */}
        <div className="col-span-2 relative overflow-hidden rounded-card border-2 p-5"
          style={{ borderColor: resumen.libre >= 0 ? salonColor : "#EF4444" }}
        >
          {/* Background glow */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              background: `radial-gradient(ellipse at bottom right, ${
                resumen.libre >= 0 ? salonColor : "#EF4444"
              } 0%, transparent 70%)`,
            }}
          />

          <p className="relative text-[11px] uppercase tracking-[0.08em] text-text-secondary font-display font-medium mb-1">
            Dinero libre
          </p>
          <p
            className={`relative font-numbers text-[36px] font-medium leading-none ${
              resumen.libre >= 0 ? "text-text-primary" : "text-red-500"
            }`}
          >
            {resumen.libre < 0 ? "-" : ""}
            {new Intl.NumberFormat("es-MX", {
              style: "currency",
              currency: "MXN",
              minimumFractionDigits: 0,
            }).format(Math.abs(resumen.libre))}
          </p>

          {/* Breakdown label */}
          <p className="relative text-[11px] font-mono text-text-secondary mt-2">
            Ingresos − Gastos fijos
          </p>
        </div>
      </div>

      {/* Método de pago breakdown */}
      <MetodoBreakdown
        porMetodo={resumen.porMetodo}
        total={resumen.ingresos}
      />
    </section>
  );
}
