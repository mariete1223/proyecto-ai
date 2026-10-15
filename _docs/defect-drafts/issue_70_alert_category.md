## Goal
Incluir una categoría inicial predeterminada (canónica) llamada "Alerta" (con comando de voz "alerta"), orientada a tareas o acciones que requieran que al llegar la fecha/hora establecida se envíe una notificación automática para realizar dicha tarea o actividad.

## Acceptance criteria (Initial)
- [ ] La categoría canónica "Alerta" (voice_command: "alerta", kind: "TASK") se crea automáticamente para nuevos usuarios y se añade a las categorías canónicas existentes (Notas, Tareas, Eventos, Proyectos).
- [ ] Sincronización y persistencia:
  - En frontend (`frontend/db/categories.ts`), registrar en `CANONICAL_CATEGORIES` con id fijo, color distintivo (ej. Rojo/Ámbar) e icono representativo (campana/alerta).
  - En backend (`backend/app/services/category_service.py`), incluirla en `INITIAL_CATEGORIES`.
- [ ] Comportamiento: Cuando se captura o crea un elemento bajo la categoría "Alerta" con una fecha/hora asignada, el recordatorio (`reminder_enabled`) se inicializa automáticamente activado a la hora establecida si el usuario no especificó lo contrario.
- [ ] Comandos de voz: Reconocer "alerta <contenido>" en el parser de voz (`voiceParser.ts`) mapeando a la categoría Alerta.
- [ ] Pruebas unitarias en frontend y backend validando la creación canónica, el comando de voz y la activación del aviso automático.

## Out of scope
- Modificación de tombstones de categorías previamente eliminadas por el usuario.
