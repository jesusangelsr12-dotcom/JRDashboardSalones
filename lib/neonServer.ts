import { neon } from "@neondatabase/serverless";
import type { Cita, Gasto, Comision, ServicioItem, MetodoPago } from "./types";
import { parseMetodoPago } from "./sheets";

// ── Clientes Neon (solo servidor — las connection strings nunca llegan al navegador) ──
// Cada salón vive en el proyecto Neon de su propia app (TWCApp, Martha Rdz App…),
// con una variable por proyecto: NEON_DATABASE_URL y NEON_DATABASE_URL_<NOMBRE>.
// El salón se busca por su uuid en la tabla `salones` de cada base, así que no
// hay que configurar en Supabase a cuál pertenece.

const NEON_ENV_PATTERN = /^NEON_DATABASE_URL(_[A-Z0-9_]+)?$/;

function neonEnvKeys(): string[] {
  return Object.keys(process.env)
    .filter((key) => NEON_ENV_PATTERN.test(key) && process.env[key])
    .sort();
}

// Solo recuerda en qué base está cada salón; sus datos siempre se leen frescos.
const baseDeSalon = new Map<string, string>();

export class NeonSalonNoEncontradoError extends Error {
  constructor(neonSalonId: string) {
    super(`El salón ${neonSalonId} no existe en ninguna base Neon configurada`);
    this.name = "NeonSalonNoEncontradoError";
  }
}

async function getSqlDeSalon(neonSalonId: string) {
  const cacheada = baseDeSalon.get(neonSalonId);
  if (cacheada && process.env[cacheada]) {
    return neon(process.env[cacheada]!);
  }

  const keys = neonEnvKeys();
  if (keys.length === 0) {
    throw new Error("NEON_DATABASE_URL no está configurada");
  }

  const resultados = await Promise.allSettled(
    keys.map(async (key) => {
      const sql = neon(process.env[key]!);
      const rows = (await sql`
        SELECT 1 FROM salones WHERE id::text = lower(${neonSalonId}) LIMIT 1
      `) as unknown[];
      return rows.length > 0;
    })
  );

  resultados.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`Neon (${keys[i]}) no respondió:`, r.reason);
    }
  });

  const encontrada = resultados.findIndex((r) => r.status === "fulfilled" && r.value);
  if (encontrada >= 0) {
    baseDeSalon.set(neonSalonId, keys[encontrada]);
    return neon(process.env[keys[encontrada]]!);
  }

  // Si alguna base falló no se puede afirmar que el salón no exista
  const fallida = resultados.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
  if (fallida) {
    throw fallida.reason;
  }
  throw new NeonSalonNoEncontradoError(neonSalonId);
}

// ── Filas crudas de Neon (mismo esquema en TWCApp y Martha Rdz App) ──
// OJO: @neondatabase/serverless parsea columnas `date` como objetos Date
// (medianoche local), no como string — a diferencia de los otros campos.

interface CitaRow {
  fecha: Date;
  timestamp: string | null;
  clienta: string;
  items: { tipo?: string; nombre?: string; costo?: number }[];
  total: string;
  metodo_pago: string | null;
}

interface GastoRow {
  fecha: Date;
  timestamp: string | null;
  descripcion: string;
  monto: string;
  metodo_pago: string | null;
}

interface ComisionRow {
  fecha: Date;
  clienta: string | null;
  trabajadora: string;
  item: string | null;
  tipo: string | null;
  costo: string | null;
  pct: string | null;
  comision: string | null;
}

function parseServiciosNeon(items: CitaRow["items"]): ServicioItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    tipo: item.tipo === "producto" ? "producto" : "servicio",
    nombre: String(item.nombre || ""),
    costo: Number(item.costo) || 0,
  }));
}

function metodoPagoOrDefault(raw: string | null): MetodoPago {
  return parseMetodoPago(raw || "");
}

// ── Fetch de citas, gastos y comisiones para un salón de Neon ──

export async function fetchSalonDataNeon(
  neonSalonId: string
): Promise<{ citas: Cita[]; gastos: Gasto[]; comisiones: Comision[] }> {
  const sql = await getSqlDeSalon(neonSalonId);

  const [citasRows, gastosRows, comisionesRows] = await Promise.all([
    sql`
      SELECT fecha, timestamp, clienta, items, total, metodo_pago
      FROM citas
      WHERE salon_id = ${neonSalonId} AND deleted_at IS NULL
    ` as unknown as Promise<CitaRow[]>,
    sql`
      SELECT fecha, timestamp, descripcion, monto, metodo_pago
      FROM gastos
      WHERE salon_id = ${neonSalonId} AND deleted_at IS NULL
    ` as unknown as Promise<GastoRow[]>,
    sql`
      SELECT fecha, clienta, trabajadora, item, tipo, costo, pct, comision
      FROM comisiones
      WHERE salon_id = ${neonSalonId} AND deleted_at IS NULL
    ` as unknown as Promise<ComisionRow[]>,
  ]);

  const citas: Cita[] = citasRows
    .map((row) => ({
      fecha: row.fecha,
      timestamp: row.timestamp || "",
      clienta: row.clienta?.trim() || "Sin nombre",
      servicios: parseServiciosNeon(row.items),
      costo: Number(row.total) || 0,
      metodoPago: metodoPagoOrDefault(row.metodo_pago),
    }))
    .filter((c) => c.costo > 0);

  const gastos: Gasto[] = gastosRows
    .map((row) => ({
      fecha: row.fecha,
      timestamp: row.timestamp || "",
      descripcion: row.descripcion?.trim() || "Sin descripción",
      monto: Number(row.monto) || 0,
      metodoPago: metodoPagoOrDefault(row.metodo_pago),
    }))
    .filter((g) => g.monto > 0);

  const comisiones: Comision[] = comisionesRows
    .map((row) => ({
      fecha: row.fecha,
      clienta: row.clienta?.trim() || "Sin nombre",
      trabajadora: row.trabajadora?.trim() || "Sin nombre",
      item: row.item?.trim() || "Sin descripción",
      tipo: (row.tipo?.trim().toLowerCase() === "producto" ? "producto" : "servicio") as Comision["tipo"],
      costo: Number(row.costo) || 0,
      porcentaje: Number(row.pct) || 0,
      monto: Number(row.comision) || 0,
    }))
    .filter((c) => c.monto > 0);

  return { citas, gastos, comisiones };
}
