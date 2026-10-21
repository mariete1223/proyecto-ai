## QA: PASS

- [x] En `MobileMainLayout`, el `PanResponder` implementa `onMoveShouldSetPanResponderCapture` cuando el desplazamiento es horizontalmente dominante (|dx| >= 20px y |dx| > |dy| * 1.5) para capturar el gesto antes de que el `ScrollView` interno (`mainScrollView`) lo consuma - PASS
- [x] Al deslizar hacia la izquierda con desplazamiento suficiente (dx <= -40px y |dx| > |dy| * 1.5), se avanza a la siguiente pestaña en el orden canónico: `VOICE_CAPTURE` -> `CALENDAR` -> `PENDING_TASKS` -> `EXPLORER` -> `LLM_IMPORT` - PASS
- [x] Al deslizar hacia la derecha con desplazamiento suficiente (dx >= 40px y |dx| > |dy| * 1.5), se retrocede a la pestaña previa en el orden canónico - PASS
- [x] En la primera pestaña (`VOICE_CAPTURE`), un deslizamiento a la derecha no realiza ninguna acción ni produce errores - PASS
- [x] En la última pestaña (`LLM_IMPORT`), un deslizamiento a la izquierda no realiza ninguna acción ni produce errores - PASS
- [x] Los desplazamientos predominantemente verticales (|dy| >= |dx| o |dx| < 20px) no son capturados por el `PanResponder`, preservando el scroll vertical nativo y fluido en las listas de eventos, notas y tareas - PASS
- [x] El `PanResponder` mantiene `onPanResponderTerminationRequest: () => false` para evitar que el gesto sea cancelado a mitad de movimiento por otros componentes - PASS
- [x] El contenedor `mobile-swipe-container` aplica la regla `touchAction: "pan-y"` en web (`Platform.OS === 'web'`), permitiendo el scroll vertical nativo del navegador mientras se habilita la detección del swipe horizontal en JavaScript - PASS
- [x] No se agregan nuevas librerías a `package.json` ni a `pyproject.toml` - PASS
- [x] Se actualiza la suite de tests en `frontend/components/MobileMainLayout.test.tsx` cubriendo la fase de captura, y toda la suite de comprobaciones (`npm run check`) pasa al 100% - PASS

### Verificación de pruebas
- Frontend:
  - Comando: `npm run check` en `frontend/`
  - Resultado: Prettier format check (aprobado), ESLint (aprobado), TypeScript compile check (aprobado), Jest (39 suites pasadas, 318 tests pasados, 0 fallidos).
- Backend:
  - Comando: `uv run --directory backend python scripts/check.py`
  - Resultado: Ruff format (68 archivos), Ruff check (aprobado), Mypy (éxito en 68 archivos), Pytest (131 pasados, 5 omitidos opcionales PG, 0 fallidos).
