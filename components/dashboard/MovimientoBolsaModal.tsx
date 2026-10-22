"use client";

import { useState, useEffect } from "react";
import type { Bolsa, MetodoPago, TipoMovimiento } from "@/lib/types";
import { addMovimientoBolsa } from "@/lib/store";
import Modal from "@/components/ui/Modal";
import { formatMoney } from "@/lib/calculations";
import { IconChevronDown } from "@/components/ui/Icons";

const LABEL = "text-[12px] font-display font-semibold text-text-secondary mb-1.5 block";
const CAMPO =
  "w-full bg-bg border border-border rounded-[12px] px-3 py-2.5 text-[14px] font-display text-text-primary placeholder:text-text-secondary/50 outline-none focus:border-rosa focus:ring-[3px] focus:ring-rosa/10 transition-colors";

interface MovimientoBolsaModalProps {
  open: boolean;
  onClose: () => void;
  salonId: string;
  bolsas: Bolsa[];
  preselectedBolsaId?: string;
  onSaved: () => void;
}

export default function MovimientoBolsaModal({
  open,
  onClose,
  salonId,
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

  const opcionBase = "flex-1 py-2.5 rounded-[10px] text-[13px] font-display font-semibold transition-all";

  return (
    <Modal open={open} onClose={onClose}>
      <h3 className="font-brand text-[20px] font-extrabold tracking-[-0.025em] text-text-primary mb-4">Movimiento de bolsa</h3>

      <div className="space-y-3.5 mb-5">
        {/* Tipo: Ingreso / Egreso */}
        <div>
          <span className={LABEL}>Tipo</span>
          <div className="flex gap-[3px] bg-tinta/[0.06] rounded-[13px] p-[3px]">
            <button
              onClick={() => { setTipo("ingreso"); setEsCostoServicio(false); }}
              className={`${opcionBase} ${tipo === "ingreso" ? "bg-entra text-white" : "text-text-secondary"}`}
            >
              + Agregar
            </button>
            <button
              onClick={() => setTipo("egreso")}
              className={`${opcionBase} ${tipo === "egreso" ? "bg-sale text-white" : "text-text-secondary"}`}
            >
              - Restar
            </button>
          </div>
        </div>

        {/* Bolsa */}
        <div>
          <label className={LABEL} htmlFor="mov-bolsa">Bolsa</label>
          <div className="relative">
            <select id="mov-bolsa" value={bolsaId} onChange={(e) => setBolsaId(e.target.value)} className={`${CAMPO} appearance-none pr-9`}>
              <option value="">Seleccionar bolsa</option>
              {bolsas.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre} ({b.porcentaje}%)
                </option>
              ))}
            </select>
            <IconChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
          </div>
          {selectedBolsa && (
            <p className="text-[11.5px] text-text-secondary mt-1">
              Acumulado actual: <span className="font-numbers font-bold text-text-primary">{formatMoney(selectedBolsa.acumulado)}</span>
            </p>
          )}
        </div>

        {/* Monto */}
        <div>
          <label className={LABEL} htmlFor="mov-monto">Monto</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-text-secondary font-numbers font-semibold">$</span>
            <input
              id="mov-monto"
              type="number"
              inputMode="decimal"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0"
              className={`${CAMPO} pl-7 font-numbers`}
            />
          </div>
        </div>

        {/* Método de pago */}
        <div>
          <span className={LABEL}>Método</span>
          <div className="flex gap-[3px] bg-tinta/[0.06] rounded-[13px] p-[3px]">
            {(["Efectivo", "Tarjeta", "Transferencia"] as MetodoPago[]).map((m) => (
              <button
                key={m}
                onClick={() => setMetodoPago(m)}
                className={`${opcionBase} text-[12.5px] ${
                  metodoPago === m ? "bg-surface text-text-primary shadow-[0_1px_3px_rgba(28,11,20,0.14)]" : "text-text-secondary"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Descripción */}
        <div>
          <label className={LABEL} htmlFor="mov-desc">Descripción (opcional)</label>
          <input
            id="mov-desc"
            type="text"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder={tipo === "ingreso" ? "Ej: Depósito, Cobro pendiente..." : "Ej: Retiro para materiales..."}
            className={CAMPO}
          />
        </div>

        {/* Fecha */}
        <div>
          <label className={LABEL} htmlFor="mov-fecha">Fecha</label>
          <input id="mov-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={CAMPO} />
        </div>

        {/* Costo de servicio toggle — solo visible para egresos */}
        {tipo === "egreso" && (
          <button
            type="button"
            onClick={() => setEsCostoServicio(!esCostoServicio)}
            aria-pressed={esCostoServicio}
            className="w-full flex items-center gap-3 text-left"
          >
            <span className={`relative w-[46px] h-7 rounded-full flex-shrink-0 transition-colors ${esCostoServicio ? "bg-tinta" : "bg-tinta/15"}`}>
              <span
                className={`absolute top-[3px] left-[3px] w-[22px] h-[22px] rounded-full bg-white shadow transition-transform ${
                  esCostoServicio ? "translate-x-[18px]" : ""
                }`}
              />
            </span>
            <span>
              <span className="block text-[13.5px] font-display font-bold text-text-primary">Producto consumido en servicio</span>
              <span className="block text-[11.5px] text-text-secondary">Tinte, químicos, productos que usaste en clientas</span>
            </span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onClose}
          className="py-3.5 rounded-[16px] border border-border text-[14.5px] font-display font-bold text-text-primary active:scale-[0.98] transition-transform"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !bolsaId || !monto || Number(monto) <= 0}
          className="py-3.5 rounded-[16px] bg-mandarina text-tinta text-[14.5px] font-display font-bold active:scale-[0.98] transition-transform disabled:opacity-40"
        >
          {saving ? "Guardando..." : tipo === "ingreso" ? `+ Agregar` : `- Restar`}
        </button>
      </div>
    </Modal>
  );
}
