import { v4 as uuidv4 } from "uuid";
import type { Salon, Bolsa, CierreSemana } from "./types";

// ── Keys ──

const SALONES_KEY = "jr_salones";
const acumuladosKey = (salonId: string) => `acumulados_${salonId}`;
const cierresKey = (salonId: string) => `cierres_${salonId}`;

// ── Helpers genéricos ──

function getItem<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function setItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

// ── Salones CRUD ──

export function getSalones(): Salon[] {
  return getItem<Salon[]>(SALONES_KEY, []);
}

export function getSalon(id: string): Salon | undefined {
  return getSalones().find((s) => s.id === id);
}

export function saveSalones(salones: Salon[]): void {
  setItem(SALONES_KEY, salones);
}

export function addSalon(salon: Salon): void {
  const salones = getSalones();
  salones.push(salon);
  saveSalones(salones);
}

export function updateSalon(updated: Salon): void {
  const salones = getSalones().map((s) =>
    s.id === updated.id ? updated : s
  );
  saveSalones(salones);
}

export function deleteSalon(id: string): void {
  const salones = getSalones().filter((s) => s.id !== id);
  saveSalones(salones);
  // Limpiar datos asociados
  if (typeof window !== "undefined") {
    localStorage.removeItem(acumuladosKey(id));
    localStorage.removeItem(cierresKey(id));
  }
}

// ── Acumulados de bolsas ──

export function getAcumulados(salonId: string): Record<string, number> {
  return getItem<Record<string, number>>(acumuladosKey(salonId), {});
}

export function saveAcumulados(
  salonId: string,
  acumulados: Record<string, number>
): void {
  setItem(acumuladosKey(salonId), acumulados);
}

export function resetAcumulados(salonId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(acumuladosKey(salonId));
}

// ── Cierres de semana ──

export function getCierres(salonId: string): CierreSemana[] {
  return getItem<CierreSemana[]>(cierresKey(salonId), []);
}

export function addCierre(salonId: string, cierre: CierreSemana): void {
  const cierres = getCierres(salonId);
  cierres.push(cierre);
  setItem(cierresKey(salonId), cierres);
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

export function seedSalones(): Salon[] {
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
  saveSalones(salones);
  return salones;
}

// ── Inicializar store ──

export function initStore(): Salon[] {
  const existing = getSalones();
  if (existing.length > 0) return existing;
  return seedSalones();
}
