"use client";

import type { Semaforo } from "@/lib/salud";
import { colorSemaforo } from "@/lib/salud";
import { IconChevronLeft, IconChevronRight } from "./Icons";

// ── Chip de semáforo (Sano / Atento / Riesgo / Sin datos) ──
export function SemaforoChip({ semaforo, label, size = "sm" }: { semaforo: Semaforo; label?: string; size?: "sm" | "lg" }) {
  const c = colorSemaforo(semaforo);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-display font-bold whitespace-nowrap flex-shrink-0 ${
        size === "lg" ? "text-[13px] px-3.5 py-1.5" : "text-[11px] px-2 py-0.5"
      }`}
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      <span className={`rounded-full ${size === "lg" ? "w-2 h-2" : "w-1.5 h-1.5"}`} style={{ backgroundColor: c.fg }} />
      {label ?? c.label}
    </span>
  );
}

// Etiqueta global del semáforo del salón
export function semaforoGlobalLabel(s: Semaforo): string {
  return s === "verde" ? "Salón sano" : s === "ambar" ? "Atención" : s === "rojo" ? "En riesgo" : "Sin datos";
}

// ── Avatar del salón: el color del salón solo vive aquí ──
export function iniciales(nombre: string): string {
  return nombre.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function SalonAvatar({ nombre, color, size = 40 }: { nombre: string; color: string; size?: number }) {
  return (
    <span
      className="rounded-full inline-flex items-center justify-center text-white font-brand font-bold flex-shrink-0 leading-none"
      style={{ width: size, height: size, backgroundColor: color, fontSize: Math.round(size * 0.36) }}
    >
      {iniciales(nombre)}
    </span>
  );
}

// ── Variación porcentual ▲ / ▼ ──
export function Delta({
  actual,
  base,
  invertir = false,
  referencia,
  oscuro = false,
}: {
  actual: number;
  base: number;
  invertir?: boolean;
  referencia?: string;
  oscuro?: boolean;
}) {
  if (!base) return null;
  const d = ((actual - base) / base) * 100;
  const ref = referencia ? <span className={`font-medium ${oscuro ? "text-white/65" : "text-text-secondary"}`}> {referencia}</span> : null;
  if (Math.abs(d) < 0.5) {
    return (
      <span className={`text-[11.5px] font-bold whitespace-nowrap ${oscuro ? "text-white/70" : "text-text-secondary"}`}>
        = 0%{ref}
      </span>
    );
  }
  const bueno = invertir ? d <= 0 : d >= 0;
  const color = oscuro ? (bueno ? "text-[#7BE3B6]" : "text-[#FF9C92]") : bueno ? "text-entra" : "text-sale";
  return (
    <span className={`text-[11.5px] font-bold whitespace-nowrap ${color}`}>
      {d >= 0 ? "▲" : "▼"} {Math.abs(d).toFixed(0)}%{ref}
    </span>
  );
}

// ── Control segmentado ──
export function Segmented<T extends string>({
  opciones,
  valor,
  onChange,
  className = "",
}: {
  opciones: { id: T; label: string }[];
  valor: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`flex gap-[3px] bg-tinta/[0.06] rounded-[13px] p-[3px] ${className}`} role="tablist">
      {opciones.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={valor === o.id}
          onClick={() => onChange(o.id)}
          className={`flex-1 py-[7px] px-2 rounded-[10px] text-[12.5px] font-display font-semibold whitespace-nowrap transition-all ${
            valor === o.id ? "bg-surface text-text-primary shadow-[0_1px_3px_rgba(28,11,20,0.14)]" : "text-text-secondary"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Primera letra en mayúscula ("octubre de 2026" → "Octubre de 2026")
export function mayuscula(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ── Navegación de periodo ‹ Octubre 2026 › ──
export function PeriodNav({
  label,
  onPrev,
  onNext,
  canPrev = true,
  canNext = true,
  prevLabel = "Anterior",
  nextLabel = "Siguiente",
  card = false,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  canPrev?: boolean;
  canNext?: boolean;
  prevLabel?: string;
  nextLabel?: string;
  card?: boolean;
}) {
  const btn =
    "w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center active:scale-90 transition-transform disabled:opacity-30";
  return (
    <div
      className={`flex items-center justify-between gap-3 ${
        card ? "bg-surface border border-border rounded-card px-2.5 py-2" : "max-w-[300px] mx-auto"
      }`}
    >
      <button aria-label={prevLabel} onClick={onPrev} disabled={!canPrev} className={btn}>
        <IconChevronLeft size={15} />
      </button>
      <span className="flex-1 text-center text-[14px] font-display font-bold text-text-primary">{mayuscula(label)}</span>
      <button aria-label={nextLabel} onClick={onNext} disabled={!canNext} className={btn}>
        <IconChevronRight size={15} />
      </button>
    </div>
  );
}

// ── Etiqueta de sección ──
export function SectionLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[11px] uppercase tracking-[0.07em] text-text-secondary font-display font-bold ${className}`}>{children}</p>
  );
}

// Colores por método de pago (identidad, no estado)
export const METODO_COLOR: Record<string, string> = {
  Efectivo: "#D9007A",
  Tarjeta: "#1C0B14",
  Transferencia: "#E0A100",
};
