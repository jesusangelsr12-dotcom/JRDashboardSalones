import { NextRequest, NextResponse } from "next/server";
import { fetchSalonDataNeon } from "@/lib/neonServer";

export const dynamic = "force-dynamic";

// Postgres "date" llega como Date de medianoche local (mismo proceso que la
// parseó); JSON.stringify lo convertiría a instante UTC y el cliente lo
// reinterpretaría en SU zona horaria, corriendo el día. Mandamos "YYYY-MM-DD"
// en su lugar, igual que ya vienen las fechas de Sheets.
function fechaAYMD(fecha: unknown): string {
  const d = fecha as Date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(req: NextRequest) {
  const neonSalonId = req.nextUrl.searchParams.get("neonSalonId");

  if (!neonSalonId) {
    return NextResponse.json({ error: "Falta neonSalonId" }, { status: 400 });
  }

  try {
    const { citas, gastos, comisiones } = await fetchSalonDataNeon(neonSalonId);
    const data = {
      citas: citas.map((c) => ({ ...c, fecha: fechaAYMD(c.fecha) })),
      gastos: gastos.map((g) => ({ ...g, fecha: fechaAYMD(g.fecha) })),
      comisiones: comisiones.map((c) => ({ ...c, fecha: fechaAYMD(c.fecha) })),
    };
    return NextResponse.json(data);
  } catch (err) {
    console.error("Error fetching Neon salon data:", err);
    return NextResponse.json(
      { error: "Error al obtener datos de Neon" },
      { status: 500 }
    );
  }
}
