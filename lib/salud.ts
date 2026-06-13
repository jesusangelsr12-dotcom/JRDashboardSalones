// ════════════════════════════════════════════════════════════════
// Módulo "Salud del Salón" — Fase 1 + 2
// Funciones puras y testeables. Toda la lógica de los 10 KPIs,
// el scorecard semanal y el semáforo global vive aquí.
//
// Ver docs/TRAZABILIDAD-SALUD-SALON.html para el origen de cada dato
// y la fórmula exacta de cada resultado.
// ════════════════════════════════════════════════════════════════

import type { Cita, Gasto, GastoFijo, Bolsa, CategoriaGasto } from "./types";
import { costoNeto, getInicioMes, getFinMes, enRango, formatMoney } from "./calculations";

export type Semaforo = "verde" | "ambar" | "rojo" | "gris";

export const FACTOR_RIESGO_DEFAULT = 1.5;
// Cobertura de ventas sobre el punto de equilibrio para considerarlo "sano".
// La barra de progreso del PE se llena al 100% en este múltiplo.
export const PE_COBERTURA_VERDE = 1.3;

export interface KpiResultado {
  valor: number;
  semaforo: Semaforo;
  detalle?: string;
  explicacion?: string;                          // qué significa, en una frase
  formula?: string;                              // fórmula sencilla
  desglose?: { label: string; valor: string }[]; // números reales del cálculo
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

export interface SaludSnapshot {
  ingresosMes: number;
  visitasMes: number;
  visitasPromedio3Meses: number;
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
}

// ── Helpers ──

function mediana(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const pctStr = (v: number) => `${v.toFixed(1)}%`;

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
    explicacion: "De cada $100 que entran, cuánto te queda como utilidad después de todos los gastos y los sueldos de las dueñas.",
    formula: "(Ingresos − gastos fijos − gastos variables − sueldo dueñas) ÷ Ingresos",
    desglose: [
      { label: "Ingresos del mes", valor: formatMoney(ingresosMes) },
      { label: "− Gastos fijos", valor: formatMoney(gfMes) },
      { label: "− Gastos variables", valor: formatMoney(gastosVariablesMes) },
      { label: "− Sueldo dueñas (bolsas op.)", valor: formatMoney(sueldoOperativo) },
      { label: "= Utilidad", valor: formatMoney(utilidad) },
      { label: "Margen", valor: pctStr(margenPct) },
    ],
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
    explicacion: "Qué porcentaje de tus ventas se va en pagar a las personas (nómina + sueldos de las dueñas).",
    formula: "(Nómina + sueldo dueñas) ÷ Ingresos",
    desglose: [
      { label: "Nómina (gastos categoría nómina)", valor: formatMoney(nominaGastos) },
      { label: "+ Sueldo dueñas (bolsas op.)", valor: formatMoney(sueldoOperativo) },
      { label: "= Total personal", valor: formatMoney(nomina) },
      { label: "÷ Ingresos del mes", valor: formatMoney(ingresosMes) },
      { label: "= Costo de personal", valor: pctStr(costoPersonalPct) },
    ],
  };

  // ── KPI 3 · Punto de equilibrio ──
  const peMonto = gfMes + sueldoOperativo;
  const cobertura = peMonto > 0 ? ingresosMes / peMonto : 0;
  const faltaParaPE = Math.max(0, peMonto - ingresosMes);
  const puntoEquilibrio: KpiResultado = {
    valor: cobertura,
    semaforo: peMonto === 0 ? "gris" : cobertura >= PE_COBERTURA_VERDE ? "verde" : cobertura < 1 ? "rojo" : "ambar",
    detalle: `Ventas ≥ ${PE_COBERTURA_VERDE}× PE`,
    explicacion: "Cuánto necesitas vender al mes solo para no perder. Arriba de eso, empiezas a ganar.",
    formula: "Punto de equilibrio = gastos fijos + sueldo dueñas",
    desglose: [
      { label: "Gastos fijos del mes", valor: formatMoney(gfMes) },
      { label: "+ Sueldo dueñas (bolsas op.)", valor: formatMoney(sueldoOperativo) },
      { label: "= Punto de equilibrio", valor: formatMoney(peMonto) },
      { label: "Ventas del mes", valor: formatMoney(ingresosMes) },
      { label: "Cobertura", valor: `${cobertura.toFixed(2)}×` },
      faltaParaPE > 0
        ? { label: "Falta para cubrir el PE", valor: formatMoney(faltaParaPE) }
        : { label: "Excedente sobre el PE", valor: formatMoney(ingresosMes - peMonto) },
    ],
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
    explicacion: "Qué porcentaje de tus ventas se va en pagar la renta del local. Si pasa del 18%, el local te queda grande o las ventas chicas.",
    formula: "Renta ÷ Ingresos",
    desglose: [
      { label: "Renta del mes (gastos categoría renta)", valor: formatMoney(renta) },
      { label: "÷ Ingresos del mes", valor: formatMoney(ingresosMes) },
      { label: "= Renta sobre ingreso", valor: pctStr(rentaPctVal) },
    ],
  };

  // ── KPI 5 · Ticket promedio ──
  const visitasMes = agruparVisitas(citasMes, comisionTarjeta);
  const ticket = visitasMes.length > 0 ? ingresosMes / visitasMes.length : 0;
  // Promedio de ticket y de visitas de los 3 meses anteriores
  const ticketsPrevios: number[] = [];
  const visitasPrevias: number[] = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(year, month - i, 1);
    const ini = getInicioMes(d.getFullYear(), d.getMonth());
    const fin = getFinMes(d.getFullYear(), d.getMonth());
    const cm = enRango(citas, ini, fin);
    const v = agruparVisitas(cm, comisionTarjeta);
    visitasPrevias.push(v.length);
    if (v.length > 0) {
      const ing = cm.reduce((s, c) => s + costoNeto(c.costo, c.metodoPago, comisionTarjeta), 0);
      ticketsPrevios.push(ing / v.length);
    }
  }
  const ticketProm3 = ticketsPrevios.length > 0 ? ticketsPrevios.reduce((a, b) => a + b, 0) / ticketsPrevios.length : 0;
  const visitasProm3 = visitasPrevias.length > 0 ? visitasPrevias.reduce((a, b) => a + b, 0) / visitasPrevias.length : 0;
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
    explicacion: "De las clientas nuevas de este mes, cuántas regresaron al menos una vez en los siguientes 90 días.",
    formula: "Clientas nuevas que volvieron en 90 días ÷ Clientas nuevas del mes",
    desglose: [
      { label: "Clientas nuevas del mes", valor: String(cohorte) },
      { label: "De ellas, volvieron en 90 días", valor: String(retenidos) },
      { label: "= Retención", valor: cohorte === 0 ? "—" : pctStr(retencionPct) },
      ...(enCurso ? [{ label: "Estado", valor: "En curso (mes reciente)" }] : []),
    ],
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
    explicacion: "Qué parte del ingreso del mes vino de clientas que ya te habían visitado antes (no de clientas nuevas).",
    formula: "Ingreso de clientas que ya existían ÷ Ingreso total del mes",
    desglose: [
      { label: "Ingreso de clientas recurrentes", valor: formatMoney(ingresoRecurrenteMonto) },
      { label: "÷ Ingreso total del mes", valor: formatMoney(ingresosMes) },
      { label: "= Ingreso recurrente", valor: pctStr(recurrentePct) },
    ],
  };

  // ── KPI 9 · Frecuencia de visita (mediana del salón) ──
  const frecuenciaVisita: KpiResultado = {
    valor: medianaSalon,
    semaforo:
      intervalosSalon.length === 0 ? "gris" : medianaSalon >= 30 && medianaSalon <= 50 ? "verde" : "ambar",
    detalle: "Estable 30–50 días",
    explicacion: "Cada cuántos días, en promedio (mediana), regresan tus clientas. Usamos la mediana para que las visitas muy espaciadas no inflen el número.",
    formula: "Mediana de los días entre visitas consecutivas de cada clienta",
    desglose: [
      { label: "Intervalos entre visitas medidos", valor: String(intervalosSalon.length) },
      { label: "= Frecuencia típica (mediana)", valor: intervalosSalon.length === 0 ? "—" : `${Math.round(medianaSalon)} días` },
    ],
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

  return {
    ingresosMes,
    visitasMes: visitasMes.length,
    visitasPromedio3Meses: visitasProm3,
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
