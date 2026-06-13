import { describe, it, expect } from "vitest";
import { calcularDatosGraficas, calcularDatosGraficasAnual } from "../calculations";
import type { Cita, Gasto, MetodoPago, ServicioItem } from "../types";

function cita(clienta: string, dia: number, servicios: ServicioItem[], metodoPago: MetodoPago = "Efectivo"): Cita {
  const costo = servicios.reduce((s, x) => s + x.costo, 0);
  return { fecha: new Date(2026, 4, dia, 12), timestamp: "", clienta, servicios, costo, metodoPago };
}
const serv = (nombre: string, costo: number): ServicioItem => ({ tipo: "servicio", nombre, costo });
const prod = (nombre: string, costo: number): ServicioItem => ({ tipo: "producto", nombre, costo });

function gasto(dia: number, descripcion: string, monto: number): Gasto {
  return { fecha: new Date(2026, 4, dia, 12), timestamp: "", descripcion, monto, metodoPago: "Efectivo", source: "sheets" };
}

describe("calcularDatosGraficas — números de las gráficas", () => {
  const citas: Cita[] = [
    cita("Ana", 2, [serv("Corte", 200), prod("Shampoo", 100)], "Efectivo"),
    cita("Ana", 9, [serv("Corte", 200)], "Tarjeta"),
    cita("Bea", 9, [serv("Tinte", 500), prod("Shampoo", 100)], "Transferencia"),
  ];
  const gastos: Gasto[] = [gasto(3, "Luz", 800), gasto(10, "Luz", 200), gasto(11, "Productos", 500)];
  const d = calcularDatosGraficas(citas, gastos, 2026, 4, 0);

  it("top servicios: agrega por nombre, ordenado por total", () => {
    expect(d.topServicios[0]).toEqual({ nombre: "Tinte", cantidad: 1, total: 500 });
    const corte = d.topServicios.find((s) => s.nombre === "Corte");
    expect(corte).toEqual({ nombre: "Corte", cantidad: 2, total: 400 });
  });

  it("top productos: Shampoo aparece 2 veces, total 200", () => {
    expect(d.topProductos.find((p) => p.nombre === "Shampoo")).toEqual({ nombre: "Shampoo", cantidad: 2, total: 200 });
  });

  it("top gastos: Luz agrupado (2 registros, 1000), ordenado por total", () => {
    expect(d.topGastos[0]).toEqual({ descripcion: "Luz", cantidad: 2, total: 1000 });
    expect(d.topGastos.find((g) => g.descripcion === "Productos")?.total).toBe(500);
  });

  it("distribución por método de pago suma por método", () => {
    const ef = d.distribucionMetodo.find((m) => m.metodo === "Efectivo");
    expect(ef?.total).toBe(300); // 200 + 100
    const tr = d.distribucionMetodo.find((m) => m.metodo === "Transferencia");
    expect(tr?.total).toBe(600); // 500 + 100
  });

  it("top clientas por gasto y por citas", () => {
    // Ana: 300 (efectivo) + 200 (tarjeta) = 500; Bea: 600 → Bea primero
    expect(d.topClientasPorGasto[0]).toEqual({ nombre: "Bea", total: 600 });
    expect(d.topClientasPorCitas.find((c) => c.nombre === "Ana")?.citas).toBe(2);
  });

  it("evolución mensual devuelve 6 meses", () => {
    expect(d.evolucionMensual.length).toBe(6);
    expect(d.evolucionMensual[5].total).toBe(1100); // mayo: 300 (efvo) + 200 (tarj) + 600 (transf)
  });
});

describe("calcularDatosGraficasAnual", () => {
  it("incluye citas de distintos meses del año", () => {
    const citas: Cita[] = [
      { fecha: new Date(2026, 0, 5), timestamp: "", clienta: "Ana", servicios: [serv("Corte", 100)], costo: 100, metodoPago: "Efectivo" },
      { fecha: new Date(2026, 6, 5), timestamp: "", clienta: "Bea", servicios: [serv("Corte", 300)], costo: 300, metodoPago: "Efectivo" },
    ];
    const d = calcularDatosGraficasAnual(citas, [], 2026, 0);
    const total = d.distribucionMetodo.reduce((s, m) => s + m.total, 0);
    expect(total).toBe(400);
  });
});
