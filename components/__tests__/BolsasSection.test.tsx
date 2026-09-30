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
import { getCierres } from "@/lib/store";

const salon: Salon = {
  id: "s1",
  nombre: "Salón Test",
  color: "#7B4F2E",
  sheetId: "",
  dataSource: "sheets",
  neonSalonId: null,
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

  it("el texto copiado lista bolsas y gastos fijos prorrateados, sin secciones ni totales", async () => {
    render(
      <BolsasSection resumen={resumen} salon={salon} salonColor={salon.color}
        citas={[]} gastos={[]} movimientos={[]} onCierreCompleto={() => {}} onMovimiento={() => {}} />
    );

    fireEvent.click(screen.getByText("Copiar"));
    await screen.findByText("Copiado"); // confirma que el copy resolvió

    expect(writeText).toHaveBeenCalledTimes(1);
    const texto = writeText.mock.calls[0][0] as string;
    const titulo = texto.split("\n")[0];

    // Renta mensual 8000/4 = 2000; Luz semanal = 500
    expect(texto).toBe(
      [
        titulo,
        "",
        "📦 Sueldo: $4,000",
        "📦 Reparto: $4,000",
        "",
        "• Renta: $2,000",
        "• Luz: $500",
      ].join("\n")
    );
    expect(titulo).toMatch(/^💰 \*Distribución semana .+\*$/);
    expect(texto).not.toContain("Total");
    expect(texto).not.toContain("Gastos fijos");
  });

  it("una semana del historial copia el desglose guardado en su cierre", async () => {
    vi.mocked(getCierres).mockResolvedValueOnce([
      {
        fecha: "2026-08-24T10:00:00.000Z",
        semanaInicio: "2026-08-17",
        semanaFin: "2026-08-23",
        ingresos: 12000,
        gastos: 2500,
        libre: 9500,
        bolsas: [
          { bolsaId: "b1", nombre: "Sueldo", monto: 4750 },
          { bolsaId: "b2", nombre: "Reparto", monto: 4750 },
        ],
      },
    ]);
    render(
      <BolsasSection resumen={resumen} salon={salon} salonColor={salon.color}
        citas={[]} gastos={[]} movimientos={[]} onCierreCompleto={() => {}} onMovimiento={() => {}} />
    );

    fireEvent.click(await screen.findByText("1 semanas"));
    fireEvent.click(screen.getByText("Semana 17 – 23 Ago 2026"));
    fireEvent.click(await screen.findByText("Copiar semana"));
    await screen.findByText("Copiado");

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toBe(
      [
        "💰 *Distribución semana 17 – 23 Ago 2026*",
        "",
        "📦 Sueldo: $4,750",
        "📦 Reparto: $4,750",
        "",
        "• Renta: $2,000",
        "• Luz: $500",
      ].join("\n")
    );
  });
});
