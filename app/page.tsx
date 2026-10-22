"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import type { Salon, Cita, Gasto, Comision, CierreSemana } from "@/lib/types";
import { initStore, getGastosAdmin, getCierres } from "@/lib/store";
import { fetchSalonData } from "@/lib/sheets";
import { fetchSalonDataNeon } from "@/lib/neon";
import { formatMoney } from "@/lib/calculations";
import { colorSemaforo, type Semaforo } from "@/lib/salud";
import { resumirSalon, consolidar, alertasInicio, type DatosSalonInicio } from "@/lib/inicio";
import EmptyState from "@/components/ui/EmptyState";
import FadeIn from "@/components/motion/FadeIn";
import StaggerChildren, { StaggerItem } from "@/components/motion/StaggerChildren";
import UpdateButton from "@/components/ui/UpdateButton";
import { Delta, SalonAvatar, SemaforoChip, semaforoGlobalLabel } from "@/components/ui/Primitives";
import { IconAlert, IconCheck, IconChevronRight, IconPerson, IconPlus, MarcaApalabra } from "@/components/ui/Icons";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

type Estado = { tipo: "cargando" } | { tipo: "listo"; datos: DatosSalonInicio } | { tipo: "sin-datos" };

// Misma carga que la pantalla del salón: fuente (Sheets / Neon) + gastos admin + cierres.
async function cargarSalon(salon: Salon): Promise<{ citas: Cita[]; gastos: Gasto[]; comisiones: Comision[]; cierres: CierreSemana[] } | null> {
  const usaNeon = salon.dataSource === "neon";
  if (usaNeon ? !salon.neonSalonId : !salon.sheetId || salon.sheetId.startsWith("TU_SHEET_ID")) return null;

  const [fuente, adminGastos, cierres] = await Promise.all([
    usaNeon ? fetchSalonDataNeon(salon.neonSalonId!) : fetchSalonData(salon.sheetId),
    getGastosAdmin(salon.id),
    getCierres(salon.id),
  ]);

  const adminConvertidos: Gasto[] = adminGastos.map((ag) => ({
    fecha: new Date(ag.fecha + "T00:00:00"),
    timestamp: ag.createdAt,
    descripcion: ag.descripcion,
    monto: ag.monto,
    metodoPago: ag.metodoPago,
    bolsaId: ag.bolsaId,
    source: "admin" as const,
    adminId: ag.id,
  }));

  return {
    citas: fuente.citas,
    gastos: [...fuente.gastos.map((g) => ({ ...g, source: "sheets" as const })), ...adminConvertidos],
    comisiones: fuente.comisiones,
    cierres,
  };
}

export default function Home() {
  const [salones, setSalones] = useState<Salon[]>([]);
  const [estados, setEstados] = useState<Record<string, Estado>>({});
  const [mounted, setMounted] = useState(false);
  const hoy = useMemo(() => new Date(), []);

  useEffect(() => {
    async function load() {
      const data = await initStore();
      setSalones(data);
      setEstados(Object.fromEntries(data.map((s) => [s.id, { tipo: "cargando" } as Estado])));
      setMounted(true);

      data.forEach(async (salon) => {
        try {
          const r = await cargarSalon(salon);
          setEstados((prev) => ({
            ...prev,
            [salon.id]: r ? { tipo: "listo", datos: resumirSalon(salon, r.citas, r.gastos, r.comisiones, r.cierres, hoy) } : { tipo: "sin-datos" },
          }));
        } catch {
          setEstados((prev) => ({ ...prev, [salon.id]: { tipo: "sin-datos" } }));
        }
      });
    }
    load();
  }, [hoy]);

  const filas = useMemo(
    () =>
      salones
        .map((s) => estados[s.id])
        .filter((e): e is { tipo: "listo"; datos: DatosSalonInicio } => e?.tipo === "listo")
        .map((e) => e.datos),
    [salones, estados]
  );
  const pendientes = salones.filter((s) => estados[s.id]?.tipo === "cargando").length;
  const total = useMemo(() => consolidar(filas), [filas]);
  const alertas = useMemo(() => alertasInicio(filas), [filas]);
  const masClientasEnRiesgo = useMemo(
    () => filas.slice().sort((a, b) => b.salud.clientasEnRiesgo.length - a.salud.clientasEnRiesgo.length)[0],
    [filas]
  );
  const cierres = filas.map((f) => f.cierreSemanaPasada).filter((c): c is CierreSemana => !!c);
  const repartido = cierres.reduce((s, c) => s + Math.max(0, c.libre), 0);

  const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  const corteAnterior = `1–${Math.min(hoy.getDate(), new Date(hoy.getFullYear(), hoy.getMonth(), 0).getDate())} de ${MESES[(hoy.getMonth() + 11) % 12]}`;
  const listo = mounted && pendientes === 0;

  if (!mounted) {
    return (
      <main className="px-4 pt-14">
        <div className="skeleton h-6 w-32 mb-4" />
        <div className="skeleton h-8 w-48 mb-5" />
        <div className="skeleton h-52 w-full rounded-[22px] mb-3" />
        <div className="grid grid-cols-2 gap-2.5">
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 pt-4 pb-10">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center justify-between pt-2 pb-3.5">
          <span className="inline-flex items-center gap-1 font-brand text-[22px] font-extrabold tracking-[-0.035em] text-rosa leading-none">
            <MarcaApalabra size={20} />
            apalabra
          </span>
          <Link
            href="/salon/new"
            aria-label="Agregar salón"
            className="w-[38px] h-[38px] rounded-full bg-surface border border-border flex items-center justify-center active:scale-95 transition-transform"
          >
            <IconPlus size={18} />
          </Link>
        </div>
        <p className="text-[12px] text-text-secondary font-semibold">
          {DIAS[hoy.getDay()]} {hoy.getDate()} de {MESES[hoy.getMonth()]}
        </p>
        <h1 className="font-brand text-[30px] font-extrabold tracking-[-0.035em] leading-tight text-text-primary mb-4">Tus negocios</h1>
      </FadeIn>

      {salones.length === 0 ? (
        <FadeIn delay={0.15}>
          <EmptyState title="Sin salones" description="Agrega tu primer salón para comenzar a ver métricas" icon="💇‍♀️" />
        </FadeIn>
      ) : (
        <>
          {/* Panel de dinero (tinta): ingresos del mes de todos los salones */}
          <FadeIn delay={0.05}>
            <section className="relative overflow-hidden rounded-[22px] bg-tinta text-white p-[18px] mb-3">
              <div className="pointer-events-none absolute -right-16 -top-20 w-52 h-52 rounded-full bg-[radial-gradient(closest-side,rgba(217,0,122,0.5),transparent)]" />
              <div className="relative flex items-center justify-between gap-2 text-[12px] font-semibold text-white/75">
                <span>
                  Ingresos de {MESES[hoy.getMonth()]} · {salones.length} {salones.length === 1 ? "salón" : "salones"}
                </span>
                <span className="bg-white/[0.12] text-white text-[11px] px-2.5 py-0.5 rounded-full whitespace-nowrap">al día {hoy.getDate()}</span>
              </div>
              {listo ? (
                <>
                  <p className="relative font-numbers text-[40px] font-bold leading-none tracking-[-0.035em] mt-2.5 mb-1.5">{formatMoney(total.ingresos)}</p>
                  <p className="relative text-[12px] text-white/70 flex items-baseline gap-1.5 flex-wrap">
                    <Delta actual={total.ingresos} base={total.ingresosPrev} oscuro />
                    <span>vs. {corteAnterior}</span>
                  </p>
                  <div className="relative mt-3.5">
                    <div className="h-1.5 rounded-full bg-white/[0.14] overflow-hidden">
                      <div className="h-full rounded-full bg-rosa" style={{ width: `${(hoy.getDate() / diasMes) * 100}%` }} />
                    </div>
                    <p className="text-[12px] text-white/75 mt-1.5">
                      Al ritmo de hoy, {MESES[hoy.getMonth()]} cierra en <span className="font-numbers font-bold text-white">{formatMoney(total.proyeccion)}</span>
                    </p>
                  </div>
                  <div className="relative grid grid-cols-3 gap-2 mt-3.5 pt-3 border-t border-white/[0.14]">
                    <MiniCifra label="Utilidad" valor={formatMoney(total.utilidad)} />
                    <MiniCifra label="Margen" valor={`${total.margen.toFixed(1)}%`} />
                    <MiniCifra label="Libre semana" valor={formatMoney(total.libreSemana)} />
                  </div>
                </>
              ) : (
                <div className="relative mt-3 space-y-2">
                  <div className="h-10 w-48 rounded-[10px] bg-white/10 animate-pulse" />
                  <div className="h-4 w-40 rounded bg-white/10 animate-pulse" />
                  <p className="text-[12px] text-white/60 pt-2">
                    Cargando {pendientes} {pendientes === 1 ? "salón" : "salones"}…
                  </p>
                </div>
              )}
            </section>
          </FadeIn>

          {listo && filas.length > 0 && (
            <FadeIn delay={0.1}>
              <div className="grid grid-cols-2 gap-2.5 mb-2">
                <Mosaico label="Visitas del mes" valor={total.visitas.toLocaleString("es-MX")}>
                  <Delta actual={total.visitas} base={total.visitasPrev} referencia={`vs. ${MESES_CORTOS[(hoy.getMonth() + 11) % 12]}`} />
                </Mosaico>
                <Mosaico label="Ticket promedio" valor={formatMoney(total.ticket)}>
                  <Delta actual={total.ticket} base={total.ticketPrev} referencia={`vs. ${MESES_CORTOS[(hoy.getMonth() + 11) % 12]}`} />
                </Mosaico>
                <Mosaico label="Costo de personal" valor={`${total.costoPersonal.toFixed(0)}%`}>
                  <SemaforoChip
                    semaforo={total.costoPersonal > 55 ? "rojo" : total.costoPersonal >= 40 && total.costoPersonal <= 50 ? "verde" : "ambar"}
                    label="Ideal 40–50%"
                  />
                </Mosaico>
                {masClientasEnRiesgo ? (
                  <Link href={`/salon/${masClientasEnRiesgo.salon.id}?tab=salud`} className="block active:scale-[0.98] transition-transform">
                    <Mosaico label="Clientas por recuperar" valor={String(total.clientasEnRiesgo)}>
                      <span className="text-[11.5px] text-text-secondary leading-snug">
                        Valen {formatMoney(total.valorClientasEnRiesgo)} en su historial
                      </span>
                    </Mosaico>
                  </Link>
                ) : (
                  <Mosaico label="Clientas por recuperar" valor="0" />
                )}
              </div>
            </FadeIn>
          )}

          {/* Necesita tu atención */}
          {listo && (alertas.length > 0 || total.clientasEnRiesgo > 0 || cierres.length > 0) && (
            <FadeIn delay={0.15}>
              <h2 className="font-brand text-[18px] font-bold tracking-[-0.02em] text-text-primary mt-6 mb-2.5">Necesita tu atención</h2>
              <div className="space-y-2">
                {alertas.map((a) => {
                  const c = colorSemaforo(a.semaforo);
                  return (
                    <Link key={a.salonId} href={`/salon/${a.salonId}?tab=salud`} className="flex items-center gap-3 bg-surface border border-border rounded-[18px] p-3 active:scale-[0.99] transition-transform">
                      <span className="w-9 h-9 rounded-[12px] flex items-center justify-center flex-shrink-0" style={{ backgroundColor: c.bg, color: c.fg }}>
                        <IconAlert size={18} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13.5px] font-bold text-text-primary">
                          {a.salonNombre} <span style={{ color: c.fg }}>· {semaforoGlobalLabel(a.semaforo)}</span>
                        </span>
                        <span className="block text-[12px] text-text-secondary leading-snug">{a.texto}</span>
                      </span>
                      <IconChevronRight size={16} className="text-tinta/35 flex-shrink-0" />
                    </Link>
                  );
                })}

                {masClientasEnRiesgo && total.clientasEnRiesgo > 0 && (
                  <Link
                    href={`/salon/${masClientasEnRiesgo.salon.id}?tab=salud`}
                    className="flex items-center gap-3 bg-surface border border-border rounded-[18px] p-3 active:scale-[0.99] transition-transform"
                  >
                    <span className="w-9 h-9 rounded-[12px] bg-rubor text-rosa flex items-center justify-center flex-shrink-0">
                      <IconPerson size={18} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13.5px] font-bold text-text-primary">
                        {total.clientasEnRiesgo} {total.clientasEnRiesgo === 1 ? "clienta valiosa no ha vuelto" : "clientas valiosas no han vuelto"}
                      </span>
                      <span className="block text-[12px] text-text-secondary leading-snug">
                        Pasaron su día habitual de regreso. Empieza por {masClientasEnRiesgo.salon.nombre} ({masClientasEnRiesgo.salud.clientasEnRiesgo.length}).
                      </span>
                    </span>
                    <IconChevronRight size={16} className="text-tinta/35 flex-shrink-0" />
                  </Link>
                )}

                {cierres.length > 0 && (
                  <div className="flex items-center gap-3 bg-patio-soft border border-patio/40 rounded-[18px] p-3">
                    <span className="w-9 h-9 rounded-[12px] bg-patio text-tinta flex items-center justify-center flex-shrink-0">
                      <IconCheck size={18} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13.5px] font-bold text-text-primary">Semana pasada cerrada</span>
                      <span className="block text-[12px] text-text-secondary leading-snug">
                        Cerrada en {cierres.length} de {salones.length} {salones.length === 1 ? "salón" : "salones"}; se repartieron{" "}
                        <span className="font-numbers font-bold text-text-primary">{formatMoney(repartido)}</span> en bolsas.
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </FadeIn>
          )}

          {/* Tus salones */}
          <h2 className="font-brand text-[18px] font-bold tracking-[-0.02em] text-text-primary mt-6 mb-2.5">Tus salones</h2>
          <StaggerChildren className="space-y-2">
            {salones.map((salon) => (
              <StaggerItem key={salon.id}>
                <TarjetaSalon salon={salon} estado={estados[salon.id]} />
              </StaggerItem>
            ))}
          </StaggerChildren>

          {/* Comparativo */}
          {listo && filas.length > 1 && (
            <FadeIn delay={0.2}>
              <h2 className="font-brand text-[18px] font-bold tracking-[-0.02em] text-text-primary mt-6 mb-2.5">
                Comparativo de {MESES[hoy.getMonth()]}
              </h2>
              <Comparativo filas={filas} />
            </FadeIn>
          )}
        </>
      )}

      {/* Footer */}
      <FadeIn delay={0.3}>
        <div className="mt-10">
          <UpdateButton />
        </div>
        <p className="text-center text-[11px] text-text-secondary/60 mt-4">apalabra © {hoy.getFullYear()}</p>
      </FadeIn>
    </main>
  );
}

function MiniCifra({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="min-w-0">
      <span className="block text-[11px] text-white/60">{label}</span>
      <span className="block font-numbers text-[16px] font-bold whitespace-nowrap">{valor}</span>
    </div>
  );
}

function Mosaico({ label, valor, children }: { label: string; valor: string; children?: React.ReactNode }) {
  return (
    <div className="h-full bg-surface border border-border rounded-[18px] px-3.5 py-3 flex flex-col gap-0.5">
      <span className="text-[12px] text-text-secondary font-medium">{label}</span>
      <span className="font-numbers text-[22px] font-bold tracking-[-0.025em] text-text-primary leading-tight">{valor}</span>
      {children && <div>{children}</div>}
    </div>
  );
}

function Sparkline({ valores }: { valores: number[] }) {
  const w = 132;
  const h = 34;
  const max = Math.max(...valores);
  const min = Math.min(...valores);
  const r = max - min || 1;
  const pts = valores.map((v, i) => [(i / Math.max(1, valores.length - 1)) * (w - 6) + 3, h - 4 - ((v - min) / r) * (h - 10)]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const ultimo = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="flex-shrink-0" aria-hidden="true">
      <path d={`${d} L${ultimo[0].toFixed(1)} ${h} L${pts[0][0].toFixed(1)} ${h} Z`} fill="#D9007A" opacity={0.08} />
      <path d={d} fill="none" stroke="#D9007A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={ultimo[0]} cy={ultimo[1]} r={3} fill="#D9007A" />
    </svg>
  );
}

function TarjetaSalon({ salon, estado }: { salon: Salon; estado?: Estado }) {
  const datos = estado?.tipo === "listo" ? estado.datos : null;
  const mes = new Date().getMonth();
  const MES = MESES_CORTOS[mes];
  const MES_ANTERIOR = MESES_CORTOS[(mes + 11) % 12];
  return (
    <Link href={`/salon/${salon.id}`} className="block">
      <div className="bg-surface rounded-card border border-border p-3.5 active:scale-[0.985] transition-transform">
        <div className="flex items-center gap-2.5">
          <SalonAvatar nombre={salon.nombre} color={salon.color} size={40} />
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-bold text-text-primary truncate leading-tight">{salon.nombre}</h3>
            <p className="text-[11.5px] text-text-secondary">
              {salon.bolsas.length} bolsas · {salon.dataSource === "neon" ? "Base de datos" : "Google Sheets"}
            </p>
          </div>
          {datos && <SemaforoChip semaforo={datos.salud.semaforoGlobal} />}
        </div>

        {!estado || estado.tipo === "cargando" ? (
          <div className="grid grid-cols-2 gap-2.5 mt-3">
            <div className="skeleton h-12" />
            <div className="skeleton h-12" />
          </div>
        ) : !datos ? (
          <p className="text-[12px] text-text-secondary mt-3">Sin datos de citas: revisa la fuente de datos en Configuración.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5 mt-3">
              <div>
                <span className="block text-[11.5px] text-text-secondary">Ingresos {MES}</span>
                <span className="block font-numbers text-[20px] font-bold tracking-[-0.02em] text-text-primary">{formatMoney(datos.salud.ingresosMes)}</span>
                <Delta actual={datos.salud.ingresosMes} base={datos.saludPrev.ingresosMes} referencia={`vs. ${MES_ANTERIOR}`} />
              </div>
              <div>
                <span className="block text-[11.5px] text-text-secondary">Utilidad</span>
                <span className="block font-numbers text-[20px] font-bold tracking-[-0.02em] text-text-primary">{formatMoney(datos.salud.utilidad)}</span>
                <span className="block text-[11.5px] text-text-secondary">margen {datos.salud.margenNeto.valor.toFixed(1)}%</span>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2.5 mt-3 border-t border-border">
              <Sparkline valores={datos.ingresosSemanas} />
              <span className="min-w-0">
                <span className="block text-[11px] text-text-secondary">Ingresos · últimas 8 semanas</span>
                <span className="block text-[11.5px] text-text-secondary">
                  Libre esta semana <span className="font-numbers font-bold text-text-primary">{formatMoney(datos.libreSemana)}</span>
                </span>
              </span>
            </div>
          </>
        )}
      </div>
    </Link>
  );
}

function Comparativo({ filas }: { filas: DatosSalonInicio[] }) {
  const k = (v: number) => (v >= 100000 ? `$${Math.round(v / 1000)}k` : v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : formatMoney(v));
  const renglones: { label: string; valor: (f: DatosSalonInicio) => string; sem?: (f: DatosSalonInicio) => Semaforo }[] = [
    { label: "Ingresos", valor: (f) => k(f.salud.ingresosMes) },
    { label: "Margen", valor: (f) => `${f.salud.margenNeto.valor.toFixed(0)}%`, sem: (f) => f.salud.margenNeto.semaforo },
    { label: "Personal", valor: (f) => `${f.salud.costoPersonal.valor.toFixed(0)}%`, sem: (f) => f.salud.costoPersonal.semaforo },
    { label: "Renta", valor: (f) => `${f.salud.rentaPct.valor.toFixed(0)}%`, sem: (f) => f.salud.rentaPct.semaforo },
    { label: "Equilibrio", valor: (f) => `${f.salud.puntoEquilibrio.valor.toFixed(1)}×`, sem: (f) => f.salud.puntoEquilibrio.semaforo },
    { label: "Ticket", valor: (f) => formatMoney(f.salud.ticketPromedio.valor), sem: (f) => f.salud.ticketPromedio.semaforo },
    { label: "Recurrente", valor: (f) => `${f.salud.ingresoRecurrente.valor.toFixed(0)}%`, sem: (f) => f.salud.ingresoRecurrente.semaforo },
  ];
  return (
    <div className="bg-surface border border-border rounded-card p-3.5 overflow-x-auto">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr>
            <th />
            {filas.map((f) => (
              <th key={f.salon.id} className="pb-2 text-right font-semibold">
                <span className="inline-flex justify-end w-full">
                  <SalonAvatar nombre={f.salon.nombre} color={f.salon.color} size={26} />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {renglones.map((r) => (
            <tr key={r.label} className="border-t border-border">
              <td className="py-2 text-text-secondary font-medium">{r.label}</td>
              {filas.map((f) => (
                <td key={f.salon.id} className="py-2 pl-2 text-right font-numbers font-semibold text-text-primary whitespace-nowrap">
                  {r.sem && (
                    <span
                      className="inline-block w-[7px] h-[7px] rounded-full mr-1.5 align-[1px]"
                      style={{ backgroundColor: colorSemaforo(r.sem(f)).fg }}
                    />
                  )}
                  {r.valor(f)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5 text-[11px] text-text-secondary">
        {filas.map((f) => (
          <span key={f.salon.id} className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: f.salon.color }} />
            {f.salon.nombre}
          </span>
        ))}
      </p>
    </div>
  );
}
