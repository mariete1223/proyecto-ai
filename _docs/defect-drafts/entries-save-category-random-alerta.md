---
fingerprint: entries-save-category-random-alerta
status: published
github_issue: https://github.com/mariete1223/proyecto-ai/issues/149
first_seen: 2026-11-02
last_seen: 2026-11-02
---

# Defect: Guardado de eventos asigna categorías erróneas (Alerta o Tarea) y preselecciona Alerta por defecto

## Observed behaviour

Al guardar un evento o nota desde el móvil, se asignan categorías no deseadas o inesperadas (por ejemplo, se guardan como «Alerta» con recordatorios automáticos no solicitados o como «Tarea»).

## Expected behaviour

Al guardar un evento o nota, debe respetarse fielmente la categoría deseada por el usuario (ej. «Eventos» o «Notas»), sin que el sistema preseleccione silenciosamente la categoría «Alerta» ni active recordatorios automáticos a deshoras.

## Reproduction

1. Dictado por voz:
   - El usuario pulsa el micrófono y dice claramente: «evento [texto del evento]».
   - El parser de voz (`VoiceCaptureFlow` / `voiceParser.ts`) detecta correctamente la categoría «Eventos» y asigna el UUID canónico (`45e5d9a3-b1d9-4268-acbf-cbe98c0d1ccd`).
   - Al sincronizar con el backend, el backend busca la categoría con ese UUID exacto para el usuario.
   - En la base de datos del usuario, la categoría «Eventos» tiene un UUID distinto (`88c26dbc-219e-47a3-a371-531937173c29`).
   - `backend/app/services/sync_service.py` (L420-449) no encuentra el UUID y recurre al fallback: `order_by(Category.created_at.asc()).first()`.
   - Como la categoría más antigua en la base de datos es «Alerta», el backend reasigna la categoría a «Alerta».
   - Al sincronizar de vuelta al cliente, el evento aparece guardado como «Alerta».
2. Formulario manual («✍️ Escritura Libre»):
   - Al abrir el formulario, aparece seleccionada automáticamente «Alerta» (debido a orden alfabético de `cats[0]` en `EntryForm.tsx:86-95`), activando `reminder_enabled = true`.

## Environment

- Client: PWA móvil / Web móvil (Android Chrome / iOS Safari)
- Frontend: `EntryForm.tsx`, `VoiceCaptureFlow.tsx`, `voiceParser.ts`
- Backend: SQLite / FastAPI (`sync_service.py`, `category_service.py`)

## Evidence

- Confirmación del usuario: «el fallo ha sido por voz y he dicho claramente evento, ha detectado evento, y luego me ha guardado una alert».
- Base de datos `backend/app.db`:
  - En la cuenta del usuario, la categoría «Eventos» tiene ID `88c26dbc-219e-47a3-a371-531937173c29`.
  - El frontend envía `category_id = 45e5d9a3-b1d9-4268-acbf-cbe98c0d1ccd` (el canónico de `categories.ts`).
  - `sync_service.py` (L420-449) al no encontrar coincidencia exacta por ID en las categorías de ese usuario, ejecuta el fallback por defecto:
    `fallback_cat = select(Category).where(Category.user_id == user_id).order_by(Category.created_at.asc()).scalars().first()`
  - La primera categoría por `created_at` es `Alerta` (`c3d4e5f6-a7b8-4901-c2d3-e4f5a6b7c8d9`), mutando silenciosamente la categoría de Evento a Alerta.
- En `EntryForm.tsx`:
  - Línea 86-95: `setSelectedCategoryId((prev) => { const nextId = prev ? prev : cats[0].id; ... if (isCategoryAlert(cat)) { setReminderEnabled(true); ... } })`. Como las categorías se ordenan alfabéticamente en `listCategories`, `cats[0]` es siempre «Alerta».

