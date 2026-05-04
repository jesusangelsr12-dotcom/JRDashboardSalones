import { describe, it, expect } from "vitest";
import { calcularGastoProductosMes } from "../calculations";
import type { MovimientoBolsa } from "../types";

function makeMovimiento(overrides: Partial<MovimientoBolsa> = {}): MovimientoBolsa {
  return {
    id: "m1",
    salonId: "s1",
    bolsaId: "b1",
    tipo: "egreso",
    monto: 500,
    metodoPago: "Efectivo",
    descripcion: "Tinte",
    fecha: "2026-05-01",
    createdAt: "2026-05-01T00:00:00Z",
    origen: "manual",
    esCostoServicio: true,
    ...overrides,
  };
}

describe("calcularGastoProductosMes", () => {
  it("returns zero and verde when no product movements exist", () => {
    const movimientos = [
      makeMovimiento({ esCostoServicio: false }),
      makeMovimiento({ tipo: "ingreso", esCostoServicio: false }),
    ];

    const result = calcularGastoProductosMes(movimientos, 10000, 4, 2026);

    expect(result.totalProductos).toBe(0);
    expect(result.ratio).toBe(0);
    expect(result.semaforo).toBe("verde");
  });

  it("returns amarillo when ratio is between 15% and 20%", () => {
    const movimientos = [
      makeMovimiento({ monto: 1800, fecha: "2026-05-10" }),
    ];

    const result = calcularGastoProductosMes(movimientos, 10000, 4, 2026);

    expect(result.totalProductos).toBe(1800);
    expect(result.ratio).toBeCloseTo(18);
    expect(result.semaforo).toBe("amarillo");
  });

  it("returns rojo when ratio exceeds 20%", () => {
    const movimientos = [
      makeMovimiento({ monto: 1500, fecha: "2026-05-05" }),
      makeMovimiento({ monto: 1000, fecha: "2026-05-15" }),
    ];

    const result = calcularGastoProductosMes(movimientos, 10000, 4, 2026);

    expect(result.totalProductos).toBe(2500);
    expect(result.ratio).toBeCloseTo(25);
    expect(result.semaforo).toBe("rojo");
  });

  it("returns 0 ratio without error when ingresos is 0", () => {
    const movimientos = [
      makeMovimiento({ monto: 500, fecha: "2026-05-01" }),
    ];

    const result = calcularGastoProductosMes(movimientos, 0, 4, 2026);

    expect(result.totalProductos).toBe(500);
    expect(result.ratio).toBe(0);
    expect(result.semaforo).toBe("verde");
  });

  it("ignores movements from other months", () => {
    const movimientos = [
      makeMovimiento({ monto: 3000, fecha: "2026-04-15" }),
      makeMovimiento({ monto: 200, fecha: "2026-05-10" }),
    ];

    const result = calcularGastoProductosMes(movimientos, 10000, 4, 2026);

    expect(result.totalProductos).toBe(200);
    expect(result.ratio).toBeCloseTo(2);
    expect(result.semaforo).toBe("verde");
  });
});
