"use client";

import { useState, useEffect } from "react";
import type { Bolsa, MetodoPago, TipoMovimiento } from "@/lib/types";
import { addMovimientoBolsa } from "@/lib/store";
import Modal from "@/components/ui/Modal";

interface MovimientoBolsaModalProps {
  open: boolean;
  onClose: () => void;
  salonId: string;
  salonColor: string;
  bolsas: Bolsa[];
  preselectedBolsaId?: string;
  onSaved: () => void;
}

export default function MovimientoBolsaModal({
  open,
  onClose,
  salonId,
  salonColor,
  bolsas,
  preselectedBolsaId,
  onSaved,
}: MovimientoBolsaModalProps) {
  const [tipo, setTipo] = useState<TipoMovimiento>("ingreso");
  const [bolsaId, setBolsaId] = useState<string>(preselectedBolsaId || "");
  const [monto, setMonto] = useState("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("Efectivo");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const [esCostoServicio, setEsCostoServicio] = useState(false);

  // Resetear fecha cada vez que se abre el modal
  useEffect(() => {
    if (open) setFecha(new Date().toISOString().split("T")[0]);
  }, [open]);

  const handleSave = async () => {
    if (!bolsaId || !monto || Number(monto) <= 0) return;
    setSaving(true);

    await addMovimientoBolsa(salonId, {
      bolsaId,
      tipo,
      monto: Number(monto),
      metodoPago,
      descripcion: descripcion.trim() || (tipo === "ingreso" ? "Ingreso manual" : "Retiro manual"),
      fecha,
      esCostoServicio: tipo === "egreso" ? esCostoServicio : false,
    });

    // Reset
    setTipo("ingreso");
    setBolsaId(preselectedBolsaId || "");
    setMonto("");
    setMetodoPago("Efectivo");
    setDescripcion("");
    setFecha(new Date().toISOString().split("T")[0]);
    setEsCostoServicio(false);
    setSaving(false);
    onSaved();
    onClose();
  };

  const selectedBolsa = bolsas.find((b) => b.id === bolsaId);

  return (
    <Modal open={open} onClose={onClose}>
      <h3 className="text-lg font-bold font-display text-text-primary mb-4">
        Movimiento de bolsa
      </h3>

      <div className="space-y-4 mb-6">
        {/* Tipo: Ingreso / Egreso */}
        <div>
          <label className="text-[12px] font-display text-text-secondary mb-1 block">
            Tipo
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => { setTipo("ingreso"); setEsCostoServicio(false); }}
              className={`flex-1 py-2.5 rounded-[8px] text-[13px] font-display font-medium transition-all ${
                tipo === "ingreso"
                  ? "text-white"
                  : "bg-bg border border-border text-text-secondary"
              }`}
              style={tipo === "ingreso" ? { backgroundColor: "#10B981" } : undefined}
            >
              + Agregar
            </button>
            <button
              onClick={() => setTipo("egreso")}
              className={`flex-1 py-2.5 rounded-[8px] text-[13px] font-display font-medium transition-all ${
                tipo === "egreso"
                  ? "text-white"
                  : "bg-bg border border-border text-text-secondary"
              }`}
              style={tipo === "egreso" ? { backgroundColor: "#EF4444" } : undefined}
            >
              - Restar
            </button>
          </div>
        </div>

        {/* Bolsa */}
        <div>
          <label className="text-[12px] font-display text-text-secondary mb-1 block">
            Bolsa
          </label>
          <select
            value={bolsaId}
            onChange={(e) => setBolsaId(e.target.value)}
            className="w-full bg-bg border border-border rounded-[8px] px-3 py-2.5 text-[14px] font-display text-text-primary outline-none focus:border-text-secondary transition-colors"
          >
            <option value="">Seleccionar bolsa</option>
            {bolsas.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre} ({b.porcentaje}%)
              </option>
            ))}
          </select>
          {selectedBolsa && (
            <p className="text-[11px] font-mono text-text-secondary mt-1">
              Acumulado actual:{" "}
              <span style={{ color: selectedBolsa.color }}>
                {new Intl.NumberFormat("es-MX", {
                  style: "currency",
                  currency: "MXN",
                  minimumFractionDigits: 0,
                }).format(selectedBolsa.acumulado)}
              </span>
            </p>
          )}
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
            Método
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

        {/* Descripción */}
        <div>
          <label className="text-[12px] font-display text-text-secondary mb-1 block">
            Descripción (opcional)
          </label>
          <input
            type="text"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder={tipo === "ingreso" ? "Ej: Depósito, Cobro pendiente..." : "Ej: Retiro para materiales..."}
            className="w-full bg-bg border border-border rounded-[8px] px-3 py-2.5 text-[14px] font-display text-text-primary placeholder:text-text-secondary/40 outline-none focus:border-text-secondary transition-colors"
          />
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

        {/* Costo de servicio toggle — solo visible para egresos */}
        {tipo === "egreso" && (
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setEsCostoServicio(!esCostoServicio)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  esCostoServicio ? "bg-emerald-500" : "bg-border"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    esCostoServicio ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </div>
              <div>
                <span className="text-[13px] font-display text-text-primary">
                  Producto consumido en servicio
                </span>
                <p className="text-[10px] font-display text-text-secondary">
                  Tinte, químicos, productos que usaste en clientas
                </p>
              </div>
            </label>
          </div>
        )}
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
          disabled={saving || !bolsaId || !monto || Number(monto) <= 0}
          className="flex-1 py-3 rounded-card text-[14px] font-display font-semibold text-white active:scale-[0.98] transition-transform disabled:opacity-50"
          style={{
            backgroundColor: tipo === "ingreso" ? "#10B981" : "#EF4444",
          }}
        >
          {saving
            ? "Guardando..."
            : tipo === "ingreso"
            ? `+ Agregar`
            : `- Restar`}
        </button>
      </div>
    </Modal>
  );
}
