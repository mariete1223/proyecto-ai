## Goal

Proporcionar una solicitud guiada, proactiva y unificada de permisos de notificaciones y micrófono al iniciar la aplicación (`StartupPermissionsPrompt.tsx`), de manera que el usuario pueda autorizar en un solo paso ambos permisos esenciales para el funcionamiento de las alertas sonoras programadas y la captura por voz, sin tener que buscarlos en ajustes o sufrir avisos silenciados.

## Acceptance criteria

- [ ] Crear el componente `StartupPermissionsPrompt.tsx`:
  - Se activa al iniciar la app si el permiso de notificaciones no ha sido concedido (`getPermissionStatus() !== "granted"`) y el usuario no ha descartado previamente la solicitud en `localStorage`.
  - Presenta un diseño amigable y claro explicando el beneficio: recordatorios puntuales y dictado por voz sin fricciones.
  - Ofrece un botón de acción principal (`testID="btn-grant-startup-permissions"`) que solicita en secuencia:
    1. Permiso de Notificaciones del navegador/sistema (`notificationService.requestPermissions()`).
    2. Permiso de Micrófono (`navigator.mediaDevices.getUserMedia({ audio: true })`).
    3. Si hay sesión iniciada, suscribe automáticamente a Web Push.
  - Ofrece un botón secundario de descarte (`testID="btn-dismiss-startup-permissions"`) que guarda la preferencia en `localStorage` para no ser intrusivo.
- [ ] En `App.tsx`, integrar `StartupPermissionsPrompt` de forma flotante y responsiva visible tanto en versión móvil (`MobileMainLayout`) como de escritorio (`WebMainLayout`).
- [ ] Pruebas unitarias completas en `frontend/components/StartupPermissionsPrompt.test.tsx` verificando los flujos de activación, descarte y persistencia.
- [ ] Mantener el 100% de las pruebas pasando (242+ en frontend y 116 en backend).

## Out of scope

- Cambios en el motor de transcripción o modelos de voz.

## Constraints

- No introducir dependencias externas en `package.json`.
- Compatibilidad garantizada con navegadores móviles modernos (iOS Safari, Android Chrome) y entornos de testing Jest.
