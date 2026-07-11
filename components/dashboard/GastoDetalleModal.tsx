"use client";

import type { Gasto, GastoFijo, Comision } from "@/lib/types";
import { formatMoney } from "@/lib/calculations";
import Modal from "@/components/ui/Modal";

interface GastoDetalleModalProps {
  open: boolean;
  onClose: () => void;
  tipo: "fijos" | "bolsas" | "comisiones" | null;
  gastosFijos: GastoFijo[];
  gastosSemana: Gasto[];
  comisionesSemana?: Comision[];
  salonColor: string;
}

function formatFechaCorta(fecha: Date): string {
  return fecha.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

export default function GastoDetalleModal({
  open,
  onClose,
  tipo,
  gastosFijos,
  gastosSemana,
  comisionesSemana = [],
  salonColor,
}: GastoDetalleModalProps) {
  const esFijos = tipo === "fijos";
  const esComisiones = tipo === "comisiones";

  const fijosDetalle = gastosFijos.map((gf) => ({
    nombre: gf.nombre || "Sin nombre",
    frecuencia: gf.frecuencia,
    montoSemana: gf.frecuencia === "semanal" ? gf.monto : gf.monto / 4,
    montoOriginal: gf.monto,
  }));
  const totalFijos = fijosDetalle.reduce((s, gf) => s + gf.montoSemana, 0);
  const totalBolsas = gastosSemana.reduce((s, g) => s + g.monto, 0);
  const totalComisiones = comisionesSemana.reduce((s, c) => s + c.monto, 0);

  return (
    <Modal open={open} onClose={onClose}>
      <h3 className="text-lg font-bold font-display text-text-primary mb-1">
        {esFijos ? "Gastos fijos" : esComisiones ? "Comisiones trabajadoras" : "Gastos en bolsas"}
      </h3>
      <p className="text-[11px] font-mono text-text-secondary mb-4">
        {esFijos
          ? "Prorrateados a la semana (mensual ÷ 4)"
          : esComisiones
          ? "Comisiones de esta semana (hoja Comisiones)"
          : "Gastos variables de esta semana"}
      </p>

      <div className="space-y-2 max-h-[50vh] overflow-y-auto">
        {esComisiones ? (
          comisionesSemana.length === 0 ? (
            <p className="text-[12px] font-display text-text-secondary py-4 text-center">
              No hay comisiones esta semana
            </p>
          ) : (
            comisionesSemana.map((c, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-border last:border-b-0"
              >
                <div>
                  <p className="text-[13px] font-display text-text-primary">
                    {c.item}
                  </p>
                  <p className="text-[11px] font-mono text-text-secondary mt-0.5">
                    {c.trabajadora} · {formatFechaCorta(c.fecha)} · {c.porcentaje}%
                  </p>
                </div>
                <span className="text-[13px] font-numbers font-medium text-red-500">
                  -{formatMoney(c.monto)}
                </span>
              </div>
            ))
          )
        ) : esFijos ? (
          fijosDetalle.length === 0 ? (
            <p className="text-[12px] font-display text-text-secondary py-4 text-center">
              No hay gastos fijos configurados
            </p>
          ) : (
            fijosDetalle.map((gf, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-border last:border-b-0"
              >
                <div>
                  <p className="text-[13px] font-display text-text-primary">
                    {gf.nombre}
                  </p>
                  <p className="text-[11px] font-mono text-text-secondary mt-0.5">
                    {gf.frecuencia === "mensual"
                      ? `${formatMoney(gf.montoOriginal)} /mes`
                      : "Semanal"}
                  </p>
                </div>
                <span className="text-[13px] font-numbers font-medium text-red-500">
                  -{formatMoney(gf.montoSemana)}
                </span>
              </div>
            ))
          )
        ) : gastosSemana.length === 0 ? (
          <p className="text-[12px] font-display text-text-secondary py-4 text-center">
            No hay gastos en bolsas esta semana
          </p>
        ) : (
          gastosSemana.map((g, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 border-b border-border last:border-b-0"
            >
              <div>
                <p className="text-[13px] font-display text-text-primary">
                  {g.descripcion}
                </p>
                <p className="text-[11px] font-mono text-text-secondary mt-0.5">
                  {formatFechaCorta(g.fecha)} · {g.metodoPago}
                </p>
              </div>
              <span className="text-[13px] font-numbers font-medium text-red-500">
                -{formatMoney(g.monto)}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between pt-3 mt-3 border-t border-border">
        <span className="text-[11px] font-display font-medium text-text-secondary uppercase tracking-wide">
          Total
        </span>
        <span
          className="text-[15px] font-numbers font-semibold"
          style={{ color: salonColor }}
        >
          {formatMoney(esFijos ? totalFijos : esComisiones ? totalComisiones : totalBolsas)}
        </span>
      </div>
    </Modal>
  );
}
