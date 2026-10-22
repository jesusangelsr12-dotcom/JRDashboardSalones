"use client";

// Íconos de línea (24×24, trazo de 2 px) usados en toda la app.
type IconProps = { size?: number; className?: string; strokeWidth?: number };

function base(paths: React.ReactNode, { size = 18, className = "", strokeWidth = 2 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
}

export const IconBack = (p: IconProps) => base(<path d="M15 5l-7 7 7 7" />, p);
export const IconChevronRight = (p: IconProps) => base(<path d="M9 5l7 7-7 7" />, p);
export const IconChevronLeft = (p: IconProps) => base(<path d="M15 6l-6 6 6 6" />, p);
export const IconChevronDown = (p: IconProps) => base(<path d="M6 9l6 6 6-6" />, p);
export const IconPlus = (p: IconProps) => base(<path d="M12 5v14M5 12h14" />, p);
export const IconCheck = (p: IconProps) => base(<path d="M20 6L9 17l-5-5" />, { strokeWidth: 2.6, ...p });
export const IconCopy = (p: IconProps) =>
  base(
    <>
      <rect x="9" y="9" width="12" height="12" rx="2.5" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>,
    p
  );
export const IconSearch = (p: IconProps) =>
  base(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>,
    p
  );
export const IconChat = (p: IconProps) => base(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />, p);
export const IconArrowUp = (p: IconProps) => base(<path d="M12 19V5M6 11l6-6 6 6" />, { strokeWidth: 2.4, ...p });
export const IconArrowDown = (p: IconProps) => base(<path d="M12 5v14M6 13l6 6 6-6" />, { strokeWidth: 2.4, ...p });
export const IconDownload = (p: IconProps) => base(<path d="M12 3v12M7 10l5 5 5-5M4 19h16" />, p);
export const IconSwap = (p: IconProps) => base(<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />, p);
export const IconAlert = (p: IconProps) =>
  base(
    <>
      <path d="M12 4l9.5 16.5h-19z" />
      <path d="M12 10v4.5M12 17.6v.1" />
    </>,
    { strokeWidth: 2.2, ...p }
  );
export const IconPerson = (p: IconProps) =>
  base(
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </>,
    p
  );
export const IconGear = (p: IconProps) =>
  base(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>,
    p
  );

// ── Barra inferior ──
export const IconTabResumen = (p: IconProps) =>
  base(
    <>
      <rect x="3" y="3" width="7.5" height="9" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="5" rx="2" />
      <rect x="13.5" y="11" width="7.5" height="10" rx="2" />
      <rect x="3" y="15" width="7.5" height="6" rx="2" />
    </>,
    p
  );
export const IconTabCierres = (p: IconProps) =>
  base(
    <>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19a1 1 0 0 1 1 1v3" />
      <path d="M4 7.5V18a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 1 4 7.5z" />
      <circle cx="16.5" cy="14.5" r="1.3" fill="currentColor" />
    </>,
    p
  );
export const IconTabSalud = (p: IconProps) =>
  base(
    <>
      <path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 22l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
      <path d="M3.5 12h4l2-3 3 6 2-3h6" />
    </>,
    p
  );
export const IconTabGraficas = (p: IconProps) => base(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />, p);
export const IconTabMovimientos = (p: IconProps) =>
  base(
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <circle cx="3.5" cy="6" r="1" fill="currentColor" />
      <circle cx="3.5" cy="12" r="1" fill="currentColor" />
      <circle cx="3.5" cy="18" r="1" fill="currentColor" />
    </>,
    p
  );

// ── KPIs de Salud ──
export const IconKpiMargen = (p: IconProps) =>
  base(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9.5c-.6-1-1.7-1.5-3-1.5-1.7 0-3 .9-3 2.2 0 3 6 1.6 6 4.6 0 1.3-1.3 2.2-3 2.2-1.4 0-2.5-.6-3.1-1.6M12 6v2M12 16.9V18" />
    </>,
    p
  );
export const IconKpiPersonal = (p: IconProps) =>
  base(
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <circle cx="17.5" cy="9" r="2.4" />
      <path d="M15.8 14.3c3 .1 5.7 2.2 5.7 5.7" />
    </>,
    p
  );
export const IconKpiRenta = (p: IconProps) =>
  base(
    <>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-5h4v5" />
    </>,
    p
  );
export const IconKpiRetencion = (p: IconProps) =>
  base(
    <>
      <path d="M3 12a9 9 0 0 1 15.4-6.4L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.4 6.4L3 16" />
      <path d="M3 21v-5h5" />
    </>,
    p
  );
export const IconKpiRecurrente = (p: IconProps) => base(<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />, p);
export const IconKpiFrecuencia = (p: IconProps) =>
  base(
    <>
      <rect x="3" y="4.5" width="18" height="16" rx="3" />
      <path d="M8 2.5v4M16 2.5v4M3 10h18" />
    </>,
    p
  );

// Símbolo de apalabra: burbuja con palomita (logo de dos colores).
export function MarcaApalabra({ size = 20, burbuja = "#D9007A", palomita = "#FFFFFF" }: { size?: number; burbuja?: string; palomita?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M18 6H46A14 14 0 0 1 60 20V36A14 14 0 0 1 46 50H30L16 60V50A12 12 0 0 1 4 38V20A14 14 0 0 1 18 6Z" fill={burbuja} />
      <path d="M19.5 28.5L28 37L44.5 20.5" fill="none" stroke={palomita} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
