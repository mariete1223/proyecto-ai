---
fingerprint: safari-mobile-notif-banner-activate-button-no-op
status: resolved
github_issue: https://github.com/mariete1223/proyecto-ai/issues/152
first_seen: 2026-11-02
last_seen: 2026-11-02
---

# Defect: El botón «Activar 🔔» del banner amarillo «Notificaciones inactivas» no hace nada en iOS Safari

## Observed behaviour

En iOS Safari (`voxdaily.vercel.app`), dentro de la pantalla de inicio móvil (`MobileHomeVoiceView`), aparece la tarjeta amarilla **«🔔 Notificaciones inactivas — Actívalas para que tus avisos y alertas te despierten incluso con la pantalla apagada»** con el botón **«Activar 🔔»**. Al pulsar el botón **«Activar 🔔»**, no ocurre absolutamente nada: no se solicita permiso del sistema, no cambia el estado del banner, no se muestra ningún mensaje explicativo ni opción para ocultarlo. En cambio, el otro banner emergente de permisos (`StartupPermissionsPrompt`) sí responde al pulsarlo.

## Expected behaviour

Al pulsar **«Activar 🔔»** en el banner amarillo de `MobileHomeVoiceView` en Safari (o cuando las notificaciones Web Push no están soportadas en pestaña de navegador sin instalar como PWA en iOS, o cuando se conceden desde `StartupPermissionsPrompt`):
- Si el navegador soporta `Notification.requestPermission()`, debe solicitarse el permiso y actualizarse el estado del banner en consecuencia (incluyendo suscripción Web Push si procede).
- Si el entorno devuelve `"unsupported"` (como una pestaña normal de Safari en iOS fuera del modo standalone en pantalla de inicio), el botón no debe quedarse inerte: debe informar claramente al usuario de cómo habilitarlas en iOS (p. ej. añadir la app a la pantalla de inicio) y permitir descartar/cerrar el aviso, de forma consistente con `StartupPermissionsPrompt`.
- Además, si el usuario activa o descarta las notificaciones desde `StartupPermissionsPrompt`, el banner amarillo de `MobileHomeVoiceView` debe sincronizar su estado sin quedar desfasado.

## Reproduction

1. Abrir `https://voxdaily.vercel.app` en Safari en iOS (pestaña del navegador).
2. En la pestaña «Captura» (`MobileHomeVoiceView`), observar el banner amarillo «🔔 Notificaciones inactivas».
3. Pulsar el botón «Activar 🔔».
4. Observar que el botón no realiza ninguna acción visible y el banner permanece idéntico.

Frequency: Siempre en iOS Safari (pestaña de navegador donde `Notification` no está expuesto en `window`).

## Environment

- Client: Web móvil (`voxdaily.vercel.app`)
- Device or browser: iOS Safari
- Backend or build: Producción Vercel + backend FastAPI

## Evidence

- Captura aportada por el usuario mostrando `voxdaily.vercel.app` en iOS Safari con el banner amarillo «🔔 Notificaciones inactivas» y el botón «Activar 🔔».
- Reporte del usuario: *"lo de notificaciones inactivas la alerta si estoy en safari, si pulso en boton no hace nada, me refieo la notificacion amarilla, la otra si funciona."*

## Triage

- Classification: confirmed
- Impact: Medio-Alto (bloquea la interacción del usuario con el CTA de notificaciones en iOS Safari y deja un banner permanente imposible de accionar o cerrar).
- Facts:
  - En `frontend/services/notificationService.ts`, `isSupported()` comprueba `"Notification" in window`. En una pestaña estándar de Safari en iOS (no instalada en pantalla de inicio), `"Notification" in window` es `false`, por lo que `getPermissionStatus()` y `requestPermissions()` devuelven `"unsupported"`.
  - En `frontend/components/StartupPermissionsPrompt.tsx` (líneas 112-117), cuando `requestPermissions()` devuelve `"unsupported"`, entra en la rama `else` que guarda el descarte (`saveDismissed()`) y oculta el banner (`setVisible(false)`), por eso «la otra sí funciona».
  - En `frontend/components/MobileHomeVoiceView.tsx` (líneas 44-54 y 133-170), el banner amarillo se muestra siempre que `notifStatus !== "granted"`, y `handleActivateNotifications` solo ejecuta `setNotifStatus(await notificationService.requestPermissions())`. Al devolver `"unsupported"`, el estado pasa de `"unsupported"` a `"unsupported"` sin feedback ni cierre.
- Hypotheses: Ninguna adicional; la causa está confirmada en la gestión del estado `"unsupported"` y la falta de sincronización en `MobileHomeVoiceView.tsx`.
- Missing information: Ninguna.
- Possible duplicates checked:
  - Issue #148 (`android-notifications-delivery-failure.md`) — introdujo el banner en `MobileHomeVoiceView`, pero no contempló el estado `"unsupported"` de iOS Safari.
  - `startup-permissions-prompt-freeze-on-activate.md` — afectaba únicamente a `StartupPermissionsPrompt`.
