import { describe, it, expect } from "vitest";
import { calcularSalud, agruparVisitas, gastosFijosMes, pctGastoOperativo } from "../salud";
import type { Cita, Gasto, GastoFijo, Bolsa, MetodoPago } from "../types";

function cita(clienta: string, dia: number, costo: number, metodoPago: MetodoPago = "Efectivo"): Cita {
  return {
    fecha: new Date(2026, 4, dia, 12, 0, 0), // mayo 2026
    timestamp: "",
    clienta,
    servicios: [],
    costo,
    metodoPago,
  };
}

function gasto(dia: number, monto: number, categoria?: Gasto["categoria"]): Gasto {
  return {
    fecha: new Date(2026, 4, dia, 12, 0, 0),
    timestamp: "",
    descripcion: "x",
    monto,
    metodoPago: "Efectivo",
    source: "sheets",
    categoria,
  };
}

const bolsas: Bolsa[] = [
  { id: "b1", nombre: "Sueldo dueñas", porcentaje: 50, color: "#000", acumulado: 0, naturaleza: "gasto_operativo" },
  { id: "b2", nombre: "Reparto", porcentaje: 50, color: "#111", acumulado: 0, naturaleza: "reparto" },
];

const gastosFijos: GastoFijo[] = [
  { id: "gf1", nombre: "Renta", monto: 12000, frecuencia: "mensual", categoria: "renta" },
];

describe("helpers", () => {
  it("agruparVisitas: misma clienta + misma fecha = 1 visita", () => {
    const citas = [cita("Ana", 5, 200), cita("Ana", 5, 300), cita("Ana", 6, 100)];
    const visitas = agruparVisitas(citas, 0);
    expect(visitas.length).toBe(2);
    expect(visitas.find((v) => v.fechaKey.endsWith("05"))?.total).toBe(500);
  });

  it("gastosFijosMes: semanal × 4, mensual × 1", () => {
    expect(gastosFijosMes([
      { id: "a", nombre: "", monto: 1000, frecuencia: "semanal", categoria: "otros" },
      { id: "b", nombre: "", monto: 8000, frecuencia: "mensual", categoria: "renta" },
    ])).toBe(12000);
  });

  it("pctGastoOperativo: suma solo naturaleza gasto_operativo", () => {
    expect(pctGastoOperativo(bolsas)).toBeCloseTo(0.5);
  });
});

describe("calcularSalud — ejemplo del documento de trazabilidad", () => {
  // 40,000 ingresos, 12,000 fijos, 3,000 variables, bolsa gasto_operativo 50%
  const citas = [
    cita("Ana", 5, 10000),
    cita("Bea", 10, 10000),
    cita("Cata", 15, 10000),
    cita("Dani", 20, 10000),
  ];
  const gastos = [gasto(12, 3000, "insumos")];
  const hoy = new Date(2026, 4, 31, 12, 0, 0); // dentro de mayo

  const salud = calcularSalud(citas, gastos, gastosFijos, bolsas, 2026, 4, 0, hoy);

  it("ingresos del mes = 40,000", () => {
    expect(salud.ingresosMes).toBe(40000);
  });

  it("punto de equilibrio = fijos + sueldo operativo = 26,000", () => {
    // libre = 40000 - 12000 = 28000; sueldoOperativo = 28000 * 0.5 = 14000
    expect(salud.peMonto).toBe(26000);
  });

  it("utilidad = 40000 - 12000 - 3000 - 14000 = 11,000", () => {
    expect(salud.utilidad).toBe(11000);
  });

  it("margen neto = 27.5%", () => {
    expect(salud.margenNeto.valor).toBeCloseTo(27.5);
    expect(salud.margenNeto.semaforo).toBe("verde");
  });

  it("costo de personal incluye el sueldo de las dueñas (bolsa)", () => {
    // nómina = 14000 (bolsa) / 40000 = 35%
    expect(salud.costoPersonal.valor).toBeCloseTo(35);
  });

  it("renta % = 12000/40000 = 30% (rojo)", () => {
    expect(salud.rentaPct.valor).toBeCloseTo(30);
    expect(salud.rentaPct.semaforo).toBe("rojo");
  });
});

describe("calcularSalud — scorecard sin desbordar a fin de mes", () => {
  it("gasto de meses previos no incluye días del mes siguiente (día 31 sobre mes de 30)", () => {
    const hoy = new Date(2026, 4, 31, 12, 0, 0); // 31 de mayo (diaDelMes = 31)
    const gastos: Gasto[] = [
      { fecha: new Date(2026, 3, 15), timestamp: "", descripcion: "", monto: 100, metodoPago: "Efectivo", source: "sheets" },
      { fecha: new Date(2026, 3, 30), timestamp: "", descripcion: "", monto: 200, metodoPago: "Efectivo", source: "sheets" },
      { fecha: new Date(2026, 4, 1), timestamp: "", descripcion: "", monto: 999, metodoPago: "Efectivo", source: "sheets" }, // mayo 1: NO debe contar para abril
    ];
    const salud = calcularSalud([], gastos, gastosFijos, bolsas, 2026, 4, 0, hoy);
    // Abril acumula 100+200 = 300; Mar y Feb = 0 → promedio = 100. El $999 de mayo queda fuera.
    expect(salud.scorecard.gastoPromedioMesesPrevios).toBeCloseTo(100);
  });
});

describe("calcularSalud — clientas en riesgo", () => {
  it("detecta clienta cuya última visita supera 1.5× su frecuencia", () => {
    const hoy = new Date(2026, 4, 31, 12, 0, 0);
    // Ana visita cada ~10 días, última hace 40 días → en riesgo
    const citas = [
      { ...cita("Ana", 1, 500), fecha: new Date(2026, 2, 1) },
      { ...cita("Ana", 11, 500), fecha: new Date(2026, 2, 11) },
      { ...cita("Ana", 21, 500), fecha: new Date(2026, 2, 21) }, // última: ~70 días antes de hoy
    ];
    const salud = calcularSalud(citas, [], gastosFijos, bolsas, 2026, 4, 0, hoy);
    expect(salud.clientasEnRiesgo.some((c) => c.clienta === "Ana")).toBe(true);
  });
});
