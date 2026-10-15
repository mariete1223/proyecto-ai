## Goal
Permitir la edición de elementos existentes mediante comandos de voz inteligentes, permitiendo al usuario cambiar la hora, el título o configurar un aviso en una entrada activa o identificada mediante dictado por voz.

## Acceptance criteria (Initial)
- [ ] En la vista de detalle de entrada o en la captura rápida, reconocer comandos de edición por voz como:
  - *"cambiar la hora a las 18:00"* / *"poner a las 5 de la tarde"*
  - *"poner título <texto>"* / *"cambiar título a <texto>"*
  - *"poner aviso 15 minutos antes"* / *"activar recordatorio a la hora"*
- [ ] El parser de voz o procesador interpreta la intención de actualización sobre la entrada en foco o seleccionada.
- [ ] La entrada se actualiza inmediatamente en base de datos local y se refleja en la UI.
- [ ] Pruebas unitarias que verifiquen el parsing y la aplicación de los cambios sobre una entrada existente.

## Out of scope
- Onboarding inicial (#66).
- Avisos flexibles cada X horas (#67).
