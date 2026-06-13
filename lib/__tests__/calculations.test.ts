import { describe, it, expect } from "vitest";
import {
  calcularResumenSemanal,
  calcularResumenParaSemana,
  getLunesDeSemana,
  getDomingoDeSemana,
  formatMoney,
  detectarSemanas,
} from "../calculations";
import type { Cita, Gasto, Bolsa, GastoFijo, CierreSemana } from "../types";

// ── Helpers ──

function makeCita(overrides: Partial<Cita> = {}): Cita {
  return {
    fecha: new Date("2026-02-23T10:00:00"), // Monday
    timestamp: "2026-02-23",
    clienta: "Test",
    servicios: [{ tipo: "servicio", nombre: "Corte", costo: 500 }],
    costo: 500,
    metodoPago: "Efectivo",
    ...overrides,
  };
}

function makeGasto(overrides: Partial<Gasto> = {}): Gasto {
  return {
    fecha: new Date("2026-02-23T10:00:00"),
    timestamp: "2026-02-23",
    descripcion: "Shampoo",
    monto: 100,
    metodoPago: "Efectivo",
    ...overrides,
  };
}

const bolsas: Bolsa[] = [
  { id: "b1", nombre: "Materiales", porcentaje: 60, color: "#000", acumulado: 1000, naturaleza: "reparto" },
  { id: "b2", nombre: "Sueldo", porcentaje: 40, color: "#111", acumulado: 500, naturaleza: "gasto_operativo" },
];

const gastosFijos: GastoFijo[] = [
  { id: "gf1", nombre: "Renta", monto: 8000, frecuencia: "mensual", categoria: "renta" },
];

// ── Date helpers ──

describe("getLunesDeSemana", () => {
  it("returns Monday for a Wednesday", () => {
    const wed = new Date("2026-02-25T12:00:00"); // Wednesday
    const lunes = getLunesDeSemana(wed);
    expect(lunes.getDay()).toBe(1); // Monday
    expect(lunes.getDate()).toBe(23);
  });

  it("returns Monday for a Sunday", () => {
    const sun = new Date("2026-03-01T12:00:00"); // Sunday
    const lunes = getLunesDeSemana(sun);
    expect(lunes.getDay()).toBe(1);
    expect(lunes.getDate()).toBe(23); // Previous Monday
  });

  it("returns same day for a Monday", () => {
    const mon = new Date("2026-02-23T12:00:00");
    const lunes = getLunesDeSemana(mon);
    expect(lunes.getDate()).toBe(23);
  });
});

describe("getDomingoDeSemana", () => {
  it("returns Sunday of the same week", () => {
    const wed = new Date("2026-02-25T12:00:00");
    const domingo = getDomingoDeSemana(wed);
    expect(domingo.getDay()).toBe(0);
    expect(domingo.getDate()).toBe(1); // March 1
  });
});

describe("formatMoney", () => {
  it("formats positive numbers as MXN currency", () => {
    const result = formatMoney(1500);
    expect(result).toContain("1,500");
  });

  it("formats zero", () => {
    const result = formatMoney(0);
    expect(result).toContain("0");
  });
});

// ── Resumen semanal ──

describe("calcularResumenSemanal", () => {
  it("calculates correct libre = ingresos - gastosFijos", () => {
    // Renta 8000/4 = 2000 semanal
    const citas = [makeCita({ costo: 5000 })];
    const acumulados = { b1: 1000, b2: 500 };

    const resumen = calcularResumenSemanal(
      citas, [], bolsas, gastosFijos, acumulados, null
    );

    expect(resumen.ingresos).toBe(5000);
    expect(resumen.gastosFijos).toBe(2000); // 8000 / 4
    expect(resumen.libre).toBe(3000); // 5000 - 2000
  });

  it("assigns gastos to bolsa via bolsaId", () => {
    const citas = [makeCita({ costo: 5000 })];
    const gastos = [makeGasto({ monto: 200, bolsaId: "b1" })];
    const acumulados = { b1: 1000, b2: 500 };

    const resumen = calcularResumenSemanal(
      citas, gastos, bolsas, gastosFijos, acumulados, null
    );

    const bolsaB1 = resumen.bolsas.find((b) => b.bolsaId === "b1");
    expect(bolsaB1?.gastosAsignados).toBe(200);
  });

  it("assigns gastos to default bolsa when no bolsaId", () => {
    const citas = [makeCita({ costo: 5000 })];
    const gastos = [makeGasto({ monto: 300 })]; // no bolsaId
    const acumulados = { b1: 1000, b2: 500 };

    const resumen = calcularResumenSemanal(
      citas, gastos, bolsas, gastosFijos, acumulados, "b2" // default bolsa
    );

    const bolsaB2 = resumen.bolsas.find((b) => b.bolsaId === "b2");
    expect(bolsaB2?.gastosAsignados).toBe(300);
  });

  it("does not assign gastos to any bolsa when no bolsaId and no default", () => {
    const citas = [makeCita({ costo: 5000 })];
    const gastos = [makeGasto({ monto: 300 })];
    const acumulados = { b1: 1000, b2: 500 };

    const resumen = calcularResumenSemanal(
      citas, gastos, bolsas, gastosFijos, acumulados, null
    );

    const totalGastosAsignados = resumen.bolsas.reduce((s, b) => s + b.gastosAsignados, 0);
    expect(totalGastosAsignados).toBe(0);
  });

  it("distributes libre correctly by percentage", () => {
    const citas = [makeCita({ costo: 5000 })];
    const acumulados = { b1: 0, b2: 0 };

    const resumen = calcularResumenSemanal(
      citas, [], bolsas, gastosFijos, acumulados, null
    );

    // libre = 3000
    const b1 = resumen.bolsas.find((b) => b.bolsaId === "b1");
    const b2 = resumen.bolsas.find((b) => b.bolsaId === "b2");
    expect(b1?.montoSemana).toBe(1800); // 3000 * 60%
    expect(b2?.montoSemana).toBe(1200); // 3000 * 40%
  });

  it("gives zero to bolsas when libre is negative", () => {
    const citas = [makeCita({ costo: 100 })]; // Very low income
    const acumulados = { b1: 0, b2: 0 };

    const resumen = calcularResumenSemanal(
      citas, [], bolsas, gastosFijos, acumulados, null
    );

    expect(resumen.libre).toBeLessThan(0);
    resumen.bolsas.forEach((b) => {
      expect(b.montoSemana).toBe(0);
    });
  });

  it("includes acumulados from DB", () => {
    const acumulados = { b1: 5000, b2: 3000 };

    const resumen = calcularResumenSemanal(
      [], [], bolsas, gastosFijos, acumulados, null
    );

    expect(resumen.bolsas.find((b) => b.bolsaId === "b1")?.acumulado).toBe(5000);
    expect(resumen.bolsas.find((b) => b.bolsaId === "b2")?.acumulado).toBe(3000);
  });

  it("tracks porMetodo correctly", () => {
    const citas = [
      makeCita({ costo: 1000, metodoPago: "Efectivo" }),
      makeCita({ costo: 2000, metodoPago: "Tarjeta" }),
      makeCita({ costo: 500, metodoPago: "Transferencia" }),
    ];
    const acumulados = { b1: 0, b2: 0 };

    const resumen = calcularResumenSemanal(
      citas, [], bolsas, gastosFijos, acumulados, null
    );

    expect(resumen.porMetodo.Efectivo).toBe(1000);
    expect(resumen.porMetodo.Tarjeta).toBe(2000);
    expect(resumen.porMetodo.Transferencia).toBe(500);
  });
});

// ── calcularResumenParaSemana ──

describe("calcularResumenParaSemana", () => {
  it("calculates gastosPorBolsa with default bolsa", () => {
    const citas = [makeCita({ costo: 10000 })];
    const gastos = [
      makeGasto({ monto: 200, bolsaId: "b1" }),
      makeGasto({ monto: 150 }), // goes to default
    ];

    const result = calcularResumenParaSemana(
      citas, gastos, gastosFijos,
      "2026-02-23", "2026-03-01", "b2"
    );

    expect(result.gastosPorBolsa["b1"]).toBe(200);
    expect(result.gastosPorBolsa["b2"]).toBe(150);
  });

  it("does not assign gastos without bolsa when no default", () => {
    const gastos = [makeGasto({ monto: 200 })];

    const result = calcularResumenParaSemana(
      [], gastos, gastosFijos,
      "2026-02-23", "2026-03-01", null
    );

    expect(Object.keys(result.gastosPorBolsa).length).toBe(0);
  });

  it("filters by date range correctly", () => {
    const citas = [
      makeCita({ fecha: new Date("2026-02-23T10:00:00"), costo: 1000 }), // In range
      makeCita({ fecha: new Date("2026-03-05T10:00:00"), costo: 2000 }), // Out of range
    ];

    const result = calcularResumenParaSemana(
      citas, [], gastosFijos,
      "2026-02-23", "2026-03-01", null
    );

    expect(result.ingresos).toBe(1000);
  });
});

// ── detectarSemanas ──

describe("detectarSemanas", () => {
  it("detects weeks from citas data", () => {
    const citas = [
      makeCita({ fecha: new Date("2026-02-23T10:00:00") }),
      makeCita({ fecha: new Date("2026-02-16T10:00:00") }),
    ];

    const semanas = detectarSemanas(citas, [], gastosFijos, [], null);

    expect(semanas.length).toBeGreaterThanOrEqual(2);
  });

  it("marks closed weeks correctly", () => {
    const citas = [makeCita({ fecha: new Date("2026-02-16T10:00:00") })];
    const cierres: CierreSemana[] = [
      {
        fecha: "2026-02-22",
        semanaInicio: "2026-02-16",
        semanaFin: "2026-02-22",
        ingresos: 5000,
        gastos: 2000,
        libre: 3000,
        bolsas: [],
      },
    ];

    const semanas = detectarSemanas(citas, [], gastosFijos, cierres, null);
    const semanaCerrada = semanas.find((s) => s.semanaInicio === "2026-02-16");

    expect(semanaCerrada?.cerrada).toBe(true);
  });
});
