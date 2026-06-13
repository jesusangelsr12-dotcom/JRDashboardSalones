// ════════════════════════════════════════════════════════════════
// Módulo "Salud del Salón" — Fase 1 + 2
// Funciones puras y testeables. Toda la lógica de los 10 KPIs,
// el scorecard semanal y el semáforo global vive aquí.
//
// Ver docs/TRAZABILIDAD-SALUD-SALON.html para el origen de cada dato
// y la fórmula exacta de cada resultado.
// ════════════════════════════════════════════════════════════════

import type { Cita, Gasto, GastoFijo, Bolsa, CategoriaGasto } from "./types";
import { costoNeto, getInicioMes, getFinMes, getLunesDeSemana, getDomingoDeSemana, enRango } from "./calculations";

export type Semaforo = "verde" | "ambar" | "rojo" | "gris";

export const FACTOR_RIESGO_DEFAULT = 1.5;
// Cobertura de ventas sobre el punto de equilibrio para considerarlo "sano".
// La barra de progreso del PE se llena al 100% en este múltiplo.
export const PE_COBERTURA_VERDE = 1.3;

export interface KpiResultado {
  valor: number;
  semaforo: Semaforo;
  detalle?: string;
}

export interface DiaSemana {
  dow: number; // 0=domingo … 6=sábado
  promedio: number;
  esValle: boolean;
}

export interface ClientaRiesgo {
  clienta: string;
  ultimaVisita: string;        // ISO date
  diasDesdeUltima: number;
  frecuenciaPersonal: number;  // días (mediana)
  ingresoHistorico: number;
  visitasTotales: number;
}

export interface Scorecard {
  ingresoSemana: number;
  ingresoSemanaPrevia: number;     // misma semana ~mes anterior (-28 días)
  citasProximaSemana: number;
  ticketSemana: number;
  gastoAcumuladoMes: number;
  gastoPromedioMesesPrevios: number; // a la misma altura del mes
}

export interface SaludSnapshot {
  ingresosMes: number;
  // Capa A · Rentabilidad
  margenNeto: KpiResultado;        // valor = % margen
  costoPersonal: KpiResultado;     // valor = % nómina/ingreso
  puntoEquilibrio: KpiResultado;   // valor = cobertura (ventas/PE)
  rentaPct: KpiResultado;          // valor = % renta/ingreso
  peMonto: number;                 // monto del punto de equilibrio
  utilidad: number;
  gastosTotales: number;
  // Capa B · Operación
  ticketPromedio: KpiResultado;    // valor = ticket $
  citasPorDia: DiaSemana[];
  // Capa C · Clientas
  retencion90: KpiResultado;       // valor = %
  ingresoRecurrente: KpiResultado; // valor = %
  frecuenciaVisita: KpiResultado;  // valor = días (mediana)
  clientasEnRiesgo: ClientaRiesgo[];
  // Global
  semaforoGlobal: Semaforo;
  scorecard: Scorecard;
}

// ── Helpers ──

function mediana(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function fechaKey(d: Date): string {
  return d.toISOString().split("T")[0];
}

/** Gastos fijos prorrateados a un mes (mensual = monto; semanal = monto × 4) */
export function gastosFijosMes(gastosFijos: GastoFijo[]): number {
  return gastosFijos.reduce((s, gf) => s + (gf.frecuencia === "mensual" ? gf.monto : gf.monto * 4), 0);
}

/** Gastos fijos del mes de una categoría concreta */
function gastosFijosCategoria(gastosFijos: GastoFijo[], cat: CategoriaGasto): number {
  return gastosFijosMes(gastosFijos.filter((gf) => gf.categoria === cat));
}

/** % del libre que va a bolsas de naturaleza gasto_operativo (sueldo de trabajo real) */
export function pctGastoOperativo(bolsas: Bolsa[]): number {
  return bolsas
    .filter((b) => b.naturaleza === "gasto_operativo")
    .reduce((s, b) => s + b.porcentaje, 0) / 100;
}

/** Agrupa líneas de cita en visitas: misma clienta + misma fecha = 1 visita */
export interface Visita {
  clienta: string;
  fecha: Date;
  fechaKey: string;
  total: number;
}
export function agruparVisitas(citas: Cita[], comisionTarjeta: number): Visita[] {
  const map = new Map<string, Visita>();
  for (const c of citas) {
    const key = `${c.clienta}__${fechaKey(c.fecha)}`;
    const neto = costoNeto(c.costo, c.metodoPago, comisionTarjeta);
    const existing = map.get(key);
    if (existing) {
      existing.total += neto;
    } else {
      map.set(key, { clienta: c.clienta, fecha: c.fecha, fechaKey: fechaKey(c.fecha), total: neto });
    }
  }
  return Array.from(map.values());
}

// ── Función principal ──

export function calcularSalud(
  citas: Cita[],
  gastos: Gasto[],
  gastosFijos: GastoFijo[],
  bolsas: Bolsa[],
  year: number,
  month: number,
  comisionTarjeta: number = 0,
  hoy: Date = new Date(),
  factorRiesgo: number = FACTOR_RIESGO_DEFAULT
): SaludSnapshot {
  const inicioMes = getInicioMes(year, month);
  const finMes = getFinMes(year, month);

  const citasMes = enRango(citas, inicioMes, finMes);
  const gastosMes = enRango(gastos, inicioMes, finMes);

  // ── Primitivas ──
  const ingresosMes = citasMes.reduce((s, c) => s + costoNeto(c.costo, c.metodoPago, comisionTarjeta), 0);
  const gfMes = gastosFijosMes(gastosFijos);
  const gastosVariablesMes = gastosMes.reduce((s, g) => s + g.monto, 0);
  const libreMes = Math.max(0, ingresosMes - gfMes);
  const sueldoOperativo = libreMes * pctGastoOperativo(bolsas);

  // ── KPI 1 · Margen neto ──
  const gastosTotales = gfMes + gastosVariablesMes + sueldoOperativo;
  const utilidad = ingresosMes - gastosTotales;
  const margenPct = ingresosMes > 0 ? (utilidad / ingresosMes) * 100 : 0;
  const margenNeto: KpiResultado = {
    valor: margenPct,
    semaforo: ingresosMes === 0 ? "gris" : margenPct >= 10 ? "verde" : margenPct < 5 ? "rojo" : "ambar",
    detalle: "Meta ≥ 10%",
  };

  // ── KPI 2 · Costo de personal ──
  const nominaGastos =
    gastosFijosCategoria(gastosFijos, "nomina") +
    gastosMes.filter((g) => g.categoria === "nomina").reduce((s, g) => s + g.monto, 0);
  const nomina = nominaGastos + sueldoOperativo;
  const costoPersonalPct = ingresosMes > 0 ? (nomina / ingresosMes) * 100 : 0;
  const costoPersonal: KpiResultado = {
    valor: costoPersonalPct,
    semaforo:
      ingresosMes === 0 ? "gris" : costoPersonalPct > 55 ? "rojo" : costoPersonalPct >= 40 && costoPersonalPct <= 50 ? "verde" : "ambar",
    detalle: "Ideal 40–50%",
  };

  // ── KPI 3 · Punto de equilibrio ──
  const peMonto = gfMes + sueldoOperativo;
  const cobertura = peMonto > 0 ? ingresosMes / peMonto : 0;
  const puntoEquilibrio: KpiResultado = {
    valor: cobertura,
    semaforo: peMonto === 0 ? "gris" : cobertura >= PE_COBERTURA_VERDE ? "verde" : cobertura < 1 ? "rojo" : "ambar",
    detalle: `Ventas ≥ ${PE_COBERTURA_VERDE}× PE`,
  };

  // ── KPI 4 · Renta % ──
  const renta =
    gastosFijosCategoria(gastosFijos, "renta") +
    gastosMes.filter((g) => g.categoria === "renta").reduce((s, g) => s + g.monto, 0);
  const rentaPctVal = ingresosMes > 0 ? (renta / ingresosMes) * 100 : 0;
  const rentaPct: KpiResultado = {
    valor: rentaPctVal,
    semaforo:
      ingresosMes === 0 || renta === 0 ? "gris" : rentaPctVal > 18 ? "rojo" : rentaPctVal >= 8 && rentaPctVal <= 12 ? "verde" : "ambar",
    detalle: "Ideal 8–12%",
  };

  // ── KPI 5 · Ticket promedio ──
  const visitasMes = agruparVisitas(citasMes, comisionTarjeta);
  const ticket = visitasMes.length > 0 ? ingresosMes / visitasMes.length : 0;
  // Promedio de ticket de los 3 meses anteriores
  const ticketsPrevios: number[] = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(year, month - i, 1);
    const ini = getInicioMes(d.getFullYear(), d.getMonth());
    const fin = getFinMes(d.getFullYear(), d.getMonth());
    const cm = enRango(citas, ini, fin);
    const v = agruparVisitas(cm, comisionTarjeta);
    if (v.length > 0) {
      const ing = cm.reduce((s, c) => s + costoNeto(c.costo, c.metodoPago, comisionTarjeta), 0);
      ticketsPrevios.push(ing / v.length);
    }
  }
  const ticketProm3 = ticketsPrevios.length > 0 ? ticketsPrevios.reduce((a, b) => a + b, 0) / ticketsPrevios.length : 0;
  const muestraChica = visitasMes.length < 30;
  const ticketPromedio: KpiResultado = {
    valor: ticket,
    semaforo:
      visitasMes.length === 0 || muestraChica
        ? "gris"
        : ticketProm3 > 0 && ticket < ticketProm3 * 0.92
        ? "rojo"
        : "verde",
    detalle: muestraChica ? "Muestra chica" : ticketProm3 > 0 ? `vs prom. ${Math.round(ticketProm3)}` : "Sin histórico",
  };

  // ── KPI 6a · Citas por día de la semana (últimas 8 semanas) ──
  const hace8sem = new Date(hoy);
  hace8sem.setDate(hace8sem.getDate() - 56);
  const visitas8sem = agruparVisitas(enRango(citas, hace8sem, hoy), comisionTarjeta);
  const conteoDow = [0, 0, 0, 0, 0, 0, 0];
  visitas8sem.forEach((v) => { conteoDow[v.fecha.getDay()]++; });
  const promedioDow = conteoDow.map((c) => c / 8);
  // Identificar los 2 días valle (menor promedio), solo si hay datos
  const ordenadosPorPromedio = promedioDow
    .map((p, dow) => ({ dow, p }))
    .sort((a, b) => a.p - b.p);
  const vallesDow = new Set(
    visitas8sem.length > 0 ? ordenadosPorPromedio.slice(0, 2).map((x) => x.dow) : []
  );
  const citasPorDia: DiaSemana[] = promedioDow.map((promedio, dow) => ({
    dow,
    promedio,
    esValle: vallesDow.has(dow),
  }));

  // ── Capa C: precálculo de visitas por clienta (todo el histórico) ──
  const visitasTodas = agruparVisitas(citas, comisionTarjeta);
  const porClienta = new Map<string, Visita[]>();
  for (const v of visitasTodas) {
    const arr = porClienta.get(v.clienta) || [];
    arr.push(v);
    porClienta.set(v.clienta, arr);
  }
  porClienta.forEach((arr) => arr.sort((a, b) => a.fecha.getTime() - b.fecha.getTime()));

  // Mediana del salón (intervalos de clientas con 2+ visitas)
  const intervalosSalon: number[] = [];
  porClienta.forEach((arr) => {
    for (let i = 1; i < arr.length; i++) {
      const dias = (arr[i].fecha.getTime() - arr[i - 1].fecha.getTime()) / 86400000;
      intervalosSalon.push(dias);
    }
  });
  const medianaSalon = mediana(intervalosSalon);

  // ── KPI 7 · Retención a 90 días (cohorte del mes) ──
  let cohorte = 0;
  let retenidos = 0;
  porClienta.forEach((arr) => {
    const primera = arr[0].fecha;
    if (primera >= inicioMes && primera <= finMes) {
      cohorte++;
      const limite = new Date(primera);
      limite.setDate(limite.getDate() + 90);
      if (arr.some((v) => v.fecha > primera && v.fecha <= limite)) retenidos++;
    }
  });
  const retencionPct = cohorte > 0 ? (retenidos / cohorte) * 100 : 0;
  // "En curso": el mes analizado está dentro de los últimos 3 meses
  const mesesDesde = (hoy.getFullYear() - year) * 12 + (hoy.getMonth() - month);
  const enCurso = mesesDesde < 3;
  const retencion90: KpiResultado = {
    valor: retencionPct,
    semaforo:
      cohorte === 0 || enCurso ? "gris" : retencionPct > 35 ? "verde" : retencionPct < 20 ? "rojo" : "ambar",
    detalle: enCurso ? "En curso" : `${retenidos}/${cohorte} clientas`,
  };

  // ── KPI 8 · % ingreso de clientas recurrentes ──
  const ingresoRecurrenteMonto = citasMes.reduce((s, c) => {
    const arr = porClienta.get(c.clienta);
    const primera = arr ? arr[0].fecha : c.fecha;
    return primera < inicioMes ? s + costoNeto(c.costo, c.metodoPago, comisionTarjeta) : s;
  }, 0);
  const recurrentePct = ingresosMes > 0 ? (ingresoRecurrenteMonto / ingresosMes) * 100 : 0;
  const ingresoRecurrente: KpiResultado = {
    valor: recurrentePct,
    semaforo:
      ingresosMes === 0 ? "gris" : recurrentePct > 60 ? "verde" : recurrentePct < 40 ? "rojo" : "ambar",
    detalle: "Meta > 60%",
  };

  // ── KPI 9 · Frecuencia de visita (mediana del salón) ──
  const frecuenciaVisita: KpiResultado = {
    valor: medianaSalon,
    semaforo:
      intervalosSalon.length === 0 ? "gris" : medianaSalon >= 30 && medianaSalon <= 50 ? "verde" : "ambar",
    detalle: "Estable 30–50 días",
  };

  // ── KPI 10 · Clientas en riesgo ──
  const limite180 = new Date(hoy);
  limite180.setDate(limite180.getDate() - 180);
  const clientasEnRiesgo: ClientaRiesgo[] = [];
  porClienta.forEach((arr, clienta) => {
    const ultima = arr[arr.length - 1].fecha;
    if (ultima < limite180) return; // no activa
    const intervalos: number[] = [];
    for (let i = 1; i < arr.length; i++) {
      intervalos.push((arr[i].fecha.getTime() - arr[i - 1].fecha.getTime()) / 86400000);
    }
    const frecuenciaPersonal = intervalos.length > 0 ? mediana(intervalos) : medianaSalon;
    const diasDesdeUltima = (hoy.getTime() - ultima.getTime()) / 86400000;
    if (frecuenciaPersonal > 0 && diasDesdeUltima > factorRiesgo * frecuenciaPersonal) {
      clientasEnRiesgo.push({
        clienta,
        ultimaVisita: fechaKey(ultima),
        diasDesdeUltima: Math.round(diasDesdeUltima),
        frecuenciaPersonal: Math.round(frecuenciaPersonal),
        ingresoHistorico: arr.reduce((s, v) => s + v.total, 0),
        visitasTotales: arr.length,
      });
    }
  });
  clientasEnRiesgo.sort((a, b) => b.ingresoHistorico - a.ingresoHistorico);

  // ── Semáforo global ──
  const capaA = [margenNeto, costoPersonal, puntoEquilibrio, rentaPct];
  const capaC = [retencion90, ingresoRecurrente, frecuenciaVisita];
  const hayRojoA = capaA.some((k) => k.semaforo === "rojo");
  const hayRojoC = capaC.some((k) => k.semaforo === "rojo");
  const todoVerdeA = capaA.every((k) => k.semaforo === "verde" || k.semaforo === "gris");
  const semaforoGlobal: Semaforo = hayRojoA
    ? "rojo"
    : hayRojoC || !todoVerdeA
    ? "ambar"
    : "verde";

  // ── Scorecard semanal ──
  const lunesActual = getLunesDeSemana(hoy);
  const domingoActual = getDomingoDeSemana(hoy);
  const citasSemana = enRango(citas, lunesActual, domingoActual);
  const ingresoSemana = citasSemana.reduce((s, c) => s + costoNeto(c.costo, c.metodoPago, comisionTarjeta), 0);
  const visitasSemana = agruparVisitas(citasSemana, comisionTarjeta).length;

  const lunesPrevio = new Date(lunesActual); lunesPrevio.setDate(lunesPrevio.getDate() - 28);
  const domingoPrevio = new Date(lunesPrevio); domingoPrevio.setDate(domingoPrevio.getDate() + 6); domingoPrevio.setHours(23, 59, 59, 999);
  const ingresoSemanaPrevia = enRango(citas, lunesPrevio, domingoPrevio)
    .reduce((s, c) => s + costoNeto(c.costo, c.metodoPago, comisionTarjeta), 0);

  const lunesProx = new Date(lunesActual); lunesProx.setDate(lunesProx.getDate() + 7);
  const domingoProx = new Date(lunesProx); domingoProx.setDate(domingoProx.getDate() + 6); domingoProx.setHours(23, 59, 59, 999);
  const citasProximaSemana = agruparVisitas(enRango(citas, lunesProx, domingoProx), comisionTarjeta).length;

  // Gasto acumulado del mes hasta hoy vs promedio de 3 meses previos a la misma altura
  const diaDelMes = hoy.getDate();
  const gastoAcumuladoMes = gastosMes
    .filter((g) => g.fecha.getDate() <= diaDelMes)
    .reduce((s, g) => s + g.monto, 0);
  const gastosPrevios: number[] = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(year, month - i, 1);
    const ini = getInicioMes(d.getFullYear(), d.getMonth());
    const finMesPrevio = getFinMes(d.getFullYear(), d.getMonth());
    // "Misma altura del mes": acumular hasta el mismo día, sin desbordar a meses
    // cortos (ej. día 31 sobre un mes de 30 días rodaría al mes siguiente).
    const acum = enRango(gastos, ini, finMesPrevio)
      .filter((g) => g.fecha.getDate() <= diaDelMes)
      .reduce((s, g) => s + g.monto, 0);
    gastosPrevios.push(acum);
  }
  const gastoPromedioMesesPrevios = gastosPrevios.length > 0 ? gastosPrevios.reduce((a, b) => a + b, 0) / gastosPrevios.length : 0;

  const scorecard: Scorecard = {
    ingresoSemana,
    ingresoSemanaPrevia,
    citasProximaSemana,
    ticketSemana: visitasSemana > 0 ? ingresoSemana / visitasSemana : 0,
    gastoAcumuladoMes,
    gastoPromedioMesesPrevios,
  };

  return {
    ingresosMes,
    margenNeto,
    costoPersonal,
    puntoEquilibrio,
    rentaPct,
    peMonto,
    utilidad,
    gastosTotales,
    ticketPromedio,
    citasPorDia,
    retencion90,
    ingresoRecurrente,
    frecuenciaVisita,
    clientasEnRiesgo,
    semaforoGlobal,
    scorecard,
  };
}

// ── Utilidades de presentación ──

export const DOW_LABELS = ["D", "L", "M", "M", "J", "V", "S"];
export const DOW_LABELS_LARGO = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export function colorSemaforo(s: Semaforo): { bg: string; fg: string; label: string } {
  switch (s) {
    case "verde": return { bg: "#E7F4EC", fg: "#1F9D55", label: "Sano" };
    case "ambar": return { bg: "#FBF0DC", fg: "#C57B14", label: "Atento" };
    case "rojo": return { bg: "#FBEAE7", fg: "#C0392B", label: "Riesgo" };
    default: return { bg: "#EDE3D6", fg: "#6B5D50", label: "—" };
  }
}
