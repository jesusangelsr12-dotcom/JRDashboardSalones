"use client";

import { useMemo, useState } from "react";
import type { ResumenSemanal as ResumenType, MovimientoBolsa, Gasto, GastoFijo, Comision, Cita } from "@/lib/types";
import {
  formatMoney,
  calcularGastoProductosMes,
  getLunesDeSemana,
  getDomingoDeSemana,
  getInicioMes,
  getFinMes,
  enRango,
  costoNeto,
} from "@/lib/calculations";
import GastoDetalleModal from "./GastoDetalleModal";
import { Delta, SectionLabel, SemaforoChip, METODO_COLOR } from "@/components/ui/Primitives";
import { IconChevronRight } from "@/components/ui/Icons";
import type { Semaforo } from "@/lib/salud";

interface ResumenSemanalProps {
  resumen: ResumenType;
  movimientos?: MovimientoBolsa[];
  gastosFijos?: GastoFijo[];
  gastos?: Gasto[];
  comisiones?: Comision[];
  citas?: Cita[];
  comisionTarjeta?: number;
  bolsaDefaultNombre?: string;
  onVerCierres?: () => void;
}

// Defaults estables para no invalidar useMemo en cada render
const SIN_GASTOS: Gasto[] = [];
const SIN_COMISIONES: Comision[] = [];
const SIN_CITAS: Cita[] = [];
const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

// Semáforo de productos (amarillo de calculations ≈ atento)
const SEMAFORO_PRODUCTOS: Record<string, Semaforo> = { verde: "verde", amarillo: "ambar", rojo: "rojo" };

export default function ResumenSemanal({
  resumen,
  movimientos = [],
  gastosFijos = [],
  gastos = SIN_GASTOS,
  comisiones = SIN_COMISIONES,
  citas = SIN_CITAS,
  comisionTarjeta = 0,
  bolsaDefaultNombre,
  onVerCierres,
}: ResumenSemanalProps) {
  const [detalleGastos, setDetalleGastos] = useState<"fijos" | "bolsas" | "comisiones" | null>(null);

  const hoy = useMemo(() => new Date(), []);

  const gastosSemana = useMemo(
    () => enRango(gastos, getLunesDeSemana(hoy), getDomingoDeSemana(hoy)),
    [gastos, hoy]
  );

  const comisionesSemana = useMemo(
    () => enRango(comisiones, getLunesDeSemana(hoy), getDomingoDeSemana(hoy)),
    [comisiones, hoy]
  );

  // Citas de la semana y mismo tramo (lunes → hoy) de la semana pasada
  const { citasSemana, ingresosTramoPasado } = useMemo(() => {
    const lunes = getLunesDeSemana(hoy);
    const delSemana = enRango(citas, lunes, getDomingoDeSemana(hoy));
    const lunesPasado = new Date(lunes);
    lunesPasado.setDate(lunesPasado.getDate() - 7);
    const hoyPasado = new Date(hoy);
    hoyPasado.setDate(hoyPasado.getDate() - 7);
    hoyPasado.setHours(23, 59, 59, 999);
    const tramo = enRango(citas, lunesPasado, hoyPasado).reduce(
      (s, c) => s + costoNeto(c.costo, c.metodoPago, comisionTarjeta),
      0
    );
    return { citasSemana: delSemana.length, ingresosTramoPasado: tramo };
  }, [citas, comisionTarjeta, hoy]);

  // Productos del mes contra el ingreso DEL MES (antes se comparaba contra la semana)
  const kpiProductos = useMemo(() => {
    const ingresosMes = enRango(citas, getInicioMes(hoy.getFullYear(), hoy.getMonth()), getFinMes(hoy.getFullYear(), hoy.getMonth()))
      .reduce((s, c) => s + costoNeto(c.costo, c.metodoPago, comisionTarjeta), 0);
    return calcularGastoProductosMes(movimientos, ingresosMes, hoy.getMonth(), hoy.getFullYear());
  }, [movimientos, citas, comisionTarjeta, hoy]);

  const dia = ((hoy.getDay() + 6) % 7) + 1;
  const total = resumen.ingresos || 1;
  const pctDe = (v: number) => `${Math.max(0, (v / total) * 100).toFixed(2)}%`;
  const libreNeg = resumen.libre < 0;
  const semProd = SEMAFORO_PRODUCTOS[kpiProductos.semaforo];
  const colorProd = semProd === "verde" ? "#0E8A5F" : semProd === "ambar" ? "#9A4A00" : "#B3261E";
  const metodos = ["Efectivo", "Tarjeta", "Transferencia"] as const;

  return (
    <section>
      {/* Semana en curso */}
      <div className="flex items-center justify-between text-[12px] font-display font-semibold text-text-secondary mb-2 px-0.5">
        <span className="flex items-center gap-2 text-text-primary">
          <span className="w-[7px] h-[7px] rounded-full bg-tinta animate-[pulseDot_1.8s_ease-in-out_infinite]" />
          Semana en curso
        </span>
        <span>Día {dia} de 7</span>
      </div>

      {/* Panel de dinero: Dinero libre */}
      <div className="relative overflow-hidden rounded-[22px] bg-tinta text-white p-[18px] mb-3">
        <div className="pointer-events-none absolute -right-16 -top-20 w-52 h-52 rounded-full bg-[radial-gradient(closest-side,rgba(217,0,122,0.5),transparent)]" />
        <div className="relative flex items-center justify-between text-[12px] font-display font-semibold text-white/75">
          <span>Dinero libre</span>
          <span className="bg-white/[0.12] text-white text-[11px] px-2.5 py-0.5 rounded-full">esta semana</span>
        </div>
        <p className={`relative font-numbers text-[40px] font-bold leading-none tracking-[-0.035em] mt-2.5 mb-1.5 ${libreNeg ? "text-[#FF9C92]" : ""}`}>
          {libreNeg ? "−" : ""}
          {formatMoney(Math.abs(resumen.libre))}
        </p>
        <p className="relative text-[12px] text-white/70">Ingresos − Gastos fijos − Comisiones</p>

        <div className="relative flex h-2.5 rounded-full overflow-hidden gap-[2px] mt-3.5" aria-hidden="true">
          <span className="h-full bg-[#FF8F84]" style={{ width: pctDe(resumen.gastosFijos) }} />
          <span className="h-full bg-[#FFC6BE]" style={{ width: pctDe(resumen.comisiones) }} />
          <span className="h-full bg-[#7BE3B6]" style={{ width: pctDe(resumen.libre) }} />
        </div>
        <div className="relative mt-3 space-y-[5px] text-[12.5px] text-white/80">
          <FilaPanel label="Ingresos" valor={formatMoney(resumen.ingresos)} />
          <FilaPanel label="Gastos fijos" color="#FF8F84" valor={`−${formatMoney(resumen.gastosFijos)}`} />
          <FilaPanel label="Comisiones" color="#FFC6BE" valor={`−${formatMoney(resumen.comisiones)}`} />
          <div className="pt-[7px] mt-0.5 border-t border-white/[0.14]">
            <FilaPanel label="Libre" color="#7BE3B6" valor={formatMoney(resumen.libre)} fuerte />
          </div>
        </div>
      </div>

      {/* Mosaicos */}
      <div className="grid grid-cols-2 gap-2.5 mb-3">
        <div className="col-span-2 bg-surface border border-border rounded-[18px] px-3.5 py-3">
          <p className="text-[12px] text-text-secondary font-medium">Ingresos de la semana</p>
          <p className="font-numbers text-[30px] font-bold leading-tight tracking-[-0.025em] text-text-primary">
            {formatMoney(resumen.ingresos)}
          </p>
          <Delta
            actual={resumen.ingresos}
            base={ingresosTramoPasado}
            referencia={`vs. lun–${DIAS_CORTOS[hoy.getDay()]} de la semana pasada`}
          />
          <p className="text-[11.5px] text-text-secondary mt-0.5">
            {citasSemana} citas · netos de comisión de tarjeta{comisionTarjeta > 0 ? ` (${comisionTarjeta}%)` : ""}
          </p>
        </div>

        <TileGasto label="Gastos fijos" valor={resumen.gastosFijos} onClick={() => setDetalleGastos("fijos")} />
        <TileGasto label="Comisiones" valor={resumen.comisiones} onClick={() => setDetalleGastos("comisiones")} />

        <button
          onClick={() => setDetalleGastos("bolsas")}
          className="col-span-2 text-left bg-surface border border-border rounded-[18px] px-3.5 py-3 active:scale-[0.98] transition-transform"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] text-text-secondary font-medium">Gastos en bolsas</p>
              <p className="font-numbers text-[22px] font-bold leading-tight tracking-[-0.025em] text-sale">
                {resumen.gastosVariables > 0 ? "−" : ""}
                {formatMoney(resumen.gastosVariables)}
              </p>
            </div>
            <VerDetalle />
          </div>
          <p className="text-[11.5px] text-text-secondary mt-1 leading-snug">
            No restan del libre: salen del acumulado {bolsaDefaultNombre ? `de ${bolsaDefaultNombre} ` : "de la bolsa de gastos "}al cerrar la semana.
          </p>
        </button>
      </div>

      {/* Productos del mes */}
      {(kpiProductos.totalProductos > 0 || movimientos.length > 0) && (
        <div className="bg-surface border border-border rounded-card p-3.5 mb-3">
          <div className="flex items-center justify-between">
            <SectionLabel>Productos del mes</SectionLabel>
            <SemaforoChip semaforo={semProd} label={semProd === "verde" ? "Bajo control" : semProd === "ambar" ? "Vigilar" : "Alto"} />
          </div>
          <div className="flex items-baseline gap-2.5 flex-wrap mt-2">
            <p className="font-numbers text-[22px] font-bold text-text-primary">{formatMoney(kpiProductos.totalProductos)}</p>
            <p className="font-numbers text-[13px] font-bold" style={{ color: colorProd }}>
              {kpiProductos.ratio.toFixed(1)}% de los ingresos del mes
            </p>
          </div>
          <div className="relative h-2 bg-bg rounded-full mt-2.5 mb-1.5">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (kpiProductos.ratio / 25) * 100)}%`, backgroundColor: colorProd }}
            />
            <span className="absolute -top-[3px] -bottom-[3px] w-[2px] rounded bg-tinta/20" style={{ left: "60%" }} />
            <span className="absolute -top-[3px] -bottom-[3px] w-[2px] rounded bg-tinta/20" style={{ left: "80%" }} />
          </div>
          <p className="text-[11.5px] text-text-secondary">Atento desde 15 %, alto arriba de 20 %.</p>
        </div>
      )}

      {/* Por método de pago */}
      {resumen.ingresos > 0 && (
        <div className="bg-surface border border-border rounded-card p-3.5 mb-3">
          <SectionLabel>Por método de pago</SectionLabel>
          <div className="flex h-2.5 rounded-full overflow-hidden gap-[2px] mt-3 mb-2">
            {metodos.map((m) => (
              <span key={m} className="h-full" style={{ width: pctDe(resumen.porMetodo[m]), backgroundColor: METODO_COLOR[m] }} />
            ))}
          </div>
          {metodos.map((m) => (
            <div key={m} className="grid grid-cols-[1fr_auto_40px] items-center gap-2 py-2 border-t border-border text-[13px]">
              <span className="flex items-center gap-2 text-text-primary">
                <span className="w-[9px] h-[9px] rounded-[3px]" style={{ backgroundColor: METODO_COLOR[m] }} />
                {m}
              </span>
              <span className="font-numbers font-semibold text-text-primary">{formatMoney(resumen.porMetodo[m])}</span>
              <span className="font-numbers text-[12px] text-text-secondary text-right">
                {((resumen.porMetodo[m] / total) * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {onVerCierres && (
        <button
          onClick={onVerCierres}
          className="w-full flex items-center justify-between gap-3 bg-rubor rounded-[18px] px-4 py-3.5 text-left active:scale-[0.99] transition-transform"
        >
          <span>
            <span className="block text-[14px] font-display font-bold text-text-primary">Reparto en bolsas</span>
            <span className="block text-[12px] text-text-secondary">
              {formatMoney(Math.max(0, resumen.libre))} a repartir entre {resumen.bolsas.length} bolsas
            </span>
          </span>
          <IconChevronRight size={18} className="text-rosa" />
        </button>
      )}

      {/* Detalle de gastos (fijos / comisiones / en bolsas) */}
      <GastoDetalleModal
        open={detalleGastos !== null}
        onClose={() => setDetalleGastos(null)}
        tipo={detalleGastos}
        gastosFijos={gastosFijos}
        gastosSemana={gastosSemana}
        comisionesSemana={comisionesSemana}
      />
    </section>
  );
}

function FilaPanel({ label, valor, color, fuerte }: { label: string; valor: string; color?: string; fuerte?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`flex items-center gap-[7px] ${fuerte ? "text-white font-bold" : ""}`}>
        {color && <span className="w-2 h-2 rounded-[2px]" style={{ backgroundColor: color }} />}
        {label}
      </span>
      <span className={`font-numbers text-white ${fuerte ? "text-[16px] font-bold" : "text-[13.5px] font-semibold"}`}>{valor}</span>
    </div>
  );
}

function VerDetalle() {
  return (
    <span className="inline-flex items-center gap-0.5 text-[11.5px] font-bold text-rosa whitespace-nowrap">
      Ver detalle <IconChevronRight size={12} />
    </span>
  );
}

function TileGasto({ label, valor, onClick }: { label: string; valor: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-surface border border-border rounded-[18px] px-3.5 py-3 flex flex-col gap-0.5 active:scale-[0.98] transition-transform"
    >
      <span className="text-[12px] text-text-secondary font-medium">{label}</span>
      <span className="font-numbers text-[22px] font-bold leading-tight tracking-[-0.025em] text-sale">
        {valor > 0 ? "−" : ""}
        {formatMoney(valor)}
      </span>
      <VerDetalle />
    </button>
  );
}
