## Goal

Permitir la navegación fluida entre pestañas en la versión móvil (`MobileMainLayout`) mediante gestos táctiles de deslizamiento horizontal (swipe), sin interferir con el scroll vertical de las listas ni con controles interactivos internos.

## Acceptance criteria

- [x] Un deslizamiento horizontal hacia la izquierda (swipe left) con deltaX negativo (|dx| >= 50px y |dx| > |dy| * 1.5) avanza a la siguiente pestaña en el orden canónico: `VOICE_CAPTURE` -> `CALENDAR` -> `PENDING_TASKS` -> `EXPLORER` -> `LLM_IMPORT`.
- [x] Un deslizamiento horizontal hacia la derecha (swipe right) con deltaX positivo (dx >= 50px y |dx| > |dy| * 1.5) retrocede a la pestaña previa en el orden canónico.
- [x] En la primera pestaña (`VOICE_CAPTURE`), un deslizamiento a la derecha no realiza ninguna acción ni produce errores.
- [x] En la última pestaña (`LLM_IMPORT`), un deslizamiento a la izquierda no realiza ninguna acción ni produce errores.
- [x] Los desplazamientos predominantemente verticales (|dy| >= |dx| o |dx| < 50px) no activan el cambio de pestaña para no entorpecer el scroll de eventos, tareas o notas.
- [x] Se implementa usando exclusivamente `PanResponder` nativo de React Native, sin añadir nuevas dependencias npm.
- [x] Pasan todos los tests unitarios existentes de `MobileMainLayout` y se añade cobertura de tests para los gestos de deslizamiento lateral.

## Out of scope

- Animaciones complejas de carrusel 3D o páginas paginadas swipeables completas fuera de `MobileMainLayout`.
- Gestos de swipe en la versión de escritorio (`WebMainLayout`).

## Constraints

- Archivos a modificar: `frontend/components/MobileMainLayout.tsx`, `frontend/components/MobileMainLayout.test.tsx`.
- Dependencias: Sin librerías nuevas (regla de `AGENTS.md` y `pyproject.toml` / `package.json`).
- Compatible tanto en navegadores móviles (iOS Safari / Web touch) como en React Native móvil.
