"use client";

import { formatMoney } from "@/lib/calculations";

interface MetodoBreakdownProps {
  porMetodo: {
    Efectivo: number;
    Tarjeta: number;
    Transferencia: number;
  };
  total: number;
}

const METODO_CONFIG = {
  Efectivo: { icon: "💵", color: "#10B981" },
  Tarjeta: { icon: "💳", color: "#6366F1" },
  Transferencia: { icon: "📲", color: "#F59E0B" },
} as const;

export default function MetodoBreakdown({
  porMetodo,
  total,
}: MetodoBreakdownProps) {
  const metodos = (
    Object.entries(porMetodo) as [keyof typeof METODO_CONFIG, number][]
  ).filter(([, monto]) => monto > 0);

  if (metodos.length === 0 && total === 0) {
    return null;
  }

  return (
    <div className="bg-surface rounded-card border border-border p-4">
      <p className="text-[11px] uppercase tracking-[0.08em] text-text-secondary font-display font-medium mb-4">
        Por método de pago
      </p>

      <div className="space-y-3">
        {(Object.keys(METODO_CONFIG) as (keyof typeof METODO_CONFIG)[]).map(
          (metodo) => {
            const monto = porMetodo[metodo];
            const pct = total > 0 ? (monto / total) * 100 : 0;
            const config = METODO_CONFIG[metodo];

            return (
              <div key={metodo}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{config.icon}</span>
                    <span className="text-[13px] text-text-primary font-display">
                      {metodo}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-numbers text-text-primary">
                      {formatMoney(monto)}
                    </span>
                    <span className="text-[11px] font-numbers text-text-secondary w-10 text-right">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-bg rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${Math.max(pct, 1)}%`,
                      backgroundColor: config.color,
                    }}
                  />
                </div>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}
