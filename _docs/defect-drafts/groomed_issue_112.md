## Goal

Hacer que la navegación mediante deslizamiento horizontal (swipe) funcione de forma fiable y responsiva en dispositivos móviles reales (incluyendo navegadores móviles y aplicaciones web ancladas a la pantalla de inicio / PWA), permitiendo alternar fluidamente entre pestañas sin interferir con el scroll vertical de los contenidos ni con los elementos interactivos internos.

## Acceptance criteria

- [ ] En `MobileMainLayout`, el `PanResponder` implementa `onMoveShouldSetPanResponderCapture` cuando el desplazamiento es horizontalmente dominante (|dx| >= 20px y |dx| > |dy| * 1.5) para capturar el gesto antes de que el `ScrollView` interno (`mainScrollView`) lo consuma.
- [ ] Al deslizar hacia la izquierda con desplazamiento suficiente (dx <= -40px y |dx| > |dy| * 1.5), se avanza a la siguiente pestaña en el orden canónico: `VOICE_CAPTURE` -> `CALENDAR` -> `PENDING_TASKS` -> `EXPLORER` -> `LLM_IMPORT`.
- [ ] Al deslizar hacia la derecha con desplazamiento suficiente (dx >= 40px y |dx| > |dy| * 1.5), se retrocede a la pestaña previa en el orden canónico.
- [ ] En la primera pestaña (`VOICE_CAPTURE`), un deslizamiento a la derecha no realiza ninguna acción ni produce errores.
- [ ] En la última pestaña (`LLM_IMPORT`), un deslizamiento a la izquierda no realiza ninguna acción ni produce errores.
- [ ] Los desplazamientos predominantemente verticales (|dy| >= |dx| o |dx| < 20px) no son capturados por el `PanResponder`, preservando el scroll vertical nativo y fluido en las listas de eventos, notas y tareas.
- [ ] El `PanResponder` mantiene `onPanResponderTerminationRequest: () => false` para evitar que el gesto sea cancelado a mitad de movimiento por otros componentes.
- [ ] El contenedor `mobile-swipe-container` aplica la regla `touchAction: "pan-y"` en web (`Platform.OS === 'web'`), permitiendo el scroll vertical nativo del navegador mientras se habilita la detección del swipe horizontal en JavaScript.
- [ ] No se agregan nuevas librerías a `package.json` ni a `pyproject.toml`.
- [ ] Se actualiza la suite de tests en `frontend/components/MobileMainLayout.test.tsx` cubriendo la fase de captura, y toda la suite de comprobaciones (`npm run check`) pasa al 100%.

## Out of scope

- Navegación por swipe en la vista de escritorio (`WebMainLayout`).
- Animaciones complejas de transición de pantalla estilo carrusel paginado.

## Constraints

- Archivos a modificar: `frontend/components/MobileMainLayout.tsx`, `frontend/components/MobileMainLayout.test.tsx`.
- Sin dependencias externas adicionales (cumplir regla de `AGENTS.md`).
