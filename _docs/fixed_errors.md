# Registro de Errores Corregidos (fixed_errors)

Este documento registra los fallos críticos diagnosticados y resueltos en el entorno del servidor backend, túnel estático y cliente móvil.

---

## 1. Error de esquema SQLite local: `no such column: users.is_verified`

### Síntoma
- Al intentar iniciar sesión o registrarse desde la aplicación, el cliente recibía un error genérico: `No se pudo conectar con el servidor`.
- En el backend, las peticiones a `/api/v1/auth/login` fallaban con error `500 Internal Server Error` debido a una excepción de SQLAlchemy / SQLite: `sqlite3.OperationalError: no such column: users.is_verified`.

### Causa Raíz
- El Issue #111 introdujo la verificación por correo electrónico de cuentas, añadiendo el campo `is_verified` al modelo `User` en SQLAlchemy y generando una migración Alembic.
- En desarrollo local con SQLite (`backend/app.db`), las migraciones Alembic están diseñadas para PostgreSQL, por lo que las tablas SQLite existentes conservaban el esquema antiguo sin la columna `is_verified`. Al ejecutar consultas `select(User)`, SQLite abortaba por no encontrar la columna.

### Solución Aplicada
1. Se ejecutó la migración manual en `backend/app.db`:
   ```sql
   ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT 1;
   ```
2. Se actualizó la función `_create_sqlite_tables` en `backend/app/main.py` para aplicar automáticamente este `ALTER TABLE` si no existe la columna en cualquier base de datos SQLite de desarrollo.

---

## 2. Proceso Backend Uvicorn desactualizado en memoria (estancado 2 días)

### Síntoma
- A pesar de corregirse archivos en el repositorio, las peticiones continuaban fallando internamente o no reflejaban los cambios recientes.

### Causa Raíz
- El proceso Python de Uvicorn (`PID 61884`) llevaba en ejecución ininterrumpida desde el **19/10/2026 a las 16:58**.
- El mecanismo de recarga automática (`--reload`) en Windows no recargó los nuevos módulos ni el esquema modificado en memoria, manteniendo bloqueos y versiones antiguas de los servicios.

### Solución Aplicada
1. Se forzó la detención de los procesos residuales en el puerto 8000:
   ```powershell
   Stop-Process -Id 23120, 61884 -Force
   ```
2. Se reinició Uvicorn de forma limpia desde el directorio `backend` con el entorno virtual activo.

---

## 3. Fallo de red en cliente web/PWA: `Failed to fetch` por túnel Cloudflare caducado

### Síntoma
- En la web desplegada en Vercel (`https://voxdaily.vercel.app`) y en la PWA anclada en el móvil, cualquier intento de llamada a la API producía inmediatamente:
  `No se pudo conectar con el servidor: Failed to fetch`.

### Causa Raíz
- En `frontend/App.tsx`, la función `getBackendUrl()` comprobaba `process.env.EXPO_PUBLIC_BACKEND_URL`.
- En el despliegue previo en Vercel, dicha variable quedó inyectada con un túnel efímero antiguo (`https://excitement-molecules-galleries-cable.trycloudflare.com`). Al apagarse ese túnel temporal, cualquier llamada desde el navegador fallaba con error de DNS/red (`Failed to fetch`) antes de salir a internet.

### Solución Aplicada
1. Se modificó `frontend/App.tsx` para filtrar explícitamente y **descartar cualquier URL que contenga `trycloudflare.com`**.
2. Se estableció como fallback predeterminado garantizado la URL estática permanente:
   ```typescript
   const ACTIVE_BACKEND_TUNNEL = "https://raging-degraded-reptile.ngrok-free.dev";
   ```
3. Se actualizó el repositorio en `main` para que Vercel regenere el bundle limpio apuntando a la URL estática.

---

## 4. Elementos guardados anteriormente no visibles tras iniciar sesión

### Síntoma
- El usuario reportó: *"he guardado antes cosas y no me aparecen en la app porque?"*.

### Causa Raíz
- Antes de activar el sistema de autenticación, la aplicación operaba en **modo invitado/demo**, guardando las notas y tareas asociadas al usuario demo (`demo@example.com` / `user-demo-123`).
- Las notas existen intactas en la base de datos `backend/app.db` (ej. nota de la carbonara, compra en La Alberca, Cervemur).
- Al iniciar sesión con una cuenta personal (`mariete1223@outlook.es`), la aplicación aísla estrictamente los registros por `user_id`, por lo que las notas demo no se mezclan con las del usuario autenticado.

### Solución
- Se diagnosticó que las notas están a salvo en la base de datos local y se documentó el script para asociarlas/reasignarlas a la cuenta personal del usuario en cuanto lo solicite.

---

## 5. Salto de día en test nocturno de calendario (`CalendarMonthView.test.tsx`)

### Síntoma
- Fallo en `CalendarMonthView.test.tsx`:
  `expect(getByTestId("day-has-reminder-2026-10-21")).toBeTruthy()` fallaba al ejecutarse entre las 22:00 y las 23:59 porque el test calculaba `today.getTime() + 2 * 3600 * 1000`, lo que desplazaba la fecha al día 22.

### Solución Aplicada
- En `frontend/components/CalendarMonthView.test.tsx`, se fijó el recordatorio sumando 5 minutos sobre la hora actual y limitando al día actual (máx. 23:59), garantizando que el test sea determinista a cualquier hora del día.
