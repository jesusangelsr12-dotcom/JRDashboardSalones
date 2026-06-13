"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import type { Salon, Cita, Gasto, GastoAdmin, MovimientoBolsa, ResumenSemanal as ResumenType } from "@/lib/types";
import { getSalon, getAcumulados, getGastosAdmin, getMovimientosBolsa } from "@/lib/store";
import { fetchSalonData } from "@/lib/sheets";
import { calcularResumenSemanal } from "@/lib/calculations";
import { exportarDatosXlsx } from "@/lib/exportXlsx";
import { getCierres } from "@/lib/store";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import TabNav, { type TabId } from "@/components/dashboard/TabNav";
import ResumenSemanal from "@/components/dashboard/ResumenSemanal";
import BolsasSection from "@/components/dashboard/BolsasSection";
import GraficasSection from "@/components/dashboard/GraficasSection";
import TablaSection from "@/components/dashboard/TablaSection";
import SaludSection from "@/components/dashboard/SaludSection";
import MovimientoBolsaModal from "@/components/dashboard/MovimientoBolsaModal";
import FadeIn from "@/components/motion/FadeIn";

export default function SalonDashboard() {
  const params = useParams<{ id: string }>();
  const [salon, setSalon] = useState<Salon | null>(null);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [resumen, setResumen] = useState<ResumenType | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("resumen");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMovimientoModal, setShowMovimientoModal] = useState(false);
  const [movimientos, setMovimientos] = useState<MovimientoBolsa[]>([]);

  // Load salon from store — also refresh when page regains focus (e.g. back from config)
  const loadSalon = useCallback(async () => {
    const s = await getSalon(params.id);
    if (s) setSalon(s);
  }, [params.id]);

  useEffect(() => {
    loadSalon();
  }, [loadSalon]);

  useEffect(() => {
    const onFocus = () => { loadSalon(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadSalon]);

  // Fetch data from Sheets + admin gastos
  const loadData = useCallback(async () => {
    if (!salon) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch admin gastos from Supabase
      const adminGastos = await getGastosAdmin(salon.id);

      // Convert admin gastos to Gasto format
      const adminGastosConverted: Gasto[] = adminGastos.map((ag) => ({
        fecha: new Date(ag.fecha + "T00:00:00"),
        timestamp: ag.createdAt,
        descripcion: ag.descripcion,
        monto: ag.monto,
        metodoPago: ag.metodoPago,
        bolsaId: ag.bolsaId,
        source: "admin" as const,
        adminId: ag.id,
      }));

      let sheetCitas: Cita[] = [];
      let sheetGastos: Gasto[] = [];

      // Fetch from Sheets if valid ID
      if (salon.sheetId && !salon.sheetId.startsWith("TU_SHEET_ID")) {
        try {
          const { citas: c, gastos: g } = await fetchSalonData(salon.sheetId);
          sheetCitas = c;
          sheetGastos = g.map((gasto) => ({
            ...gasto,
            source: "sheets" as const,
          }));
        } catch (err) {
          setError("No se pudieron cargar los datos de Sheets. Verifica el Sheet ID y la API key.");
        }
      }

      const allCitas = sheetCitas;
      const allGastos = [...sheetGastos, ...adminGastosConverted];

      setCitas(allCitas);
      setGastos(allGastos);

      // Fetch movimientos de bolsa
      const movs = await getMovimientosBolsa(salon.id);
      setMovimientos(movs);

      const acumulados = await getAcumulados(salon.id);
      const r = calcularResumenSemanal(
        allCitas, allGastos, salon.bolsas, salon.gastosFijos,
        acumulados, salon.bolsaDefaultGastosId, salon.comisionTarjeta ?? 0
      );
      setResumen(r);
    } catch (err) {
      setError("Error cargando datos.");
      const acumulados = await getAcumulados(salon.id);
      const r = calcularResumenSemanal(
        [], [], salon.bolsas, salon.gastosFijos,
        acumulados, salon.bolsaDefaultGastosId, salon.comisionTarjeta ?? 0
      );
      setResumen(r);
    } finally {
      setLoading(false);
    }
  }, [salon]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExportXlsx = async () => {
    if (!salon) return;
    const cierres = await getCierres(salon.id);
    exportarDatosXlsx(salon.nombre, citas, gastos, cierres, salon.bolsas);
  };

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
            <ResumenSemanal resumen={resumen} salonColor={salon.color} movimientos={movimientos} />
          )}

          {activeTab === "bolsas" && resumen && (
            <BolsasSection
              resumen={resumen}
              salon={salon}
              salonColor={salon.color}
              citas={citas}
              gastos={gastos}
              movimientos={movimientos}
              onCierreCompleto={loadData}
              onMovimiento={() => setShowMovimientoModal(true)}
            />
          )}

          {activeTab === "graficas" && (
            <GraficasSection
              citas={citas}
              gastos={gastos}
              salonColor={salon.color}
              comisionTarjeta={salon.comisionTarjeta ?? 0}
            />
          )}

          {activeTab === "tabla" && (
            <TablaSection
              citas={citas}
              gastos={gastos}
              movimientos={movimientos}
              bolsas={salon.bolsas}
              salonColor={salon.color}
              comisionTarjeta={salon.comisionTarjeta ?? 0}
              onRefresh={loadData}
            />
          )}

          {activeTab === "salud" && (
            <SaludSection
              salon={salon}
              citas={citas}
              gastos={gastos}
              salonColor={salon.color}
            />
          )}
        </FadeIn>
      )}

      {/* Floating action buttons — bottom right */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 items-end z-50">
        {/* XLSX export — subtle, small */}
        <button
          onClick={handleExportXlsx}
          className="w-9 h-9 rounded-full bg-surface border border-border flex items-center justify-center opacity-40 hover:opacity-100 active:scale-90 transition-all shadow-sm"
          title="Descargar Excel"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1V9M7 9L4 6.5M7 9L10 6.5" stroke="#7C7C8A" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 10V12H12V10" stroke="#7C7C8A" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

      </div>

      {/* Movimiento de bolsa modal */}
      <MovimientoBolsaModal
        open={showMovimientoModal}
        onClose={() => setShowMovimientoModal(false)}
        salonId={salon.id}
        salonColor={salon.color}
        bolsas={salon.bolsas}
        onSaved={loadData}
      />
    </main>
  );
}
