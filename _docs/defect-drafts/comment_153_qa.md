## QA: PASS

- [x] En `MobileMainLayout`, `contentArea` (`mobile-content-area`) ocupa únicamente el espacio vertical restante debajo de `topHeader` (`flex: 1`, `minHeight: 0`) sin definir `height: "100%"` ni `maxHeight: "100%"` que provoquen que su caja se desborde por debajo del viewport en iOS Safari o Android Chrome - PASS
      Verificado en `frontend/components/MobileMainLayout.tsx` (`styles.contentArea` y `webContentAreaStyle` definen `flex: 1`, `minHeight: 0`, `overflow: "hidden"` y eliminan `height: "100%"` y `maxHeight: "100%"`).
- [x] El espacio reservado respecto a `bottomTabBar` (`mobile-bottom-tab-bar`) y el contenedor del dock anclado (`mobile-pinned-dock-container`) garantiza una separación visual limpia de al menos `12px–16px` entre el borde inferior de la tarjeta «Acción Rápida» (`mobile-thumb-zone-card`) y el borde superior de `bottomTabBar`, tanto en web móvil (incluyendo `env(safe-area-inset-bottom)`) como en nativo - PASS
      Verificado en `MobileMainLayout.tsx` (`paddingBottom: 68` en nativo y `"calc(max(8px, env(safe-area-inset-bottom, 0px)) + 68px)"` en web sobre un `bottomTabBar` de `minHeight: 50`) y en `MobileHomeVoiceView.tsx` (`pinnedDockContainer` con `paddingBottom: 16` en web / `14` en nativo, más `marginBottom: 4` en `thumbZoneCard`).
- [x] La tarjeta «Acción Rápida» (`mobile-thumb-zone-card`) muestra íntegramente su borde redondeado inferior y los botones «✍️ Escritura Libre» (`btn-mobile-manual-entry`) y «🤖 Estructurar con IA» (`btn-mobile-llm-import`) sin quedar pegados ni recortados por la barra de navegación inferior - PASS
      Verificado en `MobileHomeVoiceView.tsx` (`thumbZoneCard` mantiene `borderRadius: 20`, `borderWidth: 1.5`, `paddingVertical: 14`, `marginBottom: 4`, `flexShrink: 0` y renderiza ambos botones dentro de un contenedor que ya no desborda por detrás de `bottomTabBar`).
- [x] La zona superior de lectura (`mobile-home-scroll-area`, con el título, banner de notificaciones y guía de comandos) sigue haciendo scroll vertical de forma independiente por encima del dock anclado (`mobile-pinned-dock-container`), sin que el dock sea empujado fuera de la vista - PASS
      Verificado en `MobileHomeVoiceView.tsx`: `scrollArea` (`flex: 1`, `minHeight: 0`, `overflowY: "auto"` en web) convive con `pinnedDockContainer` (`flexShrink: 0`) dentro de `mainLayoutWrapper` (`flex: 1`, `minHeight: 0`, `overflow: "hidden"`).
- [x] El panel activo de captura de voz (`mobile-voice-capture-panel`) también respeta la separación inferior respecto a `bottomTabBar` sin que su tarjeta ni su dock de dictado (`pinned-dictate-dock`) queden solapados por el menú inferior - PASS
      Verificado en `MobileHomeVoiceView.tsx`: `voiceModalContainer` aplica `paddingBottom: Platform.OS === "web" ? 16 : 14` y `voiceModalCard` usa `flex: 1`, `minHeight: 0` sin `height: "100%"`, mantendo `pinned-dictate-dock` separado de `bottomTabBar`.
- [x] Se incluyen tests unitarios de regresión en `frontend/components/MobileMainLayout.test.tsx` y `frontend/components/MobileHomeVoiceView.test.tsx` que verifican que `contentArea` no usa `height: "100%"` / `maxHeight: "100%"` que desborden el contenedor Flex y que existe la separación/padding inferior requerido entre el dock anclado y `bottomTabBar` - PASS
      Verificado en ambos archivos de test y ejecutado en la suite de Jest.

Tests:
- `npm --prefix frontend test -- components/MobileMainLayout.test.tsx components/MobileHomeVoiceView.test.tsx --watchAll=false`, 2 test suites passed, 19 passed, 0 failed
- `npm --prefix frontend run format:check`, passed
- `npm --prefix frontend run lint`, passed (0 warnings, 0 errors)
- `npm --prefix frontend run typecheck`, passed
