import type { CitaRaw, GastoRaw, ComisionRaw, Cita, Gasto, Comision, ServicioItem, MetodoPago } from "./types";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const BASE_URL = "https://sheets.googleapis.com/v4/spreadsheets";

// ── Fetch genérico de una hoja ──

async function fetchSheet<T>(
  sheetId: string,
  sheetName: string
): Promise<T[]> {
  const url = `${BASE_URL}/${sheetId}/values/${encodeURIComponent(sheetName)}?key=${API_KEY}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;

  const res = await fetch(url, { next: { revalidate: 0 } });

  if (!res.ok) {
    throw new Error(
      `Error fetching sheet "${sheetName}": ${res.status} ${res.statusText}`
    );
  }

  const data = await res.json();
  const rows: string[][] = data.values || [];

  if (rows.length < 2) return []; // solo headers o vacío

  const headers = rows[0].map((h: string) =>
    String(h).trim().toLowerCase().replace(/\s+/g, "_")
  );

  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header: string, i: number) => {
      obj[header] = row[i] != null ? String(row[i]) : "";
    });
    return obj as T;
  });
}

// ── Fetch citas (ingresos) ──

export async function fetchCitasRaw(sheetId: string): Promise<CitaRaw[]> {
  return fetchSheet<CitaRaw>(sheetId, "citas");
}

// ── Fetch gastos ──

export async function fetchGastosRaw(sheetId: string): Promise<GastoRaw[]> {
  return fetchSheet<GastoRaw>(sheetId, "gastos");
}

// ── Fetch comisiones (hoja opcional: salones viejos pueden no tenerla) ──

export async function fetchComisionesRaw(sheetId: string): Promise<ComisionRaw[]> {
  try {
    return await fetchSheet<ComisionRaw>(sheetId, "Comisiones");
  } catch {
    return [];
  }
}

// ── Parseo de fecha ──

function parseFecha(fecha: string): Date {
  // Soporta formatos comunes: "2025-01-15", "15/01/2025", "01/15/2025"
  if (!fecha) return new Date(0);

  // Formato ISO: "2025-01-15"
  if (/^\d{4}-\d{2}-\d{2}/.test(fecha)) {
    return new Date(fecha + "T00:00:00");
  }

  // Formato dd/mm/yyyy
  const parts = fecha.split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const year = y.length === 2 ? `20${y}` : y;
    return new Date(`${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00`);
  }

  return new Date(fecha);
}

// ── Parseo de servicios (JSON stringify) ──

function parseServicios(raw: string): ServicioItem[] {
  if (!raw || raw.trim() === "") return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => ({
        tipo: item.tipo === "producto" ? "producto" : "servicio",
        nombre: String(item.nombre || ""),
        costo: Number(item.costo) || 0,
      }));
    }
    return [];
  } catch {
    // Si no es JSON, devolvemos un servicio genérico
    return [{ tipo: "servicio", nombre: raw, costo: 0 }];
  }
}

// ── Normalizar método de pago ──

function parseMetodoPago(raw: string): MetodoPago {
  const normalized = raw.trim().toLowerCase();
  if (normalized.includes("tarjeta")) return "Tarjeta";
  if (normalized.includes("transferencia")) return "Transferencia";
  return "Efectivo";
}

// ── Parsear citas completas ──

export function parseCitas(rawCitas: CitaRaw[]): Cita[] {
  return rawCitas
    .map((raw) => ({
      fecha: parseFecha(raw.fecha),
      timestamp: raw.timestamp || "",
      clienta: raw.clienta?.trim() || "Sin nombre",
      servicios: parseServicios(raw.servicio),
      costo: Number(raw.costo) || 0,
      metodoPago: parseMetodoPago(raw.metodo_pago),
    }))
    .filter((c) => c.costo > 0);
}

// ── Parsear gastos completos ──

export function parseGastos(rawGastos: GastoRaw[]): Gasto[] {
  return rawGastos
    .map((raw) => ({
      fecha: parseFecha(raw.fecha),
      timestamp: raw.timestamp || "",
      descripcion: raw.descripcion?.trim() || "Sin descripción",
      monto: Number(raw.monto) || 0,
      metodoPago: parseMetodoPago(raw.metodo_pago),
    }))
    .filter((g) => g.monto > 0);
}

// ── Parsear comisiones completas ──

export function parseComisiones(rawComisiones: ComisionRaw[]): Comision[] {
  return rawComisiones
    .map((raw) => ({
      fecha: parseFecha(raw.fecha),
      clienta: raw.clienta?.trim() || "Sin nombre",
      trabajadora: raw.trabajadora?.trim() || "Sin nombre",
      item: raw.item?.trim() || "Sin descripción",
      tipo: (raw.tipo?.trim().toLowerCase() === "producto" ? "producto" : "servicio") as Comision["tipo"],
      costo: Number(raw.costo_de_item) || 0,
      porcentaje: Number(raw["comision_%"]) || 0,
      monto: Number(raw.pago_de_comision) || 0,
    }))
    .filter((c) => c.monto > 0);
}

// ── Función principal: obtener todos los datos de un salón ──

export async function fetchSalonData(
  sheetId: string
): Promise<{ citas: Cita[]; gastos: Gasto[]; comisiones: Comision[] }> {
  const [citasRaw, gastosRaw, comisionesRaw] = await Promise.all([
    fetchCitasRaw(sheetId),
    fetchGastosRaw(sheetId),
    fetchComisionesRaw(sheetId),
  ]);

  return {
    citas: parseCitas(citasRaw),
    gastos: parseGastos(gastosRaw),
    comisiones: parseComisiones(comisionesRaw),
  };
}
