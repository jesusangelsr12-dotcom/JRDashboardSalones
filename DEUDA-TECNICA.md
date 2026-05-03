# Deuda Técnica

## 1. Migración de Gastos de Sheets a Supabase

### Estado actual

Los gastos que vienen de Google Sheets NO se persisten en Supabase.
Se cargan en runtime en cada render desde la API de Sheets.
Se asignan automáticamente a `bolsaDefaultGastos` en `calculations.ts`.

### Limitación que esto causa

- No se pueden reasignar a otra bolsa
- No hay audit log de gastos auto
- No hay capacidad offline
- Cada render hace fetch a Sheets API (latencia + quota)

### Trigger para resolver

Cuando reasignar gastos auto se vuelva fricción semanal (más de 1 vez
por semana), o cuando se necesite audit log completo, o cuando el dashboard
deba funcionar sin internet.

### Esfuerzo estimado

~7-8 horas.

### Decisiones técnicas pendientes

- Una tabla unificada `gastos` o mantener tablas separadas
- Hash de identificación: hash determinista de (fecha+monto+desc+metodo)
- Columna `bolsa_reasignada_at` para no sobrescribir reasignaciones del
  usuario en re-sync

### Pre-requisitos antes de hacer la migración

- Backup automático de Supabase configurado
- Tests del módulo de cálculos pasando
- Rama dedicada
- Ventana de 1-2 días sin trabajar el dashboard productivo
