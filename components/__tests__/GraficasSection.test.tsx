import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GraficasSection from "../dashboard/GraficasSection";
import type { Cita, Gasto, ServicioItem } from "@/lib/types";

const serv = (nombre: string, costo: number): ServicioItem => ({ tipo: "servicio", nombre, costo });

const citas: Cita[] = [
  { fecha: new Date(), timestamp: "", clienta: "Ana", servicios: [serv("Corte", 300)], costo: 300, metodoPago: "Efectivo" },
  { fecha: new Date(), timestamp: "", clienta: "Bea", servicios: [serv("Tinte", 600)], costo: 600, metodoPago: "Tarjeta" },
];
const gastos: Gasto[] = [
  { fecha: new Date(), timestamp: "", descripcion: "Luz", monto: 400, metodoPago: "Efectivo", source: "sheets" },
];

describe("GraficasSection — render y cambio de vistas (smoke)", () => {
  it("renderiza las pestañas mensual/anual y las 4 vistas de gráfica", () => {
    render(<GraficasSection citas={citas} gastos={gastos} salonColor="#7B4F2E" comisionTarjeta={0} />);
    expect(screen.getByText("Evolución")).toBeInTheDocument();
    expect(screen.getByText("Servicios")).toBeInTheDocument();
    expect(screen.getByText("Método")).toBeInTheDocument();
    expect(screen.getByText("Gastos")).toBeInTheDocument();
  });

  it("cambiar entre vistas no rompe el render", () => {
    render(<GraficasSection citas={citas} gastos={gastos} salonColor="#7B4F2E" comisionTarjeta={0} />);
    for (const label of ["Servicios", "Método", "Gastos", "Evolución"]) {
      fireEvent.click(screen.getByText(label));
      // la barra de vistas sigue presente tras cada cambio
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("alterna a la vista anual sin romperse", () => {
    render(<GraficasSection citas={citas} gastos={gastos} salonColor="#7B4F2E" comisionTarjeta={0} />);
    const anual = screen.getByText((t) => /anual/i.test(t));
    fireEvent.click(anual);
    expect(screen.getByText("Evolución")).toBeInTheDocument();
  });
});
