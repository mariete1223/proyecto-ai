## Goal

Permitir la edición y actualización de entradas guardadas (notas, tareas, eventos) mediante comandos de voz desde la vista de detalle y edición, permitiendo cambiar la hora, definir/modificar el título y activar o ajustar avisos/recordatorios mediante dictado por voz, incorporando además un aviso/guía visual que indique claramente al usuario cómo formular dichos comandos.

## Acceptance criteria

- [ ] Parser de comandos de edición por voz (`parseVoiceEditCommand`):
  - **Cambio de hora/fecha**: Detecta expresiones como *"cambiar la hora a las 18:30"*, *"poner a las 5 de la tarde"*, *"cambiar fecha a mañana a las 10:00"*, *"mover a las 19:00"*.
  - **Definición o cambio de título**: Detecta expresiones como *"poner título Comprar víveres"*, *"cambiar título a Reunión con cliente"*, *"título: Proyecto AI"*.
  - **Configuración de avisos**: Detecta expresiones como *"poner aviso 15 minutos antes"*, *"poner aviso 1 hora antes"*, *"activar aviso a la hora exacta"*, *"poner recordatorio a las 17:00"*.
- [ ] En `EntryDetailView.tsx`:
  - Botón interactivo de micrófono para dictar comando de edición (`testID="btn-voice-edit-entry"`).
  - Tarjeta o panel informativo de ayuda ("💡 Cómo editar con tu voz", `testID="voice-edit-guide-card"`) que detalla con ejemplos prácticos cómo cambiar la hora, el título y los avisos con la voz.
- [ ] Aplicación y persistencia de cambios:
  - Al dictar un comando de edición, se aplican los campos detectados sobre la entrada actual en base de datos local (`updateLocalEntry`).
  - Si se modificó o activó un aviso, se actualiza el timer en `notificationService.scheduleForEntry`.
  - Se muestra una confirmación / toast visual claro informando de los campos actualizados.
- [ ] Pruebas unitarias completas:
  - Pruebas del parser de comandos de voz de edición (`voiceParser.test.ts` / `voiceEditParser.test.ts`).
  - Pruebas del componente `EntryDetailView.test.tsx` verificando el banner de ayuda, el botón de dictado de edición y la actualización de los campos.

## Out of scope

- Onboarding inicial (#66 - completado).
- Avisos periódicos cada X horas (#67 - completado).

## Constraints

- La funcionalidad no debe interferir con la creación de nuevas entradas mediante dictado libre.
- No alterar campos no mencionados en el comando de edición.
- No agregar nuevas dependencias en `package.json` ni en `pyproject.toml`.
