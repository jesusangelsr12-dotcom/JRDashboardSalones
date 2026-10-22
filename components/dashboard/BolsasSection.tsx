"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconCheck, IconChevronDown, IconCopy } from "@/components/ui/Icons";
import { SectionLabel } from "@/components/ui/Primitives";
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

// Las bolsas solo consideran semanas de 2026 en adelante. La historia previa
// (importada) puede vivir en la tabla de cierres para otras vistas, pero NO
// alimenta el acumulado ni aparece en el historial de bolsas.
const BOLSAS_SEMANA_MIN = "2026-01-01";

interface BolsasSectionProps {
  resumen: ResumenSemanal;
  salon: Salon;
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

// Texto para WhatsApp: solo cuánto guardar por bolsa y por gasto fijo,
// sin encabezados de sección ni totales.
function buildWhatsAppText(
  semanaLabel: string,
  bolsas: { nombre: string; monto: number }[],
  gastosFijos: GastoFijo[],
  comisiones: number
): string {
  const lines: string[] = [];
  lines.push(`💰 *Distribución semana ${semanaLabel}*`);
  lines.push("");
  for (const b of bolsas) {
    lines.push(`📦 ${b.nombre}: ${formatMoney(b.monto)}`);
  }

  const items = gastosFijos.map((gf) => {
    const montoSemana = gf.frecuencia === "semanal" ? gf.monto : gf.monto / 4;
    return `• ${gf.nombre || "Sin nombre"}: ${formatMoney(montoSemana)}`;
  });
  if (comisiones > 0) {
    items.push(`• Comisiones trabajadoras: ${formatMoney(comisiones)}`);
  }
  if (items.length > 0) {
    lines.push("");
    lines.push(...items);
  }

  return lines.join("\n");
}

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for older browsers
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

export default function BolsasSection({
  resumen,
  salon,
  citas,
  gastos,
  comisiones = SIN_COMISIONES,
  movimientos,
  onCierreCompleto,
  onMovimiento,
}: BolsasSectionProps) {
  const [semanas, setSemanas] = useState<SemanaDetectada[]>([]);
  const [cierresHistorial, setCierresHistorial] = useState<CierreSemana[]>([]);
  const [showHistorial, setShowHistorial] = useState(true);
  const [avisoCierre, setAvisoCierre] = useState<{ label: string; libre: number } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [expandedCierre, setExpandedCierre] = useState<string | null>(null);
  const [closingSemana, setClosingSemana] = useState<string | null>(null);
  const [autoClosing, setAutoClosing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedCierre, setCopiedCierre] = useState<string | null>(null);

  // Aviso "Semana … cerrada automáticamente" que dejó el auto-cierre anterior
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`jr_autocierre_${salon.id}`);
      if (raw) {
        setAvisoCierre(JSON.parse(raw));
        sessionStorage.removeItem(`jr_autocierre_${salon.id}`);
      }
    } catch { /* sin sessionStorage */ }
  }, [salon.id]);

  useEffect(() => {
    async function loadAndAutoClose() {
      const cierres = await getCierres(salon.id);
      const hoy = new Date();
      const lunesActual = getLunesDeSemana(hoy).toISOString().split("T")[0];

      const detected = detectarSemanas(
        citas, gastos, comisiones, salon.gastosFijos, cierres, salon.bolsaDefaultGastosId, salon.comisionTarjeta ?? 0
      );

      const pendientes = detected.filter(
        (s) => !s.cerrada && s.semanaInicio !== lunesActual && s.ingresos > 0 && s.semanaInicio >= BOLSAS_SEMANA_MIN
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
        setCierresHistorial(cierresActualizados.filter((c) => c.semanaInicio >= BOLSAS_SEMANA_MIN).reverse());
        // El aviso sobrevive al re-montaje que provoca onCierreCompleto()
        const ultima = pendientes[pendientes.length - 1];
        const cierreUltima = cierresActualizados.find((c) => c.semanaInicio === ultima.semanaInicio);
        try {
          sessionStorage.setItem(
            `jr_autocierre_${salon.id}`,
            JSON.stringify({ label: formatSemanaLabel(ultima.semanaInicio, ultima.semanaFin), libre: cierreUltima?.libre ?? 0 })
          );
        } catch { /* sin sessionStorage */ }
        onCierreCompleto();
      } else {
        setSemanas(detected.reverse());
        setCierresHistorial(cierres.filter((c) => c.semanaInicio >= BOLSAS_SEMANA_MIN).reverse());
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
    const text = buildWhatsAppText(
      semanaActualLabel,
      resumen.bolsas.map((b) => ({ nombre: b.nombre, monto: b.montoSemana })),
      salon.gastosFijos,
      resumen.comisiones
    );
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Semana ya cerrada: las bolsas salen del cierre guardado (lo que se
  // repartió ese día); las comisiones se recalculan para esa semana.
  const handleCopyCierre = async (cierre: CierreSemana) => {
    const { comisiones: comisionesSemana } = calcularResumenParaSemana(
      citas, gastos, comisiones, salon.gastosFijos,
      cierre.semanaInicio, cierre.semanaFin,
      salon.bolsaDefaultGastosId, salon.comisionTarjeta ?? 0
    );
    const text = buildWhatsAppText(
      formatSemanaLabel(cierre.semanaInicio, cierre.semanaFin),
      cierre.bolsas,
      salon.gastosFijos,
      comisionesSemana
    );
    await copyToClipboard(text);
    setCopiedCierre(cierre.semanaInicio);
    setTimeout(() => setCopiedCierre((k) => (k === cierre.semanaInicio ? null : k)), 2000);
  };

  const INITIAL_SHOW = 8;
  const cierresToShow = showAll ? cierresHistorial : cierresHistorial.slice(0, INITIAL_SHOW);
  const colorBolsa = (id: string) => salon.bolsas.find((b) => b.id === id)?.color ?? "#D9007A";

  // Libre de las últimas 12 semanas cerradas (de la más vieja a la más reciente)
  const ultimas12 = cierresHistorial.slice(0, 12).reverse();
  const maxLibre = Math.max(...ultimas12.map((c) => c.libre), 1);

  const abrirSemana = (key: string) => {
    const idx = cierresHistorial.findIndex((c) => c.semanaInicio === key);
    if (idx >= INITIAL_SHOW) setShowAll(true);
    setExpandedCierre(key);
    setTimeout(() => document.getElementById(`semana-${key}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  };

  return (
    <section>
      {/* Aviso de cierre automático */}
      {autoClosing && (
        <div className="flex items-center gap-2.5 mb-2.5 bg-surface border border-dashed border-tinta/20 rounded-[14px] px-3 py-2.5">
          <span className="w-4 h-4 rounded-full border-2 border-rubor border-t-rosa animate-spin flex-shrink-0" />
          <p className="text-[12.5px] text-text-secondary font-display font-medium">Cerrando semanas pendientes...</p>
        </div>
      )}
      {!autoClosing && avisoCierre && (
        <div className="flex items-center gap-2.5 mb-2.5 bg-patio-soft border border-patio/40 rounded-[14px] px-3 py-2.5">
          <span className="w-6 h-6 rounded-[8px] bg-patio text-tinta flex items-center justify-center flex-shrink-0">
            <IconCheck size={14} />
          </span>
          <p className="text-[12.5px] text-text-primary font-display">
            Semana {avisoCierre.label} cerrada automáticamente ·{" "}
            <span className="font-numbers font-bold">{formatMoney(avisoCierre.libre)}</span> repartidos
          </p>
        </div>
      )}

      {/* Plano rosa: A repartir */}
      <div className="relative overflow-hidden rounded-[22px] bg-rosa text-white p-[18px] mb-2.5">
        <svg className="pointer-events-none absolute -right-8 -bottom-11 w-[170px] h-[170px] opacity-[0.13]" viewBox="0 0 64 64" aria-hidden="true">
          <path d="M18 6H46A14 14 0 0 1 60 20V36A14 14 0 0 1 46 50H30L16 60V50A12 12 0 0 1 4 38V20A14 14 0 0 1 18 6Z" fill="#FFFFFF" />
          <path d="M19.5 28.5L28 37L44.5 20.5" fill="none" stroke="#D9007A" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="relative flex items-center justify-between gap-2 text-[12px] font-display font-semibold text-white/90">
          <span>A repartir</span>
          <span className="bg-white/20 px-2.5 py-0.5 rounded-full whitespace-nowrap">{semanaActualLabel}</span>
        </div>
        <p className="relative font-numbers text-[42px] font-bold leading-none tracking-[-0.035em] mt-2.5 mb-3.5">
          {formatMoney(totalBolsas)}
        </p>
        <div className="relative flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[13px] font-display font-semibold bg-tinta/20 px-3 py-1.5 rounded-full">
            Libre: {formatMoney(resumen.libre)}
          </span>
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 bg-white rounded-[12px] px-3 py-2 text-[12.5px] font-display font-bold transition-transform active:scale-95 ${
              copied ? "text-entra" : "text-rosa"
            }`}
          >
            {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
            <span>{copied ? "Copiado" : "Copiar para WhatsApp"}</span>
          </button>
        </div>
      </div>

      {/* Acción principal */}
      <button
        onClick={onMovimiento}
        className="w-full mb-3 py-3.5 rounded-[16px] bg-mandarina text-tinta text-[14.5px] font-display font-bold transition-transform active:scale-[0.98]"
      >
        + / − Movimiento de bolsa
      </button>

      {/* Reparto del libre */}
      <div className="bg-surface border border-border rounded-card p-3.5 mb-3">
        <div className="flex items-center justify-between gap-2">
          <SectionLabel>Reparto del libre</SectionLabel>
          <span className="text-[11.5px] text-text-secondary">{resumen.bolsas.map((b) => `${b.porcentaje}%`).join(" · ")}</span>
        </div>
        <div className="flex h-4 rounded-[8px] overflow-hidden gap-[2px] mt-3">
          {resumen.bolsas.map((b) => (
            <span key={b.bolsaId} className="h-full" style={{ width: `${b.porcentaje}%`, backgroundColor: b.color }} />
          ))}
        </div>
      </div>

      {/* Bolsa cards */}
      <div className="space-y-2 mb-3">
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
      <div className="mb-3">
        <ResumenMetodoPago
          citas={citas}
          gastos={gastos}
          movimientos={movimientos}
          comisionTarjeta={salon.comisionTarjeta ?? 0}
        />
      </div>

      {/* ━━━ Historial de distribución semanal ━━━ */}
      <div className="mt-6">
        <button
          onClick={() => setShowHistorial(!showHistorial)}
          aria-expanded={showHistorial}
          className="flex items-center gap-2 w-full mb-2.5"
        >
          <SectionLabel className="flex-1 text-left">Historial de semanas</SectionLabel>
          <span className="text-[11.5px] text-text-secondary">{cierresHistorial.length} semanas</span>
          <IconChevronDown size={16} className={`text-tinta/35 transition-transform ${showHistorial ? "rotate-180" : ""}`} />
        </button>

        {showHistorial && (
          <div className="space-y-2">
            {ultimas12.length > 1 && (
              <div className="bg-surface border border-border rounded-card p-3.5">
                <div className="flex items-center justify-between text-[11.5px] text-text-secondary">
                  <span>Libre por semana · últimas {ultimas12.length}</span>
                  <span className="font-numbers">máx. {formatMoney(maxLibre)}</span>
                </div>
                <div className="flex items-stretch gap-[5px] h-[92px] mt-2.5">
                  {ultimas12.map((c) => {
                    const activa = expandedCierre === c.semanaInicio;
                    const label = formatSemanaLabel(c.semanaInicio, c.semanaFin);
                    return (
                      <button
                        key={c.semanaInicio}
                        onClick={() => abrirSemana(c.semanaInicio)}
                        aria-label={`Semana ${label}, libre ${formatMoney(c.libre)}`}
                        title={`Semana ${label}: ${formatMoney(c.libre)}`}
                        className="flex-1 min-w-0 flex flex-col items-center gap-1 group"
                      >
                        <span className="flex-1 w-full flex items-end">
                          <span
                            className={`block w-full rounded-t-[5px] rounded-b-[2px] transition-colors ${
                              activa ? "bg-rosa" : "bg-rubor group-hover:bg-rosa"
                            }`}
                            style={{ height: `${Math.max(4, (Math.max(0, c.libre) / maxLibre) * 100)}%` }}
                          />
                        </span>
                        <span className={`text-[11px] leading-none ${activa ? "text-rosa font-bold" : "text-text-secondary"}`}>
                          {new Date(c.semanaInicio + "T12:00:00").getDate()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {cierresToShow.map((cierre) => {
              const key = cierre.semanaInicio;
              const isExpanded = expandedCierre === key;
              const label = formatSemanaLabel(cierre.semanaInicio, cierre.semanaFin);

              return (
                <div
                  key={key}
                  id={`semana-${key}`}
                  className={`bg-surface rounded-[16px] border overflow-hidden transition-all ${
                    isExpanded ? "border-rosa/35 shadow-[0_10px_24px_-18px_rgba(217,0,122,0.6)]" : "border-border"
                  }`}
                >
                  <button
                    onClick={() => setExpandedCierre(isExpanded ? null : key)}
                    aria-expanded={isExpanded}
                    className="w-full pl-3.5 pr-3 py-3 flex items-center gap-2 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="block text-[13px] font-display font-bold text-text-primary">Semana {label}</span>
                      <span className="block text-[12px] text-text-secondary mt-0.5">Libre: {formatMoney(cierre.libre)}</span>
                    </div>
                    <span className="text-[11px] font-display font-bold px-2 py-0.5 rounded-full bg-entra-soft text-entra">Cerrada</span>
                    <IconChevronDown size={16} className={`text-tinta/35 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
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
                        <div className="px-3.5 pb-3 pt-1 border-t border-border">
                          <div className="grid grid-cols-3 gap-1.5 bg-bg rounded-[12px] px-2.5 py-2 my-2">
                            <ResumenCierre label="Ingresos" valor={formatMoney(cierre.ingresos)} />
                            <ResumenCierre label="Gastos" valor={`−${formatMoney(cierre.gastos)}`} negativo />
                            <ResumenCierre label="Libre" valor={formatMoney(cierre.libre)} />
                          </div>
                          {cierre.bolsas.map((b) => (
                            <div key={b.bolsaId} className="flex items-center justify-between py-1.5 text-[13px]">
                              <span className="flex items-center gap-2 text-text-primary">
                                <span className="w-[9px] h-[9px] rounded-[3px]" style={{ backgroundColor: colorBolsa(b.bolsaId) }} />
                                {b.nombre}
                              </span>
                              <span className="font-numbers font-semibold text-text-primary">{formatMoney(b.monto)}</span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between pt-2.5 mt-1 border-t border-border">
                            <span className="text-[11px] font-display font-bold text-text-secondary uppercase tracking-[0.05em]">Total libre</span>
                            <span className="font-numbers text-[15px] font-bold text-text-primary">{formatMoney(cierre.libre)}</span>
                          </div>
                          <div className="flex justify-end pt-2.5">
                            <button
                              onClick={() => handleCopyCierre(cierre)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rubor text-[12px] font-display font-bold transition-transform active:scale-95 ${
                                copiedCierre === key ? "text-entra" : "text-rosa"
                              }`}
                            >
                              {copiedCierre === key ? <IconCheck size={14} /> : <IconCopy size={14} />}
                              <span>{copiedCierre === key ? "Copiado" : "Copiar semana"}</span>
                            </button>
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
                className="w-full py-3 text-[13px] font-display font-bold text-rosa rounded-[14px] active:bg-rubor transition-colors"
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

function ResumenCierre({ label, valor, negativo }: { label: string; valor: string; negativo?: boolean }) {
  return (
    <div>
      <span className="block text-[11px] text-text-secondary">{label}</span>
      <span className={`block font-numbers text-[14px] font-bold ${negativo ? "text-sale" : "text-text-primary"}`}>{valor}</span>
    </div>
  );
}
