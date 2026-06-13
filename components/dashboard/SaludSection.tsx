"use client";

import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Salon, Cita, Gasto } from "@/lib/types";
import { formatMoney } from "@/lib/calculations";
import {
  calcularSalud,
  colorSemaforo,
  DOW_LABELS,
  DOW_LABELS_LARGO,
  PE_COBERTURA_VERDE,
  type KpiResultado,
} from "@/lib/salud";
import EstadoResultados from "./EstadoResultados";

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
  const [offset, setOffset] = useState(0); // 0 = mes actual, -1 = mes anterior...
  const [showDetalle, setShowDetalle] = useState(false);
  const [showRiesgo, setShowRiesgo] = useState(true);
  const [contactadas, setContactadas] = useState<Record<string, string>>({});

  useEffect(() => {
    const refresh = () => setHoy(new Date());
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  const ref = new Date(hoy.getFullYear(), hoy.getMonth() + offset, 1);
  const year = ref.getFullYear();
  const month = ref.getMonth();

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

  // Un solo pase calcula el mes actual y el previo (para el delta).
  const { salud, saludPrev } = useMemo(() => {
    const cur = calcularSalud(citas, gastos, salon.gastosFijos, salon.bolsas, year, month, salon.comisionTarjeta ?? 0, hoy);
    const dPrev = new Date(year, month - 1, 1);
    const prev = calcularSalud(citas, gastos, salon.gastosFijos, salon.bolsas, dPrev.getFullYear(), dPrev.getMonth(), salon.comisionTarjeta ?? 0, hoy);
    return { salud: cur, saludPrev: prev };
  }, [citas, gastos, salon, year, month, hoy]);

  const g = colorSemaforo(salud.semaforoGlobal);
  const deltaUtilidad = salud.utilidad - saludPrev.utilidad;
  const mesPrevioLabel = MESES[(month + 11) % 12];

  const contactadasCount = salud.clientasEnRiesgo.filter((c) => contactadas[c.clienta] === semanaKey()).length;

  return (
    <section className="pb-4">
      {/* ── Selector de mes ── */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <button aria-label="Mes anterior" onClick={() => setOffset(offset - 1)} className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center active:scale-90 transition-transform">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <span className="text-[13px] font-display font-medium text-text-primary min-w-[120px] text-center">
          {MESES[month]} {year}
        </span>
        <button
          aria-label="Mes siguiente"
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
        <p className="text-[11px] uppercase tracking-[0.08em] text-text-secondary font-display font-medium">Utilidad de {MESES[month]}</p>
        <p className="font-numbers text-[44px] leading-none font-bold text-text-primary mt-1">{formatMoney(salud.utilidad)}</p>
        <p className="text-[13px] font-display font-medium mt-3" style={{ color: deltaUtilidad >= 0 ? "#1F9D55" : "#C0392B" }}>
          {deltaUtilidad >= 0 ? "▲" : "▼"} {formatMoney(Math.abs(deltaUtilidad))} vs {mesPrevioLabel}
        </p>
      </div>

      {/* ── Resumen del mes (cambia al navegar) ── */}
      <p className="text-[11px] uppercase tracking-[0.08em] text-text-secondary font-display font-medium mb-3 mt-4">Resumen de {MESES[month]}</p>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <ScoreChip
          valor={formatMoney(salud.ingresosMes)}
          label="Ingreso del mes"
          delta={pctDelta(salud.ingresosMes, saludPrev.ingresosMes)}
        />
        <ScoreChip
          valor={String(salud.visitasMes)}
          label="Visitas del mes"
          deltaText={`${MESES[(month + 11) % 12]}: ${saludPrev.visitasMes}`}
          deltaUp={salud.visitasMes >= saludPrev.visitasMes}
        />
        <ScoreChip
          valor={salud.ticketPromedio.semaforo === "gris" ? "—" : formatMoney(salud.ticketPromedio.valor)}
          label="Ticket promedio"
        />
        <ScoreChip
          valor={formatMoney(salud.gastosTotales)}
          label="Gasto del mes"
          delta={pctDelta(salud.gastosTotales, saludPrev.gastosTotales)}
          invertDelta
        />
      </div>

      {/* ── Capa A · Rentabilidad ── */}
      <KpiGroup titulo="Rentabilidad" salonColor={salonColor}>
        <KpiRow icon="💰" nombre="Margen neto" kpi={salud.margenNeto} formato={(v) => `${v.toFixed(1)}%`} />
        <KpiRow icon="👥" nombre="Costo de personal" kpi={salud.costoPersonal} formato={(v) => `${v.toFixed(0)}%`} />
        <KpiRow icon="🏠" nombre="Renta / ingreso" kpi={salud.rentaPct} formato={(v) => `${v.toFixed(1)}%`} />
      </KpiGroup>

      {/* ── Punto de equilibrio ── */}
      <div className="bg-surface rounded-card border border-border p-5 mb-6">
        <div className="flex justify-between items-baseline mb-3">
          <span className="text-[14px] font-display font-semibold text-text-primary">Punto de equilibrio</span>
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
      </div>

      {/* ── Operación · al día de hoy (no depende del mes navegado) ── */}
      <div className="flex items-center gap-3 mb-4 mt-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[10px] uppercase tracking-[0.1em] text-text-secondary font-display font-semibold">Operación · al día de hoy</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* ── Días valle (heatmap) ── */}
      <p className="text-[11px] uppercase tracking-[0.08em] text-text-secondary font-display font-medium mb-3">Días valle · promedio últimas 8 semanas</p>
      <div className="bg-surface rounded-card border border-border p-4 mb-6">
        <div className="flex items-end gap-2 h-28">
          {salud.citasPorDia.map((d) => {
            const max = Math.max(...salud.citasPorDia.map((x) => x.promedio), 1);
            const h = Math.max(6, (d.promedio / max) * 100);
            return (
              <div key={d.dow} className="flex-1 flex flex-col items-center justify-end h-full">
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
          {salud.citasPorDia.some((d) => d.esValle)
            ? `Días flojos: ${salud.citasPorDia.filter((d) => d.esValle).map((d) => DOW_LABELS_LARGO[d.dow]).join(" y ")} (en rojo)`
            : "Aún sin suficientes datos para detectar días valle"}
        </p>
      </div>

      {/* ── Capa C · Clientas ── */}
      <KpiGroup titulo="Clientas" salonColor={salonColor}>
        <KpiRow icon="🔁" nombre="Retención 90 días" kpi={salud.retencion90} formato={(v) => `${v.toFixed(0)}%`} />
        <KpiRow icon="⭐" nombre="Ingreso recurrente" kpi={salud.ingresoRecurrente} formato={(v) => `${v.toFixed(0)}%`} />
        <KpiRow icon="📅" nombre="Frecuencia de visita" kpi={salud.frecuenciaVisita} formato={(v) => `${v.toFixed(0)} días`} />
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
          {salud.clientasEnRiesgo.length === 0 ? (
            <p className="text-[13px] text-text-secondary font-display text-center py-6">Sin clientas en riesgo 🎉</p>
          ) : (
            salud.clientasEnRiesgo.slice(0, 12).map((c) => {
              const contactada = contactadas[c.clienta] === semanaKey();
              return (
                <div key={c.clienta} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0" style={{ opacity: contactada ? 0.55 : 1 }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-[13px] font-display font-bold" style={{ backgroundColor: salonColor + "1A", color: salonColor }}>
                    {iniciales(c.clienta)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-display font-semibold text-text-primary truncate">{c.clienta}</p>
                    <p className="text-[11.5px] text-text-secondary font-display">
                      Hace {c.diasDesdeUltima}d · vuelve cada {c.frecuenciaPersonal}d
                    </p>
                  </div>
                  <span className="text-[13px] font-numbers font-bold text-text-primary mr-1">{formatMoney(c.ingresoHistorico)}</span>
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
    </section>
  );
}

// ── Sub-componentes ──

function ScoreChip({ valor, label, delta, deltaText, deltaUp, invertDelta }: {
  valor: string; label: string; delta?: number | null; deltaText?: string; deltaUp?: boolean; invertDelta?: boolean;
}) {
  let txt = deltaText;
  let up = deltaUp;
  if (delta != null) {
    const good = invertDelta ? delta <= 0 : delta >= 0;
    up = good;
    txt = `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(0)}%`;
  }
  return (
    <div className="bg-surface rounded-card border border-border p-4">
      <p className="font-numbers text-[22px] font-bold text-text-primary leading-none">{valor}</p>
      <p className="text-[11.5px] text-text-secondary font-display mt-1.5 leading-tight">{label}</p>
      {txt && <p className="text-[11px] font-display font-bold mt-2" style={{ color: up ? "#1F9D55" : "#C0392B" }}>{txt}</p>}
    </div>
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

function KpiRow({ icon, nombre, kpi, formato }: { icon: string; nombre: string; kpi: KpiResultado; formato: (v: number) => string }) {
  const c = colorSemaforo(kpi.semaforo);
  return (
    <div className="flex items-center gap-3.5 px-4 py-3.5 border-b border-border last:border-b-0">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[18px] flex-shrink-0" style={{ backgroundColor: c.bg }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[14.5px] font-display font-semibold text-text-primary">{nombre}</p>
        {kpi.detalle && <p className="text-[12px] text-text-secondary font-display mt-0.5">{kpi.detalle}</p>}
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-[15px] font-numbers font-bold text-text-primary">{kpi.semaforo === "gris" ? "—" : formato(kpi.valor)}</p>
        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-display font-bold mt-1" style={{ backgroundColor: c.bg, color: c.fg }}>{c.label}</span>
      </div>
    </div>
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
