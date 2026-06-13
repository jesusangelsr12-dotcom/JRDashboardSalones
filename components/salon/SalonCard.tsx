"use client";

import Link from "next/link";
import type { Salon } from "@/lib/types";
import { formatMoney } from "@/lib/calculations";

interface SalonCardProps {
  salon: Salon;
  ingresosMes: number;
  loading?: boolean;
}

export default function SalonCard({
  salon,
  ingresosMes,
  loading,
}: SalonCardProps) {
  const iniciales = salon.nombre.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";

  return (
    <Link href={`/salon/${salon.id}`}>
      <div className="bg-surface rounded-card border border-border p-5 active:scale-[0.98] transition-transform">
        {/* Identity row */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-[15px] font-display font-bold text-white flex-shrink-0"
            style={{ backgroundColor: salon.color }}
          >
            {iniciales}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-semibold font-display text-text-primary truncate leading-tight">
              {salon.nombre}
            </h3>
            <p className="text-[12px] text-text-secondary mt-0.5">
              {salon.bolsas.length} bolsas · {salon.gastosFijos.length} gastos fijos
            </p>
          </div>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: salon.color + "18" }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="translate-x-[1px]">
              <path d="M6 3L11 8L6 13" stroke={salon.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Ingresos hero */}
        <p className="text-[11px] uppercase tracking-[0.08em] text-text-secondary font-display font-medium">
          Ingresos del mes
        </p>
        {loading ? (
          <div className="skeleton h-9 w-32 mt-1.5" />
        ) : (
          <p className="font-numbers text-[28px] leading-none font-medium text-text-primary mt-1.5">
            {formatMoney(ingresosMes)}
          </p>
        )}
      </div>
    </Link>
  );
}
