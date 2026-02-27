"use client";

export type TabId = "resumen" | "bolsas" | "graficas" | "tabla";

interface TabNavProps {
  active: TabId;
  onChange: (tab: TabId) => void;
  salonColor: string;
}

const TABS: { id: TabId; label: string }[] = [
  { id: "resumen", label: "Resumen" },
  { id: "bolsas", label: "Bolsas" },
  { id: "graficas", label: "Gráficas" },
  { id: "tabla", label: "Tabla" },
];

export default function TabNav({ active, onChange, salonColor }: TabNavProps) {
  return (
    <nav className="flex gap-1 bg-bg rounded-[10px] p-1 mb-6">
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex-1 py-2 text-[13px] font-display font-medium rounded-[8px] transition-all duration-200 ${
              isActive
                ? "text-white shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
            style={
              isActive ? { backgroundColor: salonColor } : undefined
            }
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
