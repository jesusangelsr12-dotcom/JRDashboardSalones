# Plan: Comisión por Tarjeta + Métricas Financieras (EBIT/FCF)

## Decisiones tomadas
- Solo **tarjeta** tiene comisión (transferencias y efectivo NO)
- FCF **simple** por ahora (≈ EBIT, sin modelar retiros/inversiones)
- Periodos: **Mensual + Anual**
- **Sí** incluir punto de equilibrio (break-even)

---

## Feature 1: Comisión por uso de tarjeta

### Problema
Cuando un cliente paga con tarjeta, el procesador cobra una comisión (ej. 3.6%).
El dashboard muestra el monto bruto, pero el salón realmente recibe menos.

### Cambios a realizar

**Paso 1 — Migración SQL**
```sql
ALTER TABLE salones ADD COLUMN comision_tarjeta numeric NOT NULL DEFAULT 0;
```
- Ejecutar en Supabase directamente

**Paso 2 — Tipos TypeScript** (`lib/types.ts`)
- Agregar `comisionTarjeta: number` a la interfaz `Salon`
- Agregar `comisionTarjeta: number` a `ResumenSemanal`

**Paso 3 — Store** (`lib/store.ts`)
- Leer `comision_tarjeta` al cargar salón (`getSalon`)
- Escribir `comision_tarjeta` al guardar config (`saveSalon`)

**Paso 4 — UI de configuración** (`app/salon/[id]/config/page.tsx`)
- Nuevo input: "Comisión por tarjeta (%)"
- Campo numérico, paso 0.1, min 0, max 100
- Se guarda junto con el resto de la config

**Paso 5 — Cálculos** (`lib/calculations.ts`)
- Modificar `calcularResumenSemanal()`:
  - Recibir `comisionTarjeta` como parámetro
  - Calcular ingresos netos: tarjeta aplica `costo × (1 - comision/100)`, el resto igual
  - Nuevo campo en resumen: `comisionTotal` (suma de lo perdido en comisiones)
- Modificar `calcularResumenParaSemana()`: misma lógica
- Modificar `calcularDatosGraficas()`: usar montos netos en distribución por método de pago

**Paso 6 — UI del resumen** (`components/dashboard/ResumenSemanal.tsx`)
- Nuevo KPI card: "Comisión tarjeta" (en rojo/negativo)
- Actualizar breakdown: "Ingresos − Comisiones − Gastos fijos"

---

## Feature 2: Pestaña "Finanzas" (EBIT / FCF / Break-even)

### Métricas

**EBIT** = Ingresos Netos − Gastos Fijos − Gastos Variables
- Ingresos Netos = Ingresos brutos − Comisiones tarjeta
- Vista mensual + acumulado anual

**Margen EBIT** = EBIT / Ingresos Netos × 100

**FCF** ≈ EBIT (simple por ahora, sin CAPEX/retiros)

**Punto de Equilibrio** = Gastos Fijos Mensuales / (1 − Gastos Variables / Ingresos Netos)
- "Necesitas facturar al menos $X al mes para no perder"

**Ticket Promedio** = Ingresos / Número de citas

### Cambios a realizar

**Paso 7 — TabNav** (`components/dashboard/TabNav.tsx`)
- Agregar `"finanzas"` al tipo `TabId`
- Nuevo tab: `{ id: "finanzas", label: "Finanzas" }`

**Paso 8 — Función de cálculos** (`lib/calculations.ts`)
- Nueva función `calcularMetricasFinancieras(citas, gastos, gastosFijos, comisionTarjeta)`
- Retorna por cada mes:
  - ingresosNetos, comisiones, gastosFijos, gastosVariables, ebit, margenEbit, fcf, ticketPromedio, numCitas
- Retorna acumulado anual
- Retorna punto de equilibrio mensual

**Paso 9 — Componente FinanzasSection** (`components/dashboard/FinanzasSection.tsx`)
```
FinanzasSection
├── Selector de periodo (Mensual / Anual)
├── KPIs principales (4 cards)
│   ├── Ingresos Netos
│   ├── EBIT ($)
│   ├── Margen EBIT (%)
│   └── Punto de Equilibrio ($)
├── Semáforo de salud
│   ├── Verde: Margen > 20% → Saludable
│   ├── Amarillo: Margen 10-20% → Precaución
│   └── Rojo: Margen < 10% → Atención
├── Gráfica de evolución EBIT (barras por mes, últimos 6-12 meses)
└── Tabla resumen mensual
    ├── Columnas: Mes | Ingresos | Comisiones | G.Fijos | G.Variables | EBIT | Margen
    └── Fila de totales acumulados
```

**Paso 10 — Integración en dashboard** (`app/salon/[id]/page.tsx`)
- Importar FinanzasSection
- Agregar caso `"finanzas"` al switch de tabs
- Pasar datos necesarios como props

---

## Orden de ejecución

| # | Paso | Archivo(s) |
|---|------|-----------|
| 1 | Migración SQL | Supabase (manual) |
| 2 | Tipos TypeScript | `lib/types.ts` |
| 3 | Store | `lib/store.ts` |
| 4 | Config UI | `app/salon/[id]/config/page.tsx` |
| 5 | Cálculos comisión | `lib/calculations.ts` |
| 6 | UI resumen comisión | `components/dashboard/ResumenSemanal.tsx` |
| 7 | Tab Finanzas | `components/dashboard/TabNav.tsx` |
| 8 | Cálculos financieros | `lib/calculations.ts` |
| 9 | Componente Finanzas | `components/dashboard/FinanzasSection.tsx` (nuevo) |
| 10 | Integración dashboard | `app/salon/[id]/page.tsx` |

## Sin cambios en DB (excepto paso 1)
- Toda la lógica financiera se calcula a partir de datos existentes
- No se necesitan tablas nuevas
