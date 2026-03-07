import type {
  Cita,
  Gasto,
  Bolsa,
  GastoFijo,
  CierreSemana,
  ResumenSemanal,
  DatosGraficas,
  SemanaDetectada,
  MetodoPago,
} from "./types";

/** Aplica comisión de terminal a pagos con tarjeta */
export function costoNeto(costo: number, metodoPago: MetodoPago, comisionTarjeta: number): number {
  if (metodoPago === "Tarjeta" && comisionTarjeta > 0) {
    return costo * (1 - comisionTarjeta / 100);
  }
  return costo;
}

// ── Helpers de fechas ──

/** Retorna lunes 00:00 de la semana de una fecha dada */
export function getLunesDeSemana(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=dom, 1=lun, ..., 6=sáb
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Retorna domingo 23:59:59 de la semana de una fecha dada */
export function getDomingoDeSemana(date: Date): Date {
  const lunes = getLunesDeSemana(date);
  const domingo = new Date(lunes);
  domingo.setDate(domingo.getDate() + 6);
  domingo.setHours(23, 59, 59, 999);
  return domingo;
}

/** Retorna primer día del mes */
export function getInicioMes(year: number, month: number): Date {
  return new Date(year, month, 1, 0, 0, 0, 0);
}

/** Retorna último día del mes */
export function getFinMes(year: number, month: number): Date {
  return new Date(year, month + 1, 0, 23, 59, 59, 999);
}

/** Filtra items por rango de fechas */
function enRango<T extends { fecha: Date }>(
  items: T[],
  inicio: Date,
  fin: Date
): T[] {
  return items.filter((item) => item.fecha >= inicio && item.fecha <= fin);
}

/** Formatea fecha corta: "27 Feb" */
export function fechaCorta(date: Date): string {
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

/** Formatea moneda MXN */
export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Formatea moneda con centavos */
export function formatMoneyFull(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ── Resumen Semanal ──
// CAMBIO: libre = ingresos - gastosFijos (gastos variables NO restan de ingresos)
// Los gastos variables restan a la bolsa asignada

export function calcularResumenSemanal(
  citas: Cita[],
  gastos: Gasto[],
  bolsas: Bolsa[],
  gastosFijos: GastoFijo[],
  acumulados: Record<string, number>,
  bolsaDefaultGastosId: string | null,
  comisionTarjeta: number = 0
): ResumenSemanal {
  const hoy = new Date();
  const lunesSemana = getLunesDeSemana(hoy);
  const domingoSemana = getDomingoDeSemana(hoy);

  // Filtrar por semana actual
  const citasSemana = enRango(citas, lunesSemana, domingoSemana);
  const gastosSemana = enRango(gastos, lunesSemana, domingoSemana);

  // Ingresos (neto después de comisión tarjeta)
  const ingresos = citasSemana.reduce((sum, c) => sum + costoNeto(c.costo, c.metodoPago, comisionTarjeta), 0);

  // Gastos variables (solo para info, NO restan de libre)
  const gastosVariables = gastosSemana.reduce((sum, g) => sum + g.monto, 0);

  // Gastos fijos semanales (mensual / 4)
  const gastosFijosSemana = gastosFijos.reduce((sum, gf) => {
    return sum + (gf.frecuencia === "semanal" ? gf.monto : gf.monto / 4);
  }, 0);

  // NUEVO: libre = ingresos - gastosFijos solamente
  const totalGastos = gastosFijosSemana;
  const libre = ingresos - totalGastos;

  // Desglose por método de pago
  const porMetodo = { Efectivo: 0, Tarjeta: 0, Transferencia: 0 };
  citasSemana.forEach((c) => {
    porMetodo[c.metodoPago] += costoNeto(c.costo, c.metodoPago, comisionTarjeta);
  });

  // Calcular gastos asignados a cada bolsa
  const gastosPorBolsa: Record<string, number> = {};
  gastosSemana.forEach((g) => {
    const targetBolsa = g.bolsaId || bolsaDefaultGastosId;
    if (targetBolsa) {
      gastosPorBolsa[targetBolsa] = (gastosPorBolsa[targetBolsa] || 0) + g.monto;
    }
  });

  // Bolsas
  const bolsasCalc = bolsas.map((b) => ({
    bolsaId: b.id,
    nombre: b.nombre,
    porcentaje: b.porcentaje,
    color: b.color,
    montoSemana: libre > 0 ? libre * (b.porcentaje / 100) : 0,
    acumulado: acumulados[b.id] || 0,
    gastosAsignados: gastosPorBolsa[b.id] || 0,
  }));

  return {
    ingresos,
    gastosVariables,
    gastosFijos: gastosFijosSemana,
    totalGastos,
    libre,
    porMetodo,
    bolsas: bolsasCalc,
  };
}

// ── Resumen para una semana específica ──

export function calcularResumenParaSemana(
  citas: Cita[],
  gastos: Gasto[],
  gastosFijos: GastoFijo[],
  lunesISO: string,
  domingoISO: string,
  bolsaDefaultGastosId: string | null,
  comisionTarjeta: number = 0
): { ingresos: number; gastosVariables: number; gastosFijos: number; libre: number; gastosPorBolsa: Record<string, number> } {
  const inicio = new Date(lunesISO + "T00:00:00");
  const fin = new Date(domingoISO + "T23:59:59.999");

  const citasSemana = enRango(citas, inicio, fin);
  const gastosSemana = enRango(gastos, inicio, fin);

  const ingresos = citasSemana.reduce((sum, c) => sum + costoNeto(c.costo, c.metodoPago, comisionTarjeta), 0);
  const gastosVariables = gastosSemana.reduce((sum, g) => sum + g.monto, 0);
  const gastosFijosSemana = gastosFijos.reduce((sum, gf) => {
    return sum + (gf.frecuencia === "semanal" ? gf.monto : gf.monto / 4);
  }, 0);
  const libre = ingresos - gastosFijosSemana;

  const gastosPorBolsa: Record<string, number> = {};
  gastosSemana.forEach((g) => {
    const targetBolsa = g.bolsaId || bolsaDefaultGastosId;
    if (targetBolsa) {
      gastosPorBolsa[targetBolsa] = (gastosPorBolsa[targetBolsa] || 0) + g.monto;
    }
  });

  return { ingresos, gastosVariables, gastosFijos: gastosFijosSemana, libre, gastosPorBolsa };
}

// ── Detectar semanas con datos ──

export function detectarSemanas(
  citas: Cita[],
  gastos: Gasto[],
  gastosFijos: GastoFijo[],
  cierres: CierreSemana[],
  bolsaDefaultGastosId: string | null,
  comisionTarjeta: number = 0
): SemanaDetectada[] {
  const semanasSet = new Set<string>();

  // Recopilar todas las semanas que tienen transacciones
  [...citas, ...gastos].forEach((item) => {
    const lunes = getLunesDeSemana(item.fecha);
    const key = lunes.toISOString().split("T")[0];
    semanasSet.add(key);
  });

  // También agregar la semana actual
  const hoy = new Date();
  const lunesActual = getLunesDeSemana(hoy);
  semanasSet.add(lunesActual.toISOString().split("T")[0]);

  const cierresSet = new Set(cierres.map((c) => c.semanaInicio));

  const semanas: SemanaDetectada[] = Array.from(semanasSet)
    .sort()
    .map((lunesISO) => {
      const lunes = new Date(lunesISO + "T00:00:00");
      const domingo = new Date(lunes);
      domingo.setDate(domingo.getDate() + 6);
      const domingoISO = domingo.toISOString().split("T")[0];

      const datos = calcularResumenParaSemana(
        citas, gastos, gastosFijos, lunesISO, domingoISO, bolsaDefaultGastosId, comisionTarjeta
      );

      return {
        semanaInicio: lunesISO,
        semanaFin: domingoISO,
        label: `${fechaCorta(lunes)} — ${fechaCorta(domingo)}`,
        ingresos: datos.ingresos,
        gastosVariables: datos.gastosVariables,
        gastosFijos: datos.gastosFijos,
        libre: datos.libre,
        cerrada: cierresSet.has(lunesISO),
      };
    });

  return semanas;
}

// ── Ingresos del mes (para KPI en Home) ──

export function calcularIngresosMes(
  citas: Cita[],
  year: number,
  month: number,
  comisionTarjeta: number = 0
): number {
  const inicio = getInicioMes(year, month);
  const fin = getFinMes(year, month);
  return enRango(citas, inicio, fin).reduce((sum, c) => sum + costoNeto(c.costo, c.metodoPago, comisionTarjeta), 0);
}

// ── Datos para gráficas (mes específico) ──

export function calcularDatosGraficas(
  citas: Cita[],
  gastos: Gasto[],
  year: number,
  month: number,
  comisionTarjeta: number = 0
): DatosGraficas {
  const inicioMes = getInicioMes(year, month);
  const finMes = getFinMes(year, month);

  const citasMes = enRango(citas, inicioMes, finMes);
  const gastosMes = enRango(gastos, inicioMes, finMes);

  return _calcularGraficasInternas(citas, citasMes, gastosMes, year, month, comisionTarjeta);
}

// ── Datos para gráficas (año completo) ──

export function calcularDatosGraficasAnual(
  citas: Cita[],
  gastos: Gasto[],
  year: number,
  comisionTarjeta: number = 0
): DatosGraficas {
  const inicio = new Date(year, 0, 1, 0, 0, 0, 0);
  const fin = new Date(year, 11, 31, 23, 59, 59, 999);

  const citasAnio = enRango(citas, inicio, fin);
  const gastosAnio = enRango(gastos, inicio, fin);

  return _calcularGraficasInternas(citas, citasAnio, gastosAnio, year, new Date().getMonth(), comisionTarjeta);
}

function _calcularGraficasInternas(
  allCitas: Cita[],
  citasFiltradas: Cita[],
  gastosFiltrados: Gasto[],
  year: number,
  month: number,
  comisionTarjeta: number = 0
): DatosGraficas {
  // ── Ingresos por semana ──
  const semanaMap = new Map<string, number>();
  citasFiltradas.forEach((c) => {
    const lunes = getLunesDeSemana(c.fecha);
    const key = `${lunes.getDate()}/${lunes.getMonth() + 1}`;
    semanaMap.set(key, (semanaMap.get(key) || 0) + costoNeto(c.costo, c.metodoPago, comisionTarjeta));
  });
  const ingresosPorSemana = Array.from(semanaMap.entries())
    .map(([semana, total]) => ({ semana, total }))
    .sort((a, b) => {
      const [dA, mA] = a.semana.split("/").map(Number);
      const [dB, mB] = b.semana.split("/").map(Number);
      return mA !== mB ? mA - mB : dA - dB;
    });

  // ── Top 10 servicios ──
  const servicioMap = new Map<string, { cantidad: number; total: number }>();
  citasFiltradas.forEach((c) => {
    c.servicios
      .filter((s) => s.tipo === "servicio")
      .forEach((s) => {
        const current = servicioMap.get(s.nombre) || { cantidad: 0, total: 0 };
        servicioMap.set(s.nombre, {
          cantidad: current.cantidad + 1,
          total: current.total + s.costo,
        });
      });
  });
  const topServicios = Array.from(servicioMap.entries())
    .map(([nombre, data]) => ({ nombre, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // ── Top 10 productos ──
  const productoMap = new Map<string, { cantidad: number; total: number }>();
  citasFiltradas.forEach((c) => {
    c.servicios
      .filter((s) => s.tipo === "producto")
      .forEach((s) => {
        const current = productoMap.get(s.nombre) || { cantidad: 0, total: 0 };
        productoMap.set(s.nombre, {
          cantidad: current.cantidad + 1,
          total: current.total + s.costo,
        });
      });
  });
  const topProductos = Array.from(productoMap.entries())
    .map(([nombre, data]) => ({ nombre, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // ── Top 10 clientas por número de citas ──
  const clientaCitasMap = new Map<string, number>();
  citasFiltradas.forEach((c) => {
    clientaCitasMap.set(c.clienta, (clientaCitasMap.get(c.clienta) || 0) + 1);
  });
  const topClientasPorCitas = Array.from(clientaCitasMap.entries())
    .map(([nombre, citas]) => ({ nombre, citas }))
    .sort((a, b) => b.citas - a.citas)
    .slice(0, 10);

  // ── Top 10 clientas por dinero gastado ──
  const clientaGastoMap = new Map<string, number>();
  citasFiltradas.forEach((c) => {
    clientaGastoMap.set(
      c.clienta,
      (clientaGastoMap.get(c.clienta) || 0) + costoNeto(c.costo, c.metodoPago, comisionTarjeta)
    );
  });
  const topClientasPorGasto = Array.from(clientaGastoMap.entries())
    .map(([nombre, total]) => ({ nombre, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // ── Distribución por método de pago ──
  const metodoMap = new Map<string, number>();
  citasFiltradas.forEach((c) => {
    metodoMap.set(c.metodoPago, (metodoMap.get(c.metodoPago) || 0) + costoNeto(c.costo, c.metodoPago, comisionTarjeta));
  });
  const distribucionMetodo = Array.from(metodoMap.entries())
    .map(([metodo, total]) => ({ metodo, total }))
    .sort((a, b) => b.total - a.total);

  // ── Evolución mensual (últimos 6 meses) ──
  const evolucionMensual: { mes: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - i, 1);
    const mInicio = getInicioMes(d.getFullYear(), d.getMonth());
    const mFin = getFinMes(d.getFullYear(), d.getMonth());
    const total = enRango(allCitas, mInicio, mFin).reduce(
      (sum, c) => sum + costoNeto(c.costo, c.metodoPago, comisionTarjeta),
      0
    );
    const mesLabel = d.toLocaleDateString("es-MX", {
      month: "short",
      year: "2-digit",
    });
    evolucionMensual.push({ mes: mesLabel, total });
  }

  // ── Top 10 gastos ──
  const gastoDescMap = new Map<string, { cantidad: number; total: number }>();
  gastosFiltrados.forEach((g) => {
    const desc = g.descripcion.trim();
    const current = gastoDescMap.get(desc) || { cantidad: 0, total: 0 };
    gastoDescMap.set(desc, {
      cantidad: current.cantidad + 1,
      total: current.total + g.monto,
    });
  });
  const topGastos = Array.from(gastoDescMap.entries())
    .map(([descripcion, data]) => ({ descripcion, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return {
    ingresosPorSemana,
    topServicios,
    topProductos,
    topClientasPorCitas,
    topClientasPorGasto,
    distribucionMetodo,
    evolucionMensual,
    topGastos,
  };
}

// ── Rango de semana actual como texto ──

export function rangoSemanaActual(): { inicio: string; fin: string; label: string } {
  const hoy = new Date();
  const lunes = getLunesDeSemana(hoy);
  const domingo = getDomingoDeSemana(hoy);

  return {
    inicio: lunes.toISOString(),
    fin: domingo.toISOString(),
    label: `${fechaCorta(lunes)} — ${fechaCorta(domingo)}`,
  };
}

// ── Meses disponibles a partir de los datos ──

export function mesesDisponibles(
  citas: Cita[],
  gastos: Gasto[]
): { year: number; month: number; label: string }[] {
  const meses = new Set<string>();
  [...citas, ...gastos].forEach((item) => {
    const key = `${item.fecha.getFullYear()}-${item.fecha.getMonth()}`;
    meses.add(key);
  });

  // Agregar mes actual si no está
  const hoy = new Date();
  const keyHoy = `${hoy.getFullYear()}-${hoy.getMonth()}`;
  meses.add(keyHoy);

  return Array.from(meses)
    .map((key) => {
      const [year, month] = key.split("-").map(Number);
      const d = new Date(year, month, 1);
      return {
        year,
        month,
        label: d.toLocaleDateString("es-MX", {
          month: "long",
          year: "numeric",
        }),
      };
    })
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
}

// ── Años disponibles ──

export function aniosDisponibles(
  citas: Cita[],
  gastos: Gasto[]
): number[] {
  const years = new Set<number>();
  [...citas, ...gastos].forEach((item) => {
    years.add(item.fecha.getFullYear());
  });
  years.add(new Date().getFullYear());
  return Array.from(years).sort();
}
