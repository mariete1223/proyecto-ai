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

## Triage

- Classification: `needs-triage`
- Impact: La aplicación no puede comunicarse con el backend remoto o túnel desde el cliente móvil, bloqueando la sincronización de notas y el inicio de sesión.
- Facts:
  - El backend local FastAPI está activo y respondiendo en el puerto 8000 (`{"status":"ok"}`).
  - El túnel Ngrok `https://raging-degraded-reptile.ngrok-free.dev` está activo y enrutando hacia `http://localhost:8000`.
  - El usuario intenta conectar desde el móvil (PWA) y recibe el mensaje de error de conexión con el servidor.
- Hypotheses:
  1. Si el usuario está abriendo la app desde una URL que no tiene el túnel activo configurado o si el navegador móvil tiene guardada en `localStorage` una URL antigua (`custom_backend_url`), las peticiones a la API fallan.
  2. En navegadores móviles (iOS Safari), si la web anclada está en `https://voxdaily.vercel.app`, una solicitud de red fallida por problemas de red o certificado en el túnel ngrok provoca `TypeError: Failed to fetch`, derivando en el error `No se pudo conectar con el servidor`.
  3. Al no poder conectar con el servidor, no se pueden recuperar las notas y tareas sincronizadas de la cuenta del usuario.
- Missing information:
  - ¿Dónde te aparece exactamente el mensaje "no puede conectar con el servidor"? (¿Al intentar iniciar sesión en la pantalla de bienvenida, en un punto/aviso en la cabecera, o al pulsar el botón de sincronización `🔄`?)
  - ¿Qué dirección URL estás usando en el navegador del móvil para abrir la app (ej. `https://voxdaily.vercel.app` o una dirección IP)?
  - Si intentas iniciar sesión, ¿qué usuario o correo estás introduciendo?
- Possible duplicates checked:
  - Ningún issue abierto duplicado.


## Publication history

- 2026-10-21: Registrado como borrador local `needs-triage` a la espera de clarificación del usuario.
