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
  return (
    <Link href={`/salon/${salon.id}`}>
      <div className="bg-surface rounded-card border border-border p-5 active:scale-[0.98] transition-transform">
        {/* Color accent bar */}
        <div
          className="w-10 h-1.5 rounded-full mb-4"
          style={{ backgroundColor: salon.color }}
        />

        <h3 className="text-base font-semibold font-display text-text-primary truncate">
          {salon.nombre}
        </h3>

        <p className="text-xs text-text-secondary mt-1 mb-4">
          {salon.bolsas.length} bolsas · {salon.gastosFijos.length} gastos fijos
        </p>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-text-secondary">Ingresos del mes</p>
            {loading ? (
              <div className="skeleton h-8 w-28 mt-1" />
            ) : (
              <p className="font-numbers text-2xl font-medium text-text-primary mt-0.5">
                {formatMoney(ingresosMes)}
              </p>
            )}
          </div>

          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: salon.color + "18" }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="translate-x-[1px]"
            >
              <path
                d="M6 3L11 8L6 13"
                stroke={salon.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}
