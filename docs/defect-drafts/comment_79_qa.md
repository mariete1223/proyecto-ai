## QA: PASS

- [x] **Validación de comando detectado antes de guardar** - PASS
  - En Paso 2 (Revisión), ante comandos no reconocidos o sin categoría (ej. "Hola", "desconocido..."), `btn-quick-save-tokens` y `btn-save-corrected-entry` se renderizan con `disabled={true}` y estilo visual `buttonDisabled`.
  - Al dictar un comando válido con categoría (ej. "nota fecha hoy contenido comprar leche", "tarea prioridad baja ordenar estantería"), ambos botones de guardado quedan habilitados.
- [x] **Botón directo de repetir dictado** - PASS
  - La fila superior de acciones rápidas (`quickSaveTokensRow`) incorpora `btn-quick-rerecord` con etiqueta visible "🎙️ Repetir Dictado" y disposición prominente a ancho completo (`flexBasis: "100%"`).
  - Al pulsar `btn-quick-rerecord`, el flujo regresa de inmediato al Paso 1 (Dictado) con la transcripción vacía y el estado reiniciado.
- [x] **Diseño responsivo de los botones de acción rápida** - PASS
  - `styles.quickSaveTokensRow` implementa `flexWrap: "wrap"` y `gap: 10`.
  - `styles.quickSaveBtn` cuenta con base flexible de 140px (`minWidth: 140`) y se removió la propiedad `numberOfLines={1}` del texto, eliminando el corte "💾 Guardar Ent..." en pantallas estrechas.
- [x] **Pruebas y calidad** - PASS
  - Tests de regresión añadidos y actualizados en `VoiceCaptureFlow.test.tsx` cubriendo el bloqueo de guardado sin comando, la habilitación tras corrección manual y la repetición directa de dictado.
  - Tests ejecutados:
    - Frontend: `npm run check` (Prettier, ESLint, TypeScript `tsc --noEmit`, Jest: 37 suites pasadas, 250 tests pasados, 0 fallidos).
    - Backend: `..\backend\.venv\Scripts\python.exe -m pytest` (116 tests pasados, 0 fallidos).
