"use client";

import type { Cita, Gasto, MovimientoBolsa } from "@/lib/types";
import { formatMoney } from "@/lib/calculations";

interface ResumenMetodoPagoProps {
  citas: Cita[];
  gastos: Gasto[];
  movimientos: MovimientoBolsa[];
  salonColor: string;
}

const METODO_ICONS: Record<string, string> = {
  Efectivo: "$",
  Tarjeta: "T",
  Transferencia: "Tr",
};

const METODO_COLORS: Record<string, string> = {
  Efectivo: "#10B981",
  Tarjeta: "#6366F1",
  Transferencia: "#F59E0B",
};

export default function ResumenMetodoPago({
  citas,
  gastos,
  movimientos,
  salonColor,
}: ResumenMetodoPagoProps) {
  // Calcular entradas por método (citas + ingresos de movimientos)
  const entradas: Record<string, number> = { Efectivo: 0, Tarjeta: 0, Transferencia: 0 };
  const salidas: Record<string, number> = { Efectivo: 0, Tarjeta: 0, Transferencia: 0 };

  // Ingresos de citas
  citas.forEach((c) => {
    entradas[c.metodoPago] = (entradas[c.metodoPago] || 0) + c.costo;
  });

  // Gastos (sheets + admin)
  gastos.forEach((g) => {
    salidas[g.metodoPago] = (salidas[g.metodoPago] || 0) + g.monto;
  });

  // Movimientos manuales de bolsa
  movimientos.forEach((m) => {
    if (m.tipo === "ingreso") {
      entradas[m.metodoPago] = (entradas[m.metodoPago] || 0) + m.monto;
    } else {
      salidas[m.metodoPago] = (salidas[m.metodoPago] || 0) + m.monto;
    }
  });

  const metodos = ["Efectivo", "Tarjeta", "Transferencia"] as const;

  const totales = metodos.map((m) => ({
    metodo: m,
    entradas: entradas[m],
    salidas: salidas[m],
    neto: entradas[m] - salidas[m],
  }));

  const totalGeneral = totales.reduce((s, t) => s + t.neto, 0);

  return (
    <div className="bg-surface rounded-card border border-border p-4">
      <h4 className="text-[11px] uppercase tracking-[0.08em] text-text-secondary font-display font-medium mb-3">
        Dinero por método de pago
      </h4>

      <div className="space-y-3">
        {totales.map((t) => {
          const color = METODO_COLORS[t.metodo];
          return (
            <div key={t.metodo} className="flex items-center gap-3">
              {/* Icon */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-mono font-bold text-white"
                style={{ backgroundColor: color }}
              >
                {METODO_ICONS[t.metodo]}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-display font-medium text-text-primary">
                    {t.metodo}
                  </span>
                  <span
                    className="font-numbers text-[15px] font-medium"
                    style={{ color: t.neto >= 0 ? color : "#EF4444" }}
                  >
                    {formatMoney(t.neto)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono text-text-secondary mt-0.5">
                  <span>+{formatMoney(t.entradas)}</span>
                  <span>-{formatMoney(t.salidas)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
        <span className="text-[12px] font-display font-medium text-text-secondary">
          Total neto
        </span>
        <span
          className="font-numbers text-lg font-medium"
          style={{ color: totalGeneral >= 0 ? salonColor : "#EF4444" }}
        >
          {formatMoney(totalGeneral)}
        </span>
      </div>
    </div>
  );
}
