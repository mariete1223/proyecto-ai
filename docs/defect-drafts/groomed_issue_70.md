## Goal
Incorporar una categoría inicial canónica predeterminada llamada "Alerta" (comando de voz "alerta", tipo `TASK`) que represente alertas o tareas que deban notificar al usuario automáticamente al llegar la fecha/hora establecida.

## Acceptance criteria
- [ ] En `frontend/db/categories.ts`, agregar a `CANONICAL_CATEGORIES`:
  - `ALERTA`: id fijo (`c3d4e5f6-a7b8-4901-c2d3-e4f5a6b7c8d9`), name: "Alerta", voice_command: "alerta", kind: "TASK", color: "#EF4444" (Rojo Alerta), icon: "bell".
  - En `ensureCanonicalCategories`: si la categoría no existe y no ha sido eliminada por tombstone, se inicializa automáticamente.
- [ ] En backend `backend/app/services/category_service.py`:
  - Incluir la categoría "Alerta" (`kind: CategoryKind.TASK`, `voice_command: "alerta"`, `icon: "bell"`, `color: "#EF4444"`) en `INITIAL_CATEGORIES`.
- [ ] Comportamiento de notificación automática:
  - Al crear una entrada en la categoría "Alerta" con fecha/hora (`occurred_at`), si `reminder_enabled` no fue explícitamente desactivado por el usuario, se activa por defecto (`reminder_enabled = true`, `reminder_offset_minutes = 0` o el offset dictado).
  - Al llegar la hora señalada, el sistema emite la notificación y sonido de alerta correspondiente.
- [ ] Reconocimiento por voz:
  - En `voiceParser.ts`: reconocer "alerta <acción/tarea>" asignando la categoría "Alerta" y configurando el recordatorio activo automáticamente para la hora señalada.
- [ ] Pruebas unitarias:
  - `categories.test.ts`: verificar creación e idempotencia de la categoría Alerta.
  - `category_service.py` (backend tests): verificar que la categoría Alerta se crea para nuevos usuarios.
  - `voiceParser.test.ts` y flujo de guardado: verificar que dictar "alerta ..." asigna la categoría Alerta y activa el recordatorio.

## Out of scope
- Alertas continuas con sonido repetitivo tipo despertador (la notificación estándar del sistema y chime sonoro son suficientes).
- Recrear la categoría si el usuario la borró explícitamente (respetar tombstones).

## Constraints
- Mantener consistencia con el sistema de tipos `CategoryKind` existente.
- Pasar toda la suite de tests en frontend y backend.
