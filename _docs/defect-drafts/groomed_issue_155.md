## Goal

Garantizar que las alertas y recordatorios suenen y se notifiquen de forma infalible en el cliente incluso cuando el backend en Render se encuentre suspendido por inactividad: eliminando la supresión local especulativa basada en `canRelyOnRemotePush()`, disparando la alarma local siempre que no conste confirmación fehaciente de entrega remota (`PUSH_DELIVERED`) dentro de la ventana de vigencia de 2 horas, y asegurando la activación y programación automática e incondicional de los recordatorios en toda entrada de la categoría canónica «Alerta».

## Acceptance criteria

### 1. Eliminación de Supresión Especulativa de Alertas Locales (`frontend/services/notificationService.ts`)
- [ ] En el callback diferido del temporizador local (`elapsedLateMs > 5000`), se elimina la condición que suprime la alarma al evaluar `hasRemotePush = this.canRelyOnRemotePush()`.
- [ ] La alarma local solo se descarta si la entrega del Web Push fue efectivamente confirmada por el Service Worker y registrada en `notifiedEntryIds` (verificando `reminderKey`, `entry.id` o `entryTag`).
- [ ] Si no consta entrega remota previa en `notifiedEntryIds` y el retraso de ejecución está dentro de la ventana de vigencia de 2 horas (`elapsedLateMs <= 2 * 60 * 60 * 1000`), el temporizador reproduce inmediatamente el sonido de timbre (`playChimeSound()`), muestra la notificación (`sendNotification()`) y registra las claves en `notifiedEntryIds` y `localStorage`.
- [ ] Si el temporizador despierta con un retraso mayor a 2 horas (`elapsedLateMs > 2 * 60 * 60 * 1000`), la alarma se descarta por obsoleta sin emitir sonido ni notificación visual, pero avanza al siguiente ciclo si tiene recurrencia (`scheduleNextRecurrence`).

### 2. Disparo de Alertas Vencidas Recientes en Arranque o Sincronización (`scheduleForEntry`)
- [ ] Al invocar `scheduleForEntry()` (durante `syncAllReminders()`, creación o actualización de entradas), si la hora programada ya transcurrió en el pasado reciente (`diffMs <= 0` y `Math.abs(diffMs) <= 2 * 60 * 60 * 1000`) y NO existe registro previo en `notifiedEntryIds`:
  - [ ] Se dispara de inmediato la notificación y el sonido local (`sendNotification(..., true)`).
  - [ ] Se añaden `reminderKey` y `entryTag` a `notifiedEntryIds` y se persisten en `localStorage`.
  - [ ] Si la entrada tiene recurrencia (`reminder_recurrence !== 'NONE'`), se calcula y programa el siguiente ciclo futuro.
- [ ] Si la hora programada venció hace más de 2 horas (`Math.abs(diffMs) > 2 * 60 * 60 * 1000`), se descarta sin sonar ni notificar, reprogramando únicamente la siguiente recurrencia si aplica.

### 3. Programación Incondicional e Infalible para la Categoría Canónica «Alerta»
- [ ] En `notificationService.scheduleForEntry(entry)`:
  - [ ] Si la entrada pertenece a la categoría canónica «Alerta» (`entry.category_id === CANONICAL_CATEGORIES.ALERTA.id` o `category_id === 'cat-alerta'`), el servicio fuerza `entry.reminder_enabled = true` y utiliza `entry.reminder_time || entry.occurred_at || new Date().toISOString()` para calcular la fecha objetivo con antelación cero (`offsets = [0]`).
  - [ ] La alarma de una entrada «Alerta» nunca se omite silenciosamente por tener `reminder_enabled: false` o campos de recordatorio nulos.
- [ ] En `frontend/db/entries.ts` (`createLocalEntry` y `updateLocalEntry`):
  - [ ] Toda entrada creada o actualizada bajo la categoría canónica «Alerta» persiste de forma estricta `reminder_enabled = true`, `reminder_offset_minutes = 0`, `reminder_offsets_minutes = [0]`, `task_status = null`, `task_recurrence = null` y `task_priority = null`.
- [ ] En `notificationService.syncAllReminders()`:
  - [ ] Al iterar sobre las entradas locales, cualquier entrada con categoría «Alerta» es programada en `scheduleForEntry()` independientemente del valor inicial de su flag `reminder_enabled`.

### 4. Matriz de Capacidades Multi-Plataforma (`granted | denied | default | unsupported`)
- [ ] Para el estado `"granted"`:
  - [ ] La notificación se muestra mediante `swRegistration.showNotification()` (o `new Notification` como fallback) y el timbre de audio (`playChimeSound`) suena nítidamente a través de la Web Audio API.
- [ ] Para el estado `"denied"`:
  - [ ] El timbre sonoro (`playChimeSound`) se ejecuta igualmente al llegar la hora de la alarma para alertar acústicamente al usuario.
  - [ ] Si el usuario accede a la pantalla o interactúa con permisos denegados, la interfaz presenta instrucciones explícitas para **iPhone/iPad (Safari)** (*"Ajustes de iOS > Safari > Notificaciones"*) y **Android (Chrome)** (*"Ajustes del sitio > Notificaciones > Permitir"*), incluyendo un botón o acción explícita para descartar/cerrar el aviso.
- [ ] Para el estado `"default"`:
  - [ ] La aplicación solicita el permiso oportunamente mediante `requestPermissions()` en los puntos de entrada previstos (`StartupPermissionsPrompt`, creación de alertas).
- [ ] Para el estado `"unsupported"` (ej. pestaña Safari iOS fuera de PWA Standalone):
  - [ ] El timbre sonoro sintetizado por Web Audio API se reproduce sin lanzar excepciones ni fallar en silencio.
  - [ ] No se producen llamadas rotas a APIs no disponibles de Service Worker o Notification.

### 5. Invariante de Identidad Canónica y Sincronización Bidireccional
- [ ] En los flujos de `sync_push` y `sync_pull` (`frontend/services/syncEngine.ts` y `backend/app/services/sync_service.py`):
  - [ ] Las entradas de categoría «Alerta» preservan su identidad canónica (`CANONICAL_CATEGORIES.ALERTA.id` = `cat-alerta` en cliente, UUID canónico en backend) sin mutar a `Notas`, `Tareas` ni caer jamás en fallbacks ciegos (`cats[0]` o `"General"`).
  - [ ] Los atributos de alarma (`reminder_enabled: true`, `reminder_time`, `reminder_offset_minutes: 0`) se conservan idénticos tras la sincronización bidireccional cliente-servidor.

### 6. Invariantes de Layout Móvil y Flexbox
- [ ] Si se renderizan avisos de permisos, banners de alerta o modales asociados:
  - [ ] Queda estrictamente prohibido el uso de `height: "100%"` o `maxHeight: "100%"` en contenedores `flex: 1` con hermanos de cabecera o barra inferior.
  - [ ] Los contenedores con scroll declaran `minHeight: 0` y `overflow: "hidden"` (o `overflowY: "auto"`).
  - [ ] Se garantiza un margen visual de al menos 12px–16px por encima de `bottomTabBar` respetando `env(safe-area-inset-bottom)`.

### 7. Pruebas Automatizadas y Verificación de CI
- [ ] Se añaden pruebas unitarias en `frontend/services/notificationService.test.ts` que verifiquen:
  - [ ] Un temporizador que despierta con retraso (`elapsedLateMs = 15000`) y con `canRelyOnRemotePush() === true` (simulando backend de Render suspendido) ejecuta `sendNotification` y `playChimeSound` si no está en `notifiedEntryIds`.
  - [ ] Un temporizador diferido NO dispara notificación si `PUSH_DELIVERED` ya había registrado el tag/id en `notifiedEntryIds`.
  - [ ] Una entrada con alarma vencida hace menos de 2 horas se dispara inmediatamente al llamar a `scheduleForEntry()`.
  - [ ] Una entrada con alarma vencida hace más de 2 horas no se dispara (se considera obsoleta).
  - [ ] Una entrada perteneciente a la categoría «Alerta» se programa con éxito aunque su flag `reminder_enabled` llegue en `false` o indefinido.
- [ ] La suite de pruebas de frontend (`npm --prefix frontend run check`) pasa al 100% sin advertencias ni errores de formato, linter, tipos o tests.
- [ ] La suite de verificación de backend (`uv run --directory backend python scripts/check.py`) pasa al 100%.

## Out of scope

- Mantener levantado el contenedor backend en el Free Tier de Render 24/7 mediante pings externos periódicos (ej. UptimeRobot / cron-job.org) o migración a planes de pago con workers continuos (trasladado a evaluación de infraestructura en Issue #156).
- Implementación de notificaciones push nativas fuera de PWA/Web (vía APNs / Firebase FCM con bridge nativo de React Native).

## Constraints

- Modificaciones acotadas principalmente a `frontend/services/notificationService.ts`, `frontend/db/entries.ts` y sus correspondientes archivos de test (`frontend/services/notificationService.test.ts`, `frontend/db/entries.test.ts`).
- Cumplimiento riguroso de las reglas de `AGENTS.md`: prohibido el uso de parches provisionales o fallbacks arbitrarios.
- No añadir dependencias en `package.json` ni `pyproject.toml`.
- Preservar completamente el funcionamiento offline-first de la aplicación.
