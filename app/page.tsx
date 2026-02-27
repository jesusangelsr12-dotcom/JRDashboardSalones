"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Salon, Cita } from "@/lib/types";
import { initStore } from "@/lib/store";
import { fetchSalonData } from "@/lib/sheets";
import { calcularIngresosMes } from "@/lib/calculations";
import SalonCard from "@/components/salon/SalonCard";
import EmptyState from "@/components/ui/EmptyState";
import FadeIn from "@/components/motion/FadeIn";
import StaggerChildren, { StaggerItem } from "@/components/motion/StaggerChildren";

export default function Home() {
  const [salones, setSalones] = useState<Salon[]>([]);
  const [ingresos, setIngresos] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const data = initStore();
    setSalones(data);
    setMounted(true);
  }, []);

  const fetchIngresos = useCallback(async (salon: Salon) => {
    // No intentar fetch con placeholder IDs
    if (
      !salon.sheetId ||
      salon.sheetId.startsWith("TU_SHEET_ID")
    ) {
      setIngresos((prev) => ({ ...prev, [salon.id]: 0 }));
      return;
    }

    setLoading((prev) => ({ ...prev, [salon.id]: true }));
    try {
      const { citas } = await fetchSalonData(salon.sheetId);
      const hoy = new Date();
      const total = calcularIngresosMes(
        citas,
        hoy.getFullYear(),
        hoy.getMonth()
      );
      setIngresos((prev) => ({ ...prev, [salon.id]: total }));
    } catch {
      setIngresos((prev) => ({ ...prev, [salon.id]: 0 }));
    } finally {
      setLoading((prev) => ({ ...prev, [salon.id]: false }));
    }
  }, []);

  useEffect(() => {
    salones.forEach(fetchIngresos);
  }, [salones, fetchIngresos]);

  if (!mounted) {
    return (
      <main className="p-6 pt-14">
        <div className="skeleton h-8 w-48 mb-2" />
        <div className="skeleton h-4 w-64 mb-8" />
        <div className="space-y-4">
          <div className="skeleton h-32 w-full" />
          <div className="skeleton h-32 w-full" />
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 pt-14 pb-8">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold font-display text-text-primary">
            JR Consulting
          </h1>
          <Link
            href="/salon/new"
            className="w-10 h-10 rounded-full bg-accent flex items-center justify-center active:scale-95 transition-transform"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M9 3V15M3 9H15"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </Link>
        </div>

        <p className="text-sm text-text-secondary mb-8">
          Dashboard financiero multi-salón
        </p>
      </FadeIn>

      {/* Lista de salones */}
      {salones.length === 0 ? (
        <FadeIn delay={0.15}>
          <EmptyState
            title="Sin salones"
            description="Agrega tu primer salón para comenzar a ver métricas"
            icon="💇‍♀️"
          />
        </FadeIn>
      ) : (
        <StaggerChildren className="space-y-4">
          {salones.map((salon) => (
            <StaggerItem key={salon.id}>
              <SalonCard
                salon={salon}
                ingresosMes={ingresos[salon.id] ?? 0}
                loading={loading[salon.id]}
              />
            </StaggerItem>
          ))}
        </StaggerChildren>
      )}

      {/* Footer sutil */}
      <FadeIn delay={0.4}>
        <p className="text-center text-[11px] text-text-secondary/50 mt-12">
          JR Consulting © {new Date().getFullYear()}
        </p>
      </FadeIn>
    </main>
  );
}
