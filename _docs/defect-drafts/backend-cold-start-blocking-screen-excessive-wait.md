---
fingerprint: backend-cold-start-blocking-screen-excessive-wait
status: resolved
github_issue: https://github.com/mariete1223/proyecto-ai/issues/154
first_seen: 2026-11-05
last_seen: 2026-11-05
resolved_at: 2026-11-05
resolution: Desacoplado el arranque en frío y comprobación de salud remota de Render del ciclo de inicio de la aplicación en App.tsx. Los datos locales de SQLite se cargan de inmediato (< 200ms) sin bloquear la interfaz. El sondeo de reactivación se ejecuta asíncronamente en segundo plano con actualización reactiva a Online y sincronización sin recarga de página. Se añadió además un botón de escape («Continuar en modo local») si se mostrara alguna pantalla de espera transitoria, respetando los invariantes de Flexbox y thumb-zone. Verificado con QA PASS y suite de tests de regresión.
---

# Defect: Pantalla de arranque en frío bloquea la app durante 30+ segundos impidiendo el uso offline

## Observed behaviour

Al abrir la aplicación con una sesión activa cuando el backend de Render se encuentra en reposo (spun-down), la app muestra una pantalla de carga a pantalla completa ("Conectando con tu nube segura... El servidor se está reactivando tras reposo") que bloquea totalmente la interfaz durante 30 a 50 segundos. El usuario no puede consultar sus notas, ver su calendario ni capturar tareas locales hasta que el backend responde, a pesar de que la aplicación es offline-first y los datos están persistidos localmente en SQLite/IndexedDB.

## Expected behaviour

En una aplicación offline-first, la interfaz debe cargar y ser interactiva de inmediato con los datos locales disponibles (< 200ms). El sondeo de reactivación del servidor y la sincronización inicial deben ejecutarse en segundo plano con indicadores no bloqueantes (o con un botón explícito de "Acceder en modo local / Continuar sin esperar") para no congelar la experiencia del usuario durante los arranques en frío.

## Reproduction

1. Iniciar sesión en la aplicación con una cuenta válida.
2. Permitir que el backend en Render entre en modo reposo (15 minutos de inactividad).
3. Abrir la aplicación.
4. `initApp()` en `App.tsx` detecta que el backend no responde de inmediato (> 1200ms) y activa `isColdStarting = true`.
5. Se muestra `loadingContainer` y se ejecutan reintentos con `setTimeout` bloqueando el renderizado de la UI principal durante ~30-50 segundos.

Frequency: 100% al abrir la aplicación tras un periodo de inactividad del backend.

## Environment

- Client: Web / PWA móvil
- Device or browser: iOS Safari PWA / Android Chrome / Desktop Web
- Backend: Render Free Tier (`https://proyecto-ai-api-oi2n.onrender.com`)

## Evidence

- Mensaje del usuario: "lo del backend cold start tiene al usuario unos 30 segundos parado es demasiado"
- Inspección de `frontend/App.tsx` (líneas 630-680 y 816-833):
  `if (!isInitialized || isColdStarting)` renderiza una vista de bloqueo rígida que impide renderizar `MobileMainLayout` o `WebMainLayout` hasta que `isColdStarting` es `false`.

## Triage

- Classification: confirmed
- Impact: high (viola el principio de diseño offline-first y bloquea al usuario durante 30+ segundos).
- Facts:
  - Render free tier tarda entre 30 y 50 segundos en despertar de una suspensión fría.
  - La base de datos local del cliente contiene el estado completo de notas y tareas.
  - La pantalla de carga actual no ofrece vía de escape ni renderizado optimista de datos locales.
- Hypotheses: Ninguna; el flujo de bloqueo síncrono en `initApp()` está directamente acoplado al estado de salud del backend remoto.
- Missing information: Ninguna.
- Possible duplicates checked: Ningún borrador previo de arranque en frío.

## Publication history

- 2026-11-05: Intake registrado como borrador local confirmado.
