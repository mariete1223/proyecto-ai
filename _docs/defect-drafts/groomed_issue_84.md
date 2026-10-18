## Goal

Asegurar que todas las peticiones de Web Push y sincronización desde el cliente web/móvil hacia el túnel ngrok incorporen la cabecera `ngrok-skip-browser-warning: true`, y que el servidor backend ejecute el código actualizado con el TTL de 86400s y el worker de recordatorios activo, garantizando la entrega efectiva de notificaciones en reposo en iOS.

## Acceptance criteria

- [ ] En `frontend/services/notificationService.ts`, tanto la petición a `/api/v1/push/vapid-public-key` como a `/api/v1/push/subscribe` incluyen la cabecera `"ngrok-skip-browser-warning": "true"`.
- [ ] El proceso backend FastAPI en el puerto 8000 se reinicia para cargar en memoria el código actualizado de `app/core/vapid.py` (TTL 86400) y `app/services/push_worker.py` (ventana de 30 minutos).
- [ ] Se verifica mediante test unitario en `notificationService.test.ts` que las peticiones de suscripción Web Push envían la cabecera `ngrok-skip-browser-warning: true`.
- [ ] Las suites completas de tests de frontend (`npm --prefix frontend run check`) y backend (`pytest`) pasan al 100%.

## Out of scope

- [ ] Reemplazo del proveedor de túnel ngrok por una infraestructura de dominio propio o Cloudflare Tunnels dedicada.

## Constraints

- Modificaciones acotadas a `frontend/services/notificationService.ts` y sus tests asociados.
- Mantener compatibilidad con despliegues directos sin túnel o entornos locales.
