"use client";

import BarrasHorizontales from "./BarrasHorizontales";

interface ChartTopGastosProps {
  data: { descripcion: string; cantidad: number; total: number }[];
}

// Los gastos usan el color de «sale»
export default function ChartTopGastos({ data }: ChartTopGastosProps) {
  return (
    <BarrasHorizontales
      color="#B3261E"
      vacio="Sin gastos registrados"
      filas={data.slice(0, 8).map((d) => ({ nombre: d.descripcion, total: d.total, detalle: `${d.cantidad} ${d.cantidad === 1 ? "registro" : "registros"}` }))}
    />
  );
}
