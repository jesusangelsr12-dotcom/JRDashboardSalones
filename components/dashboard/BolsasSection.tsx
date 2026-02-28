"use client";

import { useState, useEffect } from "react";
import type { ResumenSemanal, CierreSemana, Salon } from "@/lib/types";
import { formatMoney, getLunesDeSemana, getDomingoDeSemana } from "@/lib/calculations";
import { addCierre, getAcumulados, saveAcumulados, getCierres } from "@/lib/store";
import BolsaCard from "./BolsaCard";
import Modal from "@/components/ui/Modal";

interface BolsasSectionProps {
  resumen: ResumenSemanal;
  salon: Salon;
  salonColor: string;
  onCierreCompleto: () => void;
}

export default function BolsasSection({
  resumen,
  salon,
  salonColor,
  onCierreCompleto,
}: BolsasSectionProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [closing, setClosing] = useState(false);
  const [yaCerrada, setYaCerrada] = useState(false);

  useEffect(() => {
    async function checkCierre() {
      const cierres = await getCierres(salon.id);
      const hoy = new Date();
      const lunesActual = getLunesDeSemana(hoy).toISOString().split("T")[0];
      setYaCerrada(cierres.some((c) => c.semanaInicio === lunesActual));
    }
    checkCierre();
  }, [salon.id]);

  const handleCerrarSemana = async () => {
    setClosing(true);

    const hoy = new Date();
    const lunes = getLunesDeSemana(hoy);
    const domingo = getDomingoDeSemana(hoy);

    const cierre: CierreSemana = {
      fecha: hoy.toISOString(),
      semanaInicio: lunes.toISOString().split("T")[0],
      semanaFin: domingo.toISOString().split("T")[0],
      ingresos: resumen.ingresos,
      gastos: resumen.totalGastos,
      libre: resumen.libre,
      bolsas: resumen.bolsas.map((b) => ({
        bolsaId: b.bolsaId,
        nombre: b.nombre,
        monto: b.montoSemana,
      })),
    };

    // Save cierre
    await addCierre(salon.id, cierre);

    // Update acumulados
    const acumulados = await getAcumulados(salon.id);
    resumen.bolsas.forEach((b) => {
      acumulados[b.bolsaId] = (acumulados[b.bolsaId] || 0) + b.montoSemana;
    });
    await saveAcumulados(salon.id, acumulados);

    setTimeout(() => {
      setClosing(false);
      setShowConfirm(false);
      setYaCerrada(true);
      onCierreCompleto();
    }, 400);
  };

  // Total que se repartirá esta semana
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
              <span className="text-[13px] font-numbers font-medium" style={{ color: b.color }}>
                +{formatMoney(b.montoSemana)}
              </span>
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
            onClick={handleCerrarSemana}
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
