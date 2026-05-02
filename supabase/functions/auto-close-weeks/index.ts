import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MEXICO_CITY_OFFSET_MS = -6 * 60 * 60 * 1000;

function nowInMexicoCity(): Date {
  const utc = new Date();
  return new Date(utc.getTime() + MEXICO_CITY_OFFSET_MS);
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getLastMonday(now: Date): Date {
  const d = new Date(now);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getSundayOfWeek(monday: Date): Date {
  const d = new Date(monday);
  d.setDate(d.getDate() + 6);
  return d;
}

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = nowInMexicoCity();
    const monday = getLastMonday(now);
    const sunday = getSundayOfWeek(monday);

    const semanaInicio = toISODate(monday);
    const semanaFin = toISODate(sunday);
    const fecha = new Date().toISOString();

    const { data: salones, error: salonesError } = await supabase
      .from("salones")
      .select("id");

    if (salonesError) {
      return new Response(JSON.stringify({ error: salonesError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!salones || salones.length === 0) {
      return new Response(JSON.stringify({ message: "No salones found" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const rows = salones.map((s) => ({
      salon_id: s.id,
      fecha,
      semana_inicio: semanaInicio,
      semana_fin: semanaFin,
      ingresos: 0,
      gastos: 0,
      libre: 0,
      bolsas: [],
    }));

    const { error: insertError } = await supabase
      .from("cierres")
      .upsert(rows, { onConflict: "salon_id,semana_inicio", ignoreDuplicates: true });

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        message: `Auto-close completed for week ${semanaInicio}`,
        salones: salones.length,
        semana_inicio: semanaInicio,
        semana_fin: semanaFin,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
