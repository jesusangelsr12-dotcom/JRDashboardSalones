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
import { PeriodNav, Segmented, SectionLabel, METODO_COLOR, mayuscula } from "@/components/ui/Primitives";

interface EstadoResultadosProps {
  citas: Cita[];
  gastos: Gasto[];
  comisiones?: Comision[];
  gastosFijos: GastoFijo[];
  comisionTarjeta: number;
  salonNombre: string;
}

type Modo = "mes" | "semana" | "anual";

export default function EstadoResultados({
  citas,
  gastos,
  comisiones = [],
  gastosFijos,
  comisionTarjeta,
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
      periodoLabel = esAnioActual ? `${selectedAnio} (al día de hoy)` : `${selectedAnio}`;
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
    <section className="bg-surface rounded-card border border-border p-3.5 mb-4">
      <Segmented
        className="mb-2.5"
        opciones={[{ id: "mes", label: "Mensual" }, { id: "semana", label: "Semanal" }, { id: "anual", label: "Anual" }]}
        valor={modo}
        onChange={setModo}
      />
      <PeriodNav label={estado.periodoLabel} onPrev={navPrev} onNext={navNext} canPrev={canPrev} canNext={canNext} />

      {/* Estado de resultados — pensado para captura de pantalla */}
      <div className="mt-3 mb-2 pb-2.5 border-b-2 border-tinta">
        <h2 className="font-brand text-[16px] font-bold tracking-[-0.02em] text-text-primary">Estado de Resultados</h2>
        <p className="text-[12px] text-text-secondary">
          {salonNombre} · {mayuscula(estado.periodoLabel)}
        </p>
      </div>

      <div className="space-y-0.5">
        <Row label="(+) Ingresos brutos" value={estado.ingresosBrutos} bold />
        {comisionTarjeta > 0 && (
          <Row label={`(-) Comisión tarjeta (${comisionTarjeta}%)`} value={-estado.comisionTotal} negative />
        )}
      </div>

      <div className="border-t border-border mt-1.5 pt-1.5">
        <Row label="Ingresos netos" value={estado.ingresosNetos} bold />
      </div>

      <div className="mt-2">
        <Row label="(-) Gastos fijos" value={-estado.gastosFijosMonto} negative />
        {estado.detalleGastosFijos.map((gf, i) => (
          <SubRow key={gf.nombre || i} label={gf.nombre || "Sin nombre"} value={gf.monto} />
        ))}
      </div>

      {estado.comisionesTrabajadoras > 0 && (
        <div className="mt-1">
          <Row label="(-) Comisiones trabajadoras" value={-estado.comisionesTrabajadoras} negative />
        </div>
      )}

      <div className="mt-1">
        <Row label="(-) Gastos variables" value={-estado.gastosVariables} negative />
      </div>

      {/* Utilidad Operativa */}
      <div className="border-t-2 border-tinta mt-3 pt-3 flex items-center justify-between gap-3">
        <span className="flex flex-col">
          <span className="text-[14px] font-display font-bold text-text-primary">Utilidad Operativa</span>
          <span className="text-[11.5px] text-text-secondary">Antes del sueldo de las dueñas</span>
        </span>
        <span className={`font-numbers text-[22px] font-bold ${estado.utilidadOperativa >= 0 ? "text-entra" : "text-sale"}`}>
          {estado.utilidadOperativa >= 0 ? "" : "−"}
          {formatMoney(Math.abs(estado.utilidadOperativa))}
        </span>
      </div>
      <div className="flex justify-end mt-1.5">
        <span
          className={`text-[12px] font-numbers font-bold px-2.5 py-0.5 rounded-full ${
            estado.margenOperativo >= 0 ? "bg-entra-soft text-entra" : "bg-sale-soft text-sale"
          }`}
        >
          Margen: {estado.margenOperativo.toFixed(1)}%
        </span>
      </div>

      {/* Desglose por método */}
      <div className="mt-4 pt-3 border-t border-border">
        <SectionLabel className="mb-2">Ingresos netos por método de pago</SectionLabel>
        <div className="space-y-1.5">
          {(["Efectivo", "Tarjeta", "Transferencia"] as const).map((m) => {
            if (estado.porMetodo[m] === 0) return null;
            return (
              <div key={m} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[12.5px] text-text-secondary">
                  <span className="w-2 h-2 rounded-[3px]" style={{ backgroundColor: METODO_COLOR[m] }} />
                  {m}
                </span>
                <span className="text-[13px] font-numbers font-semibold text-text-primary">{formatMoney(estado.porMetodo[m])}</span>
              </div>
            );
          })}
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
  negative,
}: {
  label: string;
  value: number;
  bold?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className={`text-[13px] ${bold ? "font-bold text-text-primary" : negative ? "text-sale" : "text-text-secondary"}`}>{label}</span>
      <span className={`font-numbers text-[14px] ${bold ? "font-bold" : "font-semibold"} ${negative ? "text-sale" : "text-text-primary"}`}>
        {value >= 0 ? "" : "−"}
        {formatMoney(Math.abs(value))}
      </span>
    </div>
  );
}

function SubRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between pl-3 py-0.5">
      <span className="text-[12px] text-text-secondary">{label}</span>
      <span className="text-[12px] font-numbers text-text-secondary">{formatMoney(value)}</span>
    </div>
  );
}
