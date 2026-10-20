### Descripción de la funcionalidad
Permitir a los usuarios alternar entre las pantallas o pestañas principales de la aplicación (`Captura por Voz` -> `Calendario` -> `Tareas` -> `Categorías` -> `Estructurar con IA`) deslizando el dedo horizontalmente hacia la izquierda o hacia la derecha (gesto swipe lateral), además de poder pulsar los iconos de la barra de navegación inferior.

### Comportamiento esperado
- **Deslizar hacia la izquierda (Swipe Left)**: Avanza a la siguiente pestaña en el orden canónico:
  1. `Captura por Voz` (`VOICE_CAPTURE`)
  2. `Calendario` (`CALENDAR`)
  3. `Tareas Pendientes` (`PENDING_TASKS`)
  4. `Categorías` (`EXPLORER`)
  5. `Estructurar con IA` (`LLM_IMPORT`)
- **Deslizar hacia la derecha (Swipe Right)**: Retrocede a la pestaña anterior en el orden canónico.
- **Convivencia con scroll vertical**: El detector de gestos (mediante `PanResponder` nativo de React Native sin librerías externas) solo debe activarse si el desplazamiento horizontal es claramente mayor que el vertical (`|dx| > |dy|` y superando un umbral mínimo como 50-60px), evitando interferir con el scroll vertical de listas o formularios.
- **Límites de navegación**: Si el usuario está en la primera pestaña (`VOICE_CAPTURE`), deslizar a la derecha no hace nada; si está en la última (`LLM_IMPORT`), deslizar a la izquierda no hace nada.

### Entorno
- Cliente: Móvil / PWA / Web táctil
- Componentes: `frontend/components/MobileMainLayout.tsx`, `frontend/App.tsx`

### Evidencia
Solicitud directa del usuario: "Tambien molaria poder cambiar entre pantallas con un deslizamiento lateral, no se si es muy complejo pero asi habría dos formas con los iconos de abajo y con eso, seria muy util"

### Triage inicial
- Clasificación: `confirmed`
- Factibilidad técnica: Es totalmente viable y no requiere dependencias externas adicionales; se puede implementar con `PanResponder` estándar de React Native en el contenedor principal de la vista móvil.
- Huella de deduplicación: `navigation-horizontal-swipe-tab-transition`
