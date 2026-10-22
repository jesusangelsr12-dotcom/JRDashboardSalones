"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import type { Salon, Cita, Gasto, Comision, GastoAdmin, MovimientoBolsa, ResumenSemanal as ResumenType } from "@/lib/types";
import { getSalon, getAcumulados, getGastosAdmin, getMovimientosBolsa } from "@/lib/store";
import { fetchSalonData } from "@/lib/sheets";
import { fetchSalonDataNeon } from "@/lib/neon";
import { calcularResumenSemanal } from "@/lib/calculations";
import { calcularSalud } from "@/lib/salud";
import { exportarDatosXlsx } from "@/lib/exportXlsx";
import { getCierres } from "@/lib/store";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import TabNav, { type TabId, TAB_IDS } from "@/components/dashboard/TabNav";
import ResumenSemanal from "@/components/dashboard/ResumenSemanal";
import BolsasSection from "@/components/dashboard/BolsasSection";
import GraficasSection from "@/components/dashboard/GraficasSection";
import TablaSection from "@/components/dashboard/TablaSection";
import SaludSection from "@/components/dashboard/SaludSection";
import MovimientoBolsaModal from "@/components/dashboard/MovimientoBolsaModal";
import FadeIn from "@/components/motion/FadeIn";
import UpdateButton from "@/components/ui/UpdateButton";

export default function SalonDashboard() {
  const params = useParams<{ id: string }>();
  const [salon, setSalon] = useState<Salon | null>(null);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [comisiones, setComisiones] = useState<Comision[]>([]);
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

  // Al cambiar de salón desde el encabezado se conserva la pestaña (?tab=)
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab && (TAB_IDS as string[]).includes(tab)) setActiveTab(tab as TabId);
  }, []);

  // Refrescar al volver el foco solo si pasó tiempo suficiente (evita refetch
  // en cada cambio de pestaña/app). Sigue tomando cambios de config tras ~2 min.
  const lastFocusLoad = useRef(Date.now());
  useEffect(() => {
    const onFocus = () => {
      if (Date.now() - lastFocusLoad.current > 120000) {
        lastFocusLoad.current = Date.now();
        loadSalon();
      }
    };
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
      let sheetComisiones: Comision[] = [];

      // Fetch de Neon o de Sheets, según la fuente de datos configurada
      if (salon.dataSource === "neon") {
        if (salon.neonSalonId) {
          try {
            const { citas: c, gastos: g, comisiones: com } = await fetchSalonDataNeon(salon.neonSalonId);
            sheetCitas = c;
            sheetGastos = g.map((gasto) => ({
              ...gasto,
              source: "sheets" as const,
            }));
            sheetComisiones = com;
          } catch (err) {
            setError("No se pudieron cargar los datos de la base de datos. Verifica la conexión a Neon.");
          }
        }
      } else if (salon.sheetId && !salon.sheetId.startsWith("TU_SHEET_ID")) {
        try {
          const { citas: c, gastos: g, comisiones: com } = await fetchSalonData(salon.sheetId);
          sheetCitas = c;
          sheetGastos = g.map((gasto) => ({
            ...gasto,
            source: "sheets" as const,
          }));
          sheetComisiones = com;
        } catch (err) {
          setError("No se pudieron cargar los datos de Sheets. Verifica el Sheet ID y la API key.");
        }
      }

      const allCitas = sheetCitas;
      const allGastos = [...sheetGastos, ...adminGastosConverted];

      setCitas(allCitas);
      setGastos(allGastos);
      setComisiones(sheetComisiones);

      // Fetch movimientos de bolsa
      const movs = await getMovimientosBolsa(salon.id);
      setMovimientos(movs);

      const acumulados = await getAcumulados(salon.id);
      const r = calcularResumenSemanal(
        allCitas, allGastos, sheetComisiones, salon.bolsas, salon.gastosFijos,
        acumulados, salon.bolsaDefaultGastosId, salon.comisionTarjeta ?? 0
      );
      setResumen(r);
    } catch (err) {
      setError("Error cargando datos.");
      const acumulados = await getAcumulados(salon.id);
      const r = calcularResumenSemanal(
        [], [], [], salon.bolsas, salon.gastosFijos,
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

  // Semáforo global del mes para el encabezado
  const semaforo = useMemo(() => {
    if (!salon || loading || citas.length === 0) return undefined;
    const hoy = new Date();
    return calcularSalud(
      citas, gastos, comisiones, salon.gastosFijos, salon.bolsas,
      hoy.getFullYear(), hoy.getMonth(), salon.comisionTarjeta ?? 0, hoy
    ).semaforoGlobal;
  }, [salon, citas, gastos, comisiones, loading]);

  const handleExportXlsx = async () => {
    if (!salon) return;
    const cierres = await getCierres(salon.id);
    exportarDatosXlsx(salon.nombre, citas, gastos, cierres, salon.bolsas);
  };

  // Loading skeleton
  if (!salon) {
    return (
      <main className="px-4 pt-14">
        <div className="skeleton h-11 w-11 rounded-full mb-3" />
        <div className="skeleton h-6 w-48 mb-2" />
        <div className="skeleton h-4 w-40 mb-6" />
        <div className="grid grid-cols-2 gap-2.5">
          <div className="skeleton h-44 col-span-2 rounded-[22px]" />
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
          <div className="skeleton h-28 col-span-2" />
        </div>
      </main>
    );
  }

  return (
    <main className="px-4" style={{ paddingBottom: "calc(6.5rem + var(--safe-area-bottom))" }}>
      <FadeIn>
        <DashboardHeader salon={salon} semaforo={semaforo} tab={activeTab} onExport={handleExportXlsx} />
      </FadeIn>

      {/* Error banner */}
      {error && (
        <FadeIn delay={0.1}>
          <div className="bg-sale-soft border border-sale/20 rounded-[16px] px-4 py-3 mb-3">
            <p className="text-[13px] text-sale font-display font-medium">{error}</p>
          </div>
        </FadeIn>
      )}

      {/* Tab content */}
      {loading ? (
        <div className="space-y-2.5">
          <div className="skeleton h-44 w-full rounded-[22px]" />
          <div className="grid grid-cols-2 gap-2.5">
            <div className="skeleton h-24" />
            <div className="skeleton h-24" />
          </div>
          <div className="skeleton h-28 w-full" />
          <div className="skeleton h-32 w-full" />
        </div>
      ) : (
        <FadeIn delay={0.05} key={activeTab}>
          {activeTab === "resumen" && resumen && (
            <ResumenSemanal
              resumen={resumen}
              movimientos={movimientos}
              gastosFijos={salon.gastosFijos}
              gastos={gastos}
              comisiones={comisiones}
              citas={citas}
              comisionTarjeta={salon.comisionTarjeta ?? 0}
              bolsaDefaultNombre={salon.bolsas.find((b) => b.id === salon.bolsaDefaultGastosId)?.nombre}
              onVerCierres={() => {
                setActiveTab("bolsas");
                window.scrollTo({ top: 0 });
              }}
            />
          )}

          {activeTab === "bolsas" && resumen && (
            <BolsasSection
              resumen={resumen}
              salon={salon}
              citas={citas}
              gastos={gastos}
              comisiones={comisiones}
              movimientos={movimientos}
              onCierreCompleto={loadData}
              onMovimiento={() => setShowMovimientoModal(true)}
            />
          )}

          {activeTab === "graficas" && (
            <GraficasSection
              citas={citas}
              gastos={gastos}
              comisiones={comisiones}
              comisionTarjeta={salon.comisionTarjeta ?? 0}
            />
          )}

          {activeTab === "tabla" && (
            <TablaSection
              citas={citas}
              gastos={gastos}
              movimientos={movimientos}
              bolsas={salon.bolsas}
              comisionTarjeta={salon.comisionTarjeta ?? 0}
              onRefresh={loadData}
            />
          )}

          {activeTab === "salud" && (
            <SaludSection
              salon={salon}
              citas={citas}
              gastos={gastos}
              comisiones={comisiones}
            />
          )}
        </FadeIn>
      )}

      {/* Actualizar a la última versión */}
      <div className="mt-10">
        <UpdateButton />
      </div>

      {/* Barra inferior */}
      <TabNav
        active={activeTab}
        onChange={(t) => {
          setActiveTab(t);
          window.scrollTo({ top: 0 });
        }}
      />

      {/* Movimiento de bolsa modal */}
      <MovimientoBolsaModal
        open={showMovimientoModal}
        onClose={() => setShowMovimientoModal(false)}
        salonId={salon.id}
        bolsas={salon.bolsas}
        onSaved={loadData}
      />
    </main>
  );
}
