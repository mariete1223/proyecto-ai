---
fingerprint: mobile-pinned-dock-clipped-against-bottom-tab-bar
status: resolved
github_issue: https://github.com/mariete1223/proyecto-ai/issues/153
first_seen: 2026-11-02
last_seen: 2026-11-02
---

# Defect: El bloque anclado del micrófono (Acción Rápida) queda pegado y cortado contra el menú inferior en móvil

## Observed behaviour

En iOS Safari (`voxdaily.vercel.app`), en la pestaña «Captura» (`MobileHomeVoiceView`), la tarjeta anclada inferior **«ACCIÓN RÁPIDA»** (con el botón grande del micrófono y los botones «✍️ Escritura Libre» y «🤖 Estructurar con IA») aparece pegada directamente contra el borde superior del menú de navegación inferior (`Captura`, `Calendario`, `Tareas`, `Categorías`, `IA LLM`), sin espacio libre entre ambos e incluso con el borde inferior de la tarjeta/botones solapado por la barra de navegación.

## Expected behaviour

Debe existir una separación visual clara y consistente entre la parte inferior de la tarjeta anclada «Acción Rápida» (`thumbZoneCard` / `pinnedDockContainer`) y el borde superior del menú de navegación inferior (`bottomTabBar`) en cualquier navegador móvil (incluido iOS Safari con barra de direcciones inferior), sin que el contenedor de contenido se desborde por debajo de la barra de pestañas fija.

## Reproduction

1. Abrir `https://voxdaily.vercel.app` en iOS Safari.
2. Situarse en la pestaña principal «Captura» (`MobileHomeVoiceView`).
3. Observar la zona inferior donde se unen el bloque anclado «ACCIÓN RÁPIDA» y la barra de navegación inferior (`Captura | Calendario | Tareas | Categorías | IA LLM`).
4. Comprobar que no hay margen/espacio entre el bloque del micrófono y el menú inferior.

Frequency: Siempre en web móvil / iOS Safari.

## Environment

- Client: Web móvil (`voxdaily.vercel.app`)
- Device or browser: iOS Safari
- Backend or build: Producción Vercel (`19e4ff9` / `0016cb9`)

## Evidence

- Captura de pantalla adjunta por el usuario (`23:43`, `voxdaily.vercel.app` en iOS Safari) donde se aprecia la tarjeta «ACCIÓN RÁPIDA» y sus botones inferiores («Escritura Libre», «Estructurar con IA») tocando directamente el borde superior de la barra de navegación inferior sin margen.
- Reporte del usuario: *"luego lo de abajo se ve asi: ves que no hay espacio entre el menu inferior y lo del micro q esta pinned?"*

## Triage

- Classification: confirmed
- Impact: Medio (degrada la ergonomía y legibilidad visual en la zona del pulgar y recorta el borde inferior de la tarjeta de acción rápida).
- Facts:
  - En `frontend/components/MobileMainLayout.tsx` (líneas 148-176 y 627-663), el contenedor raíz es un flex column con `height: "100dvh", maxHeight: "100dvh", overflow: "hidden"` que contiene `topHeader` (~50px de alto) y `contentArea`.
  - `webContentAreaStyle` (líneas 166-176) aplica `height: "100%", maxHeight: "100%"` sobre `contentArea` además de `flex: 1`. En CSS Flexbox, asignar `height: 100%` a un hijo que comparte contenedor con `topHeader` hace que `contentArea` mida el 100% del padre (`100dvh`) en vez del espacio restante (`flex: 1`), desplazando su borde inferior hacia abajo tantos píxeles como mide `topHeader` (~50px) y metiéndolo por debajo de `bottomTabBar` (`position: "fixed", bottom: 0`).
  - Por ello, el `paddingBottom` añadido en #150 queda oculto detrás del `bottomTabBar` fijo y la tarjeta `thumbZoneCard` queda pegada/cortada contra el menú inferior.
- Hypotheses: Ninguna adicional; el desbordamiento de `contentArea` por `height: "100%"` combinado con `bottomTabBar` en `position: "fixed"` explica exactamente la captura en iOS Safari.
- Missing information: Ninguna.
- Possible duplicates checked:
  - Issue #150 (`mobile-thumb-dock-spacing-and-voice-buttons-pinned.md`, cerrada) — intentó añadir `paddingBottom: 14` en `pinnedDockContainer`, pero el problema persiste en iOS Safari porque `contentArea` se desborda detrás de `bottomTabBar`.
