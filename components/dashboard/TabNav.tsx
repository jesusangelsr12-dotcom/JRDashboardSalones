"use client";

import {
  IconTabResumen,
  IconTabCierres,
  IconTabSalud,
  IconTabGraficas,
  IconTabMovimientos,
} from "@/components/ui/Icons";

export type TabId = "resumen" | "bolsas" | "graficas" | "tabla" | "salud";

interface TabNavProps {
  active: TabId;
  onChange: (tab: TabId) => void;
}

// Los TabId internos no cambian; solo las etiquetas: Bolsas → Cierres, Tabla → Movimientos.
const TABS: { id: TabId; label: string; Icon: (p: { size?: number }) => JSX.Element }[] = [
  { id: "resumen", label: "Resumen", Icon: IconTabResumen },
  { id: "bolsas", label: "Cierres", Icon: IconTabCierres },
  { id: "salud", label: "Salud", Icon: IconTabSalud },
  { id: "graficas", label: "Gráficas", Icon: IconTabGraficas },
  { id: "tabla", label: "Movimientos", Icon: IconTabMovimientos },
];

export const TAB_IDS = TABS.map((t) => t.id);

// Barra inferior fija, al alcance del pulgar.
export default function TabNav({ active, onChange }: TabNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-app z-40 bg-surface/95 backdrop-blur-md border-t border-border grid grid-cols-5 px-1 pt-2"
      style={{ paddingBottom: "calc(0.6rem + var(--safe-area-bottom))" }}
      aria-label="Secciones del salón"
    >
      {TABS.map(({ id, label, Icon }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            aria-current={isActive ? "page" : undefined}
            className={`flex flex-col items-center gap-[3px] text-[11px] font-display font-semibold transition-colors ${
              isActive ? "text-rosa" : "text-text-secondary"
            }`}
          >
            <Icon size={23} />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
