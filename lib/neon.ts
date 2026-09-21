import type { Cita, Gasto, Comision } from "./types";

// ── Fetch de datos de un salón conectado a Neon (vía API route del servidor) ──
// La connection string de Neon nunca se expone al navegador: este helper llama
// a /api/salon-data/neon, que corre en el servidor.

export async function fetchSalonDataNeon(
  neonSalonId: string
): Promise<{ citas: Cita[]; gastos: Gasto[]; comisiones: Comision[] }> {
  const res = await fetch(
    `/api/salon-data/neon?neonSalonId=${encodeURIComponent(neonSalonId)}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error(`Error fetching Neon salon data: ${res.status}`);
  }

  const data = await res.json();

  // El servidor manda fecha como "YYYY-MM-DD" (ver route.ts); se ancla a
  // medianoche local igual que lib/sheets.ts, para que ambas fuentes de
  // datos calculen "semana actual" con el mismo criterio.
  return {
    citas: (data.citas as Cita[]).map((c) => ({ ...c, fecha: new Date(c.fecha + "T00:00:00") })),
    gastos: (data.gastos as Gasto[]).map((g) => ({ ...g, fecha: new Date(g.fecha + "T00:00:00") })),
    comisiones: (data.comisiones as Comision[]).map((c) => ({ ...c, fecha: new Date(c.fecha + "T00:00:00") })),
  };
}
