"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Salon } from "@/lib/types";
import type { Semaforo } from "@/lib/salud";
import { rangoSemanaActual } from "@/lib/calculations";
import { getSalones } from "@/lib/store";
import Modal from "@/components/ui/Modal";
import { SalonAvatar, SemaforoChip } from "@/components/ui/Primitives";
import { IconBack, IconChevronDown, IconChevronRight, IconDownload, IconGear, IconSwap } from "@/components/ui/Icons";

interface DashboardHeaderProps {
  salon: Salon;
  semaforo?: Semaforo;
  tab?: string;
  onExport?: () => void;
}

export default function DashboardHeader({ salon, semaforo, tab, onExport }: DashboardHeaderProps) {
  const router = useRouter();
  const semana = rangoSemanaActual();
  const [hoja, setHoja] = useState<"menu" | "salones" | null>(null);
  const [salones, setSalones] = useState<Salon[] | null>(null);

  const abrirSalones = async () => {
    setHoja("salones");
    if (!salones) {
      const { salones: lista } = await getSalones();
      setSalones(lista);
    }
  };

  const irASalon = (id: string) => {
    setHoja(null);
    if (id !== salon.id) router.push(`/salon/${id}${tab ? `?tab=${tab}` : ""}`);
  };

  const btn = "w-[38px] h-[38px] rounded-full bg-surface border border-border flex items-center justify-center active:scale-95 transition-transform";

  return (
    <header className="pt-3 pb-1">
      {/* Nav row */}
      <div className="flex items-center gap-2.5 mb-3">
        <Link href="/" className={btn} aria-label="Inicio">
          <IconBack size={18} />
        </Link>
        <span className="flex-1 text-[13px] font-display font-semibold text-text-secondary">Inicio</span>
        <button onClick={() => setHoja("menu")} className={btn} aria-label="Más opciones">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="19" cy="12" r="1.8" />
          </svg>
        </button>
      </div>

      {/* Identidad del salón: tocarla cambia de salón */}
      <button onClick={abrirSalones} className="w-full flex items-center gap-3 text-left mb-3">
        <SalonAvatar nombre={salon.nombre} color={salon.color} size={44} />
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-1 font-brand text-[21px] font-extrabold tracking-[-0.03em] leading-tight text-text-primary">
            <span className="truncate">{salon.nombre}</span>
            <IconChevronDown size={14} className="text-text-secondary flex-shrink-0" />
          </span>
          <span className="block text-[12px] text-text-secondary">Semana {semana.label}</span>
        </span>
        {semaforo && <SemaforoChip semaforo={semaforo} />}
      </button>

      <Modal open={hoja === "menu"} onClose={() => setHoja(null)}>
        <h3 className="font-brand text-[20px] font-extrabold tracking-[-0.025em] text-text-primary mb-2">{salon.nombre}</h3>
        <MenuItem icon={<IconGear size={19} />} label="Configuración del salón" onClick={() => router.push(`/salon/${salon.id}/config`)} />
        {onExport && (
          <MenuItem
            icon={<IconDownload size={19} />}
            label="Descargar Excel"
            onClick={() => {
              setHoja(null);
              onExport();
            }}
          />
        )}
        <MenuItem icon={<IconSwap size={19} />} label="Cambiar de salón" onClick={abrirSalones} />
      </Modal>

      <Modal open={hoja === "salones"} onClose={() => setHoja(null)}>
        <h3 className="font-brand text-[20px] font-extrabold tracking-[-0.025em] text-text-primary mb-3">Cambiar de salón</h3>
        {!salones ? (
          <div className="space-y-2">
            <div className="skeleton h-14" />
            <div className="skeleton h-14" />
          </div>
        ) : (
          <div className="space-y-1">
            {salones.map((s) => (
              <button
                key={s.id}
                onClick={() => irASalon(s.id)}
                className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-[14px] text-left transition-colors ${
                  s.id === salon.id ? "bg-bg" : "active:bg-bg"
                }`}
              >
                <SalonAvatar nombre={s.nombre} color={s.color} size={36} />
                <span className="flex-1 min-w-0 text-[14px] font-display font-semibold text-text-primary truncate">{s.nombre}</span>
                {s.id === salon.id ? (
                  <span className="text-[11px] font-display font-bold text-rosa">Actual</span>
                ) : (
                  <IconChevronRight size={15} className="text-text-secondary" />
                )}
              </button>
            ))}
          </div>
        )}
      </Modal>
    </header>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-3.5 px-1 border-b border-border last:border-b-0 text-left text-[14px] font-display font-semibold text-text-primary active:bg-bg transition-colors"
    >
      <span className="text-text-secondary">{icon}</span>
      <span className="flex-1">{label}</span>
      <IconChevronRight size={15} className="text-text-secondary" />
    </button>
  );
}
