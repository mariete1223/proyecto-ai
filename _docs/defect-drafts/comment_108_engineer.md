### Rol: Engineer
**Issue #108: Cambio de pantalla mediante gesto de deslizamiento lateral (swipe horizontal)**

#### Causa / Motivación
En la versión móvil (`MobileMainLayout`), la navegación entre las cinco pestañas principales (`VOICE_CAPTURE`, `CALENDAR`, `PENDING_TASKS`, `EXPLORER`, `LLM_IMPORT`) requería pulsar obligatoriamente la barra de navegación inferior. Se requería soporte táctil de deslizamiento lateral (swipe horizontal) fluido para una experiencia móvil moderna y ergonómica.

#### Solución Implementada
1. En `MobileMainLayout.tsx`, se integró `PanResponder` nativo de React Native sobre el contenedor del área de contenido (`mobile-swipe-container`).
2. Se configuraron los umbrales de captura:
   - Requiere un desplazamiento horizontal significativo (`|dx| >= 50px` y `|dx| > |dy| * 1.5`).
   - Movimientos predominantemente verticales (`|dy| >= |dx|`) son rechazados en `onMoveShouldSetPanResponder` para preservar intacto el scroll nativo de listas y vistas internas.
3. Transiciones canónicas ordenadas:
   - Deslizamiento hacia la izquierda (`dx < -50`): avanza a la siguiente pestaña (`VOICE_CAPTURE` -> `CALENDAR` -> `PENDING_TASKS` -> `EXPLORER` -> `LLM_IMPORT`).
   - Deslizamiento hacia la derecha (`dx > 50`): retrocede a la pestaña previa (`LLM_IMPORT` -> `EXPLORER` -> `PENDING_TASKS` -> `CALENDAR` -> `VOICE_CAPTURE`).
   - Límites en bordes respetados sin desbordamiento ni errores.
4. Creada suite completa de pruebas en `MobileMainLayout.test.tsx` verificando el comportamiento táctil y de límites.
