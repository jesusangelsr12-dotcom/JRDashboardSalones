"use client";

import { useState } from "react";
import type { DatosGraficas } from "@/lib/types";
import { formatMoney } from "@/lib/calculations";
import ChartEvolucion from "./charts/ChartEvolucion";
import ChartTopServicios from "./charts/ChartTopServicios";
import ChartMetodoPago from "./charts/ChartMetodoPago";

interface GraficasSectionProps {
  datos: DatosGraficas;
  salonColor: string;
  mesLabel: string;
}

type ChartView = "evolucion" | "servicios" | "metodo";

const VIEWS: { id: ChartView; label: string }[] = [
  { id: "evolucion", label: "Evolución" },
  { id: "servicios", label: "Servicios" },
  { id: "metodo", label: "Método" },
];

export default function GraficasSection({
  datos,
  salonColor,
  mesLabel,
}: GraficasSectionProps) {
  const [view, setView] = useState<ChartView>("evolucion");

  return (
    <section>
      {/* Chart switcher */}
      <div className="flex gap-2 mb-5">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`px-3 py-1.5 rounded-full text-[12px] font-display font-medium transition-all ${
              view === v.id
                ? "text-white"
                : "text-text-secondary bg-bg border border-border"
            }`}
            style={view === v.id ? { backgroundColor: salonColor } : undefined}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Chart container */}
      <div className="bg-surface rounded-card border border-border p-4 mb-4">
        <p className="text-[11px] uppercase tracking-[0.08em] text-text-secondary font-display font-medium mb-4">
          {view === "evolucion" && "Ingresos — últimos 6 meses"}
          {view === "servicios" && `Top servicios — ${mesLabel}`}
          {view === "metodo" && `Método de pago — ${mesLabel}`}
        </p>

        {view === "evolucion" && (
          <ChartEvolucion data={datos.evolucionMensual} color={salonColor} />
        )}

        {view === "servicios" && (
          <ChartTopServicios data={datos.topServicios} color={salonColor} />
        )}

        {view === "metodo" && (
          <ChartMetodoPago data={datos.distribucionMetodo} />
        )}
      </div>

      {/* Top clientas card */}
      {datos.topClientasPorGasto.length > 0 && (
        <div className="bg-surface rounded-card border border-border p-4">
          <p className="text-[11px] uppercase tracking-[0.08em] text-text-secondary font-display font-medium mb-3">
            Top clientas del mes
          </p>
          <div className="space-y-2.5">
            {datos.topClientasPorGasto.slice(0, 5).map((c, i) => (
              <div key={c.nombre} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-medium text-white"
                    style={{ backgroundColor: salonColor }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-[13px] font-display text-text-primary truncate max-w-[160px]">
                    {c.nombre}
                  </span>
                </div>
                <span className="text-[13px] font-numbers font-medium text-text-primary">
                  {formatMoney(c.total)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
