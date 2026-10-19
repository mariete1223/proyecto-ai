# Groomed Task: Issue #85 - Redundancia en cabecera de dictado, verbosidad en transcripción y hueco bajo barra inferior en móviles

## Goal

Simplificar la interfaz de captura por voz eliminando encabezados redundantes y textos verbosos en la transcripción en directo, y anclar la barra de navegación inferior (`bottomTabBar`) al borde inferior de la pantalla en dispositivos móviles y PWAs para eliminar el hueco inferior visible.

## Acceptance criteria

- [ ] **Limpieza de cabecera en modal de dictado**:
  - En la cabecera del modal de captura por voz (`MobileHomeVoiceView.tsx` / `VoiceCaptureFlow.tsx`), se elimina el texto `"Captura Hablada por Voz"`.
  - Se elimina el botón redundante `"✕ Salir"`, manteniendo únicamente el botón `"✕ Cerrar"` en la cabecera superior del modal.
  - La cabecera muestra limpiamente el indicador de paso (`Paso 1 de 2: Dictado` / `Paso 2 de 2: Revisión`) sin saturación ni duplicidad de botones de cierre.
- [ ] **Reducción de verbosidad y visualización en tiempo real**:
  - En `VoiceCaptureFlow.tsx`, se elimina el encabezado estático `"🗣️ Lo que estás diciendo:"`.
  - Se elimina el placeholder explicativo verboso `"🎙️ Escuchando... Di tu comando (ej: 'tarea fecha hoy contenido comprar pan')"`.
  - Cuando se está grabando, la caja de dictado muestra directamente el texto dictado en tiempo real con un indicador sutil (`🔴 EN DIRECTO`). Si aún no hay texto, se muestra un indicador visual limpio y conciso.
  - Cuando el texto dictado contiene entidades reconocidas por `parseVoiceCommand` (categoría, fecha, hora), se muestran insignias/chips sutiles en tiempo real debajo de la transcripción para reflejar los datos detectados.
- [ ] **Anclaje inferior de la barra de navegación en móviles**:
  - En `MobileMainLayout.tsx`, la barra de navegación inferior (`bottomTabBar`) se fija firmemente a la base inferior de la pantalla (`bottom: 0` con `position: "fixed"` en web y `paddingBottom` que absorbe el área segura de iOS), eliminando el hueco oscuro inferior de más de 50px observado en iPhone.
  - El contenedor principal de `MobileMainLayout` y los estilos de `index.html` garantizan cobertura completa de la altura dinámica del viewport (`100dvh` / `-webkit-fill-available`) para evitar cortes por encima de la barra de inicio.
- [ ] **Tests y Calidad**:
  - `npm --prefix frontend run check` pasa al 100% (Prettier, ESLint sin advertencias, TypeScript sin errores, Jest pasando con suites actualizadas).
  - Backend `pytest` pasa al 100%.

## Out of scope

- Modificaciones a la lógica de guardado en el Paso 2 (Revisión/Resultado).
- Rediseño de la vista de escritorio `WebMainLayout.tsx`.

## Constraints

- Modificaciones acotadas a `frontend/components/MobileHomeVoiceView.tsx`, `frontend/components/VoiceCaptureFlow.tsx`, `frontend/components/MobileMainLayout.tsx`, `frontend/public/index.html` y tests asociados.
- No alterar esquemas de base de datos ni modelos de dominio.
