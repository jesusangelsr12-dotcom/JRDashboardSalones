"use client";

import { useMemo, useState } from "react";
import type { ResumenSemanal as ResumenType, MovimientoBolsa, Gasto, GastoFijo, Comision } from "@/lib/types";
import {
  formatMoney,
  calcularGastoProductosMes,
  getLunesDeSemana,
  getDomingoDeSemana,
  enRango,
} from "@/lib/calculations";
import KpiCard from "./KpiCard";
import MetodoBreakdown from "./MetodoBreakdown";
import GastoDetalleModal from "./GastoDetalleModal";

interface ResumenSemanalProps {
  resumen: ResumenType;
  salonColor: string;
  movimientos?: MovimientoBolsa[];
  gastosFijos?: GastoFijo[];
  gastos?: Gasto[];
  comisiones?: Comision[];
}

// Defaults estables para no invalidar useMemo en cada render
const SIN_GASTOS: Gasto[] = [];
const SIN_COMISIONES: Comision[] = [];

const SEMAFORO_COLORS: Record<string, string> = {
  verde: "#16a34a",
  amarillo: "#C8963C",
  rojo: "#dc2626",
};

export default function ResumenSemanal({
  resumen,
  salonColor,
  movimientos = [],
  gastosFijos = [],
  gastos = SIN_GASTOS,
  comisiones = SIN_COMISIONES,
}: ResumenSemanalProps) {
  const [detalleGastos, setDetalleGastos] = useState<"fijos" | "bolsas" | "comisiones" | null>(null);

  const gastosSemana = useMemo(() => {
    const hoy = new Date();
    return enRango(gastos, getLunesDeSemana(hoy), getDomingoDeSemana(hoy));
  }, [gastos]);

  const comisionesSemana = useMemo(() => {
    const hoy = new Date();
    return enRango(comisiones, getLunesDeSemana(hoy), getDomingoDeSemana(hoy));
  }, [comisiones]);

  const kpiProductos = useMemo(() => {
    const hoy = new Date();
    return calcularGastoProductosMes(
      movimientos,
      resumen.ingresos,
      hoy.getMonth(),
      hoy.getFullYear()
    );
  }, [movimientos, resumen.ingresos]);

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
          onClick={() => setDetalleGastos("fijos")}
        />

        {/* Comisiones trabajadoras (restan de libre) */}
        <KpiCard
          label="Comisiones"
          value={resumen.comisiones}
          negative
          onClick={() => setDetalleGastos("comisiones")}
        />

        {/* Gastos variables (info, no restan de libre) */}
        <div className="col-span-2">
          <KpiCard
            label="Gastos en bolsas"
            value={resumen.gastosVariables}
            negative
            onClick={() => setDetalleGastos("bolsas")}
          />
        </div>

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
            Ingresos − Gastos fijos − Comisiones
          </p>
        </div>

        {/* KPI: Productos del mes */}
        {(kpiProductos.totalProductos > 0 || movimientos.length > 0) && (
          <div className="col-span-2 relative overflow-hidden rounded-card border border-border bg-surface p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] uppercase tracking-[0.08em] text-text-secondary font-display font-medium">
                Productos del mes
              </p>
              {kpiProductos.ratio > 20 && (
                <span className="text-[12px]">⚠️</span>
              )}
            </div>
            <div className="flex items-baseline gap-3">
              <p className="font-numbers text-xl font-medium text-text-primary">
                {formatMoney(kpiProductos.totalProductos)}
              </p>
              <p
                className="font-numbers text-[14px] font-medium"
                style={{ color: SEMAFORO_COLORS[kpiProductos.semaforo] }}
              >
                {kpiProductos.ratio.toFixed(1)}% de ingresos
              </p>
            </div>
            <div className="mt-2 h-1.5 bg-bg rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(kpiProductos.ratio, 100)}%`,
                  backgroundColor: SEMAFORO_COLORS[kpiProductos.semaforo],
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Método de pago breakdown */}
      <MetodoBreakdown
        porMetodo={resumen.porMetodo}
        total={resumen.ingresos}
      />

      {/* Detalle de gastos (fijos / en bolsas) */}
      <GastoDetalleModal
        open={detalleGastos !== null}
        onClose={() => setDetalleGastos(null)}
        tipo={detalleGastos}
        gastosFijos={gastosFijos}
        gastosSemana={gastosSemana}
        comisionesSemana={comisionesSemana}
        salonColor={salonColor}
      />
    </section>
  );
}
