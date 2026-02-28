import { v4 as uuidv4 } from "uuid";
import { supabase } from "./supabase";
import type { Salon, Bolsa, GastoFijo, CierreSemana, GastoAdmin, MetodoPago, MovimientoBolsa, TipoMovimiento } from "./types";

// ── Helpers: mapear filas de Supabase → tipos de la app ──

interface SalonRow {
  id: string;
  nombre: string;
  color: string;
  sheet_id: string;
  bolsa_default_gastos_id: string | null;
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
    bolsaDefaultGastosId: row.bolsa_default_gastos_id || null,
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

export async function getSalones(): Promise<{ salones: Salon[]; error: boolean }> {
  const { data, error } = await supabase
    .from("salones")
    .select("*, bolsas!bolsas_salon_id_fkey(*), gastos_fijos(*)")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching salones:", JSON.stringify(error, null, 2));
    return { salones: [], error: true };
  }

  return { salones: (data as unknown as SalonRow[]).map(mapSalon), error: false };
}

export async function getSalon(id: string): Promise<Salon | undefined> {
  const { data, error } = await supabase
    .from("salones")
    .select("*, bolsas!bolsas_salon_id_fkey(*), gastos_fijos(*)")
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
    bolsa_default_gastos_id: salon.bolsaDefaultGastosId,
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
  // ── Bolsas: upsert las que existen + borrar las eliminadas ──
  // IMPORTANTE: se hace ANTES de actualizar bolsa_default_gastos_id
  // para evitar que ON DELETE SET NULL borre la referencia.

  // 1. Obtener IDs de bolsas actuales en la BD
  const { data: existingBolsas } = await supabase
    .from("bolsas")
    .select("id")
    .eq("salon_id", updated.id);

  const existingBolsaIds = new Set((existingBolsas || []).map((b) => b.id));
  const updatedBolsaIds = new Set(updated.bolsas.map((b) => b.id));

  // 2. Borrar bolsas que ya no existen (las que el usuario removió)
  const bolsasToDelete = Array.from(existingBolsaIds).filter((id) => !updatedBolsaIds.has(id));
  if (bolsasToDelete.length > 0) {
    await supabase.from("bolsas").delete().in("id", bolsasToDelete);
  }

  // 3. Upsert bolsas (insertar nuevas + actualizar existentes, sin tocar acumulado de existentes)
  if (updated.bolsas.length > 0) {
    for (const b of updated.bolsas) {
      if (existingBolsaIds.has(b.id)) {
        // Actualizar solo nombre, porcentaje y color — NO tocar acumulado
        await supabase
          .from("bolsas")
          .update({ nombre: b.nombre, porcentaje: b.porcentaje, color: b.color })
          .eq("id", b.id);
      } else {
        // Insertar nueva bolsa
        await supabase.from("bolsas").insert({
          id: b.id,
          salon_id: updated.id,
          nombre: b.nombre,
          porcentaje: b.porcentaje,
          color: b.color,
          acumulado: b.acumulado,
        });
      }
    }
  }

  // 4. Actualizar datos del salón (ahora bolsa_default_gastos_id apunta a un ID válido)
  await supabase
    .from("salones")
    .update({
      nombre: updated.nombre,
      color: updated.color,
      sheet_id: updated.sheetId,
      bolsa_default_gastos_id: updated.bolsaDefaultGastosId,
    })
    .eq("id", updated.id);

  // 5. Reemplazar gastos fijos (no tienen FK cascading, safe to delete+insert)
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
  // CASCADE se encarga de bolsas, gastos_fijos, cierres y gastos_admin
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

// ── Gastos Admin CRUD ──

export async function getGastosAdmin(salonId: string): Promise<GastoAdmin[]> {
  const { data, error } = await supabase
    .from("gastos_admin")
    .select("*")
    .eq("salon_id", salonId)
    .order("fecha", { ascending: false });

  if (error) {
    console.error("Error fetching gastos admin:", error);
    return [];
  }

  return (
    data?.map((g) => ({
      id: g.id,
      salonId: g.salon_id,
      fecha: g.fecha,
      descripcion: g.descripcion,
      monto: g.monto,
      metodoPago: g.metodo_pago as MetodoPago,
      bolsaId: g.bolsa_id,
      createdAt: g.created_at,
    })) ?? []
  );
}

export async function addGastoAdmin(
  salonId: string,
  gasto: {
    descripcion: string;
    monto: number;
    metodoPago: MetodoPago;
    fecha: string;
    bolsaId: string | null;
  }
): Promise<void> {
  const { error } = await supabase.from("gastos_admin").insert({
    salon_id: salonId,
    descripcion: gasto.descripcion,
    monto: gasto.monto,
    metodo_pago: gasto.metodoPago,
    fecha: gasto.fecha,
    bolsa_id: gasto.bolsaId,
  });
  if (error) console.error("Error adding gasto admin:", error);
}

export async function deleteGastoAdmin(id: string): Promise<void> {
  await supabase.from("gastos_admin").delete().eq("id", id);
}

// ── Movimientos de bolsa CRUD ──

export async function getMovimientosBolsa(salonId: string): Promise<MovimientoBolsa[]> {
  const { data, error } = await supabase
    .from("movimientos_bolsa")
    .select("*")
    .eq("salon_id", salonId)
    .order("fecha", { ascending: false });

  if (error) {
    console.error("Error fetching movimientos bolsa:", error);
    return [];
  }

  return (
    data?.map((m) => ({
      id: m.id,
      salonId: m.salon_id,
      bolsaId: m.bolsa_id,
      tipo: m.tipo as TipoMovimiento,
      monto: m.monto,
      metodoPago: m.metodo_pago as MetodoPago,
      descripcion: m.descripcion,
      fecha: m.fecha,
      createdAt: m.created_at,
    })) ?? []
  );
}

export async function addMovimientoBolsa(
  salonId: string,
  movimiento: {
    bolsaId: string;
    tipo: TipoMovimiento;
    monto: number;
    metodoPago: MetodoPago;
    descripcion: string;
    fecha: string;
  }
): Promise<void> {
  // 1. Insertar el movimiento
  const { error } = await supabase.from("movimientos_bolsa").insert({
    salon_id: salonId,
    bolsa_id: movimiento.bolsaId,
    tipo: movimiento.tipo,
    monto: movimiento.monto,
    metodo_pago: movimiento.metodoPago,
    descripcion: movimiento.descripcion,
    fecha: movimiento.fecha,
  });
  if (error) {
    console.error("Error adding movimiento bolsa:", error);
    return;
  }

  // 2. Actualizar acumulado de la bolsa
  const { data: bolsa } = await supabase
    .from("bolsas")
    .select("acumulado")
    .eq("id", movimiento.bolsaId)
    .single();

  if (bolsa) {
    const delta = movimiento.tipo === "ingreso" ? movimiento.monto : -movimiento.monto;
    await supabase
      .from("bolsas")
      .update({ acumulado: bolsa.acumulado + delta })
      .eq("id", movimiento.bolsaId);
  }
}

export async function deleteMovimientoBolsa(id: string, bolsaId: string, tipo: TipoMovimiento, monto: number): Promise<void> {
  // Revertir el acumulado
  const { data: bolsa } = await supabase
    .from("bolsas")
    .select("acumulado")
    .eq("id", bolsaId)
    .single();

  if (bolsa) {
    const delta = tipo === "ingreso" ? -monto : monto;
    await supabase
      .from("bolsas")
      .update({ acumulado: bolsa.acumulado + delta })
      .eq("id", bolsaId);
  }

  await supabase.from("movimientos_bolsa").delete().eq("id", id);
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
      bolsaDefaultGastosId: null,
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
      bolsaDefaultGastosId: null,
      createdAt: new Date().toISOString(),
    },
  ];

  for (const salon of salones) {
    await addSalon(salon);
  }

  return salones;
}

// ── Inicializar store ──

let _initPromise: Promise<Salon[]> | null = null;

export function initStore(): Promise<Salon[]> {
  if (!_initPromise) {
    _initPromise = _doInitStore().finally(() => {
      _initPromise = null;
    });
  }
  return _initPromise;
}

async function _doInitStore(): Promise<Salon[]> {
  const { salones, error } = await getSalones();
  if (error) return [];
  if (salones.length > 0) return salones;
  return seedSalones();
}
