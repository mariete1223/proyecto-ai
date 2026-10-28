# Refactor: Breakpoint adaptativo basado en viewport sin user-agent sniffing

## Contexto y Problema
En `frontend/App.tsx`, la selección entre el layout móvil (`MobileMainLayout`) y de escritorio (`WebMainLayout`) utilizaba una comprobación de user-agent (`/Mobi|Android|iPhone|iPad|iPod/i`), forzando a tablets y iPads con pantallas grandes (1024px-1366px) a usar la vista comprimida de teléfono móvil.

## Solución Propuesta (Buenas Prácticas W3C / Responsive Web Design)
1. En entornos web, gobernar el cambio de layout exclusivamente por el breakpoint de viewport (`width < 768`).
2. Permitir que tablets, iPads y pantallas intermedias disfruten del layout enriquecido con paneles y calendario mensual completo.
3. Mantener `Platform.OS !== "web"` para entornos nativos (iOS/Android).

## Criterios de Aceptación
- Comportamiento responsive fluido y sin dependencias frágiles de user-agent en web.
- 100% suites de test en verde en frontend y backend.
