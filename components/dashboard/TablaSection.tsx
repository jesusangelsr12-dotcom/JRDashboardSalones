"use client";

import { useState, useMemo } from "react";
import type { Cita, Gasto } from "@/lib/types";
import { formatMoney, fechaCorta } from "@/lib/calculations";

interface TablaSectionProps {
  citas: Cita[];
  gastos: Gasto[];
  salonColor: string;
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
}

export default function TablaSection({
  citas,
  gastos,
  salonColor,
}: TablaSectionProps) {
  const [filter, setFilter] = useState<FilterType>("todo");
  const [search, setSearch] = useState("");

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
      id: `gasto-${i}`,
      tipo: "gasto",
      fecha: g.fecha,
      descripcion: g.descripcion,
      monto: -g.monto,
      metodo: g.metodoPago,
    }));

    let all = [...citaRows, ...gastoRows].sort(
      (a, b) => b.fecha.getTime() - a.fecha.getTime()
    );

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
  }, [citas, gastos, filter, search]);

  const filters: { id: FilterType; label: string }[] = [
    { id: "todo", label: "Todo" },
    { id: "citas", label: "Ingresos" },
    { id: "gastos", label: "Gastos" },
  ];

  return (
    <section>
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
                <p className="text-[13px] font-display font-medium text-text-primary truncate">
                  {row.descripcion}
                </p>
                <p className="text-[11px] text-text-secondary font-mono truncate">
                  {fechaCorta(row.fecha)}
                  {row.detalle && ` · ${row.detalle}`}
                </p>
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
    </section>
  );
}
