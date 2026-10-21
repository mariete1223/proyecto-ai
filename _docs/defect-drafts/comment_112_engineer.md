### Software Engineer Implementation Summary

Se ha corregido el problema por el cual el gesto de deslizamiento horizontal (swipe) no respondía en dispositivos móviles reales (web anclada a inicio / PWA / navegadores móviles), manteniendo intacto el scroll vertical nativo y sin añadir dependencias externas.

#### Cambios Implementados en `MobileMainLayout.tsx`
1. **Fase de Captura Temprana (`onMoveShouldSetPanResponderCapture`)**:
   - Implementado en `getSwipePanResponderConfig`: cuando el movimiento del usuario es horizontalmente dominante (`|dx| >= 20px` y `|dx| > |dy| * 1.5`), el contenedor `MobileMainLayout` captura el gesto en la fase descendente (*capture*).
   - Esto evita que el `ScrollView` interno (`mainScrollView`) o los gestos nativos del navegador se apropien del evento antes de que se detecte el swipe.
2. **Protección contra Cancelación (`onPanResponderTerminationRequest: () => false`)**:
   - Asegura que una vez iniciado el swipe horizontal, ningún elemento hijo o evento de scroll pueda arrebatar el responder a mitad de trayectoria.
3. **Optimización de Umbral de Deslizamiento**:
   - Reducido el umbral de activación de 50px a 40px (`minSwipeDistance = 40`) para una respuesta táctil más ágil y natural con el pulgar.
4. **Propiedad CSS `touchAction: "pan-y"` en Web**:
   - En el contenedor `mobile-swipe-container` (para `Platform.OS === 'web'`), se añadió el estilo `{ touchAction: "pan-y" }`. De este modo, el navegador permite el scroll vertical nativo fluido pero cede los gestos horizontales a los controladores de eventos de React Native.
5. **No interferencia con scroll vertical**:
   - Movimientos predominantemente verticales (`|dy| >= |dx|` o `|dx| < 20px`) devuelven `false` en la captura, garantizando que el usuario pueda desplazarse verticalmente por eventos, tareas y notas sin bloqueos.

#### Cobertura de Pruebas
- Actualizada la suite `frontend/components/MobileMainLayout.test.tsx` verificando:
  - Detección en fase de captura y burbujeo (`onMoveShouldSetPanResponder` y `onMoveShouldSetPanResponderCapture`).
  - No captura en movimientos predominantemente verticales o por debajo del umbral de distancia.
  - Navegación bidireccional entre todas las pestañas ordenadas (`VOICE_CAPTURE` ↔ `CALENDAR` ↔ `PENDING_TASKS` ↔ `EXPLORER` ↔ `LLM_IMPORT`).
  - Respeto a las condiciones de frontera (primer y último tab).
- Validación completa: `npm run check` (Prettier, ESLint, TypeScript y 39 suites de Jest con 318 tests pasando).
