"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import type { Salon, Cita, Gasto, ResumenSemanal as ResumenType, DatosGraficas } from "@/lib/types";
import { getSalon, getAcumulados } from "@/lib/store";
import { fetchSalonData } from "@/lib/sheets";
import { calcularResumenSemanal, calcularDatosGraficas } from "@/lib/calculations";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import TabNav, { type TabId } from "@/components/dashboard/TabNav";
import ResumenSemanal from "@/components/dashboard/ResumenSemanal";
import BolsasSection from "@/components/dashboard/BolsasSection";
import GraficasSection from "@/components/dashboard/GraficasSection";
import TablaSection from "@/components/dashboard/TablaSection";
import FadeIn from "@/components/motion/FadeIn";

export default function SalonDashboard() {
  const params = useParams<{ id: string }>();
  const [salon, setSalon] = useState<Salon | null>(null);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [resumen, setResumen] = useState<ResumenType | null>(null);
  const [datosGraficas, setDatosGraficas] = useState<DatosGraficas | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("resumen");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load salon from store
  useEffect(() => {
    async function load() {
      const s = await getSalon(params.id);
      if (s) setSalon(s);
    }
    load();
  }, [params.id]);

  // Fetch data from Sheets
  const loadData = useCallback(async () => {
    if (!salon) return;

    // Skip fetch for placeholder sheet IDs
    if (!salon.sheetId || salon.sheetId.startsWith("TU_SHEET_ID")) {
      const acumulados = await getAcumulados(salon.id);
      const r = calcularResumenSemanal([], [], salon.bolsas, salon.gastosFijos, acumulados);
      setResumen(r);
      const hoy = new Date();
      setDatosGraficas(calcularDatosGraficas([], [], hoy.getFullYear(), hoy.getMonth()));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { citas: c, gastos: g } = await fetchSalonData(salon.sheetId);
      setCitas(c);
      setGastos(g);

      const acumulados = await getAcumulados(salon.id);
      const r = calcularResumenSemanal(c, g, salon.bolsas, salon.gastosFijos, acumulados);
      setResumen(r);
      const hoy = new Date();
      setDatosGraficas(calcularDatosGraficas(c, g, hoy.getFullYear(), hoy.getMonth()));
    } catch (err) {
      setError("No se pudieron cargar los datos. Verifica el Sheet ID y la API key.");
      // Still calculate with empty data so UI renders
      const acumulados = await getAcumulados(salon.id);
      const r = calcularResumenSemanal([], [], salon.bolsas, salon.gastosFijos, acumulados);
      setResumen(r);
    } finally {
      setLoading(false);
    }
  }, [salon]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Loading skeleton
  if (!salon) {
    return (
      <main className="p-6 pt-14">
        <div className="skeleton h-6 w-32 mb-2" />
        <div className="skeleton h-4 w-48 mb-8" />
        <div className="skeleton h-10 w-full mb-6 rounded-[10px]" />
        <div className="grid grid-cols-2 gap-3">
          <div className="skeleton h-24 col-span-2" />
          <div className="skeleton h-20" />
          <div className="skeleton h-20" />
          <div className="skeleton h-28 col-span-2" />
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 pb-10">
      <FadeIn>
        <DashboardHeader salon={salon} />
      </FadeIn>

      {/* Error banner */}
      {error && (
        <FadeIn delay={0.1}>
          <div className="bg-red-50 border border-red-200 rounded-card px-4 py-3 mb-4">
            <p className="text-[13px] text-red-600 font-display">{error}</p>
          </div>
        </FadeIn>
      )}

      {/* Tab navigation */}
      <FadeIn delay={0.15}>
        <TabNav
          active={activeTab}
          onChange={setActiveTab}
          salonColor={salon.color}
        />
      </FadeIn>

      {/* Tab content */}
      {loading ? (
        <div className="space-y-3">
          <div className="skeleton h-24 w-full" />
          <div className="grid grid-cols-2 gap-3">
            <div className="skeleton h-20" />
            <div className="skeleton h-20" />
          </div>
          <div className="skeleton h-28 w-full" />
          <div className="skeleton h-32 w-full" />
        </div>
      ) : (
        <FadeIn delay={0.2} key={activeTab}>
          {activeTab === "resumen" && resumen && (
            <ResumenSemanal resumen={resumen} salonColor={salon.color} />
          )}

          {activeTab === "bolsas" && resumen && (
            <BolsasSection
              resumen={resumen}
              salon={salon}
              salonColor={salon.color}
              onCierreCompleto={loadData}
            />
          )}

          {activeTab === "graficas" && datosGraficas && (
            <GraficasSection
              datos={datosGraficas}
              salonColor={salon.color}
              mesLabel={new Date().toLocaleDateString("es-MX", {
                month: "long",
                year: "numeric",
              })}
            />
          )}

          {activeTab === "tabla" && (
            <TablaSection
              citas={citas}
              gastos={gastos}
              salonColor={salon.color}
            />
          )}
        </FadeIn>
      )}
    </main>
  );
}
