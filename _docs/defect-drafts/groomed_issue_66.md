## Goal
Implementar una experiencia de Onboarding y Bienvenida interactiva (`OnboardingModal`) con diseño visual premium, que guíe paso a paso a nuevos usuarios al registrarse o abrir la aplicación por primera vez, permitiendo también reabrir el tutorial en cualquier momento desde un botón de ayuda/guía.

## Acceptance criteria
- [ ] Se crea el componente `frontend/components/OnboardingModal.tsx` con soporte para navegación entre pasos, indicadores de progreso visual (puntos de paginación), botón "Anterior", botón "Siguiente", botón "Saltar" y botón final "¡Comenzar!".
- [ ] El carrusel incluye exactamente 4 pasos explicativos con iconos ilustrativos, títulos claros y consejos de uso:
  1. **Voz rápida y lenguaje natural**: Cómo dictar comandos (ej: *"tarea comprar leche"*, *"nota ideas de diseño"*).
  2. **Calendario mensual dinámico**: Navegación por fechas, visualización de eventos y tareas asignadas al día de hoy.
  3. **Tareas y prioridades**: Gestión de pendientes, niveles de prioridad (Alta, Media, Baja) y checklist con un solo toque.
  4. **Avisos y Web Push**: Programación de recordatorios con antelación calculada y notificaciones push en segundo plano.
- [ ] Persistencia por usuario: Se guarda en almacenamiento local (`onboarding_completed_${userId}`) cuando el usuario completa o salta el tutorial para no interrumpirlo en aperturas posteriores.
- [ ] Apertura automática: En `frontend/App.tsx`, al iniciar sesión o registrar un usuario, si no existe el registro de onboarding completado para ese usuario, se muestra automáticamente el modal.
- [ ] Botón de apertura manual: En la barra superior o navegación (`WebMainLayout.tsx` y `MobileMainLayout.tsx`), se añade un botón con `testID="btn-open-onboarding"` y texto/icono "Guía" para que cualquier usuario pueda reabrir el modal explicativo en cualquier momento.
- [ ] Cobertura de pruebas unitarias: `frontend/components/OnboardingModal.test.tsx` prueba el renderizado de los 4 pasos, la navegación entre ellos, el salto/cierre y la persistencia del estado completado.
- [ ] Toda la suite de frontend (191+ tests) y backend pasa al 100%.

## Out of scope
- Configuración de avisos por horas recurrentes (#67).
- Edición de entradas guardadas por voz (#68).

## Constraints
- Estética Glassmorphism moderna (fondos oscuros translúcidos, tipografía limpia, acentos cian/azul `#38BDF8`).
- Responsive para móvil y escritorio.
- Sin nuevas dependencias externas en `package.json`.
