import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Salon, ResumenSemanal } from "@/lib/types";

// El useEffect de BolsasSection llama al store; lo mockeamos para aislar la UI.
vi.mock("@/lib/store", () => ({
  getCierres: vi.fn().mockResolvedValue([]),
  addCierre: vi.fn().mockResolvedValue(true),
  getAcumulados: vi.fn().mockResolvedValue({}),
  saveAcumulados: vi.fn().mockResolvedValue(undefined),
}));

import BolsasSection from "../dashboard/BolsasSection";

const salon: Salon = {
  id: "s1",
  nombre: "Salón Test",
  color: "#7B4F2E",
  sheetId: "",
  comisionTarjeta: 0,
  bolsaDefaultGastosId: null,
  createdAt: "",
  bolsas: [
    { id: "b1", nombre: "Sueldo", porcentaje: 50, color: "#000", acumulado: 0, naturaleza: "gasto_operativo" },
    { id: "b2", nombre: "Reparto", porcentaje: 50, color: "#111", acumulado: 0, naturaleza: "reparto" },
  ],
  gastosFijos: [
    { id: "gf1", nombre: "Renta", monto: 8000, frecuencia: "mensual", categoria: "renta" }, // /4 = 2000
    { id: "gf2", nombre: "Luz", monto: 500, frecuencia: "semanal", categoria: "servicios" }, // 500
  ],
};

const resumen: ResumenSemanal = {
  ingresos: 10000,
  gastosVariables: 0,
  gastosFijos: 2500,
  comisiones: 0,
  totalGastos: 2500,
  libre: 8000,
  porMetodo: { Efectivo: 10000, Tarjeta: 0, Transferencia: 0 },
  bolsas: [
    { bolsaId: "b1", nombre: "Sueldo", porcentaje: 50, color: "#000", montoSemana: 4000, acumulado: 0, gastosAsignados: 0 },
    { bolsaId: "b2", nombre: "Reparto", porcentaje: 50, color: "#111", montoSemana: 4000, acumulado: 0, gastosAsignados: 0 },
  ],
};

describe("BolsasSection — copia para WhatsApp incluye gastos fijos", () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  beforeEach(() => {
    writeText.mockClear();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  });

  it("renderiza las bolsas y el botón de copiar", () => {
    render(
      <BolsasSection resumen={resumen} salon={salon} salonColor={salon.color}
        citas={[]} gastos={[]} movimientos={[]} onCierreCompleto={() => {}} onMovimiento={() => {}} />
    );
    expect(screen.getByText("A repartir")).toBeInTheDocument();
    expect(screen.getByText("Copiar")).toBeInTheDocument();
  });

  it("el texto copiado contiene bolsas, total libre y los gastos fijos prorrateados", async () => {
    render(
      <BolsasSection resumen={resumen} salon={salon} salonColor={salon.color}
        citas={[]} gastos={[]} movimientos={[]} onCierreCompleto={() => {}} onMovimiento={() => {}} />
    );

    fireEvent.click(screen.getByText("Copiar"));
    await screen.findByText("Copiado"); // confirma que el copy resolvió

    expect(writeText).toHaveBeenCalledTimes(1);
    const texto = writeText.mock.calls[0][0] as string;

    // Bolsas + total libre
    expect(texto).toContain("Sueldo: $4,000");
    expect(texto).toContain("Total libre: $8,000");
    // Gastos fijos (Renta mensual 8000/4 = 2000; Luz semanal = 500; total 2500)
    expect(texto).toContain("Gastos fijos");
    expect(texto).toContain("Renta: $2,000");
    expect(texto).toContain("Luz: $500");
    expect(texto).toContain("Total gastos fijos: $2,500");
  });
});
