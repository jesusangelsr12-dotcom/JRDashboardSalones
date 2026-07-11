"use client";

import { useState, useMemo } from "react";
import type { Cita, Gasto, Comision, DatosGraficas } from "@/lib/types";
import {
  formatMoney,
  calcularDatosGraficas,
  calcularDatosGraficasAnual,
  mesesDisponibles,
  aniosDisponibles,
} from "@/lib/calculations";
import ChartEvolucion from "./charts/ChartEvolucion";
import ChartTopServicios from "./charts/ChartTopServicios";
import ChartMetodoPago from "./charts/ChartMetodoPago";
import ChartTopGastos from "./charts/ChartTopGastos";

interface GraficasSectionProps {
  citas: Cita[];
  gastos: Gasto[];
  comisiones?: Comision[];
  salonColor: string;
  comisionTarjeta?: number;
}

// Default estable para no invalidar useMemo en cada render
const SIN_COMISIONES: Comision[] = [];

type MainTab = "mensual" | "anual";
type ChartView = "evolucion" | "servicios" | "metodo" | "gastos";

const VIEWS: { id: ChartView; label: string }[] = [
  { id: "evolucion", label: "Evolución" },
  { id: "servicios", label: "Servicios" },
  { id: "metodo", label: "Método" },
  { id: "gastos", label: "Gastos" },
];

export default function GraficasSection({
  citas,
  gastos,
  comisiones = SIN_COMISIONES,
  salonColor,
  comisionTarjeta = 0,
}: GraficasSectionProps) {
  const [mainTab, setMainTab] = useState<MainTab>("mensual");
  const [view, setView] = useState<ChartView>("evolucion");

  const meses = useMemo(() => mesesDisponibles(citas, gastos), [citas, gastos]);
  const anios = useMemo(() => aniosDisponibles(citas, gastos), [citas, gastos]);

  // Find current month index
  const hoy = new Date();
  const currentIdx = meses.findIndex(
    (m) => m.year === hoy.getFullYear() && m.month === hoy.getMonth()
  );
  const [mesIdx, setMesIdx] = useState(Math.max(currentIdx, 0));
  const [anioIdx, setAnioIdx] = useState(anios.length - 1);

  const selectedMes = meses[mesIdx] || { year: hoy.getFullYear(), month: hoy.getMonth(), label: "" };
  const selectedAnio = anios[anioIdx] || hoy.getFullYear();

  // Calculate chart data based on tab
  const datos: DatosGraficas = useMemo(() => {
    if (mainTab === "mensual") {
      return calcularDatosGraficas(citas, gastos, comisiones, selectedMes.year, selectedMes.month, comisionTarjeta);
    }
    return calcularDatosGraficasAnual(citas, gastos, comisiones, selectedAnio, comisionTarjeta);
  }, [mainTab, citas, gastos, comisiones, selectedMes, selectedAnio, comisionTarjeta]);

  const periodLabel = mainTab === "mensual" ? selectedMes.label : String(selectedAnio);

  return (
    <section>
      {/* Main tabs: Mensual / Anual */}
      <div className="flex gap-2 mb-4">
        {(["mensual", "anual"] as MainTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setMainTab(tab)}
            className={`px-4 py-2 rounded-card text-[13px] font-display font-semibold transition-all ${
              mainTab === tab
                ? "text-white"
                : "text-text-secondary bg-bg border border-border"
            }`}
            style={mainTab === tab ? { backgroundColor: salonColor } : undefined}
          >
            {tab === "mensual" ? "Mensual" : "Anual"}
          </button>
        ))}
      </div>

      {/* Period navigation */}
      <div className="flex items-center justify-between mb-4 bg-surface rounded-card border border-border px-4 py-2.5">
        <button
          onClick={() => {
            if (mainTab === "mensual" && mesIdx > 0) setMesIdx(mesIdx - 1);
            if (mainTab === "anual" && anioIdx > 0) setAnioIdx(anioIdx - 1);
          }}
          disabled={
            (mainTab === "mensual" && mesIdx === 0) ||
            (mainTab === "anual" && anioIdx === 0)
          }
          className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary disabled:opacity-30 active:scale-90 transition-transform"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 3L5 7L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <span className="text-[14px] font-display font-semibold text-text-primary capitalize">
          {periodLabel}
        </span>

        <button
          onClick={() => {
            if (mainTab === "mensual" && mesIdx < meses.length - 1) setMesIdx(mesIdx + 1);
            if (mainTab === "anual" && anioIdx < anios.length - 1) setAnioIdx(anioIdx + 1);
          }}
          disabled={
            (mainTab === "mensual" && mesIdx >= meses.length - 1) ||
            (mainTab === "anual" && anioIdx >= anios.length - 1)
          }
          className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary disabled:opacity-30 active:scale-90 transition-transform"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Chart switcher */}
      <div className="flex gap-2 mb-5 overflow-x-auto">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`px-3 py-1.5 rounded-full text-[12px] font-display font-medium transition-all whitespace-nowrap ${
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
          {view === "servicios" && `Top servicios — ${periodLabel}`}
          {view === "metodo" && `Método de pago — ${periodLabel}`}
          {view === "gastos" && `Top gastos — ${periodLabel}`}
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

        {view === "gastos" && (
          <ChartTopGastos data={datos.topGastos} color={salonColor} />
        )}
      </div>

      {/* Top clientas card */}
      {datos.topClientasPorGasto.length > 0 && (
        <div className="bg-surface rounded-card border border-border p-4">
          <p className="text-[11px] uppercase tracking-[0.08em] text-text-secondary font-display font-medium mb-3">
            Top clientas — {periodLabel}
          </p>
          <div className="space-y-2.5">
            {datos.topClientasPorGasto.slice(0, 5).map((c, i) => (
              <div key={c.nombre} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-medium text-white flex-shrink-0"
                    style={{ backgroundColor: salonColor }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-[13px] font-display text-text-primary truncate max-w-[180px]">
                    {c.nombre}
                  </span>
                </div>
                <span className="text-[13px] font-numbers font-medium text-text-primary flex-shrink-0">
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
