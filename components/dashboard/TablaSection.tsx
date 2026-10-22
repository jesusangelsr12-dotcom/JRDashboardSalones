"use client";

import { useState, useMemo } from "react";
import type { Cita, Gasto, MovimientoBolsa, Bolsa } from "@/lib/types";
import { formatMoney, fechaCorta, mesesDisponibles, costoNeto } from "@/lib/calculations";
import type { MetodoPago } from "@/lib/types";
import { reasignarBolsa } from "@/lib/store";
import Modal from "@/components/ui/Modal";
import { mayuscula } from "@/components/ui/Primitives";
import { IconArrowDown, IconArrowUp, IconChevronDown, IconSearch } from "@/components/ui/Icons";

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const claveDia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

interface TablaSectionProps {
  citas: Cita[];
  gastos: Gasto[];
  movimientos: MovimientoBolsa[];
  bolsas: Bolsa[];
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

  const visibles = rows.slice(0, 50);

  return (
    <section>
      {/* Month selector */}
      <div className="relative mb-2">
        <select
          value={mesFilter}
          onChange={(e) => setMesFilter(e.target.value)}
          aria-label="Mes"
          className="w-full appearance-none bg-surface border border-border rounded-[14px] pl-3.5 pr-10 py-3 text-[13.5px] font-display text-text-primary outline-none focus:border-rosa focus:ring-[3px] focus:ring-rosa/10 transition-colors"
        >
          <option value="todos">Todos los meses</option>
          {meses.map((m) => (
            <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
              {mayuscula(m.label)}
            </option>
          ))}
        </select>
        <IconChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <IconSearch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          type="text"
          placeholder="Buscar clienta o servicio..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-surface border border-border rounded-[14px] pl-10 pr-4 py-3 text-[13.5px] font-display text-text-primary placeholder:text-text-secondary/60 outline-none focus:border-rosa focus:ring-[3px] focus:ring-rosa/10 transition-colors"
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1.5 mb-1">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3.5 py-[7px] rounded-full text-[12.5px] font-display font-semibold border transition-all ${
              filter === f.id ? "bg-tinta border-tinta text-white" : "bg-surface border-border text-text-secondary"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-[11.5px] font-numbers text-text-secondary">{rows.length} reg.</span>
      </div>

      {/* Lista agrupada por día */}
      {rows.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-[13px] text-text-secondary">{search ? "Sin resultados" : "Sin transacciones"}</p>
        </div>
      ) : (
        <div>
          {visibles.map((row, idx) => {
            const nuevoDia = idx === 0 || claveDia(visibles[idx - 1].fecha) !== claveDia(row.fecha);
            const ingreso = row.monto >= 0;
            return (
              <div key={row.id}>
                {nuevoDia && (
                  <p className="text-[11px] uppercase tracking-[0.07em] text-text-secondary font-display font-bold mt-4 mb-1.5 px-0.5">
                    {DIAS[row.fecha.getDay()]} {row.fecha.getDate()} {MESES_CORTOS[row.fecha.getMonth()]}
                  </p>
                )}
                <div className="bg-surface rounded-[16px] border border-border px-3 py-2.5 mb-1.5 flex items-start gap-2.5">
                  <span
                    className={`w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0 ${
                      ingreso ? "bg-entra-soft text-entra" : "bg-sale-soft text-sale"
                    }`}
                  >
                    {ingreso ? <IconArrowUp size={15} /> : <IconArrowDown size={15} />}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-[13.5px] font-display font-semibold text-text-primary truncate">{row.descripcion}</p>
                      {row.source === "admin" && <Badge className="bg-tinta text-white">Admin</Badge>}
                      {row.source === "bolsa" && <Badge className="bg-rubor text-rosa">Bolsa</Badge>}
                      {/* Auto/Manual — solo para gastos */}
                      {row.tipo === "gasto" && row.origen === "auto" && <Badge className="bg-[#F3ECEF] text-text-secondary">Auto</Badge>}
                      {row.tipo === "gasto" && row.origen === "manual" && <Badge className="bg-[#FFF0C8] text-[#7A5200]">Manual</Badge>}
                    </div>
                    <p className="text-[11.5px] text-text-secondary truncate">
                      {fechaCorta(row.fecha)}
                      {row.detalle && ` · ${row.detalle}`}
                    </p>
                    {/* Reasignar — solo gastos manuales de bolsa.
                        Los gastos de Sheets no son reasignables en esta versión.
                        Ver DEUDA-TECNICA.md → "Migración Sheets → Supabase" */}
                    {row.tipo === "gasto" && row.origen === "manual" && row.movimientoId && (
                      <button
                        onClick={() => {
                          setReasignando(row);
                          setNuevaBolsaId(row.bolsaId || "");
                        }}
                        className="mt-1 text-[11.5px] font-display font-bold px-2 py-0.5 rounded-[8px] bg-rubor text-rosa active:scale-95 transition-transform"
                      >
                        Reasignar bolsa
                      </button>
                    )}
                  </div>

                  {/* Amount + method */}
                  <div className="text-right flex-shrink-0">
                    <p className={`text-[14px] font-numbers font-bold ${ingreso ? "text-entra" : "text-sale"}`}>
                      {ingreso ? "+" : "−"}
                      {formatMoney(Math.abs(row.monto))}
                    </p>
                    {row.metodo === "Tarjeta" && row.monto > 0 && comisionTarjeta > 0 && (
                      <p className="text-[11px] font-numbers font-semibold text-text-primary">
                        Neto {formatMoney(costoNeto(row.monto, "Tarjeta" as MetodoPago, comisionTarjeta))}
                      </p>
                    )}
                    <p className="text-[11px] text-text-secondary">{row.metodo}</p>
                  </div>
                </div>
              </div>
            );
          })}

          {rows.length > 50 && (
            <p className="text-center text-[11.5px] text-text-secondary font-numbers py-3">Mostrando 50 de {rows.length} registros</p>
          )}
        </div>
      )}

      {/* Reasignar bolsa modal */}
      <Modal open={!!reasignando} onClose={() => { setReasignando(null); setNuevaBolsaId(""); }}>
        <h3 className="font-brand text-[20px] font-extrabold tracking-[-0.025em] text-text-primary">Reasignar bolsa</h3>
        <p className="text-[12.5px] text-text-secondary mt-0.5 mb-4">{reasignando?.descripcion}</p>

        <label className="text-[12px] text-text-secondary font-display font-semibold mb-1.5 block">Nueva bolsa</label>
        <div className="relative mb-5">
          <select
            value={nuevaBolsaId}
            onChange={(e) => setNuevaBolsaId(e.target.value)}
            className="w-full appearance-none bg-bg border border-border rounded-[12px] px-3 py-2.5 text-[14px] font-display text-text-primary outline-none focus:border-rosa"
          >
            <option value="">Seleccionar bolsa</option>
            {bolsas.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
          <IconChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { setReasignando(null); setNuevaBolsaId(""); }}
            className="py-3.5 rounded-[16px] border border-border text-[14.5px] font-display font-bold text-text-primary active:scale-[0.98] transition-transform"
          >
            Cancelar
          </button>
          <button
            onClick={handleReasignar}
            disabled={saving || !nuevaBolsaId || nuevaBolsaId === reasignando?.bolsaId}
            className="py-3.5 rounded-[16px] bg-mandarina text-tinta text-[14.5px] font-display font-bold active:scale-[0.98] transition-transform disabled:opacity-40"
          >
            {saving ? "Guardando..." : "Confirmar"}
          </button>
        </div>
      </Modal>
    </section>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`text-[11px] font-display font-bold px-1.5 py-[1px] rounded-[6px] flex-shrink-0 ${className}`}>{children}</span>;
}
