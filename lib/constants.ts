import type { CategoriaGasto, NaturalezaBolsa } from "./types";

// Categorías de gasto (gastos fijos y gastos admin). Fuente única para los
// selectores de config y del modal de gasto, para que no diverjan.
export const CATEGORIAS_GASTO: { value: CategoriaGasto; label: string }[] = [
  { value: "nomina", label: "Nómina" },
  { value: "renta", label: "Renta" },
  { value: "insumos", label: "Insumos" },
  { value: "servicios", label: "Servicios" },
  { value: "otros", label: "Otros" },
];

// Naturaleza de la bolsa para la capa de Salud.
export const NATURALEZAS_BOLSA: { value: NaturalezaBolsa; label: string; hint: string }[] = [
  { value: "gasto_operativo", label: "Gasto operativo", hint: "Sueldo por trabajo real · cuenta como gasto" },
  { value: "reserva", label: "Reserva / ahorro", hint: "Utilidad apartada · no es gasto" },
  { value: "reparto", label: "Reparto / utilidad", hint: "Dividendo · no es gasto" },
];
