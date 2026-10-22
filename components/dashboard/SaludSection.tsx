"use client";

import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Salon, Cita, Gasto, Comision } from "@/lib/types";
import { formatMoney, costoNeto } from "@/lib/calculations";
import {
  calcularSalud,
  calcularSaludMismoTramoAnterior,
  colorSemaforo,
  DOW_LABELS,
  DOW_LABELS_LARGO,
  PE_COBERTURA_VERDE,
  FACTOR_RIESGO_DEFAULT,
  type KpiResultado,
  type ClientaRiesgo,
} from "@/lib/salud";
import EstadoResultados from "./EstadoResultados";
import Modal from "@/components/ui/Modal";
import { Delta, PeriodNav, Segmented, SectionLabel, SemaforoChip, iniciales, semaforoGlobalLabel } from "@/components/ui/Primitives";
import {
  IconChat,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconKpiFrecuencia,
  IconKpiMargen,
  IconKpiPersonal,
  IconKpiRecurrente,
  IconKpiRenta,
  IconKpiRetencion,
} from "@/components/ui/Icons";

interface SaludSectionProps {
  salon: Salon;
  citas: Cita[];
  gastos: Gasto[];
  comisiones?: Comision[];
}

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MESES_CORTOS = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
// Días valle en orden lunes → domingo, igual que las semanas de cierre
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0];

// ── Helpers de "contactada" (persistencia local por semana) ──
function semanaKey(d = new Date()): string {
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

const CONTACTADAS_VERSION = 1;

// Default estable para no invalidar useMemo en cada render
const SIN_COMISIONES: Comision[] = [];

export default function SaludSection({ salon, citas, gastos, comisiones = SIN_COMISIONES }: SaludSectionProps) {
  // "Hoy" se refresca al recuperar foco (igual que el refetch de datos), para
  // que los KPIs por día no queden corridos si la app queda abierta tras la medianoche.
  const [hoy, setHoy] = useState(() => new Date());
  const [modo, setModo] = useState<"mes" | "ano">("mes");
  const [offset, setOffset] = useState(0); // 0 = periodo actual, -1 = anterior...
  const [showDetalle, setShowDetalle] = useState(false);
  const [showRiesgo, setShowRiesgo] = useState(true);
  const [contactadas, setContactadas] = useState<Record<string, string>>({});
  const [kpiDetalle, setKpiDetalle] = useState<{ nombre: string; kpi: KpiResultado; formato: (v: number) => string } | null>(null);
  const [clientaDetalle, setClientaDetalle] = useState<ClientaRiesgo | null>(null);

  // "Hoy" solo se actualiza al cambiar de día (evita recálculos al recuperar foco).
  useEffect(() => {
    const refresh = () => setHoy((prev) => (new Date().toDateString() === prev.toDateString() ? prev : new Date()));
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  const cambiarModo = (m: "mes" | "ano") => { setModo(m); setOffset(0); };

  const periodoRef = modo === "ano"
    ? new Date(hoy.getFullYear() + offset, 0, 1)
    : new Date(hoy.getFullYear(), hoy.getMonth() + offset, 1);
  const year = periodoRef.getFullYear();
  const month = periodoRef.getMonth();
  const pSuffix = modo === "ano" ? "del año" : "del mes";

  // Cargar contactadas (esquema versionado; conservamos solo la semana actual,
  // que es lo único que cuenta el scorecard — evita crecimiento sin límite).
  const lsKey = `jr_contactadas_${salon.id}`;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(lsKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const data: Record<string, string> = parsed?.v === CONTACTADAS_VERSION && parsed.data ? parsed.data : {};
      const wk = semanaKey();
      const pruned: Record<string, string> = {};
      for (const [k, v] of Object.entries(data)) if (v === wk) pruned[k] = v;
      setContactadas(pruned);
    } catch { /* noop */ }
  }, [lsKey]);

  const toggleContactada = (nombre: string) => {
    setContactadas((prev) => {
      const wk = semanaKey();
      const next = { ...prev };
      if (next[nombre] === wk) delete next[nombre];
      else next[nombre] = wk;
      try { localStorage.setItem(lsKey, JSON.stringify({ v: CONTACTADAS_VERSION, data: next })); } catch { /* noop */ }
      return next;
    });
  };

  // Un solo pase calcula el periodo actual y el previo (para el delta, solo en modo mes).
  // El mes en curso se compara contra el mismo tramo del mes anterior
  // (1–22 sep si hoy es 22 oct); un mes ya cerrado, contra el mes completo.
  const { salud, saludPrev, refPrev } = useMemo(() => {
    const com = salon.comisionTarjeta ?? 0;
    const cur = calcularSalud(citas, gastos, comisiones, salon.gastosFijos, salon.bolsas, year, month, com, hoy, FACTOR_RIESGO_DEFAULT, modo);
    if (modo === "ano") return { salud: cur, saludPrev: cur, refPrev: "" };
    const dPrev = new Date(year, month - 1, 1);
    if (offset === 0) {
      const { salud: prev, corte } = calcularSaludMismoTramoAnterior(
        citas, gastos, comisiones, salon.gastosFijos, salon.bolsas, year, month, com, hoy
      );
      return { salud: cur, saludPrev: prev, refPrev: `1–${corte.getDate()} ${MESES_CORTOS[corte.getMonth()]}` };
    }
    const prev = calcularSalud(citas, gastos, comisiones, salon.gastosFijos, salon.bolsas, dPrev.getFullYear(), dPrev.getMonth(), com, hoy, FACTOR_RIESGO_DEFAULT, "mes");
    return { salud: cur, saludPrev: prev, refPrev: MESES[dPrev.getMonth()] };
  }, [citas, gastos, comisiones, salon, year, month, hoy, modo, offset]);

  const esAnio = modo === "ano";
  const deltaUtilidad = salud.utilidad - saludPrev.utilidad;
  const periodoLabel = esAnio ? String(year) : MESES[month];

  const contactadasCount = salud.clientasEnRiesgo.filter((c) => contactadas[c.clienta] === semanaKey()).length;

  const maxDia = Math.max(...salud.citasPorDia.map((x) => x.promedio), 1);
  const peColor = colorSemaforo(salud.puntoEquilibrio.semaforo).fg;
  const abrirKpi = (nombre: string, kpi: KpiResultado, formato: (v: number) => string) => setKpiDetalle({ nombre, kpi, formato });

  return (
    <section className="pb-2">
      {/* ── Toggle Mes / Año ── */}
      <Segmented
        className="max-w-[250px] mx-auto mb-3"
        opciones={[{ id: "mes", label: "Mes" }, { id: "ano", label: "Año (YTD)" }]}
        valor={modo}
        onChange={cambiarModo}
      />

      {/* ── Selector de periodo ── */}
      <PeriodNav
        label={esAnio ? `${year}${year === hoy.getFullYear() ? " · al día de hoy" : ""}` : `${MESES[month]} ${year}`}
        onPrev={() => setOffset(offset - 1)}
        onNext={() => offset < 0 && setOffset(offset + 1)}
        canNext={offset < 0}
        prevLabel={esAnio ? "Año anterior" : "Mes anterior"}
        nextLabel={esAnio ? "Año siguiente" : "Mes siguiente"}
      />

      {/* ── Hero: semáforo + utilidad ── */}
      <div className="text-center pt-4 pb-2 flex flex-col items-center">
        <div className="mb-3">
          <SemaforoChip semaforo={salud.semaforoGlobal} label={semaforoGlobalLabel(salud.semaforoGlobal)} size="lg" />
        </div>
        <p className="text-[11px] uppercase tracking-[0.07em] text-text-secondary font-display font-bold">Utilidad de {periodoLabel}</p>
        <p className="font-numbers text-[46px] leading-none font-extrabold tracking-[-0.04em] text-text-primary mt-1.5">{formatMoney(salud.utilidad)}</p>
        <p
          className={`text-[13px] font-display font-semibold mt-2.5 ${
            esAnio ? "text-text-secondary" : deltaUtilidad >= 0 ? "text-entra" : "text-sale"
          }`}
        >
          {esAnio
            ? `Margen ${salud.margenNeto.valor.toFixed(1)}% en el año`
            : `${deltaUtilidad >= 0 ? "▲" : "▼"} ${formatMoney(Math.abs(deltaUtilidad))} vs. ${refPrev}`}
        </p>
      </div>

      {/* ── Resumen del periodo (cambia al navegar) ── */}
      <SectionLabel className="mb-2.5 mt-5">Resumen de {periodoLabel}</SectionLabel>
      <div className="grid grid-cols-2 gap-2.5 mb-5">
        <ScoreChip
          valor={formatMoney(salud.ingresosMes)}
          label={`Ingreso ${pSuffix}`}
          delta={esAnio ? null : <Delta actual={salud.ingresosMes} base={saludPrev.ingresosMes} referencia={`vs. ${refPrev}`} />}
          note={esAnio ? "Acumulado del año" : undefined}
        />
        <ScoreChip
          valor={salud.visitasMes.toLocaleString("es-MX")}
          label={`Visitas ${pSuffix}`}
          delta={esAnio ? null : <Delta actual={salud.visitasMes} base={saludPrev.visitasMes} referencia={`vs. ${refPrev}`} />}
          note={esAnio ? "Acumulado del año" : `Prom. 3 meses: ${salud.visitasPromedio3Meses.toFixed(0)}`}
        />
        <ScoreChip
          valor={salud.visitasMes > 0 ? formatMoney(salud.ticketPromedio.valor) : "—"}
          label="Ticket promedio"
          note={salud.visitasMes === 0 ? "Sin visitas" : salud.ticketPromedio.detalle}
        />
        <ScoreChip
          valor={formatMoney(salud.gastosTotales)}
          label={`Gasto ${pSuffix}`}
          delta={esAnio ? null : <Delta actual={salud.gastosTotales} base={saludPrev.gastosTotales} invertir referencia={`vs. ${refPrev}`} />}
          note={esAnio ? "Acumulado del año" : undefined}
        />
      </div>

      {/* ── Capa A · Rentabilidad ── */}
      <KpiGroup titulo="Rentabilidad">
        <KpiRow icon={<IconKpiMargen size={19} />} nombre="Margen neto" kpi={salud.margenNeto} formato={(v) => `${v.toFixed(1)}%`} onClick={() => abrirKpi("Margen neto", salud.margenNeto, (v) => `${v.toFixed(1)}%`)} />
        <KpiRow icon={<IconKpiPersonal size={19} />} nombre="Costo de personal" kpi={salud.costoPersonal} formato={(v) => `${v.toFixed(0)}%`} onClick={() => abrirKpi("Costo de personal", salud.costoPersonal, (v) => `${v.toFixed(0)}%`)} />
        <KpiRow icon={<IconKpiRenta size={19} />} nombre="Renta / ingreso" kpi={salud.rentaPct} formato={(v) => `${v.toFixed(1)}%`} onClick={() => abrirKpi("Renta / ingreso", salud.rentaPct, (v) => `${v.toFixed(1)}%`)} />
      </KpiGroup>

      {/* ── Punto de equilibrio ── */}
      <button
        onClick={() => abrirKpi("Punto de equilibrio", salud.puntoEquilibrio, (v) => `${v.toFixed(2)}× cubierto`)}
        className="w-full text-left bg-surface rounded-card border border-border p-4 mb-6 active:scale-[0.99] transition-transform"
      >
        <div className="flex justify-between items-center gap-3 mb-3">
          <span className="text-[14px] font-display font-bold text-text-primary flex items-center gap-1">
            Punto de equilibrio
            <IconChevronRight size={14} className="text-tinta/35" />
          </span>
          <span className="font-numbers text-[13.5px] font-bold" style={{ color: peColor }}>
            {salud.puntoEquilibrio.valor.toFixed(2)}× cubierto
          </span>
        </div>
        <div className="h-3 bg-bg rounded-full relative">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, (salud.puntoEquilibrio.valor / PE_COBERTURA_VERDE) * 100)}%`, backgroundColor: peColor }}
          />
          <span className="absolute -top-[3px] -bottom-[3px] w-[2px] rounded bg-tinta/25" style={{ left: `${(1 / PE_COBERTURA_VERDE) * 100}%` }} />
        </div>
        <div className="flex justify-between mt-2.5 text-[11.5px] font-numbers text-text-secondary">
          <span>Venta {formatMoney(salud.ingresosMes)}</span>
          <span>PE {formatMoney(salud.peMonto)}</span>
        </div>
      </button>

      {/* ── Operación · al día de hoy (no depende del mes navegado) ── */}
      <div className="flex items-center gap-3 mb-4 mt-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11px] uppercase tracking-[0.08em] text-text-secondary font-display font-bold">Operación · al día de hoy</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* ── Días valle ── */}
      <SectionLabel className="mb-2.5">Días valle · citas promedio por día (8 semanas)</SectionLabel>
      <div className="bg-surface rounded-card border border-border p-4 mb-6">
        <div className="flex items-stretch gap-[7px] h-[136px]">
          {ORDEN_SEMANA.map((dow) => {
            const d = salud.citasPorDia[dow];
            const h = Math.max(6, (d.promedio / maxDia) * 100);
            return (
              <div key={dow} className="flex-1 min-w-0 flex flex-col items-center gap-[5px]">
                <span className={`text-[11px] font-numbers font-bold ${d.esValle ? "text-sale" : "text-text-secondary"}`}>{d.promedio.toFixed(1)}</span>
                <span className="flex-1 w-full flex items-end">
                  <span
                    className={`block w-full rounded-[7px] transition-all ${d.esValle ? "bg-sale-soft border-[1.5px] border-sale" : "bg-rosa/85"}`}
                    style={{ height: `${h}%` }}
                  />
                </span>
                <span className={`text-[11px] ${d.esValle ? "text-sale font-extrabold" : "text-text-secondary font-semibold"}`}>{DOW_LABELS[dow]}</span>
              </div>
            );
          })}
        </div>
        <p className="text-[12px] text-text-secondary text-center mt-3">
          Promedio de citas por día.{" "}
          {salud.citasPorDia.some((d) => d.esValle)
            ? `Días flojos: ${salud.citasPorDia.filter((d) => d.esValle).map((d) => DOW_LABELS_LARGO[d.dow]).join(" y ")} (en rojo).`
            : "Aún sin suficientes datos para detectar días valle."}
        </p>
      </div>

      {/* ── Capa C · Clientas ── */}
      <KpiGroup titulo="Clientas">
        <KpiRow icon={<IconKpiRetencion size={19} />} nombre="Retención 90 días" kpi={salud.retencion90} formato={(v) => `${v.toFixed(0)}%`} onClick={() => abrirKpi("Retención 90 días", salud.retencion90, (v) => `${v.toFixed(0)}%`)} />
        <KpiRow icon={<IconKpiRecurrente size={19} />} nombre="Ingreso recurrente" kpi={salud.ingresoRecurrente} formato={(v) => `${v.toFixed(0)}%`} onClick={() => abrirKpi("Ingreso recurrente", salud.ingresoRecurrente, (v) => `${v.toFixed(0)}%`)} />
        <KpiRow icon={<IconKpiFrecuencia size={19} />} nombre="Frecuencia de visita" kpi={salud.frecuenciaVisita} formato={(v) => `${v.toFixed(0)} días`} onClick={() => abrirKpi("Frecuencia de visita", salud.frecuenciaVisita, (v) => `${v.toFixed(0)} días`)} />
      </KpiGroup>

      {/* ── Clientas en riesgo ── */}
      <button onClick={() => setShowRiesgo(!showRiesgo)} aria-expanded={showRiesgo} className="flex items-center gap-2 w-full mb-2.5">
        <SectionLabel className="flex-1 text-left">Clientas en riesgo</SectionLabel>
        <span className="text-[11.5px] font-numbers text-text-secondary">
          {contactadasCount}/{salud.clientasEnRiesgo.length} contactadas
        </span>
        <IconChevronDown size={16} className={`text-tinta/35 transition-transform ${showRiesgo ? "rotate-180" : ""}`} />
      </button>

      {showRiesgo && (
        <div className="bg-surface rounded-card border border-border overflow-hidden mb-6">
          <p className="text-[12px] text-text-secondary leading-relaxed px-4 pt-3.5 pb-3 border-b border-border">
            Clientas con al menos 2 visitas que ya pasaron su día habitual de regreso (más de 1.5× lo que suelen tardar) y aún están activas. Ordenadas por lo que han gastado contigo, para que contactes primero a las más valiosas.
          </p>
          {salud.clientasEnRiesgo.length === 0 ? (
            <p className="text-[13px] text-text-secondary text-center py-6">Sin clientas en riesgo 🎉</p>
          ) : (
            salud.clientasEnRiesgo.slice(0, 12).map((c) => {
              const contactada = contactadas[c.clienta] === semanaKey();
              return (
                <div key={c.clienta} className="flex items-center gap-2 pl-3.5 pr-3 py-2.5 border-b border-border last:border-b-0 transition-opacity" style={{ opacity: contactada ? 0.55 : 1 }}>
                  <button onClick={() => setClientaDetalle(c)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
                    <span className="w-[38px] h-[38px] rounded-full bg-rubor text-rosa flex items-center justify-center flex-shrink-0 text-[13px] font-brand font-bold">
                      {iniciales(c.clienta)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13.5px] font-display font-bold text-text-primary truncate">{c.clienta}</span>
                      <span className="block text-[11.5px] text-text-secondary">
                        Hace {c.diasDesdeUltima} días · vuelve cada {c.frecuenciaPersonal}
                      </span>
                    </span>
                    <span className="text-[13px] font-numbers font-bold text-text-primary" title="Total gastado contigo">{formatMoney(c.ingresoHistorico)}</span>
                  </button>
                  <button
                    onClick={() => toggleContactada(c.clienta)}
                    className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-transform active:scale-90 ${
                      contactada ? "bg-entra-soft text-entra" : "bg-rubor text-rosa"
                    }`}
                    title={contactada ? "Contactada esta semana" : "Marcar como contactada"}
                  >
                    {contactada ? <IconCheck size={16} /> : <IconChat size={16} />}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Estado de resultados detallado (colapsable) ── */}
      <button onClick={() => setShowDetalle(!showDetalle)} aria-expanded={showDetalle} className="flex items-center gap-2 w-full mb-2.5">
        <SectionLabel className="flex-1 text-left">Estado de resultados detallado</SectionLabel>
        <IconChevronDown size={16} className={`text-tinta/35 transition-transform ${showDetalle ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {showDetalle && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <EstadoResultados
              citas={citas}
              gastos={gastos}
              comisiones={comisiones}
              gastosFijos={salon.gastosFijos}
              comisionTarjeta={salon.comisionTarjeta ?? 0}
              salonNombre={salon.nombre}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {kpiDetalle && (
        <KpiDetalleModal
          nombre={kpiDetalle.nombre}
          kpi={kpiDetalle.kpi}
          formato={kpiDetalle.formato}
          onClose={() => setKpiDetalle(null)}
        />
      )}

      {clientaDetalle && (
        <ClientaDetalleModal
          clienta={clientaDetalle}
          citas={citas}
          comisionTarjeta={salon.comisionTarjeta ?? 0}
          salonNombre={salon.nombre}
          contactada={contactadas[clientaDetalle.clienta] === semanaKey()}
          onContactar={() => {
            if (contactadas[clientaDetalle.clienta] !== semanaKey()) toggleContactada(clientaDetalle.clienta);
          }}
          onClose={() => setClientaDetalle(null)}
        />
      )}
    </section>
  );
}

// ── Sub-componentes ──

function ScoreChip({ valor, label, delta, note }: { valor: string; label: string; delta?: React.ReactNode; note?: string }) {
  return (
    <div className="bg-surface rounded-[18px] border border-border px-3.5 py-3 min-w-0">
      <p className="font-numbers text-[22px] font-bold tracking-[-0.025em] text-text-primary leading-none">{valor}</p>
      <p className="text-[12px] text-text-secondary mt-1.5 leading-tight">{label}</p>
      {delta ? <div className="mt-1.5">{delta}</div> : note ? <p className="text-[11.5px] text-text-secondary mt-1.5">{note}</p> : null}
    </div>
  );
}

function ClientaDetalleModal({ clienta, citas, comisionTarjeta, salonNombre, contactada, onContactar, onClose }: {
  clienta: ClientaRiesgo; citas: Cita[]; comisionTarjeta: number; salonNombre: string; contactada: boolean; onContactar: () => void; onClose: () => void;
}) {
  // Citas de esta clienta, más recientes primero, agrupadas por año.
  const suyas = citas
    .filter((c) => c.clienta === clienta.clienta)
    .sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

  const porAno = new Map<number, Cita[]>();
  for (const c of suyas) {
    const y = c.fecha.getFullYear();
    const arr = porAno.get(y) || [];
    arr.push(c);
    porAno.set(y, arr);
  }
  const anios = Array.from(porAno.keys()).sort((a, b) => b - a);
  const fmtFecha = (d: Date) => d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });

  const escribir = () => {
    const nombre = clienta.clienta.split(" ")[0];
    const texto = `¡Hola ${nombre}! Te extrañamos en ${salonNombre}. ¿Te apartamos tu próxima cita?`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
    onContactar();
  };

  return (
    <Modal open onClose={onClose}>
      <div className="flex items-center gap-3 mb-3">
        <span className="w-12 h-12 rounded-full bg-rubor text-rosa flex items-center justify-center text-[16px] font-brand font-bold flex-shrink-0">
          {iniciales(clienta.clienta)}
        </span>
        <div className="min-w-0">
          <h3 className="font-brand text-[20px] font-extrabold tracking-[-0.025em] text-text-primary truncate">{clienta.clienta}</h3>
          <p className="text-[12px] text-text-secondary font-numbers">
            {clienta.visitasTotales} visitas · {formatMoney(clienta.ingresoHistorico)} en total
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-bg border border-border rounded-[12px] px-3 py-2">
          <p className="text-[11.5px] text-text-secondary">Última visita</p>
          <p className="text-[14px] font-numbers font-bold text-text-primary">hace {clienta.diasDesdeUltima} días</p>
        </div>
        <div className="bg-bg border border-border rounded-[12px] px-3 py-2">
          <p className="text-[11.5px] text-text-secondary">Suele volver cada</p>
          <p className="text-[14px] font-numbers font-bold text-text-primary">{clienta.frecuenciaPersonal} días</p>
        </div>
      </div>

      <SectionLabel className="mb-2">Historial de citas</SectionLabel>
      <div className="max-h-[38vh] overflow-y-auto -mx-1 px-1">
        {anios.map((y) => (
          <div key={y} className="mb-3">
            <p className="font-brand text-[14px] font-bold text-text-primary mb-1.5">{y}</p>
            <div className="bg-bg border border-border rounded-[12px] overflow-hidden">
              {porAno.get(y)!.map((c, i) => {
                const servicios = c.servicios.length > 0
                  ? c.servicios.map((s) => s.nombre).filter(Boolean).join(", ")
                  : "Servicio";
                return (
                  <div key={i} className="flex items-start justify-between gap-3 px-3 py-2 border-b border-border last:border-b-0">
                    <div className="min-w-0">
                      <p className="text-[13px] font-display font-semibold text-text-primary leading-tight">{servicios}</p>
                      <p className="text-[11px] text-text-secondary mt-0.5">{fmtFecha(c.fecha)} · {c.metodoPago}</p>
                    </div>
                    <span className="text-[13px] font-numbers font-bold text-text-primary flex-shrink-0">{formatMoney(costoNeto(c.costo, c.metodoPago, comisionTarjeta))}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {suyas.length === 0 && (
          <p className="text-[13px] text-text-secondary text-center py-4">Sin citas registradas.</p>
        )}
      </div>

      <button
        onClick={escribir}
        className="w-full mt-3 py-3.5 rounded-[16px] bg-mandarina text-tinta text-[14.5px] font-display font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
      >
        {contactada ? <IconCheck size={17} /> : <IconChat size={17} />}
        {contactada ? "Volver a escribir por WhatsApp" : "Escribir por WhatsApp"}
      </button>
      <button onClick={onClose} className="w-full mt-2 py-3 rounded-[16px] border border-border text-[14px] font-display font-bold text-text-primary active:scale-[0.98] transition-transform">
        Cerrar
      </button>
    </Modal>
  );
}

function KpiGroup({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <SectionLabel className="mb-2.5">{titulo}</SectionLabel>
      <div className="bg-surface rounded-card border border-border overflow-hidden">{children}</div>
    </div>
  );
}

function KpiRow({ icon, nombre, kpi, formato, onClick }: { icon: React.ReactNode; nombre: string; kpi: KpiResultado; formato: (v: number) => string; onClick?: () => void }) {
  const c = colorSemaforo(kpi.semaforo);
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 pl-3.5 pr-3 py-3 border-b border-border last:border-b-0 text-left active:bg-bg transition-colors">
      <span className="w-[38px] h-[38px] rounded-[12px] flex items-center justify-center flex-shrink-0" style={{ backgroundColor: c.bg, color: c.fg }}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-display font-bold text-text-primary">{nombre}</p>
        {kpi.detalle && <p className="text-[11.5px] text-text-secondary mt-0.5">{kpi.detalle}</p>}
      </div>
      <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
        <p className="text-[15px] font-numbers font-bold text-text-primary">{kpi.semaforo === "gris" ? "—" : formato(kpi.valor)}</p>
        <SemaforoChip semaforo={kpi.semaforo} />
      </div>
      <IconChevronRight size={14} className="flex-shrink-0 text-tinta/35" />
    </button>
  );
}

function KpiDetalleModal({ nombre, kpi, formato, onClose }: { nombre: string; kpi: KpiResultado; formato: (v: number) => string; onClose: () => void }) {
  return (
    <Modal open onClose={onClose}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-brand text-[20px] font-extrabold tracking-[-0.025em] text-text-primary">{nombre}</h3>
        <SemaforoChip semaforo={kpi.semaforo} />
      </div>
      <p className="font-numbers text-[38px] font-extrabold tracking-[-0.035em] text-text-primary leading-none mb-3">{kpi.semaforo === "gris" ? "—" : formato(kpi.valor)}</p>
      {kpi.explicacion && <p className="text-[13.5px] text-text-secondary leading-relaxed mb-4">{kpi.explicacion}</p>}
      {kpi.formula && (
        <div className="mb-4">
          <SectionLabel className="mb-1.5">Fórmula</SectionLabel>
          <p className="text-[12.5px] font-mono bg-bg border border-border rounded-[12px] px-3 py-2.5 text-text-primary leading-relaxed">{kpi.formula}</p>
        </div>
      )}
      {kpi.desglose && kpi.desglose.length > 0 && (
        <div>
          <SectionLabel className="mb-1.5">Con tus números</SectionLabel>
          <div className="border border-border rounded-[12px] overflow-hidden">
            {kpi.desglose.map((d, i) => {
              const resultado = d.label.startsWith("=");
              return (
                <div key={i} className={`flex items-center justify-between gap-3 px-3 py-2 border-b border-border last:border-b-0 ${resultado ? "bg-bg" : ""}`}>
                  <span className={`text-[13px] ${resultado ? "font-bold text-text-primary" : "text-text-secondary"}`}>{d.label}</span>
                  <span className="text-[13px] font-numbers font-bold text-text-primary whitespace-nowrap">{d.valor}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <button onClick={onClose} className="w-full mt-5 py-3.5 rounded-[16px] bg-tinta text-white text-[14.5px] font-display font-bold active:scale-[0.98] transition-transform">
        Entendido
      </button>
    </Modal>
  );
}
