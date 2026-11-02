---
fingerprint: mobile-thumb-dock-spacing-and-voice-buttons-pinned
status: resolved
github_issue: https://github.com/mariete1223/proyecto-ai/issues/150
first_seen: 2026-11-02
last_seen: 2026-11-02
---

# Defect: Espaciado inferior de zona de pulgar sobre la barra de navegación y anclaje de botones de dictado

## Observed behaviour

1. En la pantalla de inicio móvil (`MobileHomeVoiceView`), el bloque anclado de acción rápida (`thumbZoneCard`) queda pegado directamente encima de la barra de pestañas inferior (`bottomTabBar`) sin margen de separación visual (`spacing`), y no queda visualmente claro que el dock es fijo y el resto del contenido superior es scrollable.
2. Al pulsar el botón grande de micrófono para abrir la captura de voz, el contenedor modal envuelve a `VoiceCaptureFlow` dentro de un `ScrollView` exterior completo. Como consecuencia, los botones de acción («Toca para Dictar» y «Detener y Procesar») no quedan anclados abajo en la zona del pulgar (Thumb Zone), sino que quedan al final del scroll, forzando al usuario a deslizar hacia abajo para verlos y pulsarlos.

## Expected behaviour

1. `MobileHomeVoiceView`: El dock inferior debe tener una separación/margen limpio sobre la barra de navegación inferior, con una jerarquía visual o sombra/divisor que distinga claramente el dock fijo del área de lectura superior deslizable.
2. En la pantalla/modal de dictado por voz: Los botones de acción principal («Toca para Dictar» y «Detener y Procesar») deben estar anclados fijamente en la parte inferior (zona de alcance del pulgar) sin requerir scroll vertical. Solo el contenido informativo superior (transcripción y comandos) debe ser deslizable.

## Resolution

- **Dock inferior en `MobileHomeVoiceView.tsx`**:
  - Se introdujo `pinnedDockContainer` con fondo sólido opaco (`rgba(15, 23, 42, 0.96)`), borde superior con resplandor cyan (`borderTopColor: rgba(56, 189, 248, 0.2)`), sombra superior suave y padding inferior de 14px en web (12px en nativo), separándolo confortablemente de la barra inferior de navegación.
  - Se añadió `dockSurfaceSeparator` para delimitar nítidamente la superficie fija sobre la que desliza el feed de comandos.
- **Anclaje de botones en `VoiceCaptureFlow.tsx` / `MobileHomeVoiceView.tsx`**:
  - Se eliminó el `ScrollView` envolvente exterior en el modal de voz en `MobileHomeVoiceView.tsx`, reemplazándolo por `voiceModalContainer`, `voiceModalCard` y `voiceModalFlowWrapper` con contención flexible (`flex: 1, minHeight: 0, overflow: "hidden"`).
  - En `VoiceCaptureFlow.tsx`, se confinaron `card`, `screenContainer` y `dictateScrollArea` a `minHeight: 0, height: "100%"`, y se blindó `pinnedDictateDock` con `flexShrink: 0`, fijando «Toca para Dictar» y «Detener y Procesar» siempre en la zona de alcance de pulgar inferior.
- **Tests**:
  - Verificado en `MobileHomeVoiceView.test.tsx` (estilo de dock, presencia fija y botones de dictado accesibles).

## Environment

- Client: PWA móvil / Web móvil (Android Chrome, iOS Safari)
- Frontend: `MobileHomeVoiceView.tsx`, `VoiceCaptureFlow.tsx`, `MobileMainLayout.tsx`

## Evidence

- Reporte directo del usuario:
  - *"el pin esta correcto pero los botones estan justo encima del menu inferior, no hay ningun espaciado, tampoco queda claro que eso no es scrolleable y el resto si, confuso"*
  - *"Luego el boton de toca para dictar debe estar pinned tambien abajo cuando este esa pantalla, y el detener y procesar tambien para vevitar tener que scrollear para verlos"*
- Verificación automatizada:
  - Frontend: 43 suites pasadas, 391 tests pasados.
  - Backend: 143 tests pasados.
