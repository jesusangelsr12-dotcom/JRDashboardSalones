# Plan de Mejoras - JR Dashboard Salones

## 1. Gastos Variables restan a Bolsa, no a Ingresos

### Cambio en cálculo (`lib/calculations.ts`)
- **Antes:** `libre = ingresos - gastosVariables - gastosFijos`
- **Después:** `libre = ingresos - gastosFijos`
- Los gastos variables ya no afectan el cálculo de "libre"
- Los gastos variables restan al **acumulado** de la bolsa asignada

### Asignación de bolsa a gastos
- **Gastos de Google Sheets:** Van automáticamente a una **bolsa default** configurable por salón
- **Gastos de admin (nuevos):** Se elige manualmente a qué bolsa va cada gasto

### Configuración del salón (`app/salon/[id]/config/page.tsx`)
- Agregar un **dropdown** "Bolsa para gastos automáticos" que permite elegir cuál bolsa recibe los gastos que vienen de Sheets
- Guardar como campo `bolsaDefaultGastos` en el salón (Supabase)

### Schema Supabase
- Agregar columna `bolsa_default_gastos_id` (UUID, nullable FK → bolsas) a tabla `salones`

### Ajuste en ResumenSemanal (`components/dashboard/ResumenSemanal.tsx`)
- Ya no mostrar gastos variables restando de ingresos
- Mostrar gastos variables como info (cuánto se gastó) pero sin restar del cálculo principal
- El KPI "Dinero libre" = ingresos - gastosFijos solamente

### Ajuste en BolsasSection
- Al cerrar semana: además de sumar `libre * porcentaje` al acumulado, **restar** los gastos variables asignados a cada bolsa
- Fórmula por bolsa: `nuevoAcumulado = acumuladoAnterior + (libre * porcentaje/100) - gastosAsignados`

---

## 2. Semanas Lunes a Domingo + Historial + Pendientes

### Lógica de semanas pendientes
- Al cargar el dashboard, detectar todas las semanas con datos (citas/gastos) que NO tienen cierre registrado
- Mostrar como lista de **semanas pendientes** en la sección de Bolsas
- Cada semana pendiente conserva su dinero intacto hasta que se cierre manualmente

### Historial dentro de Bolsas (`components/dashboard/BolsasSection.tsx`)
- Agregar sección **"Historial de semanas"** debajo de las bolsas
- Lista cronológica de semanas cerradas con:
  - Rango de fechas (Lun 20 Ene — Dom 26 Ene)
  - Ingresos / Gastos fijos / Libre
  - Distribución a bolsas
  - Estado: ✓ Cerrada / ⏳ Pendiente
- Semanas pendientes con botón "Cerrar" para cerrarlas retroactivamente
- Expandible/colapsable para no saturar la vista

### Detección de semanas con datos
- Recorrer todas las citas/gastos y agrupar por semana (lunes a domingo)
- Comparar con cierres existentes en Supabase
- Las semanas con datos pero sin cierre = pendientes

---

## 3. Registrar Gastos desde la App de Admin

### Nueva tabla Supabase: `gastos_admin`
```sql
CREATE TABLE gastos_admin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID REFERENCES salones(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  descripcion TEXT NOT NULL,
  monto NUMERIC NOT NULL,
  metodo_pago TEXT NOT NULL,        -- "Efectivo" | "Tarjeta" | "Transferencia"
  bolsa_id UUID REFERENCES bolsas(id) ON DELETE SET NULL,  -- bolsa a la que resta
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_gastos_admin_salon ON gastos_admin(salon_id);
```

### Formulario de registro (Modal o bottom sheet)
- Ubicación: botón flotante "+" en el dashboard o dentro de la pestaña Tabla
- Campos:
  - Descripción (texto)
  - Monto (número)
  - Método de pago (Efectivo / Tarjeta / Transferencia)
  - Fecha (default: hoy)
  - Bolsa destino (dropdown con bolsas del salón)
- Guardar en `gastos_admin` tabla de Supabase

### Integración con datos existentes
- `fetchSalonData()` ahora también trae gastos de `gastos_admin`
- Los gastos admin se mezclan con los de Sheets en la tabla de transacciones
- Se distinguen visualmente (badge "Admin" o ícono diferente)
- Al calcular resumen: gastos admin restan a su bolsa asignada

### Store (`lib/store.ts`)
- `addGastoAdmin(gasto)` — insertar nuevo gasto
- `getGastosAdmin(salonId)` — listar gastos admin del salón
- `deleteGastoAdmin(id)` — poder eliminar un gasto registrado por error

---

## 4. Visualización Mensual + Anual en Gráficas

### Reestructura de GraficasSection (`components/dashboard/GraficasSection.tsx`)
- Agregar **2 sub-tabs** dentro de Gráficas: **"Mensual"** y **"Anual"**

### Tab Mensual
- **Navegación por mes:** flechas < > con nombre del mes (Enero 2025, Febrero 2025...)
- Filtrar datos al mes seleccionado
- Gráficas del mes:
  - Top Servicios del mes (bar chart) — **FIX: etiquetas completas, no cortadas**
  - Top Clientas del mes (lista o bar chart)
  - Distribución por método de pago (donut)
  - Top Gastos del mes (nueva gráfica, ver punto 5)
- Default: mes actual

### Tab Anual
- Selección de año (si hay datos de múltiples años)
- Gráficas del año completo:
  - Evolución mensual (area chart, ya existe)
  - Top Servicios del año
  - Top Clientas del año
  - Distribución por método de pago del año
  - Top Gastos del año (nueva gráfica, ver punto 5)

### Fix etiquetas cortadas en ChartTopServicios
- Ajustar `width` del eje Y o usar `tick` con text wrap
- Aumentar margen izquierdo del chart
- O usar tooltip para nombres largos

---

## 5. Top Gastos (Mensual y Anual)

### Nueva gráfica: `ChartTopGastos.tsx`
- Horizontal bar chart similar a ChartTopServicios
- Agrupa gastos por descripción
- Top 5-10 gastos por monto total
- Incluye gastos de Sheets + gastos admin
- Variantes: filtrado por mes o por año (según el sub-tab)

### Cálculo (`lib/calculations.ts`)
- Agregar a `DatosGraficas`:
  ```typescript
  topGastos: { descripcion: string; cantidad: number; total: number }[];
  ```
- Agrupar gastos por descripción, sumar montos, ordenar desc, tomar top 10

---

## 6. Filtro por Mes en la Tabla

### TablaSection (`components/dashboard/TablaSection.tsx`)
- Agregar **selector de mes** encima de los filtros actuales (Todo/Ingresos/Gastos)
- Opciones: "Todos", Enero, Febrero, ..., Diciembre + Año
- Al seleccionar un mes, filtrar las transacciones a ese mes
- Combina con los filtros existentes (búsqueda + tipo)
- Mostrar conteo actualizado: "Mostrando X de Y registros (Marzo 2025)"

---

## Orden de implementación propuesto

1. **Schema Supabase** — agregar tabla `gastos_admin` + columna `bolsa_default_gastos_id`
2. **Store** — CRUD para gastos admin + campo bolsa default
3. **Cálculos** — cambiar fórmula de libre, asignar gastos a bolsas
4. **Config salón** — dropdown bolsa default para gastos Sheets
5. **Formulario gastos admin** — modal para registrar gastos desde la app
6. **Historial semanas** — detección de pendientes + vista en Bolsas
7. **Gráficas mensual/anual** — reestructura con sub-tabs + navegación
8. **Top gastos** — nueva gráfica
9. **Filtro mes en tabla** — selector de mes
10. **Fix etiquetas** — arreglar labels cortados en gráfica de servicios
