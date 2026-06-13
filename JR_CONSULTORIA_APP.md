# JR CONSULTORIA APP — Knowledge Base

> Documento vivo. Actualizar con cada cambio significativo en la app.

---

## 1. Overview

**Nombre:** JR Dashboard Salones  
**Propósito:** Dashboard financiero multi-salón para JR Consultoría. Permite registrar cierres semanales, controlar bolsas de efectivo, ver estado de resultados y analizar métricas financieras por salón.

**Stack:**
- Frontend: Next.js 14.2.21 (App Router), React 18, TypeScript, Tailwind CSS, Framer Motion, Recharts
- Backend: Supabase (PostgreSQL + PostgREST)
- Deploy: Vercel (branch `main` → production)
- Tests: Vitest + Testing Library

**Repositorio:** branch de desarrollo activo → `claude/fix-vercel-production-branch-pj9gq`  
**Production branch en Vercel:** `main`

---

## 2. Arquitectura

### Estructura de archivos clave

```
app/
  salon/[id]/
    page.tsx              ← Dashboard principal por salón (tabs: resumen, bolsas, graficas, tabla, finanzas)
    config/page.tsx       ← Configuración del salón (nombre, bolsas, comisión tarjeta)
  page.tsx                ← Lista de salones

components/dashboard/
  TabNav.tsx              ← Navegación de tabs (5 tabs)
  ResumenSection.tsx      ← Resumen semanal
  BolsasSection.tsx       ← Gestión de bolsas
  GraficasSection.tsx     ← Gráficas
  TablaSection.tsx        ← Tabla de transacciones (cierres + movimientos bolsa)
  EstadoResultados.tsx    ← Estado de resultados (mes/semana/año YTD)
  MovimientoBolsaModal.tsx ← Modal para agregar/restar a bolsa
  GastoAdminModal.tsx     ← Modal para gastos administrativos
  CierreModal.tsx         ← Modal para cerrar semana

lib/
  store.ts                ← Toda la lógica CRUD con Supabase (649+ líneas)
  calculations.ts         ← Todos los cálculos financieros
  types.ts                ← Interfaces TypeScript
  __tests__/              ← Tests unitarios (39 tests)

supabase/
  schema.sql              ← Schema completo de la BD
  migration_002_fixes.sql ← RPC increment_acumulado + UNIQUE constraints
  migration_movimientos_bolsa.sql ← Tabla movimientos_bolsa
  migration_comision_tarjeta.sql  ← Columna comision_tarjeta en salones
```

### Flujo de datos

1. `app/salon/[id]/page.tsx` llama `initStore()` en `useEffect`
2. `initStore()` siempre hace fetch fresco (sin caché) de Supabase
3. Datos pasan como props a componentes de dashboard
4. Mutaciones llaman funciones de `lib/store.ts` y luego re-fetchean con `initStore()`
5. Window focus listener re-fetcha el salón al volver de config

---

## 3. Database Schema

### Tablas

#### `salones`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| nombre | text | UNIQUE constraint |
| bolsa_default_gastos_id | uuid FK→bolsas | nullable, ON DELETE SET NULL |
| comision_tarjeta | numeric | % comisión terminal (ej: 3.5 = 3.5%) |
| created_at | timestamptz | |

#### `bolsas`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| salon_id | uuid FK→salones | ON DELETE CASCADE |
| nombre | text | |
| acumulado | numeric | saldo actual |
| tipo | text | 'efectivo' \| 'banco' \| 'otro' |
| created_at | timestamptz | |

#### `cierres`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| salon_id | uuid FK→salones | ON DELETE CASCADE |
| semana_inicio | date | UNIQUE con salon_id |
| ingresos | numeric | |
| gastos | numeric | |
| efectivo | numeric | |
| tarjeta | numeric | |
| created_at | timestamptz | |

UNIQUE constraint: `cierres_salon_semana_unique (salon_id, semana_inicio)`

#### `gastos_fijos`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| salon_id | uuid FK→salones | ON DELETE CASCADE |
| nombre | text | |
| monto | numeric | |
| frecuencia | text | 'mensual' \| 'semanal' |
| created_at | timestamptz | |

#### `movimientos_bolsa`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| salon_id | uuid FK→salones | ON DELETE CASCADE |
| bolsa_id | uuid FK→bolsas | ON DELETE CASCADE |
| tipo | text | 'ingreso' \| 'egreso' |
| monto | numeric | |
| metodo_pago | text | default 'Efectivo' |
| descripcion | text | default '' |
| fecha | date | |
| created_at | timestamptz | |

### Migrations aplicadas (en orden)
1. `schema.sql` — schema completo inicial
2. `migration_002_fixes.sql` — RPC `increment_acumulado`, UNIQUE en cierres y salones
3. `migration_movimientos_bolsa.sql` — tabla movimientos_bolsa
4. `migration_comision_tarjeta.sql` — columna comision_tarjeta en salones

### RPC Functions
- `increment_acumulado(bolsa_uuid uuid, delta numeric)` — actualiza acumulado atómicamente (evita race conditions)

---

## 4. Features Implementadas

### Salones
- Lista de salones en pantalla principal
- Crear / eliminar salón
- Configuración por salón: nombre, bolsas (tipos, nombres), bolsa default para gastos, comisión tarjeta (%)
- Seed inicial con salones de ejemplo (protegido contra duplicados)

### Cierres Semanales (Auto-Close)
- **Cierre automático en frontend**: al abrir la app, BolsasSection detecta semanas pasadas sin cerrar (con ingresos > 0) y las cierra automáticamente con datos financieros reales
- **Edge Function de respaldo**: `auto-close-weeks` corre cada domingo a medianoche CDMX, crea marcadores $0 para semanas sin cierre (safety net si nadie abre la app)
- La semana actual nunca se auto-cierra (sigue abierta hasta que pase)
- Historial de distribución semanal: cards colapsables con detalle por bolsa (máx 8, "Ver más")
- Animación expand/collapse con Framer Motion
- Protección contra doble cierre de la misma semana (UNIQUE constraint + addCierre check)
- El botón manual de cierre fue removido — todo es automático
- **Copiar para WhatsApp**: botón que copia distribución actual al clipboard con formato de emojis

### Bolsas
- Múltiples bolsas por salón (efectivo, banco, otro)
- Acumulado en tiempo real
- Agregar/restar manualmente con `MovimientoBolsaModal`
- Los gastos del Google Sheets se restan de la bolsa default de gastos
- Historial de movimientos en tab Tabla con badge "Bolsa"

### Comisión Tarjeta
- Configurable por salón en `config/page.tsx`
- Se aplica en todos los cálculos: `costoNeto(costo, metodoPago, comisionTarjeta)`
- En tab Tabla: pagos con tarjeta muestran monto original + monto neto debajo

### Estado de Resultados (`EstadoResultados.tsx`)
- 3 vistas: Mensual, Semanal, Anual (YTD)
- Navegación por período (mes, semana, año)
- Líneas: Ingresos brutos → Comisión tarjeta → Ingresos netos → Gastos fijos (detallados) → Gastos variables → **Utilidad Operativa** + Margen %
- YTD: acumula desde inicio del año hasta hoy

### Tabla de Transacciones
- Muestra cierres + movimientos de bolsa en una sola vista
- Badge "Bolsa" para movimientos de bolsa
- Filtro por bolsa
- Para pagos con tarjeta: monto original y monto neto (con comisión aplicada)

### Gráficas
- Barras semanales de ingresos/gastos
- Vista mensual y anual

---

## 5. Business Logic & Cálculos Clave

### Comisión Tarjeta

```typescript
// lib/calculations.ts
function costoNeto(costo: number, metodoPago: string, comisionTarjeta: number = 0): number {
  if (metodoPago === "Tarjeta" && comisionTarjeta > 0) {
    return costo * (1 - comisionTarjeta / 100);
  }
  return costo;
}
```

Todas las funciones de cálculo aceptan `comisionTarjeta: number = 0`:
- `calcularResumenSemanal`
- `calcularResumenParaSemana`
- `detectarSemanas`
- `calcularIngresosMes`
- `calcularDatosGraficas`
- `calcularDatosGraficasAnual`
- `_calcularGraficasInternas`

### YTD — Semanas transcurridas (IMPORTANTE: no usar aproximación)

```typescript
// EstadoResultados.tsx — cálculo correcto de semanas para gastos fijos semanales en YTD
const finPeriodo = esAnioActual ? hoy : fin;
const msTranscurridos = finPeriodo.getTime() - inicio.getTime();
const semanasTranscurridas = Math.floor(msTranscurridos / (7 * 24 * 60 * 60 * 1000));
// ❌ NUNCA usar: Math.round(mesesTranscurridos * 4.33) — impreciso
```

### Estado de Resultados — fórmula

```
Ingresos brutos (suma de cierres en período)
- Comisión tarjeta (tarjeta * comisionTarjeta / 100)
= Ingresos netos
- Gastos fijos mensual (monto / 4 para semanal; monto * meses para mensual en YTD)
- Gastos fijos semanal (monto para semanal; monto * semanas para YTD)
- Gastos variables (suma de gastos de cierres)
= Utilidad Operativa
  Margen % = Utilidad / Ingresos netos * 100
```

### Proration de gastos fijos por modo
- **Mensual**: `gf.frecuencia === 'mensual' ? gf.monto : gf.monto * 4`
- **Semanal**: `gf.frecuencia === 'semanal' ? gf.monto : gf.monto / 4`
- **YTD mensual**: `gf.monto * mesesTranscurridos` (o `gf.monto * semanasTranscurridas / 4`)
- **YTD semanal**: `gf.monto * semanasTranscurridas` (o `gf.monto * mesesTranscurridos * (4/1)`)

---

## 6. Reglas Críticas de Desarrollo (NUNCA OLVIDAR)

### 1. FK Disambiguation en Supabase
Salones tiene DOS relaciones FK con bolsas. SIEMPRE usar el nombre explícito:
```typescript
// ✅ Correcto
.select(`*, bolsas!bolsas_salon_id_fkey(*)`)
// ❌ Error PGRST201
.select(`*, bolsas(*)`)
```

### 2. initStore() NUNCA debe cachear
La función siempre debe hacer fetch fresco. Si cachea, los deletes/updates no se ven reflejados.
```typescript
// ❌ NUNCA hacer esto:
let cachedStore: Store | null = null;
if (cachedStore) return cachedStore;
```

### 3. Orden de operaciones en deleteSalon()
```typescript
// 1. Nullificar FK primero (evita ON DELETE SET NULL en cascade)
await supabase.from('salones').update({ bolsa_default_gastos_id: null }).eq('id', id);
// 2. Eliminar hijos en orden (movimientos_bolsa antes que bolsas)
await supabase.from('movimientos_bolsa').delete().eq('salon_id', id);
await supabase.from('bolsas').delete().eq('salon_id', id);
await supabase.from('cierres').delete().eq('salon_id', id);
await supabase.from('gastos_fijos').delete().eq('salon_id', id);
// 3. Eliminar el salón
await supabase.from('salones').delete().eq('id', id);
```

### 4. Orden de operaciones en addSalon()
```typescript
// 1. Insertar salón con FK null
const salon = await supabase.from('salones').insert({ nombre, bolsa_default_gastos_id: null });
// 2. Crear bolsas
const bolsas = await supabase.from('bolsas').insert([...]);
// 3. Actualizar FK
await supabase.from('salones').update({ bolsa_default_gastos_id: bolsaGastosId }).eq('id', salon.id);
```

### 5. updateSalon() usa UPSERT (no delete+insert)
Si usas DELETE ALL + INSERT para las bolsas, se dispara ON DELETE SET NULL en bolsa_default_gastos_id.
```typescript
// ✅ Upsert: solo eliminar bolsas que ya no existen, insertar/actualizar las demás
const idsToDelete = existingIds.filter(id => !newIds.includes(id));
await supabase.from('bolsas').delete().in('id', idsToDelete);
await supabase.from('bolsas').upsert(bolsasToUpsert);
```

### 6. Protección contra duplicados (React Strict Mode)
React Strict Mode llama useEffect dos veces en desarrollo. Proteger con:
- Singleton Promise en `initStore()`
- Flag `localStorage.getItem('jr_salones_seeded')` antes de seed
- Doble-check en `seedSalones()` con query antes de insertar

### 7. addCierre() debe verificar existente
```typescript
const existing = await supabase.from('cierres')
  .select('id').eq('salon_id', salonId).eq('semana_inicio', semanaInicio).single();
if (existing.data) throw new Error('Ya existe un cierre para esta semana');
```

### 8. increment_acumulado usa RPC atómico
```typescript
// ✅ Atómico (evita race conditions)
await supabase.rpc('increment_acumulado', { bolsa_uuid: bolsaId, delta });
// Con fallback a read-modify-write si RPC falla
```

### 9. Fechas en modales — usar useEffect
Los `useState` initializers solo corren en mount. Para resetear fecha al abrir modal:
```typescript
useEffect(() => {
  if (open) setFecha(new Date().toISOString().split('T')[0]);
}, [open]);
```

### 10. Nombres vacíos en gastos fijos
Siempre usar fallback para evitar rows invisibles:
```tsx
<SubRow label={gf.nombre || "Sin nombre"} value={gf.monto} />
```

---

## 7. Bugs Conocidos y Cómo Se Resolvieron

| Bug | Causa | Solución |
|---|---|---|
| PGRST201 FK ambiguity | salones tiene 2 FKs con bolsas | Usar `bolsas!bolsas_salon_id_fkey(*)` |
| Salones duplicados | React Strict Mode + múltiples dispositivos | Singleton Promise + localStorage flag + doble-check |
| Delete no persiste | initStore() cacheaba para siempre | Remover toda caché, siempre fetch fresco |
| bolsaDefaultGastosId se borraba al guardar | DELETE ALL bolsas disparaba ON DELETE SET NULL | Cambiar a upsert strategy en updateSalon() |
| FK violation en addSalon | Insertaba FK antes de que existieran las bolsas | Insertar null, crear bolsas, luego actualizar FK |
| Doble cierre / acumulado duplicado | Sin protección de duplicados | Verificar existente antes de insertar en addCierre() |
| Salón stale después de config | Solo fetch al montar | Window focus listener re-fetcha salon |
| Fechas stale en modales | useState initializer solo en mount | useEffect con dependencia en `open` |
| YTD gastos fijos semanas incorrecto | Aproximación `meses * 4.33` | Cálculo real con milisegundos |
| Row invisible en Estado de Resultados | gasto.nombre === '' sin fallback | `gf.nombre \|\| "Sin nombre"` |

---

## 8. Roadmap / Pendientes

### De PLAN.md
- [ ] Gastos variables por categoría
- [ ] Semanas pendientes de cierre (alertas)
- [ ] Gastos de admin con aprobación
- [ ] Gráficas mensuales y anuales mejoradas
- [ ] Top gastos / ranking de gastos
- [ ] Filtro por mes en historial

### De PLAN-NUEVAS-FEATURES.md
- [ ] EBIT formal (con depreciación separada)
- [ ] Free Cash Flow (FCF)
- [ ] Break-even analysis
- [ ] Proyecciones financieras

### Ideas pendientes de conversación
- [ ] Gastos de Google Sheets integración más robusta
- [ ] Notificaciones / alertas de bolsa baja
- [ ] Export a Excel del Estado de Resultados
- [ ] Multi-usuario / roles

---

## 9. Auto-Close Semanal (Edge Function)

**Propósito:** Cierre automático de semana para todos los salones cada domingo a medianoche (hora CDMX).

**Archivos:**
- `supabase/functions/auto-close-weeks/index.ts` — Supabase Edge Function (Deno)
- `supabase/cron_auto_close.sql` — Configuración pg_cron para ejecutar cada domingo 06:00 UTC

**Lógica:**
1. Calcula el lunes de la semana actual (zona horaria CDMX, UTC-6)
2. Consulta todos los salones
3. Hace UPSERT de un cierre con `ingresos=0, gastos=0, libre=0, bolsas=[]` para cada salón
4. `ON CONFLICT (salon_id, semana_inicio) DO NOTHING` — si ya se cerró manualmente, lo ignora

**Notas:**
- El cierre manual vía CierreModal sigue activo (esto es aditivo, no reemplazo)
- Un auto-close con valores en 0 es solo un marcador de tiempo — los datos financieros reales los pone el cierre manual
- Requiere extensiones `pg_cron` y `pg_net` habilitadas en Supabase Dashboard
- Requiere deploy: `supabase functions deploy auto-close-weeks`

**Cron:** `0 6 * * 0` = domingo 06:00 UTC = domingo 00:00 CDMX

---

## 10. Decisiones de Diseño

- **Sin caché en store**: Decisión consciente. La simplicidad > performance. El dashboard no tiene tráfico alto.
- **Upsert en bolsas**: Evita el problema de FK CASCADE. Más código pero seguro.
- **Comisión por salón**: Cada salón tiene su propio % porque las terminales varían.
- **YTD con milisegundos reales**: Más preciso que approximar `meses * 4.33` semanas.
- **Tabs en lugar de páginas**: Mejor UX en móvil para el flujo principal.
- **font-size reducido en TabNav**: `text-[11px]` para caber 5 tabs en móvil.

---

## 11. Módulo "Salud del Salón" (tab Salud — reemplaza Finanzas)

**Propósito:** medir si cada salón es sano con 10 KPIs + scorecard semanal + semáforo global.
Diseño estilo Coinbase iOS sobre la paleta cálida de JR. Ver `docs/TRAZABILIDAD-SALUD-SALON.html`
(origen de cada dato y fórmula) y `docs/mockup-salud-salon.html` (referencia visual).

**Archivos:**
- `lib/salud.ts` — toda la lógica (funciones puras): `calcularSalud()`, KPIs, semáforo, scorecard.
- `components/dashboard/SaludSection.tsx` — UI del tab (hero, scorecard, KPIs, días valle, riesgo).
- `lib/__tests__/salud.test.ts` — tests de las fórmulas (incluye el ejemplo numérico del doc).
- `supabase/migration_salud_salon.sql` — migración (aplicada en prod).

**Campos nuevos en BD:**
- `bolsas.naturaleza` text — `gasto_operativo` | `reserva` | `reparto` (default `reparto`).
- `gastos_fijos.categoria` y `gastos_admin.categoria` text — `nomina`/`renta`/`insumos`/`servicios`/`otros` (default `otros`).

**Regla clave (tratamiento de bolsas de sueldos):**
Las bolsas son reparto de caja, NO clasificación de gasto. La capa de Salud usa `naturaleza`:
- `gasto_operativo` (sueldo dueñas) → SÍ cuenta como gasto/nómina en margen, costo de personal y PE.
- `reserva` / `reparto` → NO son gasto (utilidad apartada/repartida).
- `sueldoOperativo = max(0, ingresos − gastosFijos) × (Σ% bolsas gasto_operativo)`.
- NO se mueve nada a "gastos fijos": el reparto de `libre` a bolsas queda intacto.

**Fórmula del margen (KPI 1):**
`utilidad = ingresos − gastosFijosMes − gastosVariablesMes − sueldoOperativo`. Gastos del Sheet = variables.
Gastos fijos prorrateados a mes con ×4 (consistente con EstadoResultados).

**"Contactada" (KPI 10):** persistida en localStorage por semana (`jr_contactadas_<salonId>`), v1 sin tabla.

**Descartado:** Fase 3 (estilista_id, KPI 6b por estilista, jugada de precios).

---

_Última actualización: 2026-06-13 — módulo Salud del Salón (Fase 1+2) + gastos fijos en copia WhatsApp_
