// ── Modelo principal: Salón ──

export interface Salon {
  id: string;
  nombre: string;
  color: string;
  sheetId: string;
  bolsas: Bolsa[];
  gastosFijos: GastoFijo[];
  createdAt: string;
}

export interface Bolsa {
  id: string;
  nombre: string;
  porcentaje: number;
  color: string;
  acumulado: number;
}

export interface GastoFijo {
  id: string;
  nombre: string;
  monto: number;
  frecuencia: "semanal" | "mensual";
}

// ── Datos de Google Sheets ──

export interface CitaRaw {
  fecha: string;
  timestamp: string;
  clienta: string;
  servicio: string; // JSON stringify
  costo: string;    // viene como string del Sheet
  metodo_pago: string;
}

export interface GastoRaw {
  fecha: string;
  timestamp: string;
  descripcion: string;
  monto: string;
  metodo_pago: string;
}

// Parseados

export interface ServicioItem {
  tipo: "servicio" | "producto";
  nombre: string;
  costo: number;
}

export interface Cita {
  fecha: Date;
  timestamp: string;
  clienta: string;
  servicios: ServicioItem[];
  costo: number;
  metodoPago: MetodoPago;
}

export interface Gasto {
  fecha: Date;
  timestamp: string;
  descripcion: string;
  monto: number;
  metodoPago: MetodoPago;
}

export type MetodoPago = "Efectivo" | "Tarjeta" | "Transferencia";

// ── Cierre de semana ──

export interface CierreSemana {
  fecha: string;           // ISO date del cierre
  semanaInicio: string;    // lunes de la semana cerrada
  semanaFin: string;       // domingo de la semana cerrada
  ingresos: number;
  gastos: number;
  libre: number;
  bolsas: {
    bolsaId: string;
    nombre: string;
    monto: number;
  }[];
}

// ── Resumen calculado ──

export interface ResumenSemanal {
  ingresos: number;
  gastosVariables: number;
  gastosFijos: number;
  totalGastos: number;
  libre: number;
  porMetodo: {
    Efectivo: number;
    Tarjeta: number;
    Transferencia: number;
  };
  bolsas: {
    bolsaId: string;
    nombre: string;
    porcentaje: number;
    color: string;
    montoSemana: number;
    acumulado: number;
  }[];
}

// ── Datos para gráficas ──

export interface DatosGraficas {
  ingresosPorSemana: { semana: string; total: number }[];
  topServicios: { nombre: string; cantidad: number; total: number }[];
  topProductos: { nombre: string; cantidad: number; total: number }[];
  topClientasPorCitas: { nombre: string; citas: number }[];
  topClientasPorGasto: { nombre: string; total: number }[];
  distribucionMetodo: { metodo: string; total: number }[];
  evolucionMensual: { mes: string; total: number }[];
}
