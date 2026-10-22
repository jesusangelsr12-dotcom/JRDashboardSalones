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

  // Total por trabajadora (de mayor a menor)
  const porTrabajadora = Object.entries(
    comisionesSemana.reduce<Record<string, number>>((acc, c) => {
      acc[c.trabajadora] = (acc[c.trabajadora] || 0) + c.monto;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  return (
    <Modal open={open} onClose={onClose}>
      <h3 className="font-brand text-[20px] font-extrabold tracking-[-0.025em] text-text-primary">
        {esFijos ? "Gastos fijos" : esComisiones ? "Comisiones trabajadoras" : "Gastos en bolsas"}
      </h3>
      <p className="text-[12px] text-text-secondary mt-0.5 mb-3">
        {esFijos
          ? "Prorrateados a la semana (mensual ÷ 4)"
          : esComisiones
          ? "Comisiones de esta semana (hoja Comisiones)"
          : "Gastos variables de esta semana"}
      </p>

      {esComisiones && porTrabajadora.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {porTrabajadora.map(([nombre, monto]) => (
            <span key={nombre} className="bg-bg border border-border rounded-full px-2.5 py-1 text-[12px] text-text-primary">
              {nombre} <span className="font-numbers font-bold">{formatMoney(monto)}</span>
            </span>
          ))}
        </div>
      )}

      <div className="max-h-[48vh] overflow-y-auto">
        {esComisiones ? (
          comisionesSemana.length === 0 ? (
            <Vacio texto="No hay comisiones esta semana" />
          ) : (
            comisionesSemana.map((c, i) => (
              <Fila key={i} titulo={c.item} sub={`${c.trabajadora} · ${formatFechaCorta(c.fecha)} · ${c.porcentaje}%`} monto={c.monto} />
            ))
          )
        ) : esFijos ? (
          fijosDetalle.length === 0 ? (
            <Vacio texto="No hay gastos fijos configurados" />
          ) : (
            fijosDetalle.map((gf, i) => (
              <Fila
                key={i}
                titulo={gf.nombre}
                sub={gf.frecuencia === "mensual" ? `${formatMoney(gf.montoOriginal)} /mes` : "Semanal"}
                monto={gf.montoSemana}
              />
            ))
          )
        ) : gastosSemana.length === 0 ? (
          <Vacio texto="No hay gastos en bolsas esta semana" />
        ) : (
          gastosSemana.map((g, i) => (
            <Fila key={i} titulo={g.descripcion} sub={`${formatFechaCorta(g.fecha)} · ${g.metodoPago}`} monto={g.monto} />
          ))
        )}
      </div>

      <div className="flex items-center justify-between pt-3">
        <span className="text-[11px] font-display font-bold text-text-secondary uppercase tracking-[0.06em]">Total</span>
        <span className="font-numbers text-[17px] font-bold text-rosa">
          {formatMoney(esFijos ? totalFijos : esComisiones ? totalComisiones : totalBolsas)}
        </span>
      </div>
    </Modal>
  );
}

function Fila({ titulo, sub, monto }: { titulo: string; sub: string; monto: number }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-border">
      <div className="min-w-0">
        <p className="text-[13.5px] font-display font-semibold text-text-primary truncate">{titulo}</p>
        <p className="text-[11.5px] text-text-secondary mt-0.5">{sub}</p>
      </div>
      <span className="font-numbers text-[13.5px] font-bold text-sale flex-shrink-0">−{formatMoney(monto)}</span>
    </div>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <p className="text-[13px] text-text-secondary py-6 text-center">{texto}</p>;
}
