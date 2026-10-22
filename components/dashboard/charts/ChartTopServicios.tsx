"use client";

import BarrasHorizontales from "./BarrasHorizontales";

interface ChartTopServiciosProps {
  data: { nombre: string; cantidad: number; total: number }[];
}

export default function ChartTopServicios({ data }: ChartTopServiciosProps) {
  return (
    <BarrasHorizontales
      color="#D9007A"
      vacio="Sin servicios registrados"
      filas={data.slice(0, 8).map((d) => ({ nombre: d.nombre, total: d.total, detalle: `${d.cantidad} ${d.cantidad === 1 ? "servicio" : "servicios"}` }))}
    />
  );
}
