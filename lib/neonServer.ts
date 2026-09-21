import { neon } from "@neondatabase/serverless";
import type { Cita, Gasto, Comision, ServicioItem, MetodoPago } from "./types";
import { parseMetodoPago } from "./sheets";

// ── Cliente Neon (solo servidor — la connection string nunca llega al navegador) ──

function getSql() {
  const url = process.env.NEON_DATABASE_URL;
  if (!url) {
    throw new Error("NEON_DATABASE_URL no está configurada");
  }
  return neon(url);
}

// ── Filas crudas de Neon (tablas del proyecto TWCApp) ──

interface CitaRow {
  fecha: string;
  timestamp: string | null;
  clienta: string;
  items: { tipo?: string; nombre?: string; costo?: number }[];
  total: string;
  metodo_pago: string | null;
}

interface GastoRow {
  fecha: string;
  timestamp: string | null;
  descripcion: string;
  monto: string;
  metodo_pago: string | null;
}

interface ComisionRow {
  fecha: string;
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
  const sql = getSql();

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
      fecha: new Date(row.fecha + "T00:00:00"),
      timestamp: row.timestamp || "",
      clienta: row.clienta?.trim() || "Sin nombre",
      servicios: parseServiciosNeon(row.items),
      costo: Number(row.total) || 0,
      metodoPago: metodoPagoOrDefault(row.metodo_pago),
    }))
    .filter((c) => c.costo > 0);

  const gastos: Gasto[] = gastosRows
    .map((row) => ({
      fecha: new Date(row.fecha + "T00:00:00"),
      timestamp: row.timestamp || "",
      descripcion: row.descripcion?.trim() || "Sin descripción",
      monto: Number(row.monto) || 0,
      metodoPago: metodoPagoOrDefault(row.metodo_pago),
    }))
    .filter((g) => g.monto > 0);

  const comisiones: Comision[] = comisionesRows
    .map((row) => ({
      fecha: new Date(row.fecha + "T00:00:00"),
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
