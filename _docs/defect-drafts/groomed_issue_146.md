## Goal
Garantizar que en la pantalla inicial de captura de voz móvil (`VOICE_CAPTURE`), la tarjeta de acción rápida con el micrófono y el rótulo «Toca para Grabar por Voz» (`mobile-thumb-zone-card`) permanezca estrictamente fijada/pinned en la parte inferior visible (justo sobre la barra de navegación de pestañas) en cualquier tamaño de pantalla y navegador móvil (Safari iOS, Chrome Android, PWA, Web), mientras que el área superior de lectura (título, comandos, categorías y etiquetas) dispone de un scroll vertical independiente que nunca arrastra el micrófono fuera de la pantalla.

## Acceptance criteria
- [ ] En `frontend/components/MobileMainLayout.tsx`, el contenedor principal de la vista móvil (`contentArea` / `swipeContainer`) tiene una altura confinada al 100% de la ventana (`height: 100%`, `overflow: hidden`) y evita que el `body` o el layout general scrolleen en web/PWA.
- [ ] En `frontend/components/MobileHomeVoiceView.tsx`:
  - `mainLayoutWrapper` ocupa el 100% del alto disponible (`flex: 1`, `height: 100%`, `overflow: hidden`).
  - El área de lectura (`mobile-reading-scroll-view`) es el único contenedor que hace scroll vertical (`flex: 1`, `overflowY: auto` en web), con un `paddingBottom` suficiente para que ningún elemento quede tapado detrás del dock.
  - La tarjeta de acción del micrófono (`mobile-thumb-zone-card`) permanece fijada en la parte inferior visible, sin desplazarse ni ocultarse al scrollear las categorías, etiquetas o ejemplos.
- [ ] El rótulo «Toca para Grabar por Voz» y el botón grande del micrófono se mantienen accesibles en todo momento para interacción táctil con el pulgar.
- [ ] Al pulsar el botón del micrófono, el modal/panel de captura activa (`mobile-voice-capture-panel`) continúa abriéndose y cerrándose sin regresiones.
- [ ] Se añaden o actualizan pruebas unitarias y de componentes en `frontend/components/MobileHomeVoiceView.test.tsx` verificando la contención de layout y el anclaje del dock.
- [ ] La suite de pruebas de frontend (`npm run check`) pasa al 100% (formato, lint, TypeScript y tests).

## Out of scope
- Modificaciones en la pantalla de escritorio/web clásica (`WebMainLayout`).
- Reorganización y ajuste de categorías fijas (se aborda inmediatamente después).

## Constraints
- Cumplir con las directrices de `AGENTS.md` (diseño adaptativo, soluciones robustas y escalables, sin parches frágiles ni `!important` descontextualizados).
- Compatible con Safari iOS PWA (`safe-area-inset-bottom`), Chrome Android y pantallas compactas.
