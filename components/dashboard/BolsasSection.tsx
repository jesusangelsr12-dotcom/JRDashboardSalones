"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ResumenSemanal, CierreSemana, Salon, Cita, Gasto, Comision, SemanaDetectada, MovimientoBolsa, GastoFijo } from "@/lib/types";
import {
  formatMoney,
  getLunesDeSemana,
  detectarSemanas,
  calcularResumenParaSemana,
} from "@/lib/calculations";
import { addCierre, getAcumulados, saveAcumulados, getCierres } from "@/lib/store";
import BolsaCard from "./BolsaCard";
import ResumenMetodoPago from "./ResumenMetodoPago";

// Default estable: un [] inline crearía una referencia nueva por render y
// dispararía en bucle el useEffect de auto-cierre que depende de comisiones.
const SIN_COMISIONES: Comision[] = [];

interface BolsasSectionProps {
  resumen: ResumenSemanal;
  salon: Salon;
  salonColor: string;
  citas: Cita[];
  gastos: Gasto[];
  comisiones?: Comision[];
  movimientos: MovimientoBolsa[];
  onCierreCompleto: () => void;
  onMovimiento: () => void;
}

function formatSemanaLabel(inicio: string, fin: string): string {
  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const d1 = new Date(inicio + "T12:00:00");
  const d2 = new Date(fin + "T12:00:00");
  const dia1 = d1.getDate();
  const dia2 = d2.getDate();
  const mes1 = meses[d1.getMonth()];
  const mes2 = meses[d2.getMonth()];
  const anio = d2.getFullYear();
  if (mes1 === mes2) {
    return `${dia1} – ${dia2} ${mes1} ${anio}`;
  }
  return `${dia1} ${mes1} – ${dia2} ${mes2} ${anio}`;
}

function buildWhatsAppText(
  resumen: ResumenSemanal,
  semanaLabel: string,
  gastosFijos: GastoFijo[]
): string {
  const lines: string[] = [];
  lines.push(`💰 *Distribución semana ${semanaLabel}*`);
  lines.push("");
  for (const b of resumen.bolsas) {
    lines.push(`📦 ${b.nombre}: ${formatMoney(b.montoSemana)}`);
  }
  lines.push("");
  lines.push(`Total libre: ${formatMoney(resumen.libre)}`);

  if (gastosFijos.length > 0) {
    let totalFijos = 0;
    lines.push("");
    lines.push("🧾 *Gastos fijos*");
    for (const gf of gastosFijos) {
      const montoSemana = gf.frecuencia === "semanal" ? gf.monto : gf.monto / 4;
      totalFijos += montoSemana;
      lines.push(`• ${gf.nombre || "Sin nombre"}: ${formatMoney(montoSemana)}`);
    }
    lines.push(`Total gastos fijos: ${formatMoney(totalFijos)}`);
  }

  if (resumen.comisiones > 0) {
    lines.push("");
    lines.push(`💇‍♀️ Comisiones trabajadoras: ${formatMoney(resumen.comisiones)}`);
  }

  return lines.join("\n");
}

export default function BolsasSection({
  resumen,
  salon,
  salonColor,
  citas,
  gastos,
  comisiones = SIN_COMISIONES,
  movimientos,
  onCierreCompleto,
  onMovimiento,
}: BolsasSectionProps) {
  const [semanas, setSemanas] = useState<SemanaDetectada[]>([]);
  const [cierresHistorial, setCierresHistorial] = useState<CierreSemana[]>([]);
  const [showHistorial, setShowHistorial] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [expandedCierre, setExpandedCierre] = useState<string | null>(null);
  const [closingSemana, setClosingSemana] = useState<string | null>(null);
  const [autoClosing, setAutoClosing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadAndAutoClose() {
      const cierres = await getCierres(salon.id);
      const hoy = new Date();
      const lunesActual = getLunesDeSemana(hoy).toISOString().split("T")[0];

      const detected = detectarSemanas(
        citas, gastos, comisiones, salon.gastosFijos, cierres, salon.bolsaDefaultGastosId, salon.comisionTarjeta ?? 0
      );

      const pendientes = detected.filter(
        (s) => !s.cerrada && s.semanaInicio !== lunesActual && s.ingresos > 0
      );

      if (pendientes.length > 0) {
        setAutoClosing(true);
        for (const semana of pendientes) {
          await cerrarSemanaEspecificaSilent(semana);
        }
        setAutoClosing(false);

        const cierresActualizados = await getCierres(salon.id);
        const detectedActualizados = detectarSemanas(
          citas, gastos, comisiones, salon.gastosFijos, cierresActualizados, salon.bolsaDefaultGastosId, salon.comisionTarjeta ?? 0
        );
        setSemanas(detectedActualizados.reverse());
        setCierresHistorial([...cierresActualizados].reverse());
        onCierreCompleto();
      } else {
        setSemanas(detected.reverse());
        setCierresHistorial([...cierres].reverse());
      }
    }
    loadAndAutoClose();
  }, [salon, citas, gastos, comisiones]);

  const cerrarSemanaEspecificaSilent = async (semana: SemanaDetectada) => {
    const datos = calcularResumenParaSemana(
      citas, gastos, comisiones, salon.gastosFijos,
      semana.semanaInicio, semana.semanaFin,
      salon.bolsaDefaultGastosId, salon.comisionTarjeta ?? 0
    );

    const libre = datos.libre;

    const cierre: CierreSemana = {
      fecha: new Date().toISOString(),
      semanaInicio: semana.semanaInicio,
      semanaFin: semana.semanaFin,
      ingresos: datos.ingresos,
      gastos: datos.gastosFijos + datos.comisiones,
      libre,
      bolsas: salon.bolsas.map((b) => ({
        bolsaId: b.id,
        nombre: b.nombre,
        monto: libre > 0 ? libre * (b.porcentaje / 100) : 0,
      })),
    };

    const added = await addCierre(salon.id, cierre);
    if (!added) return;

    const acumulados = await getAcumulados(salon.id);
    salon.bolsas.forEach((b) => {
      const montoSemana = libre > 0 ? libre * (b.porcentaje / 100) : 0;
      const gastosAsignados = datos.gastosPorBolsa[b.id] || 0;
      acumulados[b.id] = (acumulados[b.id] || 0) + montoSemana - gastosAsignados;
    });
    await saveAcumulados(salon.id, acumulados);
  };

  const totalBolsas = resumen.bolsas.reduce((s, b) => s + b.montoSemana, 0);

  const hoy = new Date();
  const lunesActual = getLunesDeSemana(hoy);
  const domingoActual = new Date(lunesActual);
  domingoActual.setDate(domingoActual.getDate() + 6);
  const semanaActualLabel = formatSemanaLabel(
    lunesActual.toISOString().split("T")[0],
    domingoActual.toISOString().split("T")[0]
  );

  const handleCopy = async () => {
    const text = buildWhatsAppText(resumen, semanaActualLabel, salon.gastosFijos);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const INITIAL_SHOW = 8;
  const cierresToShow = showAll ? cierresHistorial : cierresHistorial.slice(0, INITIAL_SHOW);

  return (
    <section>
      {/* Summary bar */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.08em] text-text-secondary font-display font-medium">
            A repartir
          </p>
          <p className="font-numbers text-2xl font-medium text-text-primary">
            {formatMoney(totalBolsas)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Copy for WhatsApp */}
          <button
            onClick={handleCopy}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-display font-medium transition-all active:scale-95"
            style={{ backgroundColor: salonColor + "14", color: salonColor }}
          >
            {copied ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Copiado</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>Copiar</span>
              </>
            )}
          </button>

          <div
            className="px-3 py-1 rounded-full text-[12px] font-mono"
            style={{
              backgroundColor: resumen.libre >= 0 ? salonColor + "14" : "#EF444414",
              color: resumen.libre >= 0 ? salonColor : "#EF4444",
            }}
          >
            Libre: {formatMoney(resumen.libre)}
          </div>
        </div>
      </div>

      {/* Movimiento button */}
      <button
        onClick={onMovimiento}
        className="w-full mb-4 py-2.5 rounded-card border border-dashed text-[13px] font-display font-medium transition-all active:scale-[0.98]"
        style={{ borderColor: salonColor + "40", color: salonColor }}
      >
        + / - Movimiento de bolsa
      </button>

      {/* Bolsa cards */}
      <div className="space-y-3 mb-6">
        {resumen.bolsas.map((bolsa) => (
          <BolsaCard
            key={bolsa.bolsaId}
            nombre={bolsa.nombre}
            porcentaje={bolsa.porcentaje}
            color={bolsa.color}
            montoSemana={bolsa.montoSemana}
            acumulado={bolsa.acumulado}
            gastosAsignados={bolsa.gastosAsignados}
          />
        ))}
      </div>

      {/* Resumen por método de pago */}
      <div className="mb-6">
        <ResumenMetodoPago
          citas={citas}
          gastos={gastos}
          movimientos={movimientos}
          salonColor={salonColor}
          comisionTarjeta={salon.comisionTarjeta ?? 0}
        />
      </div>

      {/* Auto-close status */}
      {autoClosing && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-card px-4 py-3">
          <p className="text-[12px] text-amber-700 font-display font-medium">
            Cerrando semanas pendientes...
          </p>
        </div>
      )}

      {/* ━━━ Historial de distribución semanal ━━━ */}
      <div className="mt-6">
        <button
          onClick={() => setShowHistorial(!showHistorial)}
          className="flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-text-secondary font-display font-medium mb-3 w-full"
        >
          <span>Historial de semanas</span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            className={`transition-transform ${showHistorial ? "rotate-180" : ""}`}
          >
            <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <span className="ml-auto text-[10px] font-mono">
            {cierresHistorial.length} semanas
          </span>
        </button>

        {showHistorial && (
          <div className="space-y-2">
            {cierresToShow.map((cierre) => {
              const key = cierre.semanaInicio;
              const isExpanded = expandedCierre === key;
              const label = formatSemanaLabel(cierre.semanaInicio, cierre.semanaFin);

              return (
                <div
                  key={key}
                  className="bg-surface rounded-card border border-border overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedCierre(isExpanded ? null : key)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left"
                  >
                    <div>
                      <span className="text-[12px] font-display font-semibold text-text-primary">
                        Semana {label}
                      </span>
                      <p className="text-[11px] font-mono text-text-secondary mt-0.5">
                        Libre: {formatMoney(cierre.libre)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600"
                      >
                        Cerrada
                      </span>
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="none"
                        className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      >
                        <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-3 space-y-1.5 border-t border-border pt-3">
                          {cierre.bolsas.map((b) => (
                            <div key={b.bolsaId} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-[13px]">💰</span>
                                <span className="text-[12px] font-display text-text-primary">
                                  {b.nombre}
                                </span>
                              </div>
                              <span className="text-[12px] font-numbers font-medium" style={{ color: salonColor }}>
                                {formatMoney(b.monto)}
                              </span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between pt-2 mt-2 border-t border-border">
                            <span className="text-[11px] font-display font-medium text-text-secondary uppercase tracking-wide">
                              Total libre
                            </span>
                            <span className="text-[13px] font-numbers font-semibold text-text-primary">
                              {formatMoney(cierre.libre)}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            {!showAll && cierresHistorial.length > INITIAL_SHOW && (
              <button
                onClick={() => setShowAll(true)}
                className="w-full py-2.5 text-[12px] font-display font-medium rounded-card transition-all active:scale-[0.98]"
                style={{ color: salonColor }}
              >
                Ver más ({cierresHistorial.length - INITIAL_SHOW} semanas)
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
