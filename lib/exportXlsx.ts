import * as XLSX from "xlsx";
import type { Cita, Gasto, CierreSemana, Bolsa } from "./types";
import { getLunesDeSemana, getInicioMes, getFinMes } from "./calculations";

function fmtDate(d: Date): string {
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function exportarDatosXlsx(
  salonNombre: string,
  citas: Cita[],
  gastos: Gasto[],
  cierres: CierreSemana[],
  bolsas: Bolsa[]
) {
  const wb = XLSX.utils.book_new();

  // ── Hoja 1: Ingresos ──
  const ingresosData = citas
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
    .map((c) => ({
      Fecha: fmtDate(c.fecha),
      Clienta: c.clienta,
      Servicios: c.servicios.map((s) => s.nombre).join(", "),
      Costo: c.costo,
      "Método de Pago": c.metodoPago,
    }));
  const wsIngresos = XLSX.utils.json_to_sheet(ingresosData);
  wsIngresos["!cols"] = [{ wch: 12 }, { wch: 20 }, { wch: 35 }, { wch: 12 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsIngresos, "Ingresos");

  // ── Hoja 2: Gastos ──
  const gastosData = gastos
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
    .map((g) => ({
      Fecha: fmtDate(g.fecha),
      Descripción: g.descripcion,
      Monto: g.monto,
      "Método de Pago": g.metodoPago,
      Fuente: g.source === "admin" ? "Admin" : "Salón",
      "Bolsa Asignada": g.bolsaId
        ? bolsas.find((b) => b.id === g.bolsaId)?.nombre || "—"
        : "Default",
    }));
  const wsGastos = XLSX.utils.json_to_sheet(gastosData);
  wsGastos["!cols"] = [{ wch: 12 }, { wch: 25 }, { wch: 12 }, { wch: 16 }, { wch: 10 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsGastos, "Gastos");

  // ── Hoja 3: Cierres Semanales ──
  const cierresData = cierres.map((c) => {
    const row: Record<string, string | number> = {
      "Semana Inicio": c.semanaInicio,
      "Semana Fin": c.semanaFin,
      "Fecha Cierre": c.fecha.split("T")[0],
      Ingresos: c.ingresos,
      Gastos: c.gastos,
      Libre: c.libre,
    };
    c.bolsas.forEach((b) => {
      row[`Bolsa: ${b.nombre}`] = b.monto;
    });
    return row;
  });
  if (cierresData.length > 0) {
    const wsCierres = XLSX.utils.json_to_sheet(cierresData);
    XLSX.utils.book_append_sheet(wb, wsCierres, "Cierres Semanales");
  }

  // ── Hoja 4: Resumen Mensual ──
  const mesesMap = new Map<string, { ingresos: number; gastos: number }>();
  citas.forEach((c) => {
    const key = `${c.fecha.getFullYear()}-${String(c.fecha.getMonth() + 1).padStart(2, "0")}`;
    const curr = mesesMap.get(key) || { ingresos: 0, gastos: 0 };
    curr.ingresos += c.costo;
    mesesMap.set(key, curr);
  });
  gastos.forEach((g) => {
    const key = `${g.fecha.getFullYear()}-${String(g.fecha.getMonth() + 1).padStart(2, "0")}`;
    const curr = mesesMap.get(key) || { ingresos: 0, gastos: 0 };
    curr.gastos += g.monto;
    mesesMap.set(key, curr);
  });
  const resumenMensual = Array.from(mesesMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, data]) => ({
      Mes: mes,
      Ingresos: data.ingresos,
      Gastos: data.gastos,
      Diferencia: data.ingresos - data.gastos,
    }));
  if (resumenMensual.length > 0) {
    const wsResumen = XLSX.utils.json_to_sheet(resumenMensual);
    wsResumen["!cols"] = [{ wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen Mensual");
  }

  // ── Hoja 5: Bolsas Acumulados ──
  const bolsasData = bolsas.map((b) => ({
    Bolsa: b.nombre,
    Porcentaje: `${b.porcentaje}%`,
    Acumulado: b.acumulado,
  }));
  const wsBolsas = XLSX.utils.json_to_sheet(bolsasData);
  wsBolsas["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsBolsas, "Bolsas");

  // ── Hoja 6: Ingresos por Semana ──
  const semanaMap = new Map<string, { ingresos: number; gastos: number; citas: number }>();
  citas.forEach((c) => {
    const lunes = getLunesDeSemana(c.fecha);
    const key = lunes.toISOString().split("T")[0];
    const curr = semanaMap.get(key) || { ingresos: 0, gastos: 0, citas: 0 };
    curr.ingresos += c.costo;
    curr.citas += 1;
    semanaMap.set(key, curr);
  });
  gastos.forEach((g) => {
    const lunes = getLunesDeSemana(g.fecha);
    const key = lunes.toISOString().split("T")[0];
    const curr = semanaMap.get(key) || { ingresos: 0, gastos: 0, citas: 0 };
    curr.gastos += g.monto;
    semanaMap.set(key, curr);
  });
  const semanasData = Array.from(semanaMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([semana, data]) => ({
      "Semana (Lunes)": semana,
      Ingresos: data.ingresos,
      Gastos: data.gastos,
      Libre: data.ingresos - data.gastos,
      "No. Citas": data.citas,
    }));
  if (semanasData.length > 0) {
    const wsSemanas = XLSX.utils.json_to_sheet(semanasData);
    wsSemanas["!cols"] = [{ wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsSemanas, "Por Semana");
  }

  // ── Descargar ──
  const fecha = new Date().toISOString().split("T")[0];
  const filename = `${salonNombre.replace(/\s+/g, "_")}_${fecha}.xlsx`;
  XLSX.writeFile(wb, filename);
}
