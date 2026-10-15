# Contrato del Protocolo de Sincronización (v0.1)

## 1. Visión general y objetivos

El protocolo de sincronización entre el cliente local (**SQLite** en Expo/React Native) y la persistencia central (**PostgreSQL** gestionado vía **FastAPI**) está diseñado bajo una arquitectura **offline-first**.

### Objetivos clave:
1. **Garantía contra la pérdida silenciosa de datos**: Ninguna modificación local ni remota se sobrescribe silenciosamente si existe divergencia.
2. **Versionado explícito y optimista**: Cada registro sincronizable cuenta con una versión numérica (`version >= 1`) que se incrementa monótonamente en cada actualización.
3. **Idempotencia en envíos y reintentos**: Enviar el mismo cambio repetidamente (debido a fallos de red) produce el mismo estado en el servidor sin duplicar registros.
4. **Sincronización bidireccional incremental por cursor**: El cliente descarga únicamente las modificaciones y tombstones ocurridos después de su cursor conocido.

---

## 2. Identificadores, entidades y marcas temporales

### Identificadores
- Todos los identificadores principales (`id`, `user_id`, `category_id`, `tag_id`, `entry_id`, `capture_session_id`) utilizan **UUID v4** en formato canónico de cadena de 36 caracteres (`8-4-4-4-12`).

### Entidades sincronizables
- `CATEGORY`: Categorías del usuario.
- `TAG`: Etiquetas de usuario.
- `ENTRY`: Entradas/notas/tareas guardadas.
- `ENTRY_TAG`: Relaciones muchos a muchos entre entradas y etiquetas.
- `SAVE_PREFERENCE`: Preferencia de guardado del usuario (`FAST_FORWARD` o `PREVIEW_BEFORE_SAVE`).
- `CAPTURE_CORRECTION`: Correcciones registradas durante sesiones de captura hablada o asistida.

### Marcas temporales y formatos
- Todas las marcas temporales (`created_at`, `updated_at`, `deleted_at`) deben formatearse en UTC estricto con estándar **ISO 8601** (`YYYY-MM-DDTHH:MM:SS.uuuuuuZ`).

---

## 3. Versionado y tombstones de eliminación

### Control de versiones
1. Al crear una entidad localmente o en el servidor, su `version` inicial es `1`.
2. Cada modificación válida incrementa la versión en 1 (`version_nueva = version_actual + 1`).
3. La marca temporal `updated_at` se actualiza al instante UTC en que se aplica la modificación.

### Eliminación permanente y tombstones (`deletion_tombstones`)
Cuando una entidad se elimina de forma permanente, la fila principal se borra de la tabla original y se inserta un registro en la tabla `deletion_tombstones`:
- `id`: UUID v4 del tombstone.
- `user_id`: UUID del usuario.
- `entity_type`: Nombre de la entidad (`CATEGORY`, `TAG`, `ENTRY`, `ENTRY_TAG`, `SAVE_PREFERENCE`, `CAPTURE_CORRECTION`).
- `entity_id`: UUID del registro eliminado.
- `deleted_at`: Marca temporal de la eliminación.
- `deleted_version`: Versión incrementada con la que se registró el borrado (`deleted_version = version_actual + 1`).

---

## 4. Estructura de peticiones y respuestas

### 4.1 Envío de cambios del cliente al servidor (`POST /api/v1/sync/push`)

#### Petición (`POST /api/v1/sync/push`)
```json
{
  "client_changes": [
    {
      "change_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      "entity_type": "ENTRY",
      "entity_id": "11111111-2222-3333-4444-555555555555",
      "action": "CREATE",
      "base_version": 0,
      "payload": {
        "id": "11111111-2222-3333-4444-555555555555",
        "category_id": "99999999-8888-7777-6666-555555555555",
        "occurred_at": null,
        "content": "Comprar leche y pan",
        "task_status": "PENDING",
        "task_recurrence": "ONCE",
        "created_at": "2026-09-26T13:00:00.000000Z",
        "updated_at": "2026-09-26T13:00:00.000000Z",
        "version": 1
      }
    }
  ]
}
```

#### Respuesta de la API (`200 OK`)
```json
{
  "results": [
    {
      "change_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      "entity_type": "ENTRY",
      "entity_id": "11111111-2222-3333-4444-555555555555",
      "status": "APPLIED",
      "applied_version": 1,
      "server_entity": null,
      "error_message": null
    }
  ]
}
```

---

### 4.2 Estados de resultado en el Push (`PushResultStatus`)

- `APPLIED`: El cambio se aplicó correctamente en el servidor. El cliente actualiza su versión local con `applied_version`.
- `ALREADY_APPLIED`: El cambio ya había sido aplicado en un reintento anterior. Transición idempotente exitosa.
- `CONFLICT`: Se detectó divergencia. La versión base del cliente (`base_version`) es menor que la versión actual del servidor. El servidor devuelve `server_entity` con la versión remota. El cliente debe resolver el conflicto o mostrar la discrepancia al usuario.
- `REJECTED`: El cambio es inválido (error de validación, categoría no encontrada, o violación de integridad). Contiene `error_message`.

---

### 4.3 Descarga de cambios del servidor al cliente (`GET /api/v1/sync/pull`)

#### Parámetros de consulta
- `cursor`: Cadena ISO 8601 opcional (e.g. `2026-09-26T12:00:00.000000Z`). Si se omite, devuelve todos los cambios disponibles.
- `limit`: Número entero entre 1 y 100 (por defecto 50).

#### Respuesta de la API (`200 OK`)
```json
{
  "changes": [
    {
      "entity_type": "ENTRY",
      "entity_id": "11111111-2222-3333-4444-555555555555",
      "action": "UPDATE",
      "payload": {
        "id": "11111111-2222-3333-4444-555555555555",
        "category_id": "99999999-8888-7777-6666-555555555555",
        "occurred_at": null,
        "content": "Comprar leche, pan y huevos",
        "task_status": "IN_PROGRESS",
        "task_recurrence": "ONCE",
        "created_at": "2026-09-26T13:00:00.000000Z",
        "updated_at": "2026-09-26T13:30:00.000000Z",
        "version": 2
      }
    }
  ],
  "tombstones": [
    {
      "entity_type": "TAG",
      "entity_id": "77777777-7777-7777-7777-777777777777",
      "deleted_at": "2026-09-26T13:25:00.000000Z",
      "deleted_version": 2
    }
  ],
  "next_cursor": "2026-09-26T13:30:00.000000Z",
  "has_more": false
}
```

---

## 5. Ejemplos completos de escenarios

### 5.1 Creación de entrada desde el cliente (Push)
1. **Cliente offline** crea una entrada `E1` con `version: 1`, `base_version: 0`.
2. **Petición**: `POST /api/v1/sync/push` con `action: "CREATE"`, `base_version: 0`.
3. **Servidor**: Inserta en la tabla `entries` de PostgreSQL.
4. **Respuesta**: Status `APPLIED`, `applied_version: 1`.

### 5.2 Actualización normal (Push)
1. **Cliente** modifica `E1` localmente: `content = "Nuevo contenido"`, `base_version: 1`.
2. **Petición**: `POST /api/v1/sync/push` con `action: "UPDATE"`, `base_version: 1`.
3. **Servidor**: Verifica que la versión actual de `E1` en la BD es `1`. Actualiza registro, incrementa versión a `2`.
4. **Respuesta**: Status `APPLIED`, `applied_version: 2`.

### 5.3 Reintento idempotente tras caída de red
1. **Cliente** envía `UPDATE` de `E1` con `base_version: 1` a `2`.
2. **Servidor** aplica la actualización a `version: 2` y responde `200 OK`, pero la conexión cae antes de que el cliente reciba la respuesta.
3. **Cliente** reintenta la misma petición con `base_version: 1`.
4. **Servidor** detecta que el registro ya tiene `version: 2` y que el payload coincide con la versión actual del servidor.
5. **Respuesta**: Status `ALREADY_APPLIED`, `applied_version: 2`.

### 5.4 Detección de conflicto divergente
1. **Servidor** tiene `E1` con `version: 3` (editado desde la interfaz web).
2. **Cliente offline** editó `E1` cuando tenía `version: 2`, preparando un push con `base_version: 2`.
3. **Cliente envía**: `POST /api/v1/sync/push` con `base_version: 2`.
4. **Servidor** detecta `base_version (2) < current_server_version (3)`.
5. **Servidor no sobrescribe**. Responde con:
   ```json
   {
     "status": "CONFLICT",
     "applied_version": null,
     "server_entity": {
       "id": "11111111-2222-3333-4444-555555555555",
       "content": "Contenido editado desde la Web",
       "version": 3
     }
   }
   ```
6. **Cliente** conserva la variante local y almacena la información de conflicto para resolución manual por el usuario.
