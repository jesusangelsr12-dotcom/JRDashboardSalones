"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import type { Salon, Bolsa, GastoFijo } from "@/lib/types";
import { getSalon, updateSalon, deleteSalon } from "@/lib/store";
import Modal from "@/components/ui/Modal";

const COLORES = [
  "#2563EB", "#059669", "#DC2626", "#7C3AED",
  "#DB2777", "#EA580C", "#0891B2", "#4F46E5",
  "#16A34A", "#CA8A04", "#0D9488", "#9333EA",
];

export default function SalonConfigPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [salon, setSalon] = useState<Salon | null>(null);
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState("#2563EB");
  const [sheetId, setSheetId] = useState("");
  const [bolsas, setBolsas] = useState<Bolsa[]>([]);
  const [gastosFijos, setGastosFijos] = useState<GastoFijo[]>([]);
  const [showDelete, setShowDelete] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const s = getSalon(params.id);
    if (s) {
      setSalon(s);
      setNombre(s.nombre);
      setColor(s.color);
      setSheetId(s.sheetId);
      setBolsas(s.bolsas);
      setGastosFijos(s.gastosFijos);
    }
  }, [params.id]);

  const handleSave = () => {
    if (!salon) return;
    const updated: Salon = {
      ...salon,
      nombre,
      color,
      sheetId,
      bolsas,
      gastosFijos,
    };
    updateSalon(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDelete = () => {
    deleteSalon(params.id);
    router.push("/");
  };

  // Bolsa helpers
  const addBolsa = () => {
    setBolsas([
      ...bolsas,
      {
        id: uuidv4(),
        nombre: "",
        porcentaje: 0,
        color: COLORES[bolsas.length % COLORES.length],
        acumulado: 0,
      },
    ]);
  };

  const updateBolsa = (index: number, field: keyof Bolsa, value: string | number) => {
    const updated = [...bolsas];
    updated[index] = { ...updated[index], [field]: value };
    setBolsas(updated);
  };

  const removeBolsa = (index: number) => {
    setBolsas(bolsas.filter((_, i) => i !== index));
  };

  // Gasto fijo helpers
  const addGastoFijo = () => {
    setGastosFijos([
      ...gastosFijos,
      { id: uuidv4(), nombre: "", monto: 0, frecuencia: "mensual" },
    ]);
  };

  const updateGastoFijo = (
    index: number,
    field: keyof GastoFijo,
    value: string | number
  ) => {
    const updated = [...gastosFijos];
    updated[index] = { ...updated[index], [field]: value };
    setGastosFijos(updated);
  };

  const removeGastoFijo = (index: number) => {
    setGastosFijos(gastosFijos.filter((_, i) => i !== index));
  };

  const totalPorcentaje = bolsas.reduce((s, b) => s + b.porcentaje, 0);

  if (!salon) {
    return (
      <main className="p-6 pt-14">
        <div className="skeleton h-6 w-48 mb-4" />
        <div className="skeleton h-40 w-full" />
      </main>
    );
  }

  return (
    <main className="p-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8 pt-4">
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
          Configuración
        </h1>
      </div>

      {/* General */}
      <section className="mb-8">
        <h2 className="text-[11px] uppercase tracking-[0.08em] text-text-secondary font-display font-medium mb-3">
          General
        </h2>

        <div className="bg-surface rounded-card border border-border p-4 space-y-4">
          {/* Nombre */}
          <div>
            <label className="text-[12px] font-display text-text-secondary mb-1 block">
              Nombre del salón
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full bg-bg border border-border rounded-[8px] px-3 py-2 text-[14px] font-display text-text-primary outline-none focus:border-text-secondary transition-colors"
            />
          </div>

          {/* Color */}
          <div>
            <label className="text-[12px] font-display text-text-secondary mb-2 block">
              Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {COLORES.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    color === c ? "scale-110 ring-2 ring-offset-2 ring-offset-bg" : ""
                  }`}
                  style={{
                    backgroundColor: c,
                    ringColor: color === c ? c : undefined,
                  } as React.CSSProperties}
                />
              ))}
            </div>
          </div>

          {/* Sheet ID */}
          <div>
            <label className="text-[12px] font-display text-text-secondary mb-1 block">
              Google Sheet ID
            </label>
            <input
              type="text"
              value={sheetId}
              onChange={(e) => setSheetId(e.target.value)}
              placeholder="1BxiM..."
              className="w-full bg-bg border border-border rounded-[8px] px-3 py-2 text-[13px] font-mono text-text-primary placeholder:text-text-secondary/40 outline-none focus:border-text-secondary transition-colors"
            />
          </div>
        </div>
      </section>

      {/* Bolsas */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] uppercase tracking-[0.08em] text-text-secondary font-display font-medium">
            Bolsas ({totalPorcentaje}%)
          </h2>
          <button
            onClick={addBolsa}
            className="text-[12px] font-display font-medium px-3 py-1 rounded-full"
            style={{ backgroundColor: color + "14", color }}
          >
            + Agregar
          </button>
        </div>

        {totalPorcentaje !== 100 && bolsas.length > 0 && (
          <p className="text-[11px] text-amber-600 font-mono mb-2">
            Los porcentajes suman {totalPorcentaje}% (deberían sumar 100%)
          </p>
        )}

        <div className="space-y-3">
          {bolsas.map((bolsa, i) => (
            <div
              key={bolsa.id}
              className="bg-surface rounded-card border border-border p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: bolsa.color }}
                />
                <input
                  type="text"
                  value={bolsa.nombre}
                  onChange={(e) => updateBolsa(i, "nombre", e.target.value)}
                  placeholder="Nombre de bolsa"
                  className="flex-1 bg-transparent text-[14px] font-display font-medium text-text-primary outline-none"
                />
                <button
                  onClick={() => removeBolsa(i)}
                  className="text-red-400 text-[18px] leading-none px-1"
                >
                  ×
                </button>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[10px] text-text-secondary font-display block mb-1">
                    Porcentaje
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={bolsa.porcentaje}
                      onChange={(e) =>
                        updateBolsa(i, "porcentaje", Number(e.target.value))
                      }
                      className="w-16 bg-bg border border-border rounded-[6px] px-2 py-1.5 text-[13px] font-mono text-text-primary outline-none"
                    />
                    <span className="text-[12px] text-text-secondary font-mono">%</span>
                  </div>
                </div>

                <div className="flex-1">
                  <label className="text-[10px] text-text-secondary font-display block mb-1">
                    Color
                  </label>
                  <div className="flex gap-1.5">
                    {COLORES.slice(0, 6).map((c) => (
                      <button
                        key={c}
                        onClick={() => updateBolsa(i, "color", c)}
                        className={`w-6 h-6 rounded-full ${
                          bolsa.color === c ? "ring-1 ring-offset-1" : ""
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Gastos Fijos */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] uppercase tracking-[0.08em] text-text-secondary font-display font-medium">
            Gastos fijos
          </h2>
          <button
            onClick={addGastoFijo}
            className="text-[12px] font-display font-medium px-3 py-1 rounded-full"
            style={{ backgroundColor: color + "14", color }}
          >
            + Agregar
          </button>
        </div>

        <div className="space-y-3">
          {gastosFijos.map((gf, i) => (
            <div
              key={gf.id}
              className="bg-surface rounded-card border border-border p-4 flex items-center gap-3"
            >
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={gf.nombre}
                  onChange={(e) => updateGastoFijo(i, "nombre", e.target.value)}
                  placeholder="Ej: Renta"
                  className="w-full bg-transparent text-[14px] font-display text-text-primary outline-none"
                />
                <div className="flex gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-[12px] text-text-secondary font-mono">$</span>
                    <input
                      type="number"
                      value={gf.monto}
                      onChange={(e) =>
                        updateGastoFijo(i, "monto", Number(e.target.value))
                      }
                      className="w-20 bg-bg border border-border rounded-[6px] px-2 py-1 text-[13px] font-mono text-text-primary outline-none"
                    />
                  </div>
                  <select
                    value={gf.frecuencia}
                    onChange={(e) =>
                      updateGastoFijo(i, "frecuencia", e.target.value)
                    }
                    className="bg-bg border border-border rounded-[6px] px-2 py-1 text-[12px] font-display text-text-primary outline-none"
                  >
                    <option value="mensual">Mensual</option>
                    <option value="semanal">Semanal</option>
                  </select>
                </div>
              </div>

              <button
                onClick={() => removeGastoFijo(i)}
                className="text-red-400 text-[18px] leading-none px-1 flex-shrink-0"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Save button */}
      <button
        onClick={handleSave}
        className="w-full py-3.5 rounded-card text-[14px] font-display font-semibold text-white active:scale-[0.98] transition-all mb-4"
        style={{ backgroundColor: color }}
      >
        {saved ? "Guardado" : "Guardar cambios"}
      </button>

      {/* Delete */}
      <button
        onClick={() => setShowDelete(true)}
        className="w-full py-3 rounded-card text-[14px] font-display font-medium text-red-500 border border-red-200 active:scale-[0.98] transition-transform"
      >
        Eliminar salón
      </button>

      {/* Delete confirmation */}
      <Modal open={showDelete} onClose={() => setShowDelete(false)}>
        <h3 className="text-lg font-bold font-display text-text-primary mb-2">
          Eliminar salón
        </h3>
        <p className="text-[13px] text-text-secondary mb-5">
          Se eliminará <strong className="text-text-primary">{salon.nombre}</strong> y
          todos sus datos (bolsas, cierres, acumulados). Esta acción no se
          puede deshacer.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setShowDelete(false)}
            className="flex-1 py-3 rounded-card border border-border text-[14px] font-display font-medium text-text-secondary active:scale-[0.98] transition-transform"
          >
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            className="flex-1 py-3 rounded-card bg-red-500 text-[14px] font-display font-semibold text-white active:scale-[0.98] transition-transform"
          >
            Eliminar
          </button>
        </div>
      </Modal>
    </main>
  );
}
