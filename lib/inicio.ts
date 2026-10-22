// ════════════════════════════════════════════════════════════════
// Inicio del administrador: consolidado de todos los salones.
// Funciones puras; reutilizan calcularSalud y calcularResumenSemanal
// para que las cifras sean las mismas que dentro de cada salón.
// ════════════════════════════════════════════════════════════════

import type { Cita, Gasto, Comision, Salon, CierreSemana } from "./types";
import { calcularResumenSemanal, costoNeto, enRango, getLunesDeSemana } from "./calculations";
import { calcularSalud, calcularSaludMismoTramoAnterior, type SaludSnapshot, type KpiResultado, type Semaforo } from "./salud";

export interface DatosSalonInicio {
  salon: Salon;
  salud: SaludSnapshot;
  saludPrev: SaludSnapshot;
  libreSemana: number;
  proyeccionMes: number;
  ingresosSemanas: number[]; // últimas 8 semanas cerradas, de la más vieja a la más reciente
  cierreSemanaPasada: CierreSemana | null;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Proyección lineal del mes al ritmo diario de hoy. */
export function proyectarMes(ingresosAlDia: number, hoy: Date): number {
  const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  return hoy.getDate() > 0 ? (ingresosAlDia / hoy.getDate()) * diasMes : 0;
}

/** Ingresos netos de las últimas `n` semanas ya cerradas (lunes a domingo). */
export function ingresosUltimasSemanas(citas: Cita[], comisionTarjeta: number, hoy: Date, n = 8): number[] {
  const lunesActual = getLunesDeSemana(hoy);
  const out: number[] = [];
  for (let i = n; i >= 1; i--) {
    const ini = new Date(lunesActual);
    ini.setDate(ini.getDate() - 7 * i);
    const fin = new Date(ini);
    fin.setDate(fin.getDate() + 6);
    fin.setHours(23, 59, 59, 999);
    out.push(enRango(citas, ini, fin).reduce((s, c) => s + costoNeto(c.costo, c.metodoPago, comisionTarjeta), 0));
  }
  return out;
}

export function resumirSalon(
  salon: Salon,
  citas: Cita[],
  gastos: Gasto[],
  comisiones: Comision[],
  cierres: CierreSemana[],
  hoy: Date = new Date()
): DatosSalonInicio {
  const com = salon.comisionTarjeta ?? 0;
  const salud = calcularSalud(citas, gastos, comisiones, salon.gastosFijos, salon.bolsas, hoy.getFullYear(), hoy.getMonth(), com, hoy);
  const { salud: saludPrev } = calcularSaludMismoTramoAnterior(
    citas, gastos, comisiones, salon.gastosFijos, salon.bolsas, hoy.getFullYear(), hoy.getMonth(), com, hoy
  );
  const resumen = calcularResumenSemanal(citas, gastos, comisiones, salon.bolsas, salon.gastosFijos, {}, salon.bolsaDefaultGastosId, com, hoy);
  const lunesPasado = getLunesDeSemana(hoy);
  lunesPasado.setDate(lunesPasado.getDate() - 7);
  const cierreSemanaPasada = cierres.find((c) => c.semanaInicio === ymd(lunesPasado)) ?? null;
  return {
    salon,
    salud,
    saludPrev,
    libreSemana: resumen.libre,
    proyeccionMes: proyectarMes(salud.ingresosMes, hoy),
    ingresosSemanas: ingresosUltimasSemanas(citas, com, hoy),
    cierreSemanaPasada,
  };
}

export interface Consolidado {
  ingresos: number;
  ingresosPrev: number;
  utilidad: number;
  margen: number;
  libreSemana: number;
  proyeccion: number;
  visitas: number;
  visitasPrev: number;
  ticket: number;
  ticketPrev: number;
  costoPersonal: number; // % del ingreso
  clientasEnRiesgo: number;
  valorClientasEnRiesgo: number;
}

export function consolidar(filas: DatosSalonInicio[]): Consolidado {
  const sum = (f: (d: DatosSalonInicio) => number) => filas.reduce((s, d) => s + f(d), 0);
  const ingresos = sum((d) => d.salud.ingresosMes);
  const ingresosPrev = sum((d) => d.saludPrev.ingresosMes);
  const utilidad = sum((d) => d.salud.utilidad);
  const visitas = sum((d) => d.salud.visitasMes);
  const visitasPrev = sum((d) => d.saludPrev.visitasMes);
  const personal = sum((d) => (d.salud.costoPersonal.valor / 100) * d.salud.ingresosMes);
  return {
    ingresos,
    ingresosPrev,
    utilidad,
    margen: ingresos > 0 ? (utilidad / ingresos) * 100 : 0,
    libreSemana: sum((d) => d.libreSemana),
    proyeccion: sum((d) => d.proyeccionMes),
    visitas,
    visitasPrev,
    ticket: visitas > 0 ? ingresos / visitas : 0,
    ticketPrev: visitasPrev > 0 ? ingresosPrev / visitasPrev : 0,
    costoPersonal: ingresos > 0 ? (personal / ingresos) * 100 : 0,
    clientasEnRiesgo: sum((d) => d.salud.clientasEnRiesgo.length),
    valorClientasEnRiesgo: sum((d) => d.salud.clientasEnRiesgo.reduce((s, c) => s + c.ingresoHistorico, 0)),
  };
}

// ── "Necesita tu atención" ──

export interface Alerta {
  salonId: string;
  salonNombre: string;
  semaforo: Semaforo;
  texto: string;
}

type KpiClave = "margenNeto" | "costoPersonal" | "puntoEquilibrio" | "rentaPct" | "ticketPromedio" | "retencion90" | "ingresoRecurrente" | "frecuenciaVisita";

const FRASES: Record<KpiClave, (k: KpiResultado) => string> = {
  margenNeto: (k) => `Margen de ${k.valor.toFixed(1)}% (meta ≥ 10%)`,
  costoPersonal: (k) => `El personal se lleva ${k.valor.toFixed(1)}% de las ventas (ideal 40–50%)`,
  puntoEquilibrio: (k) => `Las ventas cubren ${k.valor.toFixed(2)}× el punto de equilibrio`,
  rentaPct: (k) => `La renta se lleva ${k.valor.toFixed(1)}% de las ventas (ideal 8–12%)`,
  ticketPromedio: (k) => `Ticket promedio a la baja (${k.detalle ?? ""})`,
  retencion90: (k) => `Retención a 90 días de ${k.valor.toFixed(0)}%`,
  ingresoRecurrente: (k) => `Solo ${k.valor.toFixed(0)}% del ingreso viene de clientas que regresan (meta > 60%)`,
  frecuenciaVisita: (k) => `Las clientas regresan cada ${k.valor.toFixed(0)} días (estable 30–50)`,
};

/**
 * Una alerta por salón que no esté sano: primero sus KPIs en rojo y luego
 * los ámbar (máximo dos). Los salones en riesgo van primero.
 */
export function alertasInicio(filas: DatosSalonInicio[]): Alerta[] {
  const out: Alerta[] = [];
  for (const f of filas) {
    const g = f.salud.semaforoGlobal;
    if (g === "verde" || g === "gris") continue;
    const kpis = (Object.keys(FRASES) as KpiClave[]).map((k) => [k, f.salud[k]] as const);
    const problemas = [...kpis.filter(([, k]) => k.semaforo === "rojo"), ...kpis.filter(([, k]) => k.semaforo === "ambar")];
    if (problemas.length === 0) continue;
    out.push({
      salonId: f.salon.id,
      salonNombre: f.salon.nombre,
      semaforo: g,
      texto: problemas.slice(0, 2).map(([clave, k]) => FRASES[clave](k)).join(" · "),
    });
  }
  return out.sort((a, b) => (a.semaforo === "rojo" ? 0 : 1) - (b.semaforo === "rojo" ? 0 : 1));
}
