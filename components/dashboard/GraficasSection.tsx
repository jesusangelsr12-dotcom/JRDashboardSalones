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
import { PeriodNav, Segmented, SectionLabel } from "@/components/ui/Primitives";

interface GraficasSectionProps {
  citas: Cita[];
  gastos: Gasto[];
  comisiones?: Comision[];
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

  // ¿El último mes de la evolución es el mes en curso?
  const ultimoParcial =
    mainTab === "mensual"
      ? selectedMes.year === hoy.getFullYear() && selectedMes.month === hoy.getMonth()
      : selectedAnio === hoy.getFullYear();

  const ingresosPeriodo = datos.distribucionMetodo.reduce((s, d) => s + d.total, 0);

  const canPrev = mainTab === "mensual" ? mesIdx > 0 : anioIdx > 0;
  const canNext = mainTab === "mensual" ? mesIdx < meses.length - 1 : anioIdx < anios.length - 1;

  return (
    <section>
      <Segmented
        className="max-w-[250px] mx-auto mb-3"
        opciones={[{ id: "mensual", label: "Mensual" }, { id: "anual", label: "Anual" }]}
        valor={mainTab}
        onChange={setMainTab}
      />

      <PeriodNav
        card
        label={periodLabel}
        canPrev={canPrev}
        canNext={canNext}
        prevLabel="Periodo anterior"
        nextLabel="Periodo siguiente"
        onPrev={() => {
          if (mainTab === "mensual" && mesIdx > 0) setMesIdx(mesIdx - 1);
          if (mainTab === "anual" && anioIdx > 0) setAnioIdx(anioIdx - 1);
        }}
        onNext={() => {
          if (mainTab === "mensual" && mesIdx < meses.length - 1) setMesIdx(mesIdx + 1);
          if (mainTab === "anual" && anioIdx < anios.length - 1) setAnioIdx(anioIdx + 1);
        }}
      />

      <div className="flex items-center justify-between px-0.5 mt-2.5 mb-2.5">
        <span className="text-[11.5px] text-text-secondary">Ingresos del periodo</span>
        <span className="font-numbers text-[18px] font-bold text-text-primary">{formatMoney(ingresosPeriodo)}</span>
      </div>

      {/* Chart switcher */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`px-3.5 py-[7px] rounded-full text-[12.5px] font-display font-semibold whitespace-nowrap border transition-all ${
              view === v.id ? "bg-tinta border-tinta text-white" : "bg-surface border-border text-text-secondary"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Chart container */}
      <div className="bg-surface rounded-card border border-border p-3.5 mb-3">
        <SectionLabel>
          {view === "evolucion" && "Ingresos · últimos 6 meses"}
          {view === "servicios" && `Top servicios · ${periodLabel}`}
          {view === "metodo" && `Método de pago · ${periodLabel}`}
          {view === "gastos" && `Top gastos · ${periodLabel}`}
        </SectionLabel>

        {view === "evolucion" && <ChartEvolucion data={datos.evolucionMensual} ultimoParcial={ultimoParcial} />}
        {view === "servicios" && <ChartTopServicios data={datos.topServicios} />}
        {view === "metodo" && <ChartMetodoPago data={datos.distribucionMetodo} />}
        {view === "gastos" && <ChartTopGastos data={datos.topGastos} />}
      </div>

      {/* Top clientas card */}
      {datos.topClientasPorGasto.length > 0 && (
        <div className="bg-surface rounded-card border border-border p-3.5">
          <SectionLabel className="mb-1">Top clientas · {periodLabel}</SectionLabel>
          {datos.topClientasPorGasto.slice(0, 5).map((c, i) => (
            <div key={c.nombre} className="flex items-center gap-2.5 py-2.5 border-b border-border last:border-b-0">
              <span className="w-[22px] h-[22px] rounded-full bg-rubor text-rosa flex items-center justify-center text-[11px] font-numbers font-bold flex-shrink-0">
                {i + 1}
              </span>
              <span className="flex-1 min-w-0 text-[13px] font-display font-semibold text-text-primary truncate">{c.nombre}</span>
              <span className="text-[13.5px] font-numbers font-bold text-text-primary flex-shrink-0">{formatMoney(c.total)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
