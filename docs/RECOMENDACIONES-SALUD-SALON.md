# Recomendaciones — Módulo "Salud del Salón"

> Documento de propuesta. **No implementado** (salvo el cambio puntual de Bolsas).
> Decisiones tomadas con el usuario el 2026-06-13.

## Decisiones de alcance acordadas

1. **Ubicación**: el tab **Finanzas** se reemplaza y renombra a **"Salud"**. No se agregan tabs (siguen 5 y caben en móvil). El Estado de Resultados actual se reubica dentro de "Salud".
2. **Clientas (KPIs 7–10)**: se identifican por **nombre** (`clienta`, texto del Sheet). Sin teléfono por ahora → la lista de riesgo muestra la fila **sin botón wa.me** hasta que exista teléfono.
3. **Categorización de gastos**: se agrega **categoría** a `gastos_fijos` y a los **gastos admin** (enum: nómina, renta, insumos, servicios, otros). Todo gasto que venga del **Google Sheets se trata como variable**.
4. **Bolsas (único cambio ya hecho)**: el texto que se copia para WhatsApp incluye, después del detalle de bolsas, la lista de **gastos fijos** (prorrateados a semana) y su total.

---

## Diseño visual (estilo Coinbase · paleta JR)

Ver `docs/mockup-salud-salon.html`. Estructura tomada de Coinbase iOS, identidad de JR:

- **Hero grande**: semáforo global del salón + número grande (utilidad del mes) + pill de cambio vs mes anterior — igual que el balance de Coinbase.
- **Segmented control** (Semana / Mes / Año) en vez de tabs internos.
- **Sparkline** de tendencia de 6 meses bajo el hero.
- **Filas de lista de KPIs** agrupadas por capa (Rentabilidad / Operación / Clientas), cada una con ícono, valor a la derecha y **pill de color** (verde sano / ámbar atento / rojo riesgo) — el patrón de "lista de activos" de Coinbase.
- **Mucho aire, fondo claro, esquinas muy redondeadas (22px), tipografía con tracking apretado.**
- Acentos: marrón `#7B4F2E` y dorado `#C8963C` reemplazan el azul Coinbase.

---

## Las 10 KPIs — qué se puede calcular hoy y qué falta

| # | KPI | ¿Calculable hoy? | Bloqueante |
|---|-----|------------------|------------|
| 1 | Margen neto mensual | ✅ Sí | — (ya existe en Estado de Resultados) |
| 2 | Costo de personal | ⚠️ Parcial | Necesita categoría `nómina` en gastos |
| 3 | Punto de equilibrio | ✅ Sí (simplificado) | Usar suma de gastos fijos como PE ≈ |
| 4 | Renta % | ⚠️ Parcial | Necesita categoría `renta` en gastos |
| 5 | Ticket promedio | ✅ Sí | Definir "visita" = misma clienta+fecha |
| 6 | Citas por día / estilista | ⚠️ Parcial | Día: ✅ · Estilista: falta `estilista_id` |
| 7 | Retención 90 días | ✅ Sí | Identificación por nombre |
| 8 | % ingreso recurrente | ✅ Sí | Identificación por nombre |
| 9 | Frecuencia de visita | ✅ Sí | Identificación por nombre |
| 10 | Clientas en riesgo | ✅ Sí (sin wa.me) | Falta teléfono para el botón |

**Recomendación de fases:**
- **Fase 1** (datos actuales): KPIs 1, 3, 5, 6(a día), 7, 8, 9, 10 + semáforo global + scorecard semanal.
- **Fase 2** (categoría de gastos): KPIs 2 y 4 + alertas de cierre mensual.
- **Fase 3** (estilista_id opcional): KPI 6(b) + jugada de precios.

---

## Recomendaciones de cálculo / consistencia de números

1. **Definir "visita" una sola vez** en `calculations.ts` y usarla en ticket (5), frecuencia (9) y retención (7): citas de la misma `clienta` + misma `fecha` = 1 visita. El Sheet hoy tiene varias líneas por cita; sin esto el ticket sale inflado.
2. **Margen vs "libre"**: la app ya calcula `libre = ingresos − gastos fijos`. Cuidado: el spec define margen con **todos** los gastos (fijos + variables). No mezclar los dos conceptos en la misma pantalla — etiquetar claramente "Libre a repartir" (operativo de bolsas) vs "Margen neto" (rentabilidad real).
3. **Punto de equilibrio simplificado**: como casi todo el gasto del salón es fijo (nómina + renta), `PE ≈ suma de gastos fijos del mes`. Mostrarlo como barra de progreso contra la venta del mes (ya tienes los datos).
4. **Semáforo global** (regla del spec): Verde = Capa A verde y sin rojos en C · Ámbar = A verde pero rojo en C · Rojo = cualquier rojo en A. Implementar como función pura testeable.
5. **Casos borde**: cohortes de los últimos 3 meses = "en curso" (gris, nunca rojo); mes con <30 visitas = "muestra chica" sin semáforo; excluir citas con fecha futura de ingresos.
6. **KPIs 7–10 pesados** (cohortes/medianas): el spec sugiere vistas materializadas/RPC en Supabase. Hoy todo se calcula en cliente sobre datos del Sheet — para volúmenes actuales es viable en cliente; migrar a RPC solo si se vuelve lento.

---

## Mejoras estructurales sugeridas (más allá del spec)

1. **Factor de riesgo configurable** (1.5×) por salón en config, no hardcoded.
2. **Persistir "contactada"** del KPI 10: tabla nueva o columna en un registro de seguimiento, con fecha — necesario para el número 4 del scorecard.
3. **Entidad `jugadas`** (salon_id, jugada, métrica objetivo, valor inicial, valor actual, fechas) para la tarjeta de progreso de 90 días.
4. **Teléfono de clienta**: agregar columna al Google Sheet para habilitar wa.me sin migrar el modelo de datos.
5. **Actualizar `JR_CONSULTORIA_APP.md`** cuando se implemente cada fase (regla del proyecto).
