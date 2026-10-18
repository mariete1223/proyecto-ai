## QA: PASS

- [x] En `frontend/services/notificationService.ts`, tanto la petición a `/api/v1/push/vapid-public-key` como a `/api/v1/push/subscribe` incluyen la cabecera `"ngrok-skip-browser-warning": "true"` - PASS
      Verificado en código fuente: las opciones de fetch en las líneas 173 y 225 incluyen explícitamente `"ngrok-skip-browser-warning": "true"`.
- [x] El proceso backend FastAPI en el puerto 8000 se reinicia para cargar en memoria el código actualizado de `app/core/vapid.py` (TTL 86400) y `app/services/push_worker.py` (ventana de 30 minutos) - PASS
      Verificado: proceso Uvicorn activo en segundo plano en puerto 0.0.0.0:8000 con `--reload`, respondiendo 200 OK a peticiones de salud y conectado al túnel ngrok.
- [x] Se verifica mediante test unitario en `notificationService.test.ts` que las peticiones de suscripción Web Push envían la cabecera `ngrok-skip-browser-warning: true` - PASS
      Ejecutado test `includes ngrok-skip-browser-warning header in subscribeToWebPush fetch calls` resultando en PASS dentro de la suite `services/notificationService.test.ts`.
- [x] Las suites completas de tests de frontend (`npm --prefix frontend run check`) y backend (`pytest`) pasan al 100% - PASS
      - Frontend: `npm run check` (Prettier, ESLint, TypeScript, Jest 37 suites, 255 tests) al 100% verde (exit code 0).
      - Backend: `scripts/check.py` (Ruff format, Ruff check, Mypy 67 archivos, Pytest 117 pasados) al 100% verde (exit code 0).

Verdict: PASS
