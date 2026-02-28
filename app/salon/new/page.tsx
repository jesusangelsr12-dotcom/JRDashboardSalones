"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import type { Salon } from "@/lib/types";
import { addSalon, crearBolsasPlantilla } from "@/lib/store";

const COLORES = [
  "#2563EB", "#059669", "#DC2626", "#7C3AED",
  "#DB2777", "#EA580C", "#0891B2", "#4F46E5",
  "#16A34A", "#CA8A04", "#0D9488", "#9333EA",
];

export default function NuevoSalonPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState("#2563EB");
  const [sheetId, setSheetId] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!nombre.trim() || creating) return;
    setCreating(true);

    const salon: Salon = {
      id: uuidv4(),
      nombre: nombre.trim(),
      color,
      sheetId: sheetId.trim(),
      bolsas: crearBolsasPlantilla(),
      gastosFijos: [],
      bolsaDefaultGastosId: null,
      createdAt: new Date().toISOString(),
    };

    await addSalon(salon);
    router.push(`/salon/${salon.id}`);
  };

  return (
    <main className="p-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2 pt-4">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-surface border border-border flex items-center justify-center active:scale-95 transition-transform"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M10 3L5 8L10 13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h1 className="text-xl font-bold font-display text-text-primary">
          Nuevo salón
        </h1>
      </div>

      <p className="text-[13px] text-text-secondary font-display mb-8 ml-12">
        Paso {step} de 2
      </p>

      {step === 1 && (
        <section>
          {/* Nombre */}
          <div className="mb-6">
            <label className="text-[11px] uppercase tracking-[0.08em] text-text-secondary font-display font-medium mb-2 block">
              Nombre del salón
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Martha Rdz Stylist"
              autoFocus
              className="w-full bg-surface border border-border rounded-card px-4 py-3.5 text-[16px] font-display text-text-primary placeholder:text-text-secondary/40 outline-none focus:border-text-secondary transition-colors"
            />
          </div>

          {/* Color */}
          <div className="mb-8">
            <label className="text-[11px] uppercase tracking-[0.08em] text-text-secondary font-display font-medium mb-3 block">
              Color de identificación
            </label>
            <div className="flex gap-3 flex-wrap">
              {COLORES.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-10 h-10 rounded-full transition-all ${
                    color === c
                      ? "scale-110 ring-2 ring-offset-2 ring-offset-bg"
                      : "opacity-60 hover:opacity-100"
                  }`}
                  style={{
                    backgroundColor: c,
                    ["--tw-ring-color" as string]: color === c ? c : undefined,
                  } as React.CSSProperties}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div
            className="bg-surface rounded-card border border-border p-5 mb-8"
            style={{ borderTopColor: color, borderTopWidth: 3 }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-[15px] font-display font-semibold text-text-primary">
                {nombre || "Nombre del salón"}
              </span>
            </div>
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!nombre.trim()}
            className={`w-full py-3.5 rounded-card text-[14px] font-display font-semibold text-white active:scale-[0.98] transition-all ${
              !nombre.trim() ? "opacity-40" : ""
            }`}
            style={{ backgroundColor: color }}
          >
            Siguiente
          </button>
        </section>
      )}

      {step === 2 && (
        <section>
          {/* Sheet ID */}
          <div className="mb-6">
            <label className="text-[11px] uppercase tracking-[0.08em] text-text-secondary font-display font-medium mb-2 block">
              Google Sheet ID
            </label>
            <input
              type="text"
              value={sheetId}
              onChange={(e) => setSheetId(e.target.value)}
              placeholder="1BxiMkKeFjR..."
              autoFocus
              className="w-full bg-surface border border-border rounded-card px-4 py-3.5 text-[14px] font-mono text-text-primary placeholder:text-text-secondary/40 outline-none focus:border-text-secondary transition-colors"
            />
            <p className="text-[11px] text-text-secondary font-display mt-2">
              Encuéntralo en la URL de tu Google Sheet entre /d/ y /edit
            </p>
          </div>

          {/* Info card */}
          <div className="bg-bg rounded-card border border-border p-4 mb-8">
            <p className="text-[12px] font-display text-text-secondary leading-relaxed">
              Se crearán <strong className="text-text-primary">4 bolsas</strong> con
              la distribución plantilla (55% materiales, 30% sueldo, 10% ahorro,
              5% admin). Puedes cambiarlas después en configuración.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 py-3.5 rounded-card border border-border text-[14px] font-display font-medium text-text-secondary active:scale-[0.98] transition-transform"
            >
              Atrás
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex-1 py-3.5 rounded-card text-[14px] font-display font-semibold text-white active:scale-[0.98] transition-all"
              style={{ backgroundColor: color }}
            >
              {creating ? "Creando..." : "Crear salón"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
