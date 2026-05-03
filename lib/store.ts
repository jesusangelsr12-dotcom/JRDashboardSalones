import { v4 as uuidv4 } from "uuid";
import { supabase } from "./supabase";
import type { Salon, Bolsa, GastoFijo, CierreSemana, GastoAdmin, MetodoPago, MovimientoBolsa, TipoMovimiento, OrigenMovimiento } from "./types";

// ── Helpers: mapear filas de Supabase → tipos de la app ──

interface SalonRow {
  id: string;
  nombre: string;
  color: string;
  sheet_id: string;
  bolsa_default_gastos_id: string | null;
  comision_tarjeta: number;
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
    comisionTarjeta: row.comision_tarjeta ?? 0,
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

export async function addSalon(salon: Salon): Promise<boolean> {
  // 1. Insertar salón (sin bolsa_default_gastos_id todavía, la bolsa no existe aún)
  const { error: salonError } = await supabase.from("salones").insert({
    id: salon.id,
    nombre: salon.nombre,
    color: salon.color,
    sheet_id: salon.sheetId,
    bolsa_default_gastos_id: null,
    comision_tarjeta: salon.comisionTarjeta ?? 0,
    created_at: salon.createdAt,
  });

  if (salonError) {
    console.error("Error adding salon:", salonError);
    return false;
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
    if (bolsasError) {
      console.error("Error adding bolsas:", bolsasError);
      return false;
    }
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
    if (gastosError) {
      console.error("Error adding gastos fijos:", gastosError);
      return false;
    }
  }

  // 4. Ahora que las bolsas existen, asignar bolsa_default_gastos_id si aplica
  if (salon.bolsaDefaultGastosId) {
    await supabase
      .from("salones")
      .update({ bolsa_default_gastos_id: salon.bolsaDefaultGastosId })
      .eq("id", salon.id);
  }

  return true;
}

export async function updateSalon(updated: Salon): Promise<void> {
  // 1. Obtener IDs de bolsas actuales en la BD
  const { data: existingBolsas } = await supabase
    .from("bolsas")
    .select("id")
    .eq("salon_id", updated.id);

  const existingBolsaIds = new Set((existingBolsas || []).map((b) => b.id));
  const updatedBolsaIds = new Set(updated.bolsas.map((b) => b.id));
  const bolsasToDelete = Array.from(existingBolsaIds).filter((id) => !updatedBolsaIds.has(id));

  // 2. Si vamos a borrar bolsas, primero quitar bolsa_default_gastos_id
  //    para evitar que la FK bloquee el delete
  if (bolsasToDelete.length > 0) {
    await supabase
      .from("salones")
      .update({ bolsa_default_gastos_id: null })
      .eq("id", updated.id);

    // Borrar movimientos asociados a las bolsas que se van
    await supabase.from("movimientos_bolsa").delete().in("bolsa_id", bolsasToDelete);
    await supabase.from("bolsas").delete().in("id", bolsasToDelete);
  }

  // 3. Upsert bolsas (insertar nuevas + actualizar existentes, sin tocar acumulado)
  for (const b of updated.bolsas) {
    if (existingBolsaIds.has(b.id)) {
      await supabase
        .from("bolsas")
        .update({ nombre: b.nombre, porcentaje: b.porcentaje, color: b.color })
        .eq("id", b.id);
    } else {
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

  // 4. Actualizar datos del salón (ahora las bolsas existen, FK es válida)
  await supabase
    .from("salones")
    .update({
      nombre: updated.nombre,
      color: updated.color,
      sheet_id: updated.sheetId,
      bolsa_default_gastos_id: updated.bolsaDefaultGastosId,
      comision_tarjeta: updated.comisionTarjeta ?? 0,
    })
    .eq("id", updated.id);

  // 5. Reemplazar gastos fijos
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

export async function deleteSalon(id: string): Promise<boolean> {
  // Primero quitar la FK de bolsa_default_gastos_id para que CASCADE no falle
  await supabase.from("salones").update({ bolsa_default_gastos_id: null }).eq("id", id);

  // Borrar hijos explícitamente en orden correcto (no depender solo de CASCADE)
  await supabase.from("movimientos_bolsa").delete().eq("salon_id", id);
  await supabase.from("gastos_admin").delete().eq("salon_id", id);
  await supabase.from("cierres").delete().eq("salon_id", id);
  await supabase.from("gastos_fijos").delete().eq("salon_id", id);
  await supabase.from("bolsas").delete().eq("salon_id", id);

  const { error } = await supabase.from("salones").delete().eq("id", id);
  if (error) {
    console.error("Error deleting salon:", error);
    return false;
  }
  return true;
}

// ── Acumulados de bolsas ──

export async function getAcumulados(
  salonId: string
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("bolsas")
    .select("id, acumulado")
    .eq("salon_id", salonId);

  if (error) {
    console.error("Error fetching acumulados:", error);
    return {};
  }

  const result: Record<string, number> = {};
  data?.forEach((b) => {
    result[b.id] = b.acumulado;
  });
  return result;
}

// Incremento atómico: usa RPC si existe, si no hace read-modify-write
async function incrementAcumulado(bolsaId: string, delta: number): Promise<void> {
  // Intentar RPC atómica primero
  const { error: rpcError } = await supabase.rpc("increment_acumulado", {
    bolsa_uuid: bolsaId,
    delta,
  });

  if (!rpcError) return;

  // Fallback: read-modify-write (menos seguro, pero funciona sin la migración)
  const { data: bolsa } = await supabase
    .from("bolsas")
    .select("acumulado")
    .eq("id", bolsaId)
    .single();

  if (bolsa) {
    await supabase
      .from("bolsas")
      .update({ acumulado: bolsa.acumulado + delta })
      .eq("id", bolsaId);
  }
}

export async function saveAcumulados(
  _salonId: string,
  acumulados: Record<string, number>
): Promise<void> {
  const updates = Object.entries(acumulados).map(([bolsaId, acumulado]) =>
    supabase.from("bolsas").update({ acumulado }).eq("id", bolsaId)
  );
  await Promise.all(updates);
}

export async function resetAcumulados(salonId: string): Promise<void> {
  const { error } = await supabase
    .from("bolsas")
    .update({ acumulado: 0 })
    .eq("salon_id", salonId);
  if (error) console.error("Error resetting acumulados:", error);
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
): Promise<boolean> {
  // Verificar que no se haya cerrado ya esta semana (evita doble-click)
  const { data: existing } = await supabase
    .from("cierres")
    .select("id")
    .eq("salon_id", salonId)
    .eq("semana_inicio", cierre.semanaInicio)
    .limit(1);

  if (existing && existing.length > 0) {
    console.warn("Cierre already exists for this week, skipping");
    return false;
  }

  const { error } = await supabase.from("cierres").insert({
    salon_id: salonId,
    fecha: cierre.fecha,
    semana_inicio: cierre.semanaInicio,
    semana_fin: cierre.semanaFin,
    ingresos: cierre.ingresos,
    gastos: cierre.gastos,
    libre: cierre.libre,
    bolsas: cierre.bolsas,
  });

  if (error) {
    console.error("Error adding cierre:", error);
    return false;
  }
  return true;
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
      origen: (m.origen ?? "manual") as OrigenMovimiento,
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
  // 1. Insertar el movimiento (origen siempre 'manual' desde el formulario)
  const { error } = await supabase.from("movimientos_bolsa").insert({
    salon_id: salonId,
    bolsa_id: movimiento.bolsaId,
    tipo: movimiento.tipo,
    monto: movimiento.monto,
    metodo_pago: movimiento.metodoPago,
    descripcion: movimiento.descripcion,
    fecha: movimiento.fecha,
    origen: "manual",
  });
  if (error) {
    console.error("Error adding movimiento bolsa:", error);
    return;
  }

  // 2. Actualizar acumulado atómicamente
  const delta = movimiento.tipo === "ingreso" ? movimiento.monto : -movimiento.monto;
  await incrementAcumulado(movimiento.bolsaId, delta);
}

export async function deleteMovimientoBolsa(id: string, bolsaId: string, tipo: TipoMovimiento, monto: number): Promise<void> {
  // 1. Primero borrar el registro
  const { error } = await supabase.from("movimientos_bolsa").delete().eq("id", id);
  if (error) {
    console.error("Error deleting movimiento:", error);
    return;
  }

  // 2. Después revertir el acumulado atómicamente
  const delta = tipo === "ingreso" ? -monto : monto;
  await incrementAcumulado(bolsaId, delta);
}

export async function reasignarBolsa(movimientoId: string, nuevaBolsaId: string): Promise<boolean> {
  const { error } = await supabase
    .from("movimientos_bolsa")
    .update({ bolsa_id: nuevaBolsaId })
    .eq("id", movimientoId);

  if (error) {
    console.error("Error reasignando bolsa:", error);
    return false;
  }
  return true;
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
// NOTA: Solo se ejecuta si la tabla "salones" está completamente vacía.
// Se usa un flag en localStorage para evitar re-seedear después de que
// el usuario borra todos sus salones intencionalmente.

const SEEDED_KEY = "jr_salones_seeded";

async function seedSalonesIfEmpty(): Promise<Salon[]> {
  // Si ya se hizo seed antes (incluso si el usuario borró todo), no volver a seedear
  if (typeof window !== "undefined" && localStorage.getItem(SEEDED_KEY)) {
    return [];
  }

  // Verificar que la BD realmente esté vacía
  const { count, error } = await supabase
    .from("salones")
    .select("id", { count: "exact", head: true });

  if (error || (count ?? 0) > 0) return [];

  const salones: Salon[] = [
    {
      id: uuidv4(),
      nombre: "Martha Rdz Stylist",
      color: "#2563EB",
      sheetId: "TU_SHEET_ID_AQUI",
      bolsas: crearBolsasPlantilla(),
      gastosFijos: [
        { id: uuidv4(), nombre: "Renta", monto: 8000, frecuencia: "mensual" },
        { id: uuidv4(), nombre: "Luz", monto: 1500, frecuencia: "mensual" },
        { id: uuidv4(), nombre: "Internet", monto: 600, frecuencia: "mensual" },
      ],
      bolsaDefaultGastosId: null,
      comisionTarjeta: 0,
      createdAt: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      nombre: "Salón Elegance",
      color: "#059669",
      sheetId: "TU_SHEET_ID_2_AQUI",
      bolsas: [
        { id: uuidv4(), nombre: "Operación", porcentaje: 50, color: "#8B5CF6", acumulado: 0 },
        { id: uuidv4(), nombre: "Nómina", porcentaje: 25, color: "#EC4899", acumulado: 0 },
        { id: uuidv4(), nombre: "Reserva", porcentaje: 15, color: "#14B8A6", acumulado: 0 },
        { id: uuidv4(), nombre: "Administración JR", porcentaje: 10, color: "#F97316", acumulado: 0 },
      ],
      gastosFijos: [
        { id: uuidv4(), nombre: "Renta", monto: 12000, frecuencia: "mensual" },
        { id: uuidv4(), nombre: "Agua", monto: 400, frecuencia: "mensual" },
      ],
      bolsaDefaultGastosId: null,
      comisionTarjeta: 0,
      createdAt: new Date().toISOString(),
    },
  ];

  for (const salon of salones) {
    await addSalon(salon);
  }

  // Marcar que ya se hizo seed para no repetir
  if (typeof window !== "undefined") {
    localStorage.setItem(SEEDED_KEY, "1");
  }

  return salones;
}

// ── Deduplicar salones: elimina duplicados por nombre, conserva el más antiguo ──

async function deduplicarSalones(): Promise<void> {
  const { data: rows, error } = await supabase
    .from("salones")
    .select("id, nombre, created_at")
    .order("created_at", { ascending: true });

  if (error || !rows) return;

  const seen = new Map<string, string>();
  const idsToDelete: string[] = [];

  for (const s of rows) {
    if (seen.has(s.nombre)) {
      idsToDelete.push(s.id);
    } else {
      seen.set(s.nombre, s.id);
    }
  }

  if (idsToDelete.length === 0) return;

  // Primero quitar FK bolsa_default_gastos_id de los salones a borrar
  for (const id of idsToDelete) {
    await supabase.from("salones").update({ bolsa_default_gastos_id: null }).eq("id", id);
  }

  // Borrar hijos en orden correcto
  await supabase.from("movimientos_bolsa").delete().in("salon_id", idsToDelete);
  await supabase.from("gastos_admin").delete().in("salon_id", idsToDelete);
  await supabase.from("cierres").delete().in("salon_id", idsToDelete);
  await supabase.from("gastos_fijos").delete().in("salon_id", idsToDelete);
  await supabase.from("bolsas").delete().in("salon_id", idsToDelete);
  await supabase.from("salones").delete().in("id", idsToDelete);
}

// ── Inicializar store ──
// SIEMPRE lee datos frescos de la BD. No cachea.

export async function initStore(): Promise<Salon[]> {
  const { salones, error } = await getSalones();
  if (error) return [];

  // Si hay salones, limpiar duplicados si es necesario y devolver
  if (salones.length > 0) {
    // Marcar que ya existe data (para no re-seedear si se borran después)
    if (typeof window !== "undefined") {
      localStorage.setItem(SEEDED_KEY, "1");
    }

    const nombres = salones.map((s) => s.nombre);
    if (new Set(nombres).size < nombres.length) {
      await deduplicarSalones();
      const { salones: clean } = await getSalones();
      return clean;
    }
    return salones;
  }

  // BD vacía: intentar seed solo la primera vez
  return seedSalonesIfEmpty();
}
