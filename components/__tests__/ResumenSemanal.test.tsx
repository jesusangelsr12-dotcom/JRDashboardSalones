import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ResumenSemanal from "../dashboard/ResumenSemanal";
import type { Cita, MovimientoBolsa, ResumenSemanal as ResumenType } from "@/lib/types";

const hoy = new Date();

const resumen: ResumenType = {
  ingresos: 1000,
  gastosVariables: 0,
  gastosFijos: 200,
  comisiones: 100,
  totalGastos: 300,
  libre: 700,
  porMetodo: { Efectivo: 1000, Tarjeta: 0, Transferencia: 0 },
  bolsas: [{ bolsaId: "b1", nombre: "Ahorro", porcentaje: 100, color: "#000", montoSemana: 700, acumulado: 0, gastosAsignados: 0 }],
};

// Ingresos del mes: $10,000 (aunque la semana solo lleve $1,000)
const citas: Cita[] = [{ fecha: hoy, timestamp: "", clienta: "Ana", servicios: [], costo: 10000, metodoPago: "Efectivo" }];

const movimientos: MovimientoBolsa[] = [
  {
    id: "m1", salonId: "s1", bolsaId: "b1", tipo: "egreso", monto: 500, metodoPago: "Efectivo", descripcion: "Tinte",
    fecha: `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`,
    createdAt: "", origen: "manual", esCostoServicio: true,
  },
];

describe("ResumenSemanal", () => {
  it("muestra el dinero libre con su fórmula", () => {
    render(<ResumenSemanal resumen={resumen} citas={citas} />);
    expect(screen.getByText("Dinero libre")).toBeInTheDocument();
    expect(screen.getByText("Ingresos − Gastos fijos − Comisiones")).toBeInTheDocument();
  });

  it("Productos del mes se compara contra el ingreso del mes, no de la semana", () => {
    render(<ResumenSemanal resumen={resumen} citas={citas} movimientos={movimientos} />);
    // 500 / 10,000 = 5.0% (contra la semana daría 50%)
    expect(screen.getByText("5.0% de los ingresos del mes")).toBeInTheDocument();
  });

  it("los gastos fijos abren su detalle", () => {
    render(
      <ResumenSemanal
        resumen={resumen}
        citas={citas}
        gastosFijos={[{ id: "g", nombre: "Renta", monto: 800, frecuencia: "mensual", categoria: "renta" }]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Gastos fijos/ }));
    expect(screen.getByText("Prorrateados a la semana (mensual ÷ 4)")).toBeInTheDocument();
    expect(screen.getByText("Renta")).toBeInTheDocument();
  });
});
