## Goal

Al abrir la aplicación con una sesión activa existente y el backend en reposo/arranque en frío (Render free tier suspended), VoxDaily Hub debe inicializar y renderizar de inmediato (< 200ms) la interfaz principal con los datos locales persistidos en SQLite/IndexedDB, ejecutando el sondeo de reactivación del servidor y la sincronización en segundo plano sin congelar al usuario durante 30-50 segundos, y ofreciendo en cualquier pantalla transitoria de espera una vía de escape inmediata con un solo clic («Continuar en modo local») para interactuar con sus notas y tareas sin esperas.

---

## Defect Context & Evidence

- **GitHub Issue**: [#154](https://github.com/mariete1223/proyecto-ai/issues/154)
- **Draft Fingerprint**: `backend-cold-start-blocking-screen-excessive-wait`
- **Observed behaviour**: Al abrir la aplicación con una sesión iniciada cuando el backend de Render está en reposo (spun-down), la aplicación muestra una pantalla de carga a pantalla completa (*"Conectando con tu nube segura... El servidor se está reactivando tras reposo"*) que bloquea totalmente la interfaz durante 30 a 50 segundos. El usuario no puede consultar sus notas, ver su calendario ni añadir tareas, a pesar de que la base de datos local SQLite tiene todos sus datos almacenados.
- **Root Cause**:
  1. En `frontend/App.tsx` (`initApp()`), si `authSession` existe y el dispositivo está online, se invoca síncronamente `await checkBackendHealth(defaultApiConfig)` (con un timeout de hasta 20 segundos por intento según `frontend/services/webApi.ts`) y un bucle de reintentos (`while (!isHealthy && attempts < 2)` con esperas de 3 segundos).
  2. Si la comprobación tarda más de 1200ms, se activa `isColdStarting = true`. La condición de renderizado `if (!isInitialized || isColdStarting)` sustituye la interfaz por `loadingContainer` sin proveer ninguna acción para continuar.
  3. `await loadDatabaseState(true)` no se ejecuta hasta que finaliza el bucle de salud remoto, y dentro de `loadDatabaseState`, se vuelve a intentar un `performSync` síncrono antes de consultar `listCategories`, `listTags`, `listLocalEntries` y `listDatelessTasks`.
  4. Esto viola directamente la **Regla 4 de AGENTS.md (Invariante Offline-First)**: el cliente local debe ser autónomo, funcional e interactivo de inmediato (< 200ms) sin depender de la latencia o disponibilidad del backend.
- **Evidence**: Mensaje del usuario: *"lo del backend cold start tiene al usuario unos 30 segundos parado es demasiado"*. Inspección de `frontend/App.tsx` (líneas 630-680 y 816-833).

---

## Mandatory Edge-Case Analysis (AGENTS.md & _docs/team/pm.md)

1. **Invariante Offline-First y Sincronización Bidireccional de IDs Canónicos:**
   - La lectura inicial de la base de datos local SQLite (`ensureCanonicalCategories`, `deduplicateAndHealEntries`, `listLocalEntries`, `listCategories`, `listDatelessTasks`) debe completarse y poblar el estado de React de inmediato (< 200ms) al arrancar.
   - Cualquier nota, tarea o alerta creada o editada localmente mientras el backend se reactiva en segundo plano debe asignarse deterministamente a las categorías canónicas (`Notas`, `Tareas`, `Alerta`, `Eventos`) usando `resolveCategoryForEntry`.
   - Cuando el backend despierte finalmente, `performSync` debe sincronizar en segundo plano (`sync_push` y `sync_pull`) sin generar duplicados, sin sobrescribir ediciones locales concurrentes y sin recurrir a categorías arbitrarias (`cats[0]`, `"General"`).
2. **Layout Móvil, Viewport y Flexbox (iOS Safari, Android Chrome, PWA):**
   - Si se muestra cualquier pantalla o aviso transitorio de arranque en frío, el contenedor y el botón de escape («Continuar en modo local») deben respetar las normas de Flexbox: prohibido `height: "100%"` / `maxHeight: "100%"` en contenedores con hermanos, uso de `flex: 1, minHeight: 0`, respetando `env(safe-area-inset-bottom)` y asegurando un área de pulsación ergonómica en la zona del pulgar (mínimo 44x44px).
   - Al saltar a `MobileMainLayout`, el área de contenido (`mobile-content-area`) debe conservar su separación limpia de al menos `12px–16px` sobre `bottomTabBar`.
3. **Matriz de Capacidades del Navegador (`granted | denied | default | unsupported`):**
   - El inicio en modo local y el despertar del backend en segundo plano no deben interferir con el servicio de notificaciones ni lanzar excepciones no controladas si `notificationService.setAuth()` o `subscribeToWebPush()` se invocan antes de que el servidor esté listo; deben reintentarse silenciosamente al confirmarse la conectividad online.
4. **Sincronización Reactiva de Estado sin Recarga:**
   - Al despertar el servidor en segundo plano, la transición del chip de estado (de `"Conectando..."` / `"Offline"` a `"Online"`) y la actualización de contadores de entradas/tareas deben ocurrir reactivamente sin parpadeos y sin recargar la página (`window.location.reload` queda terminantemente prohibido).
   - Si el usuario tiene un formulario o modal abierto (`isFormOpenRef.current = true`), la sincronización en segundo plano no debe interferir con su escritura ni cerrar el formulario.

---

## Acceptance criteria

- [ ] Al arrancar la aplicación con una sesión activa (`authSession` existente), la carga de datos locales de SQLite (`listLocalEntries`, `listCategories`, `listDatelessTasks`) y la inicialización de la interfaz (`isInitialized = true`) se completan de inmediato (< 200ms), mostrando `MobileMainLayout` o `WebMainLayout` con las notas, tareas y calendario existentes sin esperar la respuesta del servidor.
- [ ] La comprobación de salud del backend (`checkBackendHealth`) y la reactivación del servidor tras reposo (cold start de Render) se ejecutan de forma asíncrona en segundo plano sin bloquear el hilo principal ni sustituir la interfaz de usuario por una pantalla rígida de 30-50 segundos.
- [ ] Mientras el backend se encuentra en proceso de reactivación/arranque en frío, el usuario puede interactuar plenamente con la aplicación: navegar entre pestañas (Calendario, Tareas, Categorías), abrir notas locales, marcar tareas como completadas y crear nuevas entradas o dictar notas de voz.
- [ ] En caso de que se renderice alguna pantalla o modal transitorio de espera de arranque en frío (`testID="loading-screen"` o aviso de conexión), se incluye un botón visible y accesible con un solo clic («Continuar en modo local» / `testID="btn-bypass-cold-start"`) que al pulsarse desmonta inmediatamente el bloqueo y abre la vista principal con los datos locales.
- [ ] Mientras el backend no responde, la barra superior de estado en `MobileMainLayout` y `WebMainLayout` muestra el indicador de conexión en estado no bloqueante (`"Conectando..."` o `"Offline"` según corresponda) sin alertas intrusivas continuas.
- [ ] Cuando el backend completa su arranque en frío y el sondeo en segundo plano confirma salud (`checkBackendHealth` devuelve `true`), el indicador de conexión cambia automáticamente a `"Online"` y se dispara la sincronización silenciosa (`syncSilentlyInBackground`) sin recargar la página.
- [ ] Si el usuario crea o modifica entradas mientras el backend está en cold start, dichas entidades mantienen la integridad de sus categorías canónicas (`Notas`, `Tareas`, `Alerta`, `Eventos`) y se transmiten limpiamente al servidor vía `sync_push` en cuanto el backend responde, sin duplicados ni huérfanos.
- [ ] Si el usuario tiene un formulario o modal de entrada abierto (`showVoiceCaptureModal`, `showEntryFormModal` o `selectedEntryId` activo), la sincronización en segundo plano al despertar el backend no interrumpe la edición ni sobrescribe el borrador activo.
- [ ] En la pantalla de carga transitoria (si se muestra), el botón de escape cumple con las reglas de Flexbox y thumb-zone: no usa `height: "100%"` en hijos Flex con hermanos, respeta `env(safe-area-inset-bottom)` y posee un objetivo táctil mínimo de 44x44px.
- [ ] Se actualizan y añaden pruebas unitarias y de integración en `frontend/App.test.tsx`:
  - Se verifica que con un backend suspendido (promesa de `checkBackendHealth` pendiente o lenta > 2000ms), la app con sesión activa renderiza la vista principal (`mobile-main-layout`) con datos locales sin quedar atascada en `loading-screen`.
  - Se verifica que si se muestra `loading-screen` con aviso de arranque en frío, el botón de bypass (`btn-bypass-cold-start`) permite pasar de inmediato al layout principal.
  - Se verifica que la reactivación del backend en segundo plano actualiza el estado de conexión a `"Online"` y llama a la sincronización sin errores.

---

## Out of scope

- Cambiar el proveedor de hosting o contratar instancias de pago sin suspensión en Render (este defecto resuelve la resiliencia y el principio offline-first en la arquitectura del cliente).
- Modificar el flujo de autenticación para nuevos registros o usuarios sin ninguna sesión previa persistida que requieran validación remota inicial de credenciales.
- Reestructurar el algoritmo de resolución de conflictos dentro de `frontend/services/syncEngine.ts`.

---

## Constraints

- **Archivos a modificar**:
  - `frontend/App.tsx` (gestión de arranque, carga inmediata de base de datos local y desacoplamiento de comprobaciones de salud del backend).
  - `frontend/services/webApi.ts` (ajuste opcional de timeouts o sondeo en segundo plano si aplica).
  - `frontend/App.test.tsx` (actualización de tests de arranque y adición de casos de regresión para arranque en frío offline-first).
- **Dependencias**: Prohibido añadir nuevas dependencias en `package.json` o `pyproject.toml`.
- **Invariantes arquitectónicas**: Cumplimiento riguroso de la Regla 4 (Offline-First e identidad canónica) y Regla 5 (Flexbox y layout móvil) de `AGENTS.md`.
