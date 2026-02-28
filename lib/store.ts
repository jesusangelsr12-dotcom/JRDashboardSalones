import { v4 as uuidv4 } from "uuid";
import { supabase } from "./supabase";
import type { Salon, Bolsa, GastoFijo, CierreSemana } from "./types";

// ── Helpers: mapear filas de Supabase → tipos de la app ──

interface SalonRow {
  id: string;
  nombre: string;
  color: string;
  sheet_id: string;
  created_at: string;
  bolsas: BolsaRow[];
  gastos_fijos: GastoFijoRow[];
}

interface BolsaRow {
  id: string;
  salon_id: string;
  nombre: string;
  porcentaje: number;
  color: string;
  acumulado: number;
}

interface GastoFijoRow {
  id: string;
  salon_id: string;
  nombre: string;
  monto: number;
  frecuencia: string;
}

function mapSalon(row: SalonRow): Salon {
  return {
    id: row.id,
    nombre: row.nombre,
    color: row.color,
    sheetId: row.sheet_id,
    bolsas: (row.bolsas || []).map((b) => ({
      id: b.id,
      nombre: b.nombre,
      porcentaje: b.porcentaje,
      color: b.color,
      acumulado: b.acumulado,
    })),
    gastosFijos: (row.gastos_fijos || []).map((g) => ({
      id: g.id,
      nombre: g.nombre,
      monto: g.monto,
      frecuencia: g.frecuencia as "semanal" | "mensual",
    })),
    createdAt: row.created_at,
  };
}

// ── Salones CRUD ──

export async function getSalones(): Promise<Salon[]> {
  const { data, error } = await supabase
    .from("salones")
    .select("*, bolsas(*), gastos_fijos(*)")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching salones:", error);
    return [];
  }

  return (data as unknown as SalonRow[]).map(mapSalon);
}

export async function getSalon(id: string): Promise<Salon | undefined> {
  const { data, error } = await supabase
    .from("salones")
    .select("*, bolsas(*), gastos_fijos(*)")
    .eq("id", id)
    .single();

  if (error || !data) return undefined;
  return mapSalon(data as unknown as SalonRow);
}

export async function addSalon(salon: Salon): Promise<void> {
  // 1. Insertar salón
  const { error: salonError } = await supabase.from("salones").insert({
    id: salon.id,
    nombre: salon.nombre,
    color: salon.color,
    sheet_id: salon.sheetId,
    created_at: salon.createdAt,
  });

  if (salonError) {
    console.error("Error adding salon:", salonError);
    return;
  }

  // 2. Insertar bolsas
  if (salon.bolsas.length > 0) {
    const { error: bolsasError } = await supabase.from("bolsas").insert(
      salon.bolsas.map((b) => ({
        id: b.id,
        salon_id: salon.id,
        nombre: b.nombre,
        porcentaje: b.porcentaje,
        color: b.color,
        acumulado: b.acumulado,
      }))
    );
    if (bolsasError) console.error("Error adding bolsas:", bolsasError);
  }

  // 3. Insertar gastos fijos
  if (salon.gastosFijos.length > 0) {
    const { error: gastosError } = await supabase.from("gastos_fijos").insert(
      salon.gastosFijos.map((g) => ({
        id: g.id,
        salon_id: salon.id,
        nombre: g.nombre,
        monto: g.monto,
        frecuencia: g.frecuencia,
      }))
    );
    if (gastosError) console.error("Error adding gastos fijos:", gastosError);
  }
}

export async function updateSalon(updated: Salon): Promise<void> {
  // 1. Actualizar datos del salón
  await supabase
    .from("salones")
    .update({
      nombre: updated.nombre,
      color: updated.color,
      sheet_id: updated.sheetId,
    })
    .eq("id", updated.id);

  // 2. Reemplazar bolsas: borrar existentes + insertar nuevas
  await supabase.from("bolsas").delete().eq("salon_id", updated.id);
  if (updated.bolsas.length > 0) {
    await supabase.from("bolsas").insert(
      updated.bolsas.map((b) => ({
        id: b.id,
        salon_id: updated.id,
        nombre: b.nombre,
        porcentaje: b.porcentaje,
        color: b.color,
        acumulado: b.acumulado,
      }))
    );
  }

  // 3. Reemplazar gastos fijos
  await supabase.from("gastos_fijos").delete().eq("salon_id", updated.id);
  if (updated.gastosFijos.length > 0) {
    await supabase.from("gastos_fijos").insert(
      updated.gastosFijos.map((g) => ({
        id: g.id,
        salon_id: updated.id,
        nombre: g.nombre,
        monto: g.monto,
        frecuencia: g.frecuencia,
      }))
    );
  }
}

export async function deleteSalon(id: string): Promise<void> {
  // CASCADE se encarga de bolsas, gastos_fijos y cierres
  await supabase.from("salones").delete().eq("id", id);
}

// ── Acumulados de bolsas ──

export async function getAcumulados(
  salonId: string
): Promise<Record<string, number>> {
  const { data } = await supabase
    .from("bolsas")
    .select("id, acumulado")
    .eq("salon_id", salonId);

  const result: Record<string, number> = {};
  data?.forEach((b) => {
    result[b.id] = b.acumulado;
  });
  return result;
}

export async function saveAcumulados(
  salonId: string,
  acumulados: Record<string, number>
): Promise<void> {
  const updates = Object.entries(acumulados).map(([bolsaId, acumulado]) =>
    supabase.from("bolsas").update({ acumulado }).eq("id", bolsaId)
  );
  await Promise.all(updates);
}

export async function resetAcumulados(salonId: string): Promise<void> {
  await supabase
    .from("bolsas")
    .update({ acumulado: 0 })
    .eq("salon_id", salonId);
}

// ── Cierres de semana ──

export async function getCierres(salonId: string): Promise<CierreSemana[]> {
  const { data } = await supabase
    .from("cierres")
    .select("*")
    .eq("salon_id", salonId)
    .order("created_at", { ascending: true });

  return (
    data?.map((c) => ({
      fecha: c.fecha,
      semanaInicio: c.semana_inicio,
      semanaFin: c.semana_fin,
      ingresos: c.ingresos,
      gastos: c.gastos,
      libre: c.libre,
      bolsas: c.bolsas as CierreSemana["bolsas"],
    })) ?? []
  );
}

export async function addCierre(
  salonId: string,
  cierre: CierreSemana
): Promise<void> {
  await supabase.from("cierres").insert({
    salon_id: salonId,
    fecha: cierre.fecha,
    semana_inicio: cierre.semanaInicio,
    semana_fin: cierre.semanaFin,
    ingresos: cierre.ingresos,
    gastos: cierre.gastos,
    libre: cierre.libre,
    bolsas: cierre.bolsas,
  });
}

// ── Seed data: Bolsas plantilla ──

export function crearBolsasPlantilla(): Bolsa[] {
  return [
    {
      id: uuidv4(),
      nombre: "Materiales Salón",
      porcentaje: 55,
      color: "#6366F1",
      acumulado: 0,
    },
    {
      id: uuidv4(),
      nombre: "Sueldo Dueño",
      porcentaje: 30,
      color: "#F59E0B",
      acumulado: 0,
    },
    {
      id: uuidv4(),
      nombre: "Ahorro Futuro",
      porcentaje: 10,
      color: "#10B981",
      acumulado: 0,
    },
    {
      id: uuidv4(),
      nombre: "Administración",
      porcentaje: 5,
      color: "#EF4444",
      acumulado: 0,
    },
  ];
}

// ── Seed data: Salones iniciales ──

export async function seedSalones(): Promise<Salon[]> {
  const salones: Salon[] = [
    {
      id: uuidv4(),
      nombre: "Martha Rdz Stylist",
      color: "#2563EB",
      sheetId: "TU_SHEET_ID_AQUI",
      bolsas: crearBolsasPlantilla(),
      gastosFijos: [
        {
          id: uuidv4(),
          nombre: "Renta",
          monto: 8000,
          frecuencia: "mensual",
        },
        {
          id: uuidv4(),
          nombre: "Luz",
          monto: 1500,
          frecuencia: "mensual",
        },
        {
          id: uuidv4(),
          nombre: "Internet",
          monto: 600,
          frecuencia: "mensual",
        },
      ],
      createdAt: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      nombre: "Salón Elegance",
      color: "#059669",
      sheetId: "TU_SHEET_ID_2_AQUI",
      bolsas: [
        {
          id: uuidv4(),
          nombre: "Operación",
          porcentaje: 50,
          color: "#8B5CF6",
          acumulado: 0,
        },
        {
          id: uuidv4(),
          nombre: "Nómina",
          porcentaje: 25,
          color: "#EC4899",
          acumulado: 0,
        },
        {
          id: uuidv4(),
          nombre: "Reserva",
          porcentaje: 15,
          color: "#14B8A6",
          acumulado: 0,
        },
        {
          id: uuidv4(),
          nombre: "Administración JR",
          porcentaje: 10,
          color: "#F97316",
          acumulado: 0,
        },
      ],
      gastosFijos: [
        {
          id: uuidv4(),
          nombre: "Renta",
          monto: 12000,
          frecuencia: "mensual",
        },
        {
          id: uuidv4(),
          nombre: "Agua",
          monto: 400,
          frecuencia: "mensual",
        },
      ],
      createdAt: new Date().toISOString(),
    },
  ];

  for (const salon of salones) {
    await addSalon(salon);
  }

  return salones;
}

// ── Inicializar store ──

export async function initStore(): Promise<Salon[]> {
  const existing = await getSalones();
  if (existing.length > 0) return existing;
  return seedSalones();
}
