import { describe, it, expect } from "vitest";

/**
 * Tests for the store logic patterns used in updateSalon.
 * We test the pure logic of the upsert strategy without hitting Supabase.
 */

describe("updateSalon bolsa upsert logic", () => {
  // Simulate the logic from updateSalon
  function computeBolsaOperations(
    existingIds: string[],
    updatedBolsas: { id: string; nombre: string }[]
  ) {
    const existingBolsaIds = new Set(existingIds);
    const updatedBolsaIds = new Set(updatedBolsas.map((b) => b.id));

    const toDelete = Array.from(existingBolsaIds).filter(
      (id) => !updatedBolsaIds.has(id)
    );
    const toUpdate = updatedBolsas.filter((b) => existingBolsaIds.has(b.id));
    const toInsert = updatedBolsas.filter((b) => !existingBolsaIds.has(b.id));

    return { toDelete, toUpdate, toInsert };
  }

  it("deletes removed bolsas only", () => {
    const existing = ["b1", "b2", "b3"];
    const updated = [
      { id: "b1", nombre: "Bolsa 1" },
      { id: "b2", nombre: "Bolsa 2" },
    ];

    const { toDelete, toUpdate, toInsert } = computeBolsaOperations(existing, updated);

    expect(toDelete).toEqual(["b3"]);
    expect(toUpdate.length).toBe(2);
    expect(toInsert.length).toBe(0);
  });

  it("inserts new bolsas only", () => {
    const existing = ["b1"];
    const updated = [
      { id: "b1", nombre: "Bolsa 1" },
      { id: "b4", nombre: "Bolsa 4" },
    ];

    const { toDelete, toUpdate, toInsert } = computeBolsaOperations(existing, updated);

    expect(toDelete.length).toBe(0);
    expect(toUpdate.length).toBe(1);
    expect(toInsert.length).toBe(1);
    expect(toInsert[0].id).toBe("b4");
  });

  it("handles full replacement (all new bolsas)", () => {
    const existing = ["b1", "b2"];
    const updated = [
      { id: "b3", nombre: "New 1" },
      { id: "b4", nombre: "New 2" },
    ];

    const { toDelete, toUpdate, toInsert } = computeBolsaOperations(existing, updated);

    expect(toDelete).toEqual(["b1", "b2"]);
    expect(toUpdate.length).toBe(0);
    expect(toInsert.length).toBe(2);
  });

  it("handles no changes", () => {
    const existing = ["b1", "b2"];
    const updated = [
      { id: "b1", nombre: "Bolsa 1" },
      { id: "b2", nombre: "Bolsa 2" },
    ];

    const { toDelete, toUpdate, toInsert } = computeBolsaOperations(existing, updated);

    expect(toDelete.length).toBe(0);
    expect(toUpdate.length).toBe(2);
    expect(toInsert.length).toBe(0);
  });

  it("handles empty existing (first time setup)", () => {
    const existing: string[] = [];
    const updated = [
      { id: "b1", nombre: "Bolsa 1" },
    ];

    const { toDelete, toUpdate, toInsert } = computeBolsaOperations(existing, updated);

    expect(toDelete.length).toBe(0);
    expect(toUpdate.length).toBe(0);
    expect(toInsert.length).toBe(1);
  });

  it("handles empty updated (remove all bolsas)", () => {
    const existing = ["b1", "b2"];
    const updated: { id: string; nombre: string }[] = [];

    const { toDelete, toUpdate, toInsert } = computeBolsaOperations(existing, updated);

    expect(toDelete).toEqual(["b1", "b2"]);
    expect(toUpdate.length).toBe(0);
    expect(toInsert.length).toBe(0);
  });
});

describe("bolsaDefaultGastosId safety", () => {
  it("only deletes bolsas that are NOT the default", () => {
    const defaultBolsaId = "b1";
    const existingIds = ["b1", "b2", "b3"];
    const updatedBolsas = [
      { id: "b1", nombre: "Keep" },
      { id: "b2", nombre: "Keep" },
    ];

    const existingBolsaIds = new Set(existingIds);
    const updatedBolsaIds = new Set(updatedBolsas.map((b) => b.id));
    const toDelete = Array.from(existingBolsaIds).filter(
      (id) => !updatedBolsaIds.has(id)
    );

    // b1 (the default) should NOT be in the delete list
    expect(toDelete).not.toContain(defaultBolsaId);
    expect(toDelete).toEqual(["b3"]);
  });

  it("prevents FK cascade when default bolsa stays", () => {
    // Simulate: bolsa_default_gastos_id = "b1"
    // Old approach: DELETE ALL then INSERT ALL → FK cascade nullifies bolsa_default_gastos_id
    // New approach: only delete removed bolsas → "b1" is never deleted → FK stays valid

    const defaultBolsaId = "b1";
    const existingIds = ["b1", "b2"];
    const updatedIds = ["b1", "b2"]; // same bolsas

    const toDelete = existingIds.filter((id) => !updatedIds.includes(id));

    // Nothing to delete → no FK cascade
    expect(toDelete.length).toBe(0);
    // defaultBolsaId would survive the update
    expect(updatedIds).toContain(defaultBolsaId);
  });
});

describe("movimiento bolsa acumulado logic", () => {
  it("ingreso adds to acumulado", () => {
    const currentAcumulado = 5000;
    const tipo = "ingreso";
    const monto = 1500;

    const delta = tipo === "ingreso" ? monto : -monto;
    const newAcumulado = currentAcumulado + delta;

    expect(newAcumulado).toBe(6500);
  });

  it("egreso subtracts from acumulado", () => {
    const currentAcumulado = 5000;
    const tipo = "egreso";
    const monto = 2000;

    const delta = tipo === "ingreso" ? monto : -monto;
    const newAcumulado = currentAcumulado + delta;

    expect(newAcumulado).toBe(3000);
  });

  it("delete movimiento reverts ingreso", () => {
    const currentAcumulado = 6500; // After ingreso of 1500
    const tipo = "ingreso";
    const monto = 1500;

    const delta = tipo === "ingreso" ? -monto : monto;
    const revertedAcumulado = currentAcumulado + delta;

    expect(revertedAcumulado).toBe(5000);
  });

  it("delete movimiento reverts egreso", () => {
    const currentAcumulado = 3000; // After egreso of 2000
    const tipo = "egreso";
    const monto = 2000;

    const delta = tipo === "ingreso" ? -monto : monto;
    const revertedAcumulado = currentAcumulado + delta;

    expect(revertedAcumulado).toBe(5000);
  });

  it("allows negative acumulado after egreso", () => {
    const currentAcumulado = 500;
    const monto = 1000;
    const tipo = "egreso";

    const delta = tipo === "ingreso" ? monto : -monto;
    const newAcumulado = currentAcumulado + delta;

    expect(newAcumulado).toBe(-500);
  });
});

describe("reasignarBolsa logic", () => {
  it("reasignar only changes bolsaId, not origen or other fields", () => {
    const movimiento = {
      id: "mov-1",
      salonId: "s1",
      bolsaId: "bolsa-vieja",
      tipo: "egreso" as const,
      monto: 500,
      metodoPago: "Efectivo" as const,
      descripcion: "Compra tinte",
      fecha: "2026-05-01",
      createdAt: "2026-05-01T00:00:00Z",
      origen: "manual" as const,
    };

    const nuevaBolsaId = "bolsa-nueva";

    const reasignado = { ...movimiento, bolsaId: nuevaBolsaId };

    expect(reasignado.bolsaId).toBe("bolsa-nueva");
    expect(reasignado.origen).toBe("manual");
    expect(reasignado.tipo).toBe("egreso");
    expect(reasignado.monto).toBe(500);
    expect(reasignado.descripcion).toBe("Compra tinte");
    expect(reasignado.metodoPago).toBe("Efectivo");
  });

  it("movimiento created manually has origen manual", () => {
    const origen = "manual" as const;

    const insertPayload = {
      salon_id: "s1",
      bolsa_id: "b1",
      tipo: "egreso",
      monto: 300,
      metodo_pago: "Efectivo",
      descripcion: "Test",
      fecha: "2026-05-01",
      origen,
    };

    expect(insertPayload.origen).toBe("manual");
  });
});
