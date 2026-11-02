## Goal

En la vista móvil (`MobileMainLayout` y `MobileHomeVoiceView`), el área de contenido (`contentArea`) debe ajustarse exactamente al espacio vertical disponible entre la cabecera superior (`topHeader`) y la barra de navegación inferior (`bottomTabBar`), garantizando una separación visual clara y constante (al menos `12px–16px` de margen/aire libre) entre el borde inferior de la tarjeta anclada «Acción Rápida» (`thumbZoneCard`, con el micrófono y los botones «✍️ Escritura Libre» / «🤖 Estructurar con IA») y el borde superior del menú inferior en iOS Safari, Android Chrome y contenedores nativos.

## Context & Defect Evidence

- **Observed behaviour**: En iOS Safari (`voxdaily.vercel.app`), dentro de la pestaña «Captura» (`MobileHomeVoiceView`), la tarjeta anclada inferior **«ACCIÓN RÁPIDA»** aparece pegada directamente contra el borde superior de la barra de navegación inferior (`Captura | Calendario | Tareas | Categorías | IA LLM`), sin espacio libre entre ambos e incluso con su borde inferior solapado/recortado por la barra de pestañas.
- **Expected behaviour**: El contenedor de contenido no debe desbordarse por detrás de `bottomTabBar`, y debe existir una separación visual nítida y ergonómica entre la tarjeta anclada «Acción Rápida» (`mobile-thumb-zone-card`) y el borde superior del menú de navegación inferior (`mobile-bottom-tab-bar`) en cualquier navegador móvil (incluido iOS Safari con barra de direcciones dinámica y `safe-area-inset-bottom`).
- **Reproduction**:
  1. Abrir `https://voxdaily.vercel.app` en iOS Safari.
  2. Situarse en la pestaña «Captura» (`MobileHomeVoiceView`).
  3. Observar la unión entre el bloque inferior anclado «ACCIÓN RÁPIDA» y la barra de navegación inferior (`Captura | Calendario | Tareas | Categorías | IA LLM`).
  4. Comprobar que el bloque del micrófono queda pegado/cortado contra el menú inferior sin espacio de separación.
- **Environment & Evidence**:
  - **Client**: Web móvil (`voxdaily.vercel.app`) en iOS Safari (captura de pantalla adjunta por el usuario a las `23:43`).
  - **Root cause identificada en el triaje**:
    1. En `frontend/components/MobileMainLayout.tsx`, el contenedor raíz (`styles.container` + `webContainerStyle`) es una columna Flex de `100dvh` (`overflow: "hidden"`) que aloja `topHeader` (~50px) y `contentArea`. Sin embargo, `styles.contentArea` y `webContentAreaStyle` definen `height: "100%"` y `maxHeight: "100%"` además de `flex: 1`. En motores WebKit/Safari, aplicar `height: 100%` a un hijo Flex que comparte columna con `topHeader` fuerza una altura igual al 100% del contenedor padre (`100dvh`) en lugar del espacio restante (`flex: 1, minHeight: 0`), empujando el borde inferior de `contentArea` ~50px hacia abajo por detrás de `bottomTabBar`.
    2. Adicionalmente, `bottomTabBar` se posiciona de forma fija/absoluta (`bottom: 0`) superponiéndose a `contentArea` con una compensación insuficiente en `paddingBottom` (`54px`), menor que la altura real renderizada de la barra de navegación más el área segura inferior en iOS Safari.
- **Persisted data repair required**: No (defecto puramente de layout/CSS en la capa de presentación móvil).

## Acceptance criteria

- [ ] En `MobileMainLayout`, `contentArea` (`mobile-content-area`) ocupa únicamente el espacio vertical restante debajo de `topHeader` (`flex: 1`, `minHeight: 0`) sin definir `height: "100%"` ni `maxHeight: "100%"` que provoquen que su caja se desborde por debajo del viewport en iOS Safari o Android Chrome.
- [ ] El espacio reservado respecto a `bottomTabBar` (`mobile-bottom-tab-bar`) y el contenedor del dock anclado (`mobile-pinned-dock-container`) garantiza una separación visual limpia de al menos `12px–16px` entre el borde inferior de la tarjeta «Acción Rápida» (`mobile-thumb-zone-card`) y el borde superior de `bottomTabBar`, tanto en web móvil (incluyendo `env(safe-area-inset-bottom)`) como en nativo.
- [ ] La tarjeta «Acción Rápida» (`mobile-thumb-zone-card`) muestra íntegramente su borde redondeado inferior y los botones «✍️ Escritura Libre» (`btn-mobile-manual-entry`) y «🤖 Estructurar con IA» (`btn-mobile-llm-import`) sin quedar pegados ni recortados por la barra de navegación inferior.
- [ ] La zona superior de lectura (`mobile-home-scroll-area`, con el título, banner de notificaciones y guía de comandos) sigue haciendo scroll vertical de forma independiente por encima del dock anclado (`mobile-pinned-dock-container`), sin que el dock sea empujado fuera de la vista.
- [ ] El panel activo de captura de voz (`mobile-voice-capture-panel`) también respeta la separación inferior respecto a `bottomTabBar` sin que su tarjeta ni su dock de dictado (`pinned-dictate-dock`) queden solapados por el menú inferior.
- [ ] Se incluyen tests unitarios de regresión en `frontend/components/MobileMainLayout.test.tsx` y `frontend/components/MobileHomeVoiceView.test.tsx` que verifican que `contentArea` no usa `height: "100%"` / `maxHeight: "100%"` que desborden el contenedor Flex y que existe la separación/padding inferior requerido entre el dock anclado y `bottomTabBar`.

## Out of scope

- Cambios en la lógica de grabación de audio, transcripción o sincronización con el backend.
- Rediseño de las vistas de escritorio (`DesktopMainLayout` / `HomeVoiceView`).

## Constraints

- Mantener los cambios acotados a `frontend/components/MobileMainLayout.tsx`, `frontend/components/MobileHomeVoiceView.tsx` y sus respectivos archivos de test (`frontend/components/MobileMainLayout.test.tsx` y `frontend/components/MobileHomeVoiceView.test.tsx`).
- No añadir nuevas dependencias en `package.json` ni `pyproject.toml`.
- Seguir las reglas de diseño adaptativo del proyecto (`AGENTS.md`): usar Flexbox estándar (`flex: 1`, `minHeight: 0`, `flexShrink: 0`) y variables de entorno seguras (`env(safe-area-inset-bottom, 0px)`), evitando alturas rígidas que desborden el contenedor padre.
