---
fingerprint: calendar-empty-no-events-nor-tasks
status: needs-triage
github_issue: null
first_seen: 2026-10-14
last_seen: 2026-10-14
---

# Defect: El calendario queda completamente vacío sin mostrar eventos ni tareas

## Observed behaviour
El usuario reporta que el calendario se ha quedado vacío o "buggeado", no mostrando ningún evento ni ninguna tarea en la cuadrícula mensual ni en el día actual.

## Expected behaviour
La cuadrícula mensual del calendario debe cargar y mostrar con normalidad todas las entradas, eventos y tareas correspondientes al mes y filtros activos del usuario autenticado.

## Reproduction
1. Abrir la aplicación y navegar a la pestaña "CALENDAR".
2. Observar la cuadrícula mensual del mes en curso.
3. El usuario reporta que no se renderizan eventos ni tareas.

Frequency: intermittently (recién observado tras crear nuevo usuario o navegar filtros)

## Environment
- Client: Web PWA (Vercel) / Móvil
- Device or browser: Navegador web / móvil
- Backend or build: Producción actual

## Evidence
- Reporte del usuario: *"Tambien, se me ha buggeado el calendario no me muestra ni eventos ni tareas tampoco ahora. También al crear usuario estaria bien..."*

## Triage
- Classification: needs-triage
- Impact: Alto (impide visualizar la agenda mensual si persiste).
- Facts:
  - En `App.tsx`, las entradas del calendario se obtienen según el `userId` de la sesión activa (`MemoryDatabaseAdapter("proyecto_ai_local_db")`).
  - Si el usuario acaba de registrar un usuario nuevo en la pantalla de autenticación, el `userId` cambia a un nuevo identificador que no tiene datos previos locales hasta sincronizar con el backend o crearlos.
  - El filtro superior `CalendarCategoryFilter` filtra las entradas mostradas si se han seleccionado categorías o etiquetas específicas.
- Hypotheses:
  1. El usuario registró una cuenta nueva o inició sesión con otro usuario, resultando en un espacio local limpio.
  2. Hay un filtro de categoría o etiqueta activo que excluye todas las entradas existentes.
  3. Ocurrió un error en el fetch o sincronización de datos con el backend tras el cambio de credenciales/túnel.
  4. La vista navegó a un mes diferente al mes donde residen las entradas.
- Missing information:
  1. ¿Ocurrió esto justo tras registrar/iniciar sesión con un nuevo usuario o en la misma cuenta donde ya tenías entradas creadas?
  2. ¿Si vas a la pestaña de "Explorador" o "Notas" siguen apareciendo tus datos o está todo vacío?
  3. ¿Tienes algún filtro de categoría o etiqueta seleccionado en la barra superior del calendario?
- Possible duplicates checked:
  - Issues #35 a #65 revisadas. Ningún issue abierto con este síntoma.

## Publication history
- 2026-10-14: Intake registrado como borrador local `needs-triage`. A la espera de las respuestas del usuario sobre el contexto de reproducción antes de publicar en GitHub.
