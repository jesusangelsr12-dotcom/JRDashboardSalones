"use client";

import { useState, useMemo } from "react";
import type { Cita, Gasto, Comision, GastoFijo } from "@/lib/types";
import {
  formatMoney,
  costoNeto,
  mesesDisponibles,
  aniosDisponibles,
  getInicioMes,
  getFinMes,
} from "@/lib/calculations";

interface EstadoResultadosProps {
  citas: Cita[];
  gastos: Gasto[];
  comisiones?: Comision[];
  gastosFijos: GastoFijo[];
  comisionTarjeta: number;
  salonColor: string;
  salonNombre: string;
}

type Modo = "mes" | "semana" | "anual";

export default function EstadoResultados({
  citas,
  gastos,
  comisiones = [],
  gastosFijos,
  comisionTarjeta,
  salonColor,
  salonNombre,
}: EstadoResultadosProps) {
  const [modo, setModo] = useState<Modo>("mes");

  // Available periods
  const meses = useMemo(() => mesesDisponibles(citas, gastos), [citas, gastos]);

  const semanas = useMemo(() => {
    const semanasSet = new Set<string>();
    [...citas, ...gastos].forEach((item) => {
      const d = new Date(item.fecha);
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const lunes = new Date(d);
      lunes.setDate(lunes.getDate() + diff);
      lunes.setHours(0, 0, 0, 0);
      semanasSet.add(lunes.toISOString().split("T")[0]);
    });
    // Add current week
    const hoy = new Date();
    const day = hoy.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const lunesActual = new Date(hoy);
    lunesActual.setDate(lunesActual.getDate() + diff);
    lunesActual.setHours(0, 0, 0, 0);
    semanasSet.add(lunesActual.toISOString().split("T")[0]);

    return Array.from(semanasSet).sort().reverse().map((lunesISO) => {
      const lunes = new Date(lunesISO + "T00:00:00");
      const domingo = new Date(lunes);
      domingo.setDate(domingo.getDate() + 6);
      const label = `${lunes.toLocaleDateString("es-MX", { day: "numeric", month: "short" })} — ${domingo.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}`;
      return { lunesISO, domingoISO: domingo.toISOString().split("T")[0], label };
    });
  }, [citas, gastos]);

  // Available years
  const anios = useMemo(() => aniosDisponibles(citas, gastos), [citas, gastos]);

  // Current period index
  const hoy = new Date();
  const currentMesIdx = meses.findIndex(
    (m) => m.year === hoy.getFullYear() && m.month === hoy.getMonth()
  );
  const [mesIdx, setMesIdx] = useState(Math.max(currentMesIdx, meses.length - 1));
  const [semIdx, setSemIdx] = useState(0); // 0 = most recent
  const currentAnioIdx = anios.indexOf(hoy.getFullYear());
  const [anioIdx, setAnioIdx] = useState(Math.max(currentAnioIdx, anios.length - 1));

  const selectedMes = meses[mesIdx];
  const selectedSem = semanas[semIdx];
  const selectedAnio = anios[anioIdx];

  // Calculate Estado de Resultados
  const estado = useMemo(() => {
    let citasPeriodo: Cita[];
    let gastosPeriodo: Gasto[];
    let comisionesPeriodo: Comision[];
    let gastosFijosMonto: number;
    let periodoLabel: string;

    if (modo === "mes" && selectedMes) {
      const inicio = getInicioMes(selectedMes.year, selectedMes.month);
      const fin = getFinMes(selectedMes.year, selectedMes.month);
      citasPeriodo = citas.filter((c) => c.fecha >= inicio && c.fecha <= fin);
      gastosPeriodo = gastos.filter((g) => g.fecha >= inicio && g.fecha <= fin);
      comisionesPeriodo = comisiones.filter((c) => c.fecha >= inicio && c.fecha <= fin);
      // Monthly: use monthly amounts directly, weekly * 4
      gastosFijosMonto = gastosFijos.reduce((sum, gf) => {
        return sum + (gf.frecuencia === "mensual" ? gf.monto : gf.monto * 4);
      }, 0);
      periodoLabel = selectedMes.label;
    } else if (modo === "semana" && selectedSem) {
      const inicio = new Date(selectedSem.lunesISO + "T00:00:00");
      const fin = new Date(selectedSem.domingoISO + "T23:59:59.999");
      citasPeriodo = citas.filter((c) => c.fecha >= inicio && c.fecha <= fin);
      gastosPeriodo = gastos.filter((g) => g.fecha >= inicio && g.fecha <= fin);
      comisionesPeriodo = comisiones.filter((c) => c.fecha >= inicio && c.fecha <= fin);
      // Weekly: monthly / 4, weekly as-is
      gastosFijosMonto = gastosFijos.reduce((sum, gf) => {
        return sum + (gf.frecuencia === "semanal" ? gf.monto : gf.monto / 4);
      }, 0);
      periodoLabel = selectedSem.label;
    } else if (modo === "anual" && selectedAnio) {
      const inicio = new Date(selectedAnio, 0, 1, 0, 0, 0, 0);
      const fin = new Date(selectedAnio, 11, 31, 23, 59, 59, 999);
      citasPeriodo = citas.filter((c) => c.fecha >= inicio && c.fecha <= fin);
      gastosPeriodo = gastos.filter((g) => g.fecha >= inicio && g.fecha <= fin);
      comisionesPeriodo = comisiones.filter((c) => c.fecha >= inicio && c.fecha <= fin);
      // Prorate fixed expenses: calculate actual weeks elapsed
      const esAnioActual = selectedAnio === hoy.getFullYear();
      const mesesTranscurridos = esAnioActual ? hoy.getMonth() + 1 : 12;
      const finPeriodo = esAnioActual ? hoy : fin;
      const msTranscurridos = finPeriodo.getTime() - inicio.getTime();
      const semanasTranscurridas = Math.floor(msTranscurridos / (7 * 24 * 60 * 60 * 1000));
      gastosFijosMonto = gastosFijos.reduce((sum, gf) => {
        return sum + (gf.frecuencia === "mensual"
          ? gf.monto * mesesTranscurridos
          : gf.monto * semanasTranscurridas);
      }, 0);
      periodoLabel = esAnioActual ? `${selectedAnio} (Year-to-Date)` : `${selectedAnio}`;
    } else {
      return null;
    }

    const ingresosBrutos = citasPeriodo.reduce((sum, c) => sum + c.costo, 0);
    const comisionTotal = citasPeriodo.reduce((sum, c) => {
      if (c.metodoPago === "Tarjeta" && comisionTarjeta > 0) {
        return sum + c.costo * (comisionTarjeta / 100);
      }
      return sum;
    }, 0);
    const ingresosNetos = ingresosBrutos - comisionTotal;
    const gastosVariables = gastosPeriodo.reduce((sum, g) => sum + g.monto, 0);
    const comisionesTrabajadoras = comisionesPeriodo.reduce((sum, c) => sum + c.monto, 0);
    const utilidadOperativa = ingresosNetos - gastosFijosMonto - comisionesTrabajadoras - gastosVariables;
    const margenOperativo = ingresosNetos > 0 ? (utilidadOperativa / ingresosNetos) * 100 : 0;

    // Desglose por método de pago (neto)
    const porMetodo = { Efectivo: 0, Tarjeta: 0, Transferencia: 0 };
    citasPeriodo.forEach((c) => {
      porMetodo[c.metodoPago] += costoNeto(c.costo, c.metodoPago, comisionTarjeta);
    });

    // Desglose gastos fijos
    const detalleGastosFijos = gastosFijos.map((gf) => {
      let monto: number;
      if (modo === "mes") {
        monto = gf.frecuencia === "mensual" ? gf.monto : gf.monto * 4;
      } else if (modo === "semana") {
        monto = gf.frecuencia === "semanal" ? gf.monto : gf.monto / 4;
      } else {
        // anual — prorrateo con semanas reales
        const esYTD = selectedAnio === hoy.getFullYear();
        const mTransc = esYTD ? hoy.getMonth() + 1 : 12;
        const inicioAnio = new Date(selectedAnio!, 0, 1, 0, 0, 0, 0);
        const finAnio = new Date(selectedAnio!, 11, 31, 23, 59, 59, 999);
        const finP = esYTD ? hoy : finAnio;
        const sTransc = Math.floor((finP.getTime() - inicioAnio.getTime()) / (7 * 24 * 60 * 60 * 1000));
        monto = gf.frecuencia === "mensual" ? gf.monto * mTransc : gf.monto * sTransc;
      }
      return { nombre: gf.nombre, monto };
    });

    return {
      periodoLabel,
      ingresosBrutos,
      comisionTotal,
      ingresosNetos,
      gastosFijosMonto,
      detalleGastosFijos,
      gastosVariables,
      comisionesTrabajadoras,
      utilidadOperativa,
      margenOperativo,
      porMetodo,
    };
  }, [citas, gastos, comisiones, gastosFijos, comisionTarjeta, modo, mesIdx, semIdx, anioIdx, selectedMes, selectedSem, selectedAnio]);

  if (!estado) return null;

  const navPrev = () => {
    if (modo === "mes" && mesIdx > 0) setMesIdx(mesIdx - 1);
    if (modo === "semana" && semIdx < semanas.length - 1) setSemIdx(semIdx + 1);
    if (modo === "anual" && anioIdx > 0) setAnioIdx(anioIdx - 1);
  };
  const navNext = () => {
    if (modo === "mes" && mesIdx < meses.length - 1) setMesIdx(mesIdx + 1);
    if (modo === "semana" && semIdx > 0) setSemIdx(semIdx - 1);
    if (modo === "anual" && anioIdx < anios.length - 1) setAnioIdx(anioIdx + 1);
  };
  const canPrev = modo === "mes" ? mesIdx > 0 : modo === "semana" ? semIdx < semanas.length - 1 : anioIdx > 0;
  const canNext = modo === "mes" ? mesIdx < meses.length - 1 : modo === "semana" ? semIdx > 0 : anioIdx < anios.length - 1;

  return (
    <section>
      {/* Mode toggle */}
      <div className="flex gap-2 mb-4">
        {(["mes", "semana", "anual"] as Modo[]).map((m) => (
          <button
            key={m}
            onClick={() => setModo(m)}
            className={`px-4 py-2 rounded-card text-[13px] font-display font-semibold transition-all ${
              modo === m
                ? "text-white"
                : "text-text-secondary bg-bg border border-border"
            }`}
            style={modo === m ? { backgroundColor: salonColor } : undefined}
          >
            {m === "mes" ? "Mensual" : m === "semana" ? "Semanal" : "Anual"}
          </button>
        ))}
      </div>

      {/* Period navigation */}
      <div className="flex items-center justify-between mb-5 bg-surface rounded-card border border-border px-4 py-2.5">
        <button
          onClick={navPrev}
          disabled={!canPrev}
          className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary disabled:opacity-30 active:scale-90 transition-transform"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 3L5 7L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <span className="text-[14px] font-display font-semibold text-text-primary capitalize">
          {estado.periodoLabel}
        </span>
        <button
          onClick={navNext}
          disabled={!canNext}
          className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary disabled:opacity-30 active:scale-90 transition-transform"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Estado de Resultados Card — screenshot-friendly */}
      <div className="bg-white rounded-card border border-border p-5 shadow-sm">
        {/* Header */}
        <div className="mb-5 pb-3 border-b-2" style={{ borderColor: salonColor }}>
          <h2 className="text-[16px] font-display font-bold text-gray-900">
            Estado de Resultados
          </h2>
          <p className="text-[13px] font-display text-gray-500">
            {salonNombre} · {estado.periodoLabel}
          </p>
        </div>

        {/* Ingresos */}
        <div className="space-y-2 mb-4">
          <Row label="(+) Ingresos brutos" value={estado.ingresosBrutos} bold />
          {comisionTarjeta > 0 && (
            <Row
              label={`(-) Comisión tarjeta (${comisionTarjeta}%)`}
              value={-estado.comisionTotal}
              negative
            />
          )}
        </div>

        <Divider color={salonColor} />

        <div className="mb-4 mt-3">
          <Row label="Ingresos netos" value={estado.ingresosNetos} bold accent={salonColor} />
        </div>

        {/* Gastos fijos */}
        <div className="space-y-1.5 mb-2">
          <Row label="(-) Gastos fijos" value={-estado.gastosFijosMonto} negative />
          {estado.detalleGastosFijos.map((gf, i) => (
            <SubRow key={gf.nombre || i} label={gf.nombre || "Sin nombre"} value={gf.monto} />
          ))}
        </div>

        {/* Comisiones trabajadoras */}
        {estado.comisionesTrabajadoras > 0 && (
          <div className="mb-2 mt-3">
            <Row label="(-) Comisiones trabajadoras" value={-estado.comisionesTrabajadoras} negative />
          </div>
        )}

        {/* Gastos variables */}
        <div className="mb-3 mt-3">
          <Row label="(-) Gastos variables" value={-estado.gastosVariables} negative />
        </div>

        <Divider color={salonColor} thick />

        {/* Utilidad Operativa */}
        <div className="mt-4 mb-2">
          <Row
            label="Utilidad Operativa"
            value={estado.utilidadOperativa}
            bold
            large
            accent={estado.utilidadOperativa >= 0 ? "#10B981" : "#EF4444"}
          />
          <div className="flex justify-end mt-1">
            <span
              className="text-[12px] font-mono px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: estado.margenOperativo >= 0 ? "#10B98114" : "#EF444414",
                color: estado.margenOperativo >= 0 ? "#10B981" : "#EF4444",
              }}
            >
              Margen: {estado.margenOperativo.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Desglose por método */}
        <div className="mt-5 pt-4 border-t border-gray-100">
          <p className="text-[10px] uppercase tracking-[0.08em] text-gray-400 font-display font-medium mb-3">
            Ingresos netos por método de pago
          </p>
          <div className="space-y-2">
            {(["Efectivo", "Tarjeta", "Transferencia"] as const).map((m) => {
              if (estado.porMetodo[m] === 0) return null;
              return (
                <div key={m} className="flex items-center justify-between">
                  <span className="text-[12px] font-display text-gray-600">{m}</span>
                  <span className="text-[13px] font-mono font-medium text-gray-800">
                    {formatMoney(estado.porMetodo[m])}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Sub-components for the report ──

function Row({
  label,
  value,
  bold,
  large,
  negative,
  accent,
}: {
  label: string;
  value: number;
  bold?: boolean;
  large?: boolean;
  negative?: boolean;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={`text-[13px] font-display ${
          bold ? "font-semibold text-gray-900" : "text-gray-600"
        }`}
      >
        {label}
      </span>
      <span
        className={`font-mono ${large ? "text-[18px] font-bold" : "text-[14px] font-medium"} ${
          negative ? "text-red-500" : ""
        }`}
        style={accent ? { color: accent } : undefined}
      >
        {value >= 0 ? "" : "-"}{formatMoney(Math.abs(value))}
      </span>
    </div>
  );
}

function SubRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between pl-5">
      <span className="text-[11px] font-display text-gray-400">
        {label}
      </span>
      <span className="text-[11px] font-mono text-gray-400">
        {formatMoney(value)}
      </span>
    </div>
  );
}

function Divider({ color, thick }: { color: string; thick?: boolean }) {
  return (
    <div
      className={thick ? "h-[2px]" : "h-px"}
      style={{ backgroundColor: thick ? color : color + "30" }}
    />
  );
}
