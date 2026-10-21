### Rol: QA
**Issue #109: Ocultar icono de campana en el calendario si la alerta o evento ya ha pasado**

#### Verificaciones Realizadas
1. **Tests unitarios específicos de `CalendarMonthView.test.tsx`**:
   - 18/18 tests pasando.
   - Verificado que una alerta o evento en el pasado (`pastDate` de hace 2 días) con `reminder_enabled: true` no renderiza la campana `day-has-reminder-${pastDayStr}`.
   - Verificado que una alerta futura (`futureDate`) con `reminder_enabled: true` sí renderiza la campana `day-has-reminder-${futureDayStr}`.
2. **Suite completa de frontend (`npm run check`)**:
   - 39/39 suites pasadas (305 tests pasados).
   - Formato, linter y TypeScript checks 100% limpios sin advertencias ni errores.
3. **Suite completa de backend (`uv run --directory backend python scripts/check.py`)**:
   - 120 tests pasados (5 skipped por base PostgreSQL de integración).
   - Formateo, ruff y tipos en 67 archivos fuente OK.

Aprobado para cierre.
