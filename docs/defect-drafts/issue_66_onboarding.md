## Goal
Mostrar una experiencia de bienvenida y onboarding interactiva cuando un nuevo usuario se registra o abre la aplicación por primera vez, guiándolo a través de las funcionalidades clave (captura por voz, calendario interactivo, gestión de tareas pendientes y avisos/notificaciones push).

## Acceptance criteria (Initial)
- [ ] Mostrar un modal o carrusel de onboarding amigable y con estética premium tras registrar un nuevo usuario o si no se ha completado el tutorial.
- [ ] El carrusel incluye pantallas explicativas con iconos/ilustraciones sobre:
  1. Captura por voz rápida y comandos naturales.
  2. Calendario mensual y vistas de detalle.
  3. Gestión de tareas, prioridades y completado.
  4. Avisos y notificaciones en navegador y segundo plano.
- [ ] El usuario puede avanzar, retroceder, omitir ("Saltar") o finalizar ("¡Empezar!").
- [ ] La finalización u omisión del onboarding se persiste en almacenamiento local (`AsyncStorage` / `localStorage`) para no volver a mostrarse involuntariamente en sesiones posteriores del mismo usuario.
- [ ] Posibilidad de reabrir el tutorial de bienvenida en cualquier momento desde un botón de ayuda/información en el encabezado o perfil.

## Out of scope
- Edición por voz de entradas guardadas (se abordará en #68).
- Avisos flexibles cada X horas (se abordará en #67).

## Constraints
- Estética moderna, glassmorphism, coherente con el sistema de diseño existente.
- Totalmente responsive en pantallas móviles (360px+) y escritorio.
