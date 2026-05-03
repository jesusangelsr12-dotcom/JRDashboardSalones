"use client";

import { useState, useEffect } from "react";
import type { ResumenSemanal, CierreSemana, Salon, Cita, Gasto, SemanaDetectada, MovimientoBolsa } from "@/lib/types";
import {
  formatMoney,
  getLunesDeSemana,
  detectarSemanas,
  calcularResumenParaSemana,
} from "@/lib/calculations";
import { addCierre, getAcumulados, saveAcumulados, getCierres } from "@/lib/store";
import BolsaCard from "./BolsaCard";
import ResumenMetodoPago from "./ResumenMetodoPago";

interface BolsasSectionProps {
  resumen: ResumenSemanal;
  salon: Salon;
  salonColor: string;
  citas: Cita[];
  gastos: Gasto[];
  movimientos: MovimientoBolsa[];
  onCierreCompleto: () => void;
  onMovimiento: () => void;
}

export default function BolsasSection({
  resumen,
  salon,
  salonColor,
  citas,
  gastos,
  movimientos,
  onCierreCompleto,
  onMovimiento,
}: BolsasSectionProps) {
  const [semanas, setSemanas] = useState<SemanaDetectada[]>([]);
  const [showHistorial, setShowHistorial] = useState(false);
  const [closingSemana, setClosingSemana] = useState<string | null>(null);
  const [autoClosing, setAutoClosing] = useState(false);

  useEffect(() => {
    async function loadAndAutoClose() {
      const cierres = await getCierres(salon.id);
      const hoy = new Date();
      const lunesActual = getLunesDeSemana(hoy).toISOString().split("T")[0];

      const detected = detectarSemanas(
        citas, gastos, salon.gastosFijos, cierres, salon.bolsaDefaultGastosId, salon.comisionTarjeta ?? 0
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
          citas, gastos, salon.gastosFijos, cierresActualizados, salon.bolsaDefaultGastosId, salon.comisionTarjeta ?? 0
        );
        setSemanas(detectedActualizados.reverse());
        onCierreCompleto();
      } else {
        setSemanas(detected.reverse());
      }
    }
    loadAndAutoClose();
  }, [salon, citas, gastos]);

  const cerrarSemanaEspecificaSilent = async (semana: SemanaDetectada) => {
    const datos = calcularResumenParaSemana(
      citas, gastos, salon.gastosFijos,
      semana.semanaInicio, semana.semanaFin,
      salon.bolsaDefaultGastosId, salon.comisionTarjeta ?? 0
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

                </div>
              );
            })}
          </div>
        )}
      </div>

    </section>
  );
}
