### Comportamiento observado
Al abrir la aplicación web anclada a la pantalla de inicio en un dispositivo móvil (PWA / Web móvil standalone) e intentar deslizar lateralmente para cambiar de pestaña, la interfaz no reacciona al movimiento y no se realiza el cambio de pantalla.

### Comportamiento esperado
Al realizar un gesto de deslizamiento horizontal (swipe) con suficiente desplazamiento (|dx| >= 50px y |dx| > |dy| * 1.5):
- Deslizar a la izquierda debe avanzar a la siguiente pestaña (`Captura -> Calendario -> Tareas -> Explorar -> Importar`).
- Deslizar a la derecha debe retroceder a la pestaña previa.
- El gesto debe funcionar de forma consistente en dispositivos móviles reales (web anclada a pantalla de inicio / PWA / navegadores móviles).

### Pasos para reproducir
1. Abrir la aplicación desde la web en un teléfono móvil o acceder a ella cuando está anclada a la pantalla de inicio (PWA / Web App).
2. Intentar cambiar de pestaña deslizando horizontalmente hacia la izquierda o hacia la derecha sobre el área de contenido principal.
3. Observar que la pantalla no reacciona al movimiento lateral y no cambia de pestaña.

### Entorno
- Cliente: Web móvil anclada a pantalla de inicio (PWA / Mobile Safari / Mobile Chrome)
- Dispositivo: Teléfono móvil físico
- Frontend: Expo / React Native Web (rama `main`)

### Evidencia
Reporte directo de usuario:
"estoy probnadolo desde la web pero anclado a la pantalla de inicio de mi movil y no hace nada cuando hago el movimiento lateral, no reacciona de ningun forma"

### Triage inicial
- Clasificación: `confirmed`
- Hechos confirmados:
  - En `MobileMainLayout.tsx`, el `PanResponder` actual solo define `onMoveShouldSetPanResponder` (fase bubble).
  - El contenedor envuelve al `ScrollView` (`mainScrollView`) de `App.tsx`, el cual intercepta y consume los eventos de movimiento táctil en su propia fase de captura.
  - En navegadores web móviles, la ausencia de captura horizontal temprana (`onMoveShouldSetPanResponderCapture`) y la interacción con `touch-action` evitan que el `PanResponder` del layout reciba los eventos táctiles.
- Hipótesis:
  - Implementar la fase de captura `onMoveShouldSetPanResponderCapture` cuando `|dx| > 30 && |dx| > |dy| * 1.5` y asegurar `onPanResponderTerminationRequest: () => false` permitirá capturar el gesto antes de que el `ScrollView` o el navegador lo consuman.

### Huella de deduplicacion
`mobile-horizontal-swipe-navigation-not-working`

### Duplicados comprobados
- Issue #108: `[Feature]: Cambio de pantalla mediante gesto de deslizamiento lateral (swipe horizontal)` (cerrado tras implementación inicial). Ningún issue abierto duplicado.
