---
fingerprint: mobile-horizontal-swipe-navigation-not-working
status: published
github_issue: https://github.com/mariete1223/proyecto-ai/issues/112
first_seen: 2026-10-21
last_seen: 2026-10-21
---

# Defect: el gesto de deslizar (swipe horizontal) para cambiar de pestaña no funciona en móvil web / PWA

## Observed behaviour

Al abrir la aplicación web anclada a la pantalla de inicio en un dispositivo móvil (PWA / Web móvil standalone) e intentar deslizar lateralmente para cambiar de pestaña, la aplicación no realiza ninguna acción ni reacciona al movimiento horizontal.

## Expected behaviour

Al realizar un deslizamiento horizontal (swipe) con suficiente recorrido (|dx| >= 50px y |dx| > |dy| * 1.5):
- Deslizar a la izquierda debe avanzar a la siguiente pestaña (`Captura -> Calendario -> Tareas -> Explorar -> Importar`).
- Deslizar a la derecha debe retroceder a la pestaña previa.
- Debe funcionar de manera fluida en navegadores móviles y aplicaciones web ancladas a la pantalla de inicio (PWA).

## Reproduction

1. Abrir la aplicación desde la web en un teléfono móvil o acceder a ella cuando está anclada a la pantalla de inicio (PWA / Web App).
2. Intentar cambiar de pestaña deslizando horizontalmente hacia la izquierda o hacia la derecha sobre el área de contenido principal.
3. Observar que la pantalla no reacciona al movimiento lateral y no se cambia de pestaña.

Frecuencia: Constante / 100% en clientes móviles web / PWA.

## Environment

- Client: Web anclada a la pantalla de inicio de teléfono móvil (PWA / navegador móvil)
- Device or browser: Teléfono móvil (iOS Safari / Android Chrome en modo standalone)
- Backend or build: Producción / local main branch (frontend Expo React Native Web)

## Evidence

- Declaración directa del usuario: "estoy probnadolo desde la web pero anclado a la pantalla de inicio de mi movil y no hace nada cuando hago el movimiento lateral, no reacciona de ningun forma".

## Triage

- Classification: `confirmed`
- Impact: Alta en experiencia móvil: los usuarios no pueden navegar mediante gestos táctiles naturales y quedan obligados a utilizar exclusivamente los botones de la barra inferior.
- Facts:
  - El usuario probó el gesto táctil en su móvil con la web anclada y la interfaz no reaccionó en absoluto.
  - En `MobileMainLayout.tsx`, el `PanResponder` está asignado al contenedor `mobile-swipe-container` que envuelve al `ScrollView` (`mainScrollView`) de `App.tsx`.
  - El `PanResponder` actual solo define `onMoveShouldSetPanResponder` (fase de burbujeo) y no implementa `onMoveShouldSetPanResponderCapture` (fase de captura).
  - En React Native / React Native Web, un `ScrollView` hijo captura los eventos táctiles nativos de desplazamiento (`touchmove`), impidiendo que el `onMoveShouldSetPanResponder` del padre se active. Además, en entorno web móvil, la propiedad CSS `touch-action` por defecto del navegador puede interceptar o cancelar el gesto horizontal si no se configura captura explícita.
- Hypotheses:
  - Implementar la fase de captura `onMoveShouldSetPanResponderCapture` cuando el movimiento es predominantemente horizontal (`|dx| > 30 && |dx| > |dy| * 1.5`) y configurar `onPanResponderTerminationRequest: () => false` permitirá a `MobileMainLayout` interceptar el gesto antes de que el `ScrollView` hijo o el navegador lo consuman.
- Missing information: Ninguna; entorno y reproducibilidad confirmados por el usuario.
- Possible duplicates checked:
  - Issue #108: `[Feature]: Cambio de pantalla mediante gesto de deslizamiento lateral (swipe horizontal)` (cerrado tras implementación inicial insuficiente para el entorno web móvil real).

## Publication history

- 2026-10-21: Clasificado como `confirmed` tras la confirmación del entorno móvil web/PWA por el usuario.
