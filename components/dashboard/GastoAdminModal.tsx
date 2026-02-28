"use client";

import { useState } from "react";
import type { Bolsa, MetodoPago } from "@/lib/types";
import { addGastoAdmin } from "@/lib/store";
import Modal from "@/components/ui/Modal";

interface GastoAdminModalProps {
  open: boolean;
  onClose: () => void;
  salonId: string;
  salonColor: string;
  bolsas: Bolsa[];
  onSaved: () => void;
}

export default function GastoAdminModal({
  open,
  onClose,
  salonId,
  salonColor,
  bolsas,
  onSaved,
}: GastoAdminModalProps) {
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("Efectivo");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [bolsaId, setBolsaId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!descripcion.trim() || !monto || Number(monto) <= 0) return;
    setSaving(true);

    await addGastoAdmin(salonId, {
      descripcion: descripcion.trim(),
      monto: Number(monto),
      metodoPago,
      fecha,
      bolsaId: bolsaId || null,
    });

    // Reset form
    setDescripcion("");
    setMonto("");
    setMetodoPago("Efectivo");
    setFecha(new Date().toISOString().split("T")[0]);
    setBolsaId("");
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose}>
      <h3 className="text-lg font-bold font-display text-text-primary mb-4">
        Registrar gasto
      </h3>

      <div className="space-y-4 mb-6">
        {/* Descripción */}
        <div>
          <label className="text-[12px] font-display text-text-secondary mb-1 block">
            Descripción
          </label>
          <input
            type="text"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej: Sueldo dueño, Administración..."
            className="w-full bg-bg border border-border rounded-[8px] px-3 py-2.5 text-[14px] font-display text-text-primary placeholder:text-text-secondary/40 outline-none focus:border-text-secondary transition-colors"
          />
        </div>

        {/* Monto */}
        <div>
          <label className="text-[12px] font-display text-text-secondary mb-1 block">
            Monto
          </label>
          <div className="flex items-center gap-1">
            <span className="text-[14px] text-text-secondary font-mono">$</span>
            <input
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0"
              className="flex-1 bg-bg border border-border rounded-[8px] px-3 py-2.5 text-[14px] font-mono text-text-primary placeholder:text-text-secondary/40 outline-none focus:border-text-secondary transition-colors"
            />
          </div>
        </div>

        {/* Método de pago */}
        <div>
          <label className="text-[12px] font-display text-text-secondary mb-1 block">
            Método de pago
          </label>
          <div className="flex gap-2">
            {(["Efectivo", "Tarjeta", "Transferencia"] as MetodoPago[]).map((m) => (
              <button
                key={m}
                onClick={() => setMetodoPago(m)}
                className={`flex-1 py-2 rounded-[8px] text-[12px] font-display font-medium transition-all ${
                  metodoPago === m
                    ? "text-white"
                    : "bg-bg border border-border text-text-secondary"
                }`}
                style={metodoPago === m ? { backgroundColor: salonColor } : undefined}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Fecha */}
        <div>
          <label className="text-[12px] font-display text-text-secondary mb-1 block">
            Fecha
          </label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full bg-bg border border-border rounded-[8px] px-3 py-2.5 text-[14px] font-mono text-text-primary outline-none focus:border-text-secondary transition-colors"
          />
        </div>

        {/* Bolsa destino */}
        <div>
          <label className="text-[12px] font-display text-text-secondary mb-1 block">
            Descontar de bolsa
          </label>
          <select
            value={bolsaId}
            onChange={(e) => setBolsaId(e.target.value)}
            className="w-full bg-bg border border-border rounded-[8px] px-3 py-2.5 text-[14px] font-display text-text-primary outline-none focus:border-text-secondary transition-colors"
          >
            <option value="">Sin asignar</option>
            {bolsas.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre} ({b.porcentaje}%)
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 py-3 rounded-card border border-border text-[14px] font-display font-medium text-text-secondary active:scale-[0.98] transition-transform"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !descripcion.trim() || !monto || Number(monto) <= 0}
          className="flex-1 py-3 rounded-card text-[14px] font-display font-semibold text-white active:scale-[0.98] transition-transform disabled:opacity-50"
          style={{ backgroundColor: salonColor }}
        >
          {saving ? "Guardando..." : "Registrar"}
        </button>
      </div>
    </Modal>
  );
}
