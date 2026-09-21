import { NextRequest, NextResponse } from "next/server";
import { fetchSalonDataNeon } from "@/lib/neonServer";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const neonSalonId = req.nextUrl.searchParams.get("neonSalonId");

  if (!neonSalonId) {
    return NextResponse.json({ error: "Falta neonSalonId" }, { status: 400 });
  }

  try {
    const data = await fetchSalonDataNeon(neonSalonId);
    return NextResponse.json(data);
  } catch (err) {
    console.error("Error fetching Neon salon data:", err);
    return NextResponse.json(
      { error: "Error al obtener datos de Neon" },
      { status: 500 }
    );
  }
}
