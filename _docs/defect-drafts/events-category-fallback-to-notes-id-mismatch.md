---
fingerprint: events-category-fallback-to-notes-id-mismatch
status: published
github_issue: https://github.com/mariete1223/proyecto-ai/issues/151
first_seen: 2026-11-02
last_seen: 2026-11-02
---

# Defect: Las entradas guardadas como Eventos se visualizan como "Notas" debido a discrepancia de category_id entre cliente y backend

## Observed behaviour

Al guardar o actualizar una entrada asignada a la categoría "Eventos" (o tras sincronizarla desde el backend), en la vista de calendario mensual y en la vista de detalle de entrada del cliente móvil aparece con la etiqueta de categoría "Notas" y el color morado/índigo (`#6366F1`) en vez de la categoría "Eventos" y su color verde esmeralda (`#10B981`).

## Expected behaviour

Toda entrada perteneciente a la categoría "Eventos" debe mostrarse en la tarjeta del calendario, en el timeline horario y en la vista de detalle de la entrada con la etiqueta "Eventos" y su color verde esmeralda (`#10B981`).

## Reproduction

1. Partir de un usuario en un entorno multi-inquilino (como `mariete1223@outlook.es`) donde en backend la categoría "Eventos" tiene un UUID generado (`88c26dbc-219e-47a3-a371-531937173c29`) porque el ID canónico (`45e5d9a3-b1d9-4268-acbf-cbe98c0d1ccd`) fue tomado globalmente por el usuario demo.
2. En el cliente móvil, `ensureCanonicalCategories` remapea o fuerza la categoría "Eventos" al ID canónico `45e5d9a3-b1d9-4268-acbf-cbe98c0d1ccd`, y `listCategories` deduplica por nombre eliminando el ID alternativo del backend de la tabla local `categories`.
3. Al sincronizar (pull) una entrada como `3552e27f` cuyo `category_id` en backend es `88c26dbc-219e-47a3-a371-531937173c29`, el cliente guarda dicho UUID foráneo en la tabla `entries`.
4. Al renderizar en `CalendarMonthView.tsx` o `EntryDetailView.tsx`, se busca `cat = categoryMap.get(entry.category_id)`.
5. Como `categoryMap` solo contiene las categorías locales del cliente, `cat` es `undefined`.
6. Como la entrada no tiene `task_status` activo (`isTask === false`), el código recurre al fallback hardcodeado:
   `const fallbackCatName = isTask ? "Tareas" : "Notas";`
   `const fallbackCatColor = isTask ? "#F59E0B" : "#6366F1";`
7. La entrada de evento se muestra con etiqueta "Notas" y color `#6366F1`.

Frecuencia: 100% reproducible en usuarios secundarios cuyos IDs de categorías en el backend difieren de los UUIDs canónicos del cliente móvil.

## Environment

- Cliente: Expo / React Native (móvil y web)
- Backend: FastAPI, SQLAlchemy SQLite multiusuario (`app.db`)
- Dispositivo: Android / Expo Go

## Evidence

- Reporte del usuario: *"luego si has intentado ponerla como evento ha salido como nota otro fallo?"*
- Verificación en base de datos `backend/app.db`:
  - Entrada `3552e27f-6a9d-44ae-9fca-fab141479274` pertenece a la categoría `Eventos` con `category_id: 88c26dbc-219e-47a3-a371-531937173c29`.
  - En `frontend/db/categories.ts`, `CANONICAL_CATEGORIES.EVENTOS.id` es `45e5d9a3-b1d9-4268-acbf-cbe98c0d1ccd`.
  - En `CalendarMonthView.tsx:1440` y `EntryDetailView.tsx:333`, si `cat` es undefined y `isTask` es false, el fallback es `"Notas"`.

## Triage

- Clasificación: `confirmed`
- Impacto: Alto (distorsiona la clasificación visual de eventos y notas para el usuario en el calendario).
- Hechos:
  1. En `backend/app/models/domain.py`, `Category.id` tiene una restricción de clave primaria global.
  2. Cuando el usuario demo ocupa los IDs canónicos estándar (`45e5d9a3-...`), a los usuarios posteriores se les generan UUIDs aleatorios para sus categorías iniciales (`88c26dbc-...`).
  3. El frontend móvil estandariza localmente las categorías canónicas (`Notas`, `Tareas`, `Eventos`, `Alerta`) bajo UUIDs canónicos fijos.
  4. Durante el pull de sincronización o renderizado en frontend, las entradas con IDs de categoría de servidor no mapeados en la tabla local quedan sin resolver (`cat === undefined`), cayendo en el fallback por defecto a "Notas".
- Hipótesis:
  - El alineamiento bidireccional debe realizarse tanto en la sincronización (traduciendo/normalizando IDs canónicos durante push y pull) como en la resolución defensiva de categorías del frontend (buscando por nombre canónico o kind si el ID exacto no coincide en `categoryMap`).
- Información faltante: Ninguna.

## Duplicados comprobados

- Revisados issues #147 (`tasks-category-fallback-general-missing-id`), #149, #150.
- El issue #147 resolvió el problema equivalente para las entradas de tipo tarea (`task_status !== null`), pero dejó como fallback `"Notas"` para todas las entradas sin `task_status` (incluyendo eventos) cuando el `category_id` no coincide con el mapa local.

## Publication history

- 2026-11-02: Borrador local creado.
