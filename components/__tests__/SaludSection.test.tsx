import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import SaludSection from "../dashboard/SaludSection";
import type { Salon, Cita, MetodoPago } from "@/lib/types";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const salon: Salon = {
  id: "s1",
  nombre: "Salón Test",
  color: "#7B4F2E",
  sheetId: "",
  comisionTarjeta: 0,
  bolsaDefaultGastosId: null,
  createdAt: "",
  bolsas: [
    { id: "b1", nombre: "Sueldo dueñas", porcentaje: 50, color: "#000", acumulado: 0, naturaleza: "gasto_operativo" },
    { id: "b2", nombre: "Reparto", porcentaje: 50, color: "#111", acumulado: 0, naturaleza: "reparto" },
  ],
  gastosFijos: [{ id: "gf1", nombre: "Renta", monto: 5000, frecuencia: "mensual", categoria: "renta" }],
};

function diasAtras(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function cita(clienta: string, fecha: Date, costo: number, metodoPago: MetodoPago = "Efectivo"): Cita {
  return { fecha, timestamp: "", clienta, servicios: [], costo, metodoPago };
}

// "Maria Lopez" visita cada ~10 días, última hace 40 días → en riesgo (40 > 1.5×10).
// "Ana" tiene una cita hoy (ingreso del mes actual > 0).
const citas: Cita[] = [
  cita("Maria Lopez", diasAtras(60), 300),
  cita("Maria Lopez", diasAtras(50), 300),
  cita("Maria Lopez", diasAtras(40), 300),
  cita("Ana", new Date(), 800),
];

describe("SaludSection — render + interacciones", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("muestra el hero con utilidad del mes y el mes actual", () => {
    render(<SaludSection salon={salon} citas={citas} gastos={[]} salonColor={salon.color} />);
    const hoy = new Date();
    expect(screen.getByText(`Utilidad de ${MESES[hoy.getMonth()]}`)).toBeInTheDocument();
    expect(screen.getByText(`${MESES[hoy.getMonth()]} ${hoy.getFullYear()}`)).toBeInTheDocument();
  });

  it("renderiza las secciones de KPIs y operación", () => {
    render(<SaludSection salon={salon} citas={citas} gastos={[]} salonColor={salon.color} />);
    expect(screen.getByText("Margen neto")).toBeInTheDocument();
    expect(screen.getByText("Costo de personal")).toBeInTheDocument();
    expect(screen.getByText("Renta / ingreso")).toBeInTheDocument();
    expect(screen.getByText("Retención 90 días")).toBeInTheDocument();
    expect(screen.getByText("Punto de equilibrio")).toBeInTheDocument();
    expect(screen.getByText("Días valle · promedio últimas 8 semanas")).toBeInTheDocument();
  });

  it("el botón 'Mes siguiente' está deshabilitado en el mes actual y 'Mes anterior' navega", () => {
    render(<SaludSection salon={salon} citas={citas} gastos={[]} salonColor={salon.color} />);
    expect(screen.getByLabelText("Mes siguiente")).toBeDisabled();

    fireEvent.click(screen.getByLabelText("Mes anterior"));
    const hoy = new Date();
    const prev = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    expect(screen.getByText(`${MESES[prev.getMonth()]} ${prev.getFullYear()}`)).toBeInTheDocument();
  });

  it("lista la clienta en riesgo y permite marcarla como contactada (persiste en localStorage)", () => {
    const { container } = render(<SaludSection salon={salon} citas={citas} gastos={[]} salonColor={salon.color} />);
    expect(screen.getByText("Maria Lopez")).toBeInTheDocument();
    expect(container).toHaveTextContent("0/1 contactadas");

    const btn = screen.getByTitle("Marcar como contactada");
    fireEvent.click(btn);

    expect(screen.getByTitle("Contactada esta semana")).toBeInTheDocument();
    expect(container).toHaveTextContent("1/1 contactadas");
    expect(localStorage.getItem("jr_contactadas_s1")).toContain("Maria Lopez");
  });

  it("expande el Estado de Resultados detallado", () => {
    render(<SaludSection salon={salon} citas={citas} gastos={[]} salonColor={salon.color} />);
    expect(screen.queryByText("(+) Ingresos brutos")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Estado de resultados detallado"));
    expect(screen.getByText("(+) Ingresos brutos")).toBeInTheDocument();
  });
});
