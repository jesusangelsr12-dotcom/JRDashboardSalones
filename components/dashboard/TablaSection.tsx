"use client";

import { useState, useMemo } from "react";
import type { Cita, Gasto, MovimientoBolsa, Bolsa } from "@/lib/types";
import { formatMoney, fechaCorta, mesesDisponibles, costoNeto } from "@/lib/calculations";
import type { MetodoPago } from "@/lib/types";
import { reasignarBolsa } from "@/lib/store";
import Modal from "@/components/ui/Modal";

interface TablaSectionProps {
  citas: Cita[];
  gastos: Gasto[];
  movimientos: MovimientoBolsa[];
  bolsas: Bolsa[];
  salonColor: string;
  comisionTarjeta: number;
  onRefresh?: () => void;
}

type FilterType = "todo" | "citas" | "gastos";

interface TransaccionRow {
  id: string;
  tipo: "cita" | "gasto";
  fecha: Date;
  descripcion: string;
  monto: number;
  metodo: string;
  detalle?: string;
  source?: string;
  origen?: "manual" | "auto";
  movimientoId?: string;
  bolsaId?: string;
}

export default function TablaSection({
  citas,
  gastos,
  movimientos,
  bolsas,
  salonColor,
  comisionTarjeta,
  onRefresh,
}: TablaSectionProps) {
  const [filter, setFilter] = useState<FilterType>("todo");
  const [search, setSearch] = useState("");
  const [mesFilter, setMesFilter] = useState("todos");
  const [reasignando, setReasignando] = useState<TransaccionRow | null>(null);
  const [nuevaBolsaId, setNuevaBolsaId] = useState("");
  const [saving, setSaving] = useState(false);

  const meses = useMemo(() => mesesDisponibles(citas, gastos), [citas, gastos]);

  const rows = useMemo<TransaccionRow[]>(() => {
    const citaRows: TransaccionRow[] = citas.map((c, i) => ({
      id: `cita-${i}`,
      tipo: "cita",
      fecha: c.fecha,
      descripcion: c.clienta,
      monto: c.costo,
      metodo: c.metodoPago,
      detalle: c.servicios.map((s) => s.nombre).join(", "),
    }));

    const gastoRows: TransaccionRow[] = gastos.map((g, i) => ({
      id: g.adminId ? `admin-${g.adminId}` : `gasto-${i}`,
      tipo: "gasto",
      fecha: g.fecha,
      descripcion: g.descripcion,
      monto: -g.monto,
      metodo: g.metodoPago,
      source: g.source,
      origen: g.source === "sheets" ? "auto" as const : undefined,
    }));

    // Movimientos de bolsa
    const bolsaNames: Record<string, string> = {};
    bolsas.forEach((b) => { bolsaNames[b.id] = b.nombre; });

    const movRows: TransaccionRow[] = movimientos.map((m) => ({
      id: `mov-${m.id}`,
      tipo: m.tipo === "ingreso" ? "cita" : "gasto",
      fecha: new Date(m.fecha + "T00:00:00"),
      descripcion: m.descripcion || `Movimiento ${m.tipo}`,
      monto: m.tipo === "ingreso" ? m.monto : -m.monto,
      metodo: m.metodoPago,
      source: "bolsa",
      detalle: bolsaNames[m.bolsaId] ? `Bolsa: ${bolsaNames[m.bolsaId]}` : undefined,
      origen: m.tipo === "egreso" ? m.origen : undefined,
      movimientoId: m.id,
      bolsaId: m.bolsaId,
    }));

    let all = [...citaRows, ...gastoRows, ...movRows].sort(
      (a, b) => b.fecha.getTime() - a.fecha.getTime()
    );

    // Month filter
    if (mesFilter !== "todos") {
      const [y, m] = mesFilter.split("-").map(Number);
      all = all.filter(
        (r) => r.fecha.getFullYear() === y && r.fecha.getMonth() === m
      );
    }

    if (filter === "citas") all = all.filter((r) => r.tipo === "cita");
    if (filter === "gastos") all = all.filter((r) => r.tipo === "gasto");

    if (search.trim()) {
      const q = search.toLowerCase();
      all = all.filter(
        (r) =>
          r.descripcion.toLowerCase().includes(q) ||
          (r.detalle && r.detalle.toLowerCase().includes(q))
      );
    }

    return all;
  }, [citas, gastos, movimientos, bolsas, filter, search, mesFilter]);

  const handleReasignar = async () => {
    if (!reasignando?.movimientoId || !nuevaBolsaId) return;
    setSaving(true);
    const ok = await reasignarBolsa(reasignando.movimientoId, nuevaBolsaId);
    setSaving(false);
    if (ok) {
      setReasignando(null);
      setNuevaBolsaId("");
      onRefresh?.();
    }
  };

  const filters: { id: FilterType; label: string }[] = [
    { id: "todo", label: "Todo" },
    { id: "citas", label: "Ingresos" },
    { id: "gastos", label: "Gastos" },
  ];

  return (
    <section>
      {/* Month selector */}
      <div className="mb-3">
        <select
          value={mesFilter}
          onChange={(e) => setMesFilter(e.target.value)}
          className="w-full bg-surface border border-border rounded-card px-3 py-2.5 text-[13px] font-display text-text-primary outline-none focus:border-text-secondary transition-colors capitalize"
        >
          <option value="todos">Todos los meses</option>
          {meses.map((m) => (
            <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
        >
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          placeholder="Buscar clienta o servicio..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-surface border border-border rounded-card pl-9 pr-4 py-2.5 text-[13px] font-display text-text-primary placeholder:text-text-secondary/50 outline-none focus:border-text-secondary transition-colors"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-[12px] font-display font-medium transition-all ${
              filter === f.id
                ? "text-white"
                : "text-text-secondary bg-bg border border-border"
            }`}
            style={filter === f.id ? { backgroundColor: salonColor } : undefined}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-[11px] font-mono text-text-secondary self-center">
          {rows.length} reg.
        </span>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-[13px] text-text-secondary font-display">
            {search ? "Sin resultados" : "Sin transacciones"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.slice(0, 50).map((row) => (
            <div
              key={row.id}
              className="bg-surface rounded-card border border-border px-4 py-3 flex items-center gap-3"
            >
              {/* Type indicator */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm ${
                  row.tipo === "cita"
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-red-50 text-red-500"
                }`}
              >
                {row.tipo === "cita" ? "↑" : "↓"}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-[13px] font-display font-medium text-text-primary truncate">
                    {row.descripcion}
                  </p>
                  {row.source === "admin" && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 flex-shrink-0">
                      Admin
                    </span>
                  )}
                  {row.source === "bolsa" && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 flex-shrink-0">
                      Bolsa
                    </span>
                  )}
                  {/* Auto/Manual badge — solo para gastos */}
                  {row.tipo === "gasto" && row.origen === "auto" && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 flex-shrink-0">
                      Auto
                    </span>
                  )}
                  {row.tipo === "gasto" && row.origen === "manual" && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 flex-shrink-0">
                      Manual
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <p className="text-[11px] text-text-secondary font-mono truncate">
                    {fechaCorta(row.fecha)}
                    {row.detalle && ` · ${row.detalle}`}
                  </p>
                  {/* Reasignar button — solo para gastos manuales de bolsa */}
                  {row.tipo === "gasto" && row.origen === "manual" && row.movimientoId && (
                    <button
                      onClick={() => {
                        setReasignando(row);
                        setNuevaBolsaId(row.bolsaId || "");
                      }}
                      className="text-[10px] font-display font-medium px-1.5 py-0.5 rounded transition-all active:scale-95 flex-shrink-0"
                      style={{ color: salonColor, backgroundColor: salonColor + "14" }}
                    >
                      ✏️ Reasignar
                    </button>
                  )}
                  {/* Los gastos de Sheets no son reasignables en esta versión.
                      Ver DEUDA-TECNICA.md → "Migración Sheets → Supabase" */}
                </div>
              </div>

              {/* Amount + method */}
              <div className="text-right flex-shrink-0">
                <p
                  className={`text-[14px] font-numbers font-medium ${
                    row.monto >= 0 ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {row.monto >= 0 ? "+" : ""}
                  {formatMoney(Math.abs(row.monto))}
                </p>
                {row.metodo === "Tarjeta" && row.monto > 0 && comisionTarjeta > 0 && (
                  <p className="text-[10px] font-mono text-teal-600">
                    Neto: {formatMoney(costoNeto(row.monto, "Tarjeta" as MetodoPago, comisionTarjeta))}
                  </p>
                )}
                <p className="text-[10px] text-text-secondary font-mono">
                  {row.metodo}
                </p>
              </div>
            </div>
          ))}

          {rows.length > 50 && (
            <p className="text-center text-[11px] text-text-secondary font-mono py-3">
              Mostrando 50 de {rows.length} registros
            </p>
          )}
        </div>
      )}

      {/* Reasignar bolsa modal */}
      <Modal open={!!reasignando} onClose={() => { setReasignando(null); setNuevaBolsaId(""); }}>
        <h3 className="text-lg font-bold font-display text-text-primary mb-2">
          Reasignar bolsa
        </h3>
        <p className="text-[13px] text-text-secondary mb-4">
          {reasignando?.descripcion}
        </p>

        <label className="text-[11px] uppercase tracking-[0.08em] text-text-secondary font-display font-medium mb-1.5 block">
          Nueva bolsa
        </label>
        <select
          value={nuevaBolsaId}
          onChange={(e) => setNuevaBolsaId(e.target.value)}
          className="w-full bg-bg border border-border rounded-card px-3 py-2.5 text-[13px] font-display text-text-primary outline-none mb-5"
        >
          <option value="">Seleccionar bolsa</option>
          {bolsas.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nombre}
            </option>
          ))}
        </select>

        <div className="flex gap-3">
          <button
            onClick={() => { setReasignando(null); setNuevaBolsaId(""); }}
            className="flex-1 py-3 rounded-card border border-border text-[14px] font-display font-medium text-text-secondary active:scale-[0.98] transition-transform"
          >
            Cancelar
          </button>
          <button
            onClick={handleReasignar}
            disabled={saving || !nuevaBolsaId || nuevaBolsaId === reasignando?.bolsaId}
            className="flex-1 py-3 rounded-card text-[14px] font-display font-semibold text-white active:scale-[0.98] transition-transform disabled:opacity-50"
            style={{ backgroundColor: salonColor }}
          >
            {saving ? "Guardando..." : "Confirmar"}
          </button>
        </div>
      </Modal>
    </section>
  );
}
