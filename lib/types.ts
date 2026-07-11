// ── Modelo principal: Salón ──

export interface Salon {
  id: string;
  nombre: string;
  color: string;
  sheetId: string;
  bolsas: Bolsa[];
  gastosFijos: GastoFijo[];
  bolsaDefaultGastosId: string | null;
  comisionTarjeta: number;
  createdAt: string;
}

// Cómo trata la capa de Salud el dinero que entra a una bolsa.
// gasto_operativo = sueldo por trabajo real (cuenta como gasto/nómina)
// reserva = ahorro / utilidad apartada (NO es gasto)
// reparto = dividendo / utilidad repartida (NO es gasto)
export type NaturalezaBolsa = "gasto_operativo" | "reserva" | "reparto";

// Categoría de un gasto registrado en la app (fijo o admin).
// Los gastos del Google Sheet NO llevan categoría: son variables.
export type CategoriaGasto = "nomina" | "renta" | "insumos" | "servicios" | "otros";

export interface Bolsa {
  id: string;
  nombre: string;
  porcentaje: number;
  color: string;
  acumulado: number;
  naturaleza: NaturalezaBolsa;
}

export interface GastoFijo {
  id: string;
  nombre: string;
  monto: number;
  frecuencia: "semanal" | "mensual";
  categoria: CategoriaGasto;
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

// Hoja "Comisiones": una fila por ítem cobrado con comisión de trabajadora.
// El header "clienta" está duplicado en el Sheet (col B es la hora); el parser
// genérico se queda con la última columna, que es el nombre real.
export interface ComisionRaw {
  fecha: string;
  clienta: string;
  trabajadora: string;
  item: string;
  tipo: string;
  costo_de_item: string;
  "comision_%": string;
  pago_de_comision: string;
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
  bolsaId?: string | null;
  source?: "sheets" | "admin";
  adminId?: string;
  categoria?: CategoriaGasto; // solo gastos admin; los de Sheet son variables sin categoría
}

export interface Comision {
  fecha: Date;
  clienta: string;
  trabajadora: string;
  item: string;
  tipo: "servicio" | "producto";
  costo: number;
  porcentaje: number;
  monto: number; // pago de comisión (costo × %)
}

export type MetodoPago = "Efectivo" | "Tarjeta" | "Transferencia";

// ── Gasto registrado desde la app de admin ──

export interface GastoAdmin {
  id: string;
  salonId: string;
  fecha: string; // ISO date
  descripcion: string;
  monto: number;
  metodoPago: MetodoPago;
  bolsaId: string | null;
  categoria: CategoriaGasto;
  createdAt: string;
}

// ── Movimiento manual de bolsa ──

export type TipoMovimiento = "ingreso" | "egreso";

export type OrigenMovimiento = "manual" | "auto";

export interface MovimientoBolsa {
  id: string;
  salonId: string;
  bolsaId: string;
  tipo: TipoMovimiento;
  monto: number;
  metodoPago: MetodoPago;
  descripcion: string;
  fecha: string; // ISO date
  createdAt: string;
  origen: OrigenMovimiento;
  esCostoServicio: boolean;
}

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
  comisiones: number;
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
    gastosAsignados: number;
  }[];
}

// ── Semana detectada ──

export interface SemanaDetectada {
  semanaInicio: string; // ISO date lunes
  semanaFin: string;    // ISO date domingo
  label: string;
  ingresos: number;
  gastosVariables: number;
  gastosFijos: number;
  comisiones: number;
  libre: number;
  cerrada: boolean;
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
  topGastos: { descripcion: string; cantidad: number; total: number }[];
}
