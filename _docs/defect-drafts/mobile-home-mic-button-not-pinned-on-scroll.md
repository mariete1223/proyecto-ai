---
fingerprint: mobile-home-mic-button-not-pinned-on-scroll
status: closed
github_issue: https://github.com/mariete1223/proyecto-ai/issues/146
first_seen: 2026-11-02
last_seen: 2026-11-02
---

# Defect: El botón de micrófono y texto «Toca para Grabar por Voz» en pantalla inicial móvil se desplaza con el scroll en lugar de permanecer fijado en pantalla

## Observed behaviour
En la pantalla de inicio móvil (`VOICE_CAPTURE` / `MobileHomeVoiceView`), al desplazarse verticalmente (scrollear) por la sección de lectura (título, comandos de voz, categorías y etiquetas), la tarjeta inferior del micrófono con el texto «Toca para Grabar por Voz» se desplaza junto con el contenido y se sale de la pantalla visible, obligando al usuario a volver a subir para poder acceder al micrófono.

## Expected behaviour
La tarjeta del micrófono con el botón grande y el texto «Toca para Grabar por Voz» debe permanecer fija/pinned en la parte inferior de la pantalla sobre la barra de navegación de pestañas en todo momento, de modo que el usuario pueda scrollear libremente el catálogo superior de comandos y categorías sin que el micrófono se mueva de su posición fija accesible para el pulgar.

## Reproduction
1. Abrir la aplicación VoxDaily en un dispositivo móvil o emulador (pantalla pequeña o viewport vertical móvil).
2. Estar en la pestaña inicial de captura de voz (`VOICE_CAPTURE`).
3. Hacer scroll hacia abajo para leer las categorías, etiquetas y guía de comandos por voz.
4. Observar que el botón del micrófono y el texto «Toca para Grabar por Voz» se mueven con el scroll y desaparecen de la vista.

Frequency: Siempre (100%)

## Environment
- Client: Móvil Web / PWA (Safari iOS / Chrome Android / PWA) y Expo
- Componentes: `frontend/components/MobileHomeVoiceView.tsx`, `frontend/components/MobileMainLayout.tsx`

## Evidence
- Reporte del usuario: *"Sigue sin pinnearse lo de la pantalla inicial del microfono que pone "Toca para grabar por voz" si scrolleo no se queda en la pantalla"*
- Código en `MobileHomeVoiceView.tsx`: `thumbZoneCard` está colocado como último elemento en el flujo normal dentro de `mainLayoutWrapper`, pero en web el contenedor principal o ancestros en `MobileMainLayout` no restringen la altura al 100% del viewport o la tarjeta no tiene fijación absoluta/fija o sticky en la base del layout móvil.

## Triage
- Classification: confirmed
- Impact: medium (usabilidad móvil y ergonomía táctil en pantalla principal de captura)
- Facts: El usuario experimenta que la tarjeta de acción rápida se desplaza al hacer scroll. En React Native Web, si el contenedor flex no tiene altura máxima restringida a la ventana o la tarjeta no está anclada de forma fija/sticky al borde inferior visible, el documento completo scrollea arrastrando la tarjeta fuera de la vista.
- Hypotheses: En navegadores móviles o PWA, el `ScrollView` interno de lectura o el `contentArea` de `MobileMainLayout` provocan que scrollee el contenedor general en lugar de limitar el scroll únicamente al área de lectura, o falta un anclaje explícito (sticky/fixed) para `thumbZoneCard`.
- Missing information: Ninguna para reproducir.
- Possible duplicates checked: Issue #144 (Cerrado previamente: abordó la estructura inicial de dos zonas, pero no fijó con robustez el anclaje en el viewport móvil real).
