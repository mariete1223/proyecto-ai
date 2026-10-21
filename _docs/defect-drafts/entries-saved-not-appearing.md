---
fingerprint: entries-saved-not-appearing
status: needs-triage
github_issue: null
first_seen: 2026-10-21
last_seen: 2026-10-21
---

# Defect: los elementos guardados previamente no aparecen en la aplicación

## Observed behaviour

El usuario reporta que guardó elementos previamente en la aplicación, pero al volver o consultar la aplicación, estos no aparecen reflejados ("he guardado antes cosas y no me aparecen en la app porque?").

## Expected behaviour

Los elementos guardados (notas, tareas, eventos o recordatorios) deben persistir y ser consultables de forma predecible en sus respectivas pantallas (Calendario para eventos con fecha, Tareas para tareas pendientes, Explorador para notas y categorías).

## Reproduction

1. Crear y guardar elementos en la aplicación (notas, tareas o recordatorios).
2. Volver a abrir la aplicación o navegar por las pantallas.
3. Observar que los elementos guardados con anterioridad no se muestran.

Frecuencia: Reportado por el usuario; pendiente de determinar las condiciones de persistencia y sesión.

## Environment

- Client: Web / Web móvil anclada (PWA)
- Device: PC / Teléfono móvil
- Backend: SQLite local / PostgreSQL sincronizado

## Evidence

- Declaración del usuario:
  - "he guardado antes cosas y no me aparecen en la app porque?"
  - "me dice q no puede conectar con el servidor"
  - "este es el ordenador donde se establece el servidor"
  - "esto nunca tuve que hacerlo Abre el navegador de tu móvil ... no me conecta aun"

## Triage

- Classification: `confirmed`
- Impact: high (usuario no visualiza sus notas previas y experimenta errores de conexión desde el cliente móvil).
- Facts:
  - El servidor backend corre localmente en esta misma máquina (`http://localhost:8000`) y está activo.
  - El túnel ngrok `https://raging-degraded-reptile.ngrok-free.dev` apunta a `http://localhost:8000` y está activo.
  - En `backend/app.db`, las entradas previas del usuario ("Hemos ido con Carmen a casa de mis abuelos...", "Tengo que ir al mercado del La Alberca...", "Después del partido fui al Cervemur...") existen y están guardadas, pero bajo el usuario demo/invitado (`11111111-1111-4111-a111-111111111111` / `demo@example.com`).
  - Al iniciar sesión con `mariete1223@outlook.es`, la app aísla los datos por `user_id` y no muestra las notas del usuario demo.
  - El fallo de conexión previo se debió a un error de esquema interno en SQLite (`no such column: users.is_verified`), que ya fue corregido en `backend/app.db` y `backend/app/main.py`.
- Missing information:
  - ¿En qué punto exacto de la app móvil se muestra el error de conexión (en el formulario de login al escribir la contraseña, en un toast al abrir la app o al pulsar sincronizar)?
- Next Steps:
  - Migrar o reasignar las notas del usuario demo a la cuenta `mariete1223@outlook.es`.
  - Asegurar que la sesión en el móvil reconecte y sincronice limpiamente.

## Publication history

- 2026-10-21: Registrado como borrador local `needs-triage` a la espera de clarificación del usuario.
- 2026-10-21: Clasificado como `confirmed` tras aislar las notas guardadas bajo la cuenta demo en `backend/app.db` y comprobar el estado del backend local.

