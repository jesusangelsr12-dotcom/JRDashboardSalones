import { describe, it, expect } from "vitest";
import type { Cita, Gasto, MovimientoBolsa } from "../types";

/**
 * Tests the payment method totals logic used in ResumenMetodoPago component.
 * Extracted here as pure functions to test without React.
 */

function calcularTotalesPorMetodo(
  citas: Cita[],
  gastos: Gasto[],
  movimientos: MovimientoBolsa[]
) {
  const entradas: Record<string, number> = { Efectivo: 0, Tarjeta: 0, Transferencia: 0 };
  const salidas: Record<string, number> = { Efectivo: 0, Tarjeta: 0, Transferencia: 0 };

  citas.forEach((c) => {
    entradas[c.metodoPago] = (entradas[c.metodoPago] || 0) + c.costo;
  });

  gastos.forEach((g) => {
    salidas[g.metodoPago] = (salidas[g.metodoPago] || 0) + g.monto;
  });

  movimientos.forEach((m) => {
    if (m.tipo === "ingreso") {
      entradas[m.metodoPago] = (entradas[m.metodoPago] || 0) + m.monto;
    } else {
      salidas[m.metodoPago] = (salidas[m.metodoPago] || 0) + m.monto;
    }
  });

  return { entradas, salidas };
}

function makeCita(metodo: string, costo: number): Cita {
  return {
    fecha: new Date("2026-02-23"),
    timestamp: "",
    clienta: "Test",
    servicios: [],
    costo,
    metodoPago: metodo as Cita["metodoPago"],
  };
}

function makeGasto(metodo: string, monto: number): Gasto {
  return {
    fecha: new Date("2026-02-23"),
    timestamp: "",
    descripcion: "Test",
    monto,
    metodoPago: metodo as Gasto["metodoPago"],
  };
}

function makeMovimiento(
  tipo: "ingreso" | "egreso",
  metodo: string,
  monto: number
): MovimientoBolsa {
  return {
    id: "m1",
    salonId: "s1",
    bolsaId: "b1",
    tipo,
    monto,
    metodoPago: metodo as MovimientoBolsa["metodoPago"],
    descripcion: "Test",
    fecha: "2026-02-23",
    createdAt: "2026-02-23",
    origen: "manual" as const,
  };
}

describe("calcularTotalesPorMetodo", () => {
  it("sums citas as entradas by method", () => {
    const citas = [
      makeCita("Efectivo", 1000),
      makeCita("Tarjeta", 2000),
      makeCita("Efectivo", 500),
    ];

    const { entradas } = calcularTotalesPorMetodo(citas, [], []);

    expect(entradas.Efectivo).toBe(1500);
    expect(entradas.Tarjeta).toBe(2000);
    expect(entradas.Transferencia).toBe(0);
  });

  it("sums gastos as salidas by method", () => {
    const gastos = [
      makeGasto("Efectivo", 300),
      makeGasto("Transferencia", 700),
    ];

    const { salidas } = calcularTotalesPorMetodo([], gastos, []);

    expect(salidas.Efectivo).toBe(300);
    expect(salidas.Transferencia).toBe(700);
    expect(salidas.Tarjeta).toBe(0);
  });

  it("handles movimiento ingreso as entrada", () => {
    const movimientos = [
      makeMovimiento("ingreso", "Tarjeta", 5000),
    ];

    const { entradas } = calcularTotalesPorMetodo([], [], movimientos);

    expect(entradas.Tarjeta).toBe(5000);
  });

  it("handles movimiento egreso as salida", () => {
    const movimientos = [
      makeMovimiento("egreso", "Efectivo", 3000),
    ];

    const { salidas } = calcularTotalesPorMetodo([], [], movimientos);

    expect(salidas.Efectivo).toBe(3000);
  });

  it("calculates correct net per method", () => {
    const citas = [makeCita("Efectivo", 5000)];
    const gastos = [makeGasto("Efectivo", 1000)];
    const movimientos = [
      makeMovimiento("ingreso", "Efectivo", 500),
      makeMovimiento("egreso", "Efectivo", 200),
    ];

    const { entradas, salidas } = calcularTotalesPorMetodo(citas, gastos, movimientos);

    // Entradas: 5000 (cita) + 500 (mov ingreso) = 5500
    expect(entradas.Efectivo).toBe(5500);
    // Salidas: 1000 (gasto) + 200 (mov egreso) = 1200
    expect(salidas.Efectivo).toBe(1200);
    // Net: 5500 - 1200 = 4300
    expect(entradas.Efectivo - salidas.Efectivo).toBe(4300);
  });

  it("handles empty data", () => {
    const { entradas, salidas } = calcularTotalesPorMetodo([], [], []);

    expect(entradas.Efectivo).toBe(0);
    expect(entradas.Tarjeta).toBe(0);
    expect(entradas.Transferencia).toBe(0);
    expect(salidas.Efectivo).toBe(0);
    expect(salidas.Tarjeta).toBe(0);
    expect(salidas.Transferencia).toBe(0);
  });

  it("mixes all sources correctly", () => {
    const citas = [
      makeCita("Efectivo", 3000),
      makeCita("Tarjeta", 2000),
    ];
    const gastos = [
      makeGasto("Efectivo", 500),
      makeGasto("Tarjeta", 300),
    ];
    const movimientos = [
      makeMovimiento("ingreso", "Transferencia", 10000),
      makeMovimiento("egreso", "Transferencia", 4000),
    ];

    const { entradas, salidas } = calcularTotalesPorMetodo(citas, gastos, movimientos);

    // Efectivo: 3000 in, 500 out → net 2500
    expect(entradas.Efectivo - salidas.Efectivo).toBe(2500);
    // Tarjeta: 2000 in, 300 out → net 1700
    expect(entradas.Tarjeta - salidas.Tarjeta).toBe(1700);
    // Transferencia: 10000 in, 4000 out → net 6000
    expect(entradas.Transferencia - salidas.Transferencia).toBe(6000);
  });
});
