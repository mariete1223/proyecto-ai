---
fingerprint: voice-capture-verbosity-and-bottom-tab-gap
status: closed
github_issue: https://github.com/mariete1223/proyecto-ai/issues/85
first_seen: 2026-10-19
last_seen: 2026-10-19
---

# Defect: Redundancia en cabecera de dictado, verbosidad en transcripción en directo y hueco bajo barra de navegación inferior

## Observed behaviour

1. En la vista de dictado por voz, coexisten dos botones de cierre ("✕ Cerrar" en la cabecera del modal y "✕ Salir" en la cabecera interna de `VoiceCaptureFlow`), además del título redundantemente largo "Captura Hablada por Voz".
2. En la pantalla de dictado en vivo, la interfaz contiene textos excesivamente verbosos ("🗣️ Lo que estás diciendo:", "🎙️ Escuchando... Di tu comando (ej: 'tarea fecha hoy contenido comprar pan')") en lugar de un área limpia enfocada en el texto dictado en tiempo real.
3. En la vista móvil en iPhone / Safari PWA, la barra de navegación de pestañas inferior (`bottomTabBar`) no queda anclada al borde inferior de la pantalla, dejando un hueco visible de más de 50px de fondo oscuro entre la barra de pestañas y la base de la pantalla.

## Expected behaviour

1. En el modal de dictado, eliminar el texto "Captura Hablada por Voz" y el botón redundante "✕ Salir", manteniendo únicamente el botón "✕ Cerrar" en la cabecera superior.
2. En la caja de dictado, simplificar los textos y eliminar la verbosidad ("Lo que estás diciendo", "Escuchando..."), mostrando de forma limpia y directa la transcripción en tiempo real a medida que el usuario habla, con desglose de parámetros detectados (categoría, fecha, etc.) cuando se identifiquen.
3. La barra de navegación inferior debe estar firmemente anclada al borde inferior físico de la pantalla en dispositivos móviles y PWAs sin hueco ni espacio sobrante.

## Reproduction

1. En iPhone (PWA o Safari móvil), abrir la aplicación.
2. Observar la parte inferior: existe un hueco de fondo oscuro entre la barra de pestañas inferior y el borde inferior del dispositivo.
3. En la pestaña de captura, pulsar "Toca para Grabar por Voz" para abrir el modal de dictado.
4. Observar la duplicidad de controles de cierre ("Cerrar" y "Salir") y el texto "Captura Hablada por Voz".
5. Observar en la caja de transcripción los textos verbosos "Lo que estás diciendo:" y el mensaje de ayuda "Escuchando... Di tu comando...".

Frequency: 100% reproducible en interfaz móvil / PWA iOS.

## Environment

- Client: Standalone PWA iOS / Safari móvil (iPhone) y web móvil
- Components: `MobileMainLayout.tsx`, `MobileHomeVoiceView.tsx`, `VoiceCaptureFlow.tsx`

## Evidence

- Captura de pantalla suministrada por el usuario (`media_1792399174571.jpg`).
- Inspección de código:
  - `MobileHomeVoiceView.tsx`: renderiza `<View style={styles.voiceModalHeader}><Text>🎙️ Captura de Voz Activa</Text><Pressable ...><Text>✕ Cerrar</Text></Pressable></View>` inmediatamente antes de `<VoiceCaptureFlow ... />`.
  - `VoiceCaptureFlow.tsx`: renderiza `<View style={styles.headerRow}><Text style={styles.title}>Captura Hablada por Voz</Text>...<Pressable ...><Text>✕ Salir</Text></Pressable></View>`.
  - `VoiceCaptureFlow.tsx`: en `styles.liveDictationBox` renderiza `<Text style={styles.liveDictationHeaderTitle}>🗣️ Lo que estás diciendo:</Text>` y `liveDictationPlaceholderActive` con texto explicativo verboso.
  - `MobileMainLayout.tsx`: `bottomTabBar` utiliza `position: "absolute", bottom: 0` dentro de un `styles.container` con `minHeight: "100%"`, que en iOS PWA no cubre la altura dinámica del viewport (`100dvh`), dejando un espacio sin anclar.

## Triage

- Classification: confirmed
- Impact: medium
- Facts:
  - La duplicidad "Salir" y "Cerrar" y el título redundante saturan la parte superior del modal en móviles con altura reducida.
  - La caja de dictado contiene textos estáticos innecesarios que ocupan espacio visual prioritario para el texto dictado en directo.
  - La barra inferior se sitúa a 56px del borde inferior físico en iPhone con home indicator.
- Missing information: ninguna.
