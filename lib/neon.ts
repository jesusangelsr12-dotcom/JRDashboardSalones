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

  return {
    citas: (data.citas as Cita[]).map((c) => ({ ...c, fecha: new Date(c.fecha) })),
    gastos: (data.gastos as Gasto[]).map((g) => ({ ...g, fecha: new Date(g.fecha) })),
    comisiones: (data.comisiones as Comision[]).map((c) => ({ ...c, fecha: new Date(c.fecha) })),
  };
}
