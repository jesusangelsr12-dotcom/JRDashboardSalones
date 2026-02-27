"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import type { Salon, Cita, Gasto, ResumenSemanal as ResumenType } from "@/lib/types";
import { getSalon, getAcumulados } from "@/lib/store";
import { fetchSalonData } from "@/lib/sheets";
import { calcularResumenSemanal } from "@/lib/calculations";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import TabNav, { type TabId } from "@/components/dashboard/TabNav";
import ResumenSemanal from "@/components/dashboard/ResumenSemanal";

export default function SalonDashboard() {
  const params = useParams<{ id: string }>();
  const [salon, setSalon] = useState<Salon | null>(null);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [resumen, setResumen] = useState<ResumenType | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("resumen");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load salon from store
  useEffect(() => {
    const s = getSalon(params.id);
    if (s) setSalon(s);
  }, [params.id]);

  // Fetch data from Sheets
  const loadData = useCallback(async () => {
    if (!salon) return;

    // Skip fetch for placeholder sheet IDs
    if (!salon.sheetId || salon.sheetId.startsWith("TU_SHEET_ID")) {
      const acumulados = getAcumulados(salon.id);
      const r = calcularResumenSemanal([], [], salon.bolsas, salon.gastosFijos, acumulados);
      setResumen(r);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { citas: c, gastos: g } = await fetchSalonData(salon.sheetId);
      setCitas(c);
      setGastos(g);

      const acumulados = getAcumulados(salon.id);
      const r = calcularResumenSemanal(c, g, salon.bolsas, salon.gastosFijos, acumulados);
      setResumen(r);
    } catch (err) {
      setError("No se pudieron cargar los datos. Verifica el Sheet ID y la API key.");
      // Still calculate with empty data so UI renders
      const acumulados = getAcumulados(salon.id);
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
      <DashboardHeader salon={salon} />

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-card px-4 py-3 mb-4">
          <p className="text-[13px] text-red-600 font-display">{error}</p>
        </div>
      )}

      {/* Tab navigation */}
      <TabNav
        active={activeTab}
        onChange={setActiveTab}
        salonColor={salon.color}
      />

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
        <>
          {activeTab === "resumen" && resumen && (
            <ResumenSemanal resumen={resumen} salonColor={salon.color} />
          )}

          {activeTab === "bolsas" && (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-text-secondary font-display">
                Bolsas — próximamente
              </p>
            </div>
          )}

          {activeTab === "graficas" && (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-text-secondary font-display">
                Gráficas — próximamente
              </p>
            </div>
          )}

          {activeTab === "tabla" && (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-text-secondary font-display">
                Tabla — próximamente
              </p>
            </div>
          )}
        </>
      )}
    </main>
  );
}
