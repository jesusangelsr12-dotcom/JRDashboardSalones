"use client";

import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Salon, Cita, Gasto } from "@/lib/types";
import { formatMoney, costoNeto } from "@/lib/calculations";
import {
  calcularSalud,
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

interface SaludSectionProps {
  salon: Salon;
  citas: Cita[];
  gastos: Gasto[];
  salonColor: string;
}

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// ── Helpers de "contactada" (persistencia local por semana) ──
function semanaKey(d = new Date()): string {
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

const CONTACTADAS_VERSION = 1;

export default function SaludSection({ salon, citas, gastos, salonColor }: SaludSectionProps) {
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
  const { salud, saludPrev } = useMemo(() => {
    const com = salon.comisionTarjeta ?? 0;
    const cur = calcularSalud(citas, gastos, salon.gastosFijos, salon.bolsas, year, month, com, hoy, FACTOR_RIESGO_DEFAULT, modo);
    if (modo === "ano") return { salud: cur, saludPrev: cur };
    const dPrev = new Date(year, month - 1, 1);
    const prev = calcularSalud(citas, gastos, salon.gastosFijos, salon.bolsas, dPrev.getFullYear(), dPrev.getMonth(), com, hoy, FACTOR_RIESGO_DEFAULT, "mes");
    return { salud: cur, saludPrev: prev };
  }, [citas, gastos, salon, year, month, hoy, modo]);

  const esAnio = modo === "ano";
  const g = colorSemaforo(salud.semaforoGlobal);
  const deltaUtilidad = salud.utilidad - saludPrev.utilidad;
  const mesPrevioLabel = MESES[(month + 11) % 12];
  const periodoLabel = esAnio ? String(year) : MESES[month];

  const contactadasCount = salud.clientasEnRiesgo.filter((c) => contactadas[c.clienta] === semanaKey()).length;

  return (
    <section className="pb-4">
      {/* ── Toggle Mes / Año ── */}
      <div className="flex gap-1 bg-[#EFE6DA] rounded-[12px] p-1 mb-4 max-w-[220px] mx-auto">
        {([["mes", "Mes"], ["ano", "Año (YTD)"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => cambiarModo(id)}
            className={`flex-1 py-1.5 text-[12px] font-display font-medium rounded-[9px] transition-all ${modo === id ? "text-white shadow-sm" : "text-text-secondary"}`}
            style={modo === id ? { backgroundColor: salonColor } : undefined}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Selector de periodo ── */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <button aria-label={esAnio ? "Año anterior" : "Mes anterior"} onClick={() => setOffset(offset - 1)} className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center active:scale-90 transition-transform">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <span className="text-[13px] font-display font-medium text-text-primary min-w-[130px] text-center">
          {esAnio ? `${year}${year === hoy.getFullYear() ? " · al día de hoy" : ""}` : `${MESES[month]} ${year}`}
        </span>
        <button
          aria-label={esAnio ? "Año siguiente" : "Mes siguiente"}
          onClick={() => offset < 0 && setOffset(offset + 1)}
          disabled={offset >= 0}
          className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center active:scale-90 transition-transform disabled:opacity-30"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      {/* ── Hero: semáforo + utilidad ── */}
      <div className="text-center py-4">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[13px] font-display font-semibold mb-4"
          style={{ backgroundColor: g.bg, color: g.fg }}
        >
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.fg }} />
          {salud.semaforoGlobal === "verde" ? "Salón sano" : salud.semaforoGlobal === "ambar" ? "Atención" : salud.semaforoGlobal === "rojo" ? "En riesgo" : "Sin datos"}
        </div>
        <p className="text-[11px] uppercase tracking-[0.08em] text-text-secondary font-display font-medium">Utilidad de {periodoLabel}</p>
        <p className="font-numbers text-[44px] leading-none font-bold text-text-primary mt-1">{formatMoney(salud.utilidad)}</p>
        <p className="text-[13px] font-display font-medium mt-3" style={{ color: esAnio ? "#6B5D50" : deltaUtilidad >= 0 ? "#1F9D55" : "#C0392B" }}>
          {esAnio
            ? `Margen ${salud.margenNeto.valor.toFixed(1)}% en el año`
            : `${deltaUtilidad >= 0 ? "▲" : "▼"} ${formatMoney(Math.abs(deltaUtilidad))} vs ${mesPrevioLabel}`}
        </p>
      </div>

      {/* ── Resumen del periodo (cambia al navegar) ── */}
      <p className="text-[11px] uppercase tracking-[0.08em] text-text-secondary font-display font-medium mb-3 mt-4">Resumen de {periodoLabel}</p>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <ScoreChip
          valor={formatMoney(salud.ingresosMes)}
          label={`Ingreso ${pSuffix}`}
          delta={esAnio ? null : pctDelta(salud.ingresosMes, saludPrev.ingresosMes)}
          deltaRef={`vs ${mesPrevioLabel}`}
          note={esAnio ? "Acumulado del año" : undefined}
        />
        <ScoreChip
          valor={String(salud.visitasMes)}
          label={`Visitas ${pSuffix}`}
          delta={esAnio ? null : pctDelta(salud.visitasMes, salud.visitasPromedio3Meses)}
          deltaRef="vs prom. 3 meses"
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
          delta={esAnio ? null : pctDelta(salud.gastosTotales, saludPrev.gastosTotales)}
          deltaRef={`vs ${mesPrevioLabel}`}
          note={esAnio ? "Acumulado del año" : undefined}
          invertDelta
        />
      </div>

      {/* ── Capa A · Rentabilidad ── */}
      <KpiGroup titulo="Rentabilidad" salonColor={salonColor}>
        <KpiRow icon="💰" nombre="Margen neto" kpi={salud.margenNeto} formato={(v) => `${v.toFixed(1)}%`} onClick={() => setKpiDetalle({ nombre: "Margen neto", kpi: salud.margenNeto, formato: (v) => `${v.toFixed(1)}%` })} />
        <KpiRow icon="👥" nombre="Costo de personal" kpi={salud.costoPersonal} formato={(v) => `${v.toFixed(0)}%`} onClick={() => setKpiDetalle({ nombre: "Costo de personal", kpi: salud.costoPersonal, formato: (v) => `${v.toFixed(0)}%` })} />
        <KpiRow icon="🏠" nombre="Renta / ingreso" kpi={salud.rentaPct} formato={(v) => `${v.toFixed(1)}%`} onClick={() => setKpiDetalle({ nombre: "Renta / ingreso", kpi: salud.rentaPct, formato: (v) => `${v.toFixed(1)}%` })} />
      </KpiGroup>

      {/* ── Punto de equilibrio ── */}
      <button
        onClick={() => setKpiDetalle({ nombre: "Punto de equilibrio", kpi: salud.puntoEquilibrio, formato: (v) => `${v.toFixed(2)}× cubierto` })}
        className="w-full text-left bg-surface rounded-card border border-border p-5 mb-6 active:scale-[0.99] transition-transform"
      >
        <div className="flex justify-between items-baseline mb-3">
          <span className="text-[14px] font-display font-semibold text-text-primary flex items-center gap-1.5">
            Punto de equilibrio
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="text-text-secondary/50"><path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </span>
          <span className="text-[13px] font-numbers font-bold" style={{ color: colorSemaforo(salud.puntoEquilibrio.semaforo).fg }}>
            {salud.puntoEquilibrio.valor.toFixed(2)}× cubierto
          </span>
        </div>
        <div className="h-3 bg-bg rounded-full overflow-hidden relative">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, (salud.puntoEquilibrio.valor / PE_COBERTURA_VERDE) * 100)}%`, backgroundColor: colorSemaforo(salud.puntoEquilibrio.semaforo).fg }}
          />
        </div>
        <div className="flex justify-between mt-2.5 text-[11.5px] font-mono text-text-secondary">
          <span>Venta {formatMoney(salud.ingresosMes)}</span>
          <span>PE {formatMoney(salud.peMonto)}</span>
        </div>
      </button>

      {/* ── Operación · al día de hoy (no depende del mes navegado) ── */}
      <div className="flex items-center gap-3 mb-4 mt-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[10px] uppercase tracking-[0.1em] text-text-secondary font-display font-semibold">Operación · al día de hoy</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* ── Días valle (heatmap) ── */}
      <p className="text-[11px] uppercase tracking-[0.08em] text-text-secondary font-display font-medium mb-3">Días valle · citas promedio por día (8 semanas)</p>
      <div className="bg-surface rounded-card border border-border p-4 mb-6">
        <div className="flex items-end gap-2 h-28">
          {salud.citasPorDia.map((d) => {
            const max = Math.max(...salud.citasPorDia.map((x) => x.promedio), 1);
            const h = Math.max(6, (d.promedio / max) * 100);
            return (
              <div key={d.dow} className="flex-1 flex flex-col items-center justify-end h-full">
                <span className="text-[10px] font-numbers font-semibold mb-1" style={{ color: d.esValle ? "#C0392B" : "#6B5D50" }}>
                  {d.promedio.toFixed(1)}
                </span>
                <div
                  className="w-full rounded-md transition-all"
                  style={{
                    height: `${h}%`,
                    backgroundColor: d.esValle ? "#FBEAE7" : salonColor + "DD",
                    border: d.esValle ? "1.5px solid #C0392B" : "none",
                  }}
                />
                <span className="text-[11px] font-mono mt-1.5" style={{ color: d.esValle ? "#C0392B" : "#A89A8B", fontWeight: d.esValle ? 700 : 500 }}>
                  {DOW_LABELS[d.dow]}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-[12px] text-text-secondary font-display text-center mt-3">
          Promedio de citas por día.{" "}
          {salud.citasPorDia.some((d) => d.esValle)
            ? `Días flojos: ${salud.citasPorDia.filter((d) => d.esValle).map((d) => DOW_LABELS_LARGO[d.dow]).join(" y ")} (en rojo).`
            : "Aún sin suficientes datos para detectar días valle."}
        </p>
      </div>

      {/* ── Capa C · Clientas ── */}
      <KpiGroup titulo="Clientas" salonColor={salonColor}>
        <KpiRow icon="🔁" nombre="Retención 90 días" kpi={salud.retencion90} formato={(v) => `${v.toFixed(0)}%`} onClick={() => setKpiDetalle({ nombre: "Retención 90 días", kpi: salud.retencion90, formato: (v) => `${v.toFixed(0)}%` })} />
        <KpiRow icon="⭐" nombre="Ingreso recurrente" kpi={salud.ingresoRecurrente} formato={(v) => `${v.toFixed(0)}%`} onClick={() => setKpiDetalle({ nombre: "Ingreso recurrente", kpi: salud.ingresoRecurrente, formato: (v) => `${v.toFixed(0)}%` })} />
        <KpiRow icon="📅" nombre="Frecuencia de visita" kpi={salud.frecuenciaVisita} formato={(v) => `${v.toFixed(0)} días`} onClick={() => setKpiDetalle({ nombre: "Frecuencia de visita", kpi: salud.frecuenciaVisita, formato: (v) => `${v.toFixed(0)} días` })} />
      </KpiGroup>

      {/* ── Clientas en riesgo ── */}
      <button onClick={() => setShowRiesgo(!showRiesgo)} className="flex items-center justify-between w-full mb-3">
        <span className="text-[11px] uppercase tracking-[0.08em] text-text-secondary font-display font-medium">
          Clientas en riesgo
        </span>
        <span className="text-[11px] font-mono text-text-secondary">
          {contactadasCount}/{salud.clientasEnRiesgo.length} contactadas
        </span>
      </button>

      {showRiesgo && (
        <div className="bg-surface rounded-card border border-border overflow-hidden mb-6">
          <p className="text-[12px] text-text-secondary font-display leading-relaxed px-4 pt-4 pb-3 border-b border-border">
            Clientas que ya pasaron su día habitual de regreso (más de 1.5× lo que suelen tardar) y aún están activas. Ordenadas por lo que han gastado contigo, para que contactes primero a las más valiosas.
          </p>
          {salud.clientasEnRiesgo.length === 0 ? (
            <p className="text-[13px] text-text-secondary font-display text-center py-6">Sin clientas en riesgo 🎉</p>
          ) : (
            salud.clientasEnRiesgo.slice(0, 12).map((c) => {
              const contactada = contactadas[c.clienta] === semanaKey();
              return (
                <div key={c.clienta} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0" style={{ opacity: contactada ? 0.55 : 1 }}>
                  <button onClick={() => setClientaDetalle(c)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-[13px] font-display font-bold" style={{ backgroundColor: salonColor + "1A", color: salonColor }}>
                      {iniciales(c.clienta)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-display font-semibold text-text-primary truncate">{c.clienta}</p>
                      <p className="text-[11.5px] text-text-secondary font-display">
                        Última visita hace {c.diasDesdeUltima} días · suele volver cada {c.frecuenciaPersonal}
                      </p>
                    </div>
                    <span className="text-[13px] font-numbers font-bold text-text-primary" title="Total gastado contigo">{formatMoney(c.ingresoHistorico)}</span>
                  </button>
                  <button
                    onClick={() => toggleContactada(c.clienta)}
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
                    style={{ backgroundColor: contactada ? "#E7F4EC" : salonColor + "14", color: contactada ? "#1F9D55" : salonColor }}
                    title={contactada ? "Contactada esta semana" : "Marcar como contactada"}
                  >
                    {contactada ? "✓" : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Estado de resultados detallado (colapsable) ── */}
      <button
        onClick={() => setShowDetalle(!showDetalle)}
        className="flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-text-secondary font-display font-medium mb-3 w-full"
      >
        <span>Estado de resultados detallado</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`ml-auto transition-transform ${showDetalle ? "rotate-180" : ""}`}>
          <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
      <AnimatePresence>
        {showDetalle && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <EstadoResultados
              citas={citas}
              gastos={gastos}
              gastosFijos={salon.gastosFijos}
              comisionTarjeta={salon.comisionTarjeta ?? 0}
              salonColor={salonColor}
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
          salonColor={salonColor}
          onClose={() => setKpiDetalle(null)}
        />
      )}

      {clientaDetalle && (
        <ClientaDetalleModal
          clienta={clientaDetalle}
          citas={citas}
          comisionTarjeta={salon.comisionTarjeta ?? 0}
          salonColor={salonColor}
          onClose={() => setClientaDetalle(null)}
        />
      )}
    </section>
  );
}

// ── Sub-componentes ──

function ScoreChip({ valor, label, delta, deltaRef, deltaText, deltaUp, invertDelta, note }: {
  valor: string; label: string; delta?: number | null; deltaRef?: string; deltaText?: string; deltaUp?: boolean; invertDelta?: boolean; note?: string;
}) {
  let txt = deltaText;
  let up = deltaUp;
  if (delta != null) {
    const good = invertDelta ? delta <= 0 : delta >= 0;
    up = good;
    txt = `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(0)}%${deltaRef ? ` ${deltaRef}` : ""}`;
  }
  return (
    <div className="bg-surface rounded-card border border-border p-4">
      <p className="font-numbers text-[22px] font-bold text-text-primary leading-none">{valor}</p>
      <p className="text-[11.5px] text-text-secondary font-display mt-1.5 leading-tight">{label}</p>
      {txt && <p className="text-[11px] font-display font-bold mt-2" style={{ color: up ? "#1F9D55" : "#C0392B" }}>{txt}</p>}
      {!txt && note && <p className="text-[11px] font-display font-medium text-text-secondary mt-2">{note}</p>}
    </div>
  );
}

function ClientaDetalleModal({ clienta, citas, comisionTarjeta, salonColor, onClose }: {
  clienta: ClientaRiesgo; citas: Cita[]; comisionTarjeta: number; salonColor: string; onClose: () => void;
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

  return (
    <Modal open onClose={onClose}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-full flex items-center justify-center text-[15px] font-display font-bold flex-shrink-0" style={{ backgroundColor: salonColor + "1A", color: salonColor }}>
          {iniciales(clienta.clienta)}
        </div>
        <div className="min-w-0">
          <h3 className="text-[17px] font-display font-bold text-text-primary truncate">{clienta.clienta}</h3>
          <p className="text-[12px] text-text-secondary font-display">
            {clienta.visitasTotales} visitas · {formatMoney(clienta.ingresoHistorico)} en total
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-bg border border-border rounded-[10px] px-3 py-2">
          <p className="text-[11px] text-text-secondary font-display">Última visita</p>
          <p className="text-[13px] font-numbers font-semibold text-text-primary">hace {clienta.diasDesdeUltima} días</p>
        </div>
        <div className="bg-bg border border-border rounded-[10px] px-3 py-2">
          <p className="text-[11px] text-text-secondary font-display">Suele volver cada</p>
          <p className="text-[13px] font-numbers font-semibold text-text-primary">{clienta.frecuenciaPersonal} días</p>
        </div>
      </div>

      <p className="text-[10px] uppercase tracking-[0.08em] text-text-secondary font-display font-semibold mb-2">Historial de citas</p>
      <div className="max-h-[44vh] overflow-y-auto -mx-1 px-1">
        {anios.map((y) => (
          <div key={y} className="mb-3">
            <p className="text-[12px] font-display font-bold text-text-primary mb-1.5">{y}</p>
            <div className="bg-bg border border-border rounded-[10px] overflow-hidden">
              {porAno.get(y)!.map((c, i) => {
                const servicios = c.servicios.length > 0
                  ? c.servicios.map((s) => s.nombre).filter(Boolean).join(", ")
                  : "Servicio";
                return (
                  <div key={i} className="flex items-start justify-between gap-3 px-3 py-2 border-b border-border last:border-b-0">
                    <div className="min-w-0">
                      <p className="text-[13px] font-display text-text-primary leading-tight">{servicios}</p>
                      <p className="text-[11px] text-text-secondary font-mono mt-0.5">{fmtFecha(c.fecha)} · {c.metodoPago}</p>
                    </div>
                    <span className="text-[13px] font-numbers font-semibold text-text-primary flex-shrink-0">{formatMoney(costoNeto(c.costo, c.metodoPago, comisionTarjeta))}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {suyas.length === 0 && (
          <p className="text-[13px] text-text-secondary font-display text-center py-4">Sin citas registradas.</p>
        )}
      </div>

      <button onClick={onClose} className="w-full mt-4 py-3 rounded-card text-[14px] font-display font-semibold text-white active:scale-[0.98] transition-transform" style={{ backgroundColor: salonColor }}>
        Cerrar
      </button>
    </Modal>
  );
}

function KpiGroup({ titulo, salonColor, children }: { titulo: string; salonColor: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="text-[11px] uppercase tracking-[0.08em] text-text-secondary font-display font-medium mb-2.5">{titulo}</p>
      <div className="bg-surface rounded-card border border-border overflow-hidden">{children}</div>
    </div>
  );
}

function KpiRow({ icon, nombre, kpi, formato, onClick }: { icon: string; nombre: string; kpi: KpiResultado; formato: (v: number) => string; onClick?: () => void }) {
  const c = colorSemaforo(kpi.semaforo);
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3.5 px-4 py-3.5 border-b border-border last:border-b-0 text-left active:bg-bg/60 transition-colors">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[18px] flex-shrink-0" style={{ backgroundColor: c.bg }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[14.5px] font-display font-semibold text-text-primary">{nombre}</p>
        {kpi.detalle && <p className="text-[12px] text-text-secondary font-display mt-0.5">{kpi.detalle}</p>}
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-[15px] font-numbers font-bold text-text-primary">{kpi.semaforo === "gris" ? "—" : formato(kpi.valor)}</p>
        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-display font-bold mt-1" style={{ backgroundColor: c.bg, color: c.fg }}>{c.label}</span>
      </div>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 text-text-secondary/50"><path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </button>
  );
}

function KpiDetalleModal({ nombre, kpi, formato, salonColor, onClose }: { nombre: string; kpi: KpiResultado; formato: (v: number) => string; salonColor: string; onClose: () => void }) {
  const c = colorSemaforo(kpi.semaforo);
  return (
    <Modal open onClose={onClose}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[18px] font-display font-bold text-text-primary">{nombre}</h3>
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-display font-bold" style={{ backgroundColor: c.bg, color: c.fg }}>{c.label}</span>
      </div>
      <p className="font-numbers text-[34px] font-bold text-text-primary leading-none mb-3">{kpi.semaforo === "gris" ? "—" : formato(kpi.valor)}</p>
      {kpi.explicacion && <p className="text-[13.5px] text-text-secondary font-display leading-relaxed mb-4">{kpi.explicacion}</p>}
      {kpi.formula && (
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-[0.08em] text-text-secondary font-display font-semibold mb-1.5">Fórmula</p>
          <p className="text-[12.5px] font-mono bg-bg border border-border rounded-[10px] px-3 py-2.5 text-text-primary leading-relaxed">{kpi.formula}</p>
        </div>
      )}
      {kpi.desglose && kpi.desglose.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-text-secondary font-display font-semibold mb-1.5">Con tus números</p>
          <div className="bg-bg border border-border rounded-[10px] overflow-hidden">
            {kpi.desglose.map((d, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 border-b border-border last:border-b-0">
                <span className="text-[13px] font-display text-text-secondary">{d.label}</span>
                <span className="text-[13px] font-numbers font-semibold text-text-primary">{d.valor}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <button onClick={onClose} className="w-full mt-5 py-3 rounded-card text-[14px] font-display font-semibold text-white active:scale-[0.98] transition-transform" style={{ backgroundColor: salonColor }}>
        Entendido
      </button>
    </Modal>
  );
}

// ── utils ──
function pctDelta(actual: number, base: number): number | null {
  if (!base) return null;
  return ((actual - base) / base) * 100;
}
function iniciales(nombre: string): string {
  return nombre.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
