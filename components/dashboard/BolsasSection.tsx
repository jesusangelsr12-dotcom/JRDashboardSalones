"use client";

import { useState, useEffect } from "react";
import type { ResumenSemanal, CierreSemana, Salon, Cita, Gasto, SemanaDetectada } from "@/lib/types";
import {
  formatMoney,
  getLunesDeSemana,
  getDomingoDeSemana,
  detectarSemanas,
  calcularResumenParaSemana,
} from "@/lib/calculations";
import { addCierre, getAcumulados, saveAcumulados, getCierres } from "@/lib/store";
import BolsaCard from "./BolsaCard";
import Modal from "@/components/ui/Modal";

interface BolsasSectionProps {
  resumen: ResumenSemanal;
  salon: Salon;
  salonColor: string;
  citas: Cita[];
  gastos: Gasto[];
  onCierreCompleto: () => void;
}

export default function BolsasSection({
  resumen,
  salon,
  salonColor,
  citas,
  gastos,
  onCierreCompleto,
}: BolsasSectionProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [closing, setClosing] = useState(false);
  const [yaCerrada, setYaCerrada] = useState(false);
  const [semanas, setSemanas] = useState<SemanaDetectada[]>([]);
  const [showHistorial, setShowHistorial] = useState(false);
  const [closingSemana, setClosingSemana] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const cierres = await getCierres(salon.id);
      const hoy = new Date();
      const lunesActual = getLunesDeSemana(hoy).toISOString().split("T")[0];
      setYaCerrada(cierres.some((c) => c.semanaInicio === lunesActual));

      const detected = detectarSemanas(
        citas, gastos, salon.gastosFijos, cierres, salon.bolsaDefaultGastosId
      );
      setSemanas(detected.reverse()); // Más recientes primero
    }
    loadData();
  }, [salon, citas, gastos]);

  const cerrarSemanaEspecifica = async (semana: SemanaDetectada) => {
    setClosingSemana(semana.semanaInicio);

    const datos = calcularResumenParaSemana(
      citas, gastos, salon.gastosFijos,
      semana.semanaInicio, semana.semanaFin,
      salon.bolsaDefaultGastosId
    );

    const libre = datos.libre;

    const cierre: CierreSemana = {
      fecha: new Date().toISOString(),
      semanaInicio: semana.semanaInicio,
      semanaFin: semana.semanaFin,
      ingresos: datos.ingresos,
      gastos: datos.gastosFijos,
      libre,
      bolsas: salon.bolsas.map((b) => ({
        bolsaId: b.id,
        nombre: b.nombre,
        monto: libre > 0 ? libre * (b.porcentaje / 100) : 0,
      })),
    };

    await addCierre(salon.id, cierre);

    // Update acumulados: sum bolsa allocation and subtract assigned gastos
    const acumulados = await getAcumulados(salon.id);
    salon.bolsas.forEach((b) => {
      const montoSemana = libre > 0 ? libre * (b.porcentaje / 100) : 0;
      const gastosAsignados = datos.gastosPorBolsa[b.id] || 0;
      acumulados[b.id] = (acumulados[b.id] || 0) + montoSemana - gastosAsignados;
    });
    await saveAcumulados(salon.id, acumulados);

    setClosingSemana(null);

    // Check if it was the current week
    const hoy = new Date();
    const lunesActual = getLunesDeSemana(hoy).toISOString().split("T")[0];
    if (semana.semanaInicio === lunesActual) {
      setYaCerrada(true);
    }

    // Refresh semanas
    const cierres = await getCierres(salon.id);
    const detected = detectarSemanas(
      citas, gastos, salon.gastosFijos, cierres, salon.bolsaDefaultGastosId
    );
    setSemanas(detected.reverse());
    onCierreCompleto();
  };

  const handleCerrarSemanaActual = async () => {
    setClosing(true);

    const hoy = new Date();
    const lunes = getLunesDeSemana(hoy);
    const domingo = getDomingoDeSemana(hoy);
    const lunesISO = lunes.toISOString().split("T")[0];
    const domingoISO = domingo.toISOString().split("T")[0];

    const currentSemana: SemanaDetectada = {
      semanaInicio: lunesISO,
      semanaFin: domingoISO,
      label: "",
      ingresos: resumen.ingresos,
      gastosVariables: resumen.gastosVariables,
      gastosFijos: resumen.gastosFijos,
      libre: resumen.libre,
      cerrada: false,
    };

    await cerrarSemanaEspecifica(currentSemana);
    setClosing(false);
    setShowConfirm(false);
    setYaCerrada(true);
  };

  // Total que se repartirá esta semana
  const totalBolsas = resumen.bolsas.reduce((s, b) => s + b.montoSemana, 0);
  const pendientes = semanas.filter((s) => !s.cerrada);

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

      {/* Cerrar semana button */}
      <button
        onClick={() => setShowConfirm(true)}
        disabled={yaCerrada || resumen.libre <= 0}
        className={`w-full py-3.5 rounded-card text-[14px] font-display font-semibold transition-all active:scale-[0.98] ${
          yaCerrada
            ? "bg-bg text-text-secondary border border-border cursor-not-allowed"
            : resumen.libre <= 0
            ? "bg-bg text-text-secondary border border-border cursor-not-allowed"
            : "text-white shadow-lg"
        }`}
        style={
          !yaCerrada && resumen.libre > 0
            ? { backgroundColor: salonColor }
            : undefined
        }
      >
        {yaCerrada ? "Semana ya cerrada" : "Cerrar semana"}
      </button>

      {yaCerrada && (
        <p className="text-center text-[11px] text-text-secondary mt-2 font-mono">
          Los acumulados ya incluyen esta semana
        </p>
      )}

      {/* Pending weeks alert */}
      {pendientes.length > 1 && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-card px-4 py-3">
          <p className="text-[12px] text-amber-700 font-display font-medium">
            {pendientes.length - 1} semana{pendientes.length - 1 > 1 ? "s" : ""} pendiente{pendientes.length - 1 > 1 ? "s" : ""} de cerrar
          </p>
        </div>
      )}

      {/* Historial de semanas */}
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
            {semanas.length} semanas
          </span>
        </button>

        {showHistorial && (
          <div className="space-y-2">
            {semanas.map((sem) => {
              const esSemanaActual =
                sem.semanaInicio === getLunesDeSemana(new Date()).toISOString().split("T")[0];

              return (
                <div
                  key={sem.semanaInicio}
                  className={`bg-surface rounded-card border px-4 py-3 ${
                    sem.cerrada ? "border-border" : "border-amber-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-mono text-text-primary font-medium">
                      {sem.label}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                        sem.cerrada
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-amber-50 text-amber-600"
                      }`}
                    >
                      {sem.cerrada ? "Cerrada" : esSemanaActual ? "Actual" : "Pendiente"}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-[11px] font-mono text-text-secondary">
                    <span>Ing: {formatMoney(sem.ingresos)}</span>
                    <span>Libre: {formatMoney(sem.libre)}</span>
                  </div>

                  {/* Close retroactively button */}
                  {!sem.cerrada && !esSemanaActual && sem.ingresos > 0 && (
                    <button
                      onClick={() => cerrarSemanaEspecifica(sem)}
                      disabled={closingSemana === sem.semanaInicio}
                      className="mt-2 text-[11px] font-display font-medium px-3 py-1 rounded-full active:scale-95 transition-transform"
                      style={{ backgroundColor: salonColor + "14", color: salonColor }}
                    >
                      {closingSemana === sem.semanaInicio ? "Cerrando..." : "Cerrar"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      <Modal open={showConfirm} onClose={() => setShowConfirm(false)}>
        <h3 className="text-lg font-bold font-display text-text-primary mb-2">
          Cerrar semana
        </h3>
        <p className="text-[13px] text-text-secondary mb-5">
          Se repartirá <strong className="text-text-primary">{formatMoney(totalBolsas)}</strong> entre
          las bolsas. Los montos se sumarán a los acumulados. Esta acción no se
          puede deshacer.
        </p>

        {/* Preview */}
        <div className="space-y-2 mb-6">
          {resumen.bolsas.map((b) => (
            <div
              key={b.bolsaId}
              className="flex items-center justify-between px-3 py-2 bg-bg rounded-[8px]"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: b.color }}
                />
                <span className="text-[13px] font-display text-text-primary">
                  {b.nombre}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[13px] font-numbers font-medium" style={{ color: b.color }}>
                  +{formatMoney(b.montoSemana)}
                </span>
                {b.gastosAsignados > 0 && (
                  <span className="text-[11px] font-mono text-red-500 ml-2">
                    -{formatMoney(b.gastosAsignados)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowConfirm(false)}
            className="flex-1 py-3 rounded-card border border-border text-[14px] font-display font-medium text-text-secondary active:scale-[0.98] transition-transform"
          >
            Cancelar
          </button>
          <button
            onClick={handleCerrarSemanaActual}
            disabled={closing}
            className="flex-1 py-3 rounded-card text-[14px] font-display font-semibold text-white active:scale-[0.98] transition-transform"
            style={{ backgroundColor: salonColor }}
          >
            {closing ? "Cerrando..." : "Confirmar"}
          </button>
        </div>
      </Modal>
    </section>
  );
}
