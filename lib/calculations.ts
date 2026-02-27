import type {
  Cita,
  Gasto,
  Bolsa,
  GastoFijo,
  ResumenSemanal,
  DatosGraficas,
} from "./types";

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

export function calcularResumenSemanal(
  citas: Cita[],
  gastos: Gasto[],
  bolsas: Bolsa[],
  gastosFijos: GastoFijo[],
  acumulados: Record<string, number>
): ResumenSemanal {
  const hoy = new Date();
  const lunesSemana = getLunesDeSemana(hoy);
  const domingoSemana = getDomingoDeSemana(hoy);

  // Filtrar por semana actual
  const citasSemana = enRango(citas, lunesSemana, domingoSemana);
  const gastosSemana = enRango(gastos, lunesSemana, domingoSemana);

  // Ingresos
  const ingresos = citasSemana.reduce((sum, c) => sum + c.costo, 0);

  // Gastos variables
  const gastosVariables = gastosSemana.reduce((sum, g) => sum + g.monto, 0);

  // Gastos fijos semanales (mensual / 4)
  const gastosFijosSemana = gastosFijos.reduce((sum, gf) => {
    return sum + (gf.frecuencia === "semanal" ? gf.monto : gf.monto / 4);
  }, 0);

  const totalGastos = gastosVariables + gastosFijosSemana;
  const libre = ingresos - totalGastos;

  // Desglose por método de pago
  const porMetodo = { Efectivo: 0, Tarjeta: 0, Transferencia: 0 };
  citasSemana.forEach((c) => {
    porMetodo[c.metodoPago] += c.costo;
  });

  // Bolsas
  const bolsasCalc = bolsas.map((b) => ({
    bolsaId: b.id,
    nombre: b.nombre,
    porcentaje: b.porcentaje,
    color: b.color,
    montoSemana: libre > 0 ? libre * (b.porcentaje / 100) : 0,
    acumulado: acumulados[b.id] || 0,
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

// ── Ingresos del mes (para KPI en Home) ──

export function calcularIngresosMes(
  citas: Cita[],
  year: number,
  month: number
): number {
  const inicio = getInicioMes(year, month);
  const fin = getFinMes(year, month);
  return enRango(citas, inicio, fin).reduce((sum, c) => sum + c.costo, 0);
}

// ── Datos para gráficas ──

export function calcularDatosGraficas(
  citas: Cita[],
  gastos: Gasto[],
  year: number,
  month: number
): DatosGraficas {
  const inicioMes = getInicioMes(year, month);
  const finMes = getFinMes(year, month);

  const citasMes = enRango(citas, inicioMes, finMes);
  const _gastosMes = enRango(gastos, inicioMes, finMes);

  // ── Ingresos por semana del mes ──
  const semanaMap = new Map<string, number>();
  citasMes.forEach((c) => {
    const lunes = getLunesDeSemana(c.fecha);
    const key = `${lunes.getDate()}/${lunes.getMonth() + 1}`;
    semanaMap.set(key, (semanaMap.get(key) || 0) + c.costo);
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
  citasMes.forEach((c) => {
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
  citasMes.forEach((c) => {
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
  citasMes.forEach((c) => {
    clientaCitasMap.set(c.clienta, (clientaCitasMap.get(c.clienta) || 0) + 1);
  });
  const topClientasPorCitas = Array.from(clientaCitasMap.entries())
    .map(([nombre, citas]) => ({ nombre, citas }))
    .sort((a, b) => b.citas - a.citas)
    .slice(0, 10);

  // ── Top 10 clientas por dinero gastado ──
  const clientaGastoMap = new Map<string, number>();
  citasMes.forEach((c) => {
    clientaGastoMap.set(
      c.clienta,
      (clientaGastoMap.get(c.clienta) || 0) + c.costo
    );
  });
  const topClientasPorGasto = Array.from(clientaGastoMap.entries())
    .map(([nombre, total]) => ({ nombre, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // ── Distribución por método de pago ──
  const metodoMap = new Map<string, number>();
  citasMes.forEach((c) => {
    metodoMap.set(c.metodoPago, (metodoMap.get(c.metodoPago) || 0) + c.costo);
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
    const total = enRango(citas, mInicio, mFin).reduce(
      (sum, c) => sum + c.costo,
      0
    );
    const mesLabel = d.toLocaleDateString("es-MX", {
      month: "short",
      year: "2-digit",
    });
    evolucionMensual.push({ mes: mesLabel, total });
  }

  return {
    ingresosPorSemana,
    topServicios,
    topProductos,
    topClientasPorCitas,
    topClientasPorGasto,
    distribucionMetodo,
    evolucionMensual,
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
  citas: Cita[]
): { year: number; month: number; label: string }[] {
  const meses = new Set<string>();
  citas.forEach((c) => {
    const key = `${c.fecha.getFullYear()}-${c.fecha.getMonth()}`;
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
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
}
