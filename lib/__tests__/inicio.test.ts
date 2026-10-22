import { describe, it, expect } from "vitest";
import type { Cita, Salon, CierreSemana } from "../types";
import { calcularSalud, calcularSaludMismoTramoAnterior } from "../salud";
import { proyectarMes, ingresosUltimasSemanas, resumirSalon, consolidar, alertasInicio } from "../inicio";

const HOY = new Date(2026, 9, 22, 12); // jueves 22 oct 2026

function cita(fecha: Date, costo: number, clienta = "Ana"): Cita {
  return { fecha, timestamp: "", clienta, servicios: [], costo, metodoPago: "Efectivo" };
}

function salon(id: string, renta: number): Salon {
  return {
    id,
    nombre: `Salón ${id}`,
    color: "#000",
    sheetId: "",
    dataSource: "sheets",
    neonSalonId: null,
    comisionTarjeta: 0,
    bolsaDefaultGastosId: null,
    createdAt: "",
    bolsas: [
      { id: `${id}-b1`, nombre: "Sueldo", porcentaje: 30, color: "#000", acumulado: 0, naturaleza: "gasto_operativo" },
      { id: `${id}-b2`, nombre: "Ahorro", porcentaje: 70, color: "#111", acumulado: 0, naturaleza: "reserva" },
    ],
    gastosFijos: [{ id: `${id}-gf`, nombre: "Renta", monto: renta, frecuencia: "mensual", categoria: "renta" }],
  };
}

describe("calcularSaludMismoTramoAnterior", () => {
  it("corta el mes anterior al mismo día que hoy (1–22 sep)", () => {
    const citas = [
      cita(new Date(2026, 8, 10), 1000), // dentro del tramo
      cita(new Date(2026, 8, 22, 18), 500), // último día del tramo
      cita(new Date(2026, 8, 25), 9000), // fuera del tramo: no cuenta
    ];
    const { salud, corte } = calcularSaludMismoTramoAnterior(citas, [], [], [], [], 2026, 9, 0, HOY);
    expect(corte.getMonth()).toBe(8);
    expect(corte.getDate()).toBe(22);
    expect(salud.ingresosMes).toBe(1500);
  });

  it("si el mes anterior es más corto, corta en su último día", () => {
    const hoy = new Date(2026, 2, 31, 12); // 31 de marzo → febrero tiene 28 días
    const { corte } = calcularSaludMismoTramoAnterior([], [], [], [], [], 2026, 2, 0, hoy);
    expect(corte.getMonth()).toBe(1);
    expect(corte.getDate()).toBe(28);
  });

  it("el mes completo sigue contando todo para comparar meses cerrados", () => {
    const citas = [cita(new Date(2026, 8, 10), 1000), cita(new Date(2026, 8, 25), 9000)];
    const completo = calcularSalud(citas, [], [], [], [], 2026, 8, 0, HOY);
    expect(completo.ingresosMes).toBe(10000);
  });
});

describe("Inicio del administrador", () => {
  it("proyecta el mes al ritmo diario", () => {
    // 22 días con $22,000 → $1,000 diarios × 31 días
    expect(proyectarMes(22000, HOY)).toBe(31000);
  });

  it("suma los ingresos de las últimas semanas cerradas (sin la semana en curso)", () => {
    const citas = [
      cita(new Date(2026, 9, 13), 300), // semana 12–18 oct
      cita(new Date(2026, 9, 6), 200), // semana 5–11 oct
      cita(new Date(2026, 9, 21), 999), // semana en curso: no cuenta
    ];
    const sem = ingresosUltimasSemanas(citas, 0, HOY, 3);
    expect(sem).toEqual([0, 200, 300]);
  });

  it("resume cada salón con las mismas fórmulas de Salud y consolida", () => {
    const citasA = [cita(new Date(2026, 9, 5), 30000), cita(new Date(2026, 8, 5), 20000)];
    const citasB = [cita(new Date(2026, 9, 6), 10000)];
    const cierres: CierreSemana[] = [
      { fecha: "", semanaInicio: "2026-10-12", semanaFin: "2026-10-18", ingresos: 0, gastos: 0, libre: 1234, bolsas: [] },
    ];
    const a = resumirSalon(salon("a", 3000), citasA, [], [], cierres, HOY);
    const b = resumirSalon(salon("b", 3000), citasB, [], [], [], HOY);

    expect(a.salud.ingresosMes).toBe(30000);
    expect(a.saludPrev.ingresosMes).toBe(20000);
    expect(a.cierreSemanaPasada?.libre).toBe(1234);
    expect(b.cierreSemanaPasada).toBeNull();

    const total = consolidar([a, b]);
    expect(total.ingresos).toBe(40000);
    expect(total.ingresosPrev).toBe(20000);
    expect(total.utilidad).toBeCloseTo(a.salud.utilidad + b.salud.utilidad, 6);
    expect(total.margen).toBeCloseTo((total.utilidad / 40000) * 100, 6);
  });

  it("alerta primero los salones en riesgo y nombra sus KPIs en rojo", () => {
    // Renta de 9,000 sobre 30,000 de venta = 30% → rojo
    const riesgo = resumirSalon(salon("r", 9000), [cita(new Date(2026, 9, 5), 30000)], [], [], [], HOY);
    const sano = resumirSalon(salon("s", 3000), [cita(new Date(2026, 9, 5), 30000)], [], [], [], HOY);
    expect(riesgo.salud.semaforoGlobal).toBe("rojo");

    const alertas = alertasInicio([sano, riesgo]);
    expect(alertas[0].salonId).toBe("r");
    expect(alertas[0].semaforo).toBe("rojo");
    expect(alertas[0].texto).toContain("La renta se lleva 30.0% de las ventas");
  });
});
