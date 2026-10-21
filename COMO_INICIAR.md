# Guía de Arranque del Sistema (VoxDaily)

Esta guía explica cómo arrancar y verificar el entorno completo para que el backend local, el túnel estático permanente y la aplicación móvil (PWA o navegador) funcionen siempre sincronizados sin errores.

---

## 1. Arquitectura de Conexión

```
┌──────────────────────────────────────────────┐
│        ESTE ORDENADOR (Servidor Local)       │
│                                              │
│  FastAPI Backend (puerto 8000)               │
│         ▲                                    │
│         │ (redirección interna)              │
│  Túnel Ngrok Permanente                      │
│  https://raging-degraded-reptile.ngrok-free.dev
└───────────────────────▲──────────────────────┘
                        │
                        │ Peticiones HTTPS seguras
                        │
┌───────────────────────┴──────────────────────┐
│             DISPOSITIVOS CLIENTE             │
│                                              │
│  - Móvil (iPhone/Android) PWA o Web          │
│  - Frontend Web (https://voxdaily.vercel.app)│
│  - Red Local / Expo Metro (puerto 8081)      │
└──────────────────────────────────────────────┘
```

---

## 2. Arranque Rápido Automático (Recomendado)

En la raíz del proyecto (`C:\Users\marie\Desktop\Proyecto_AI`), abre **PowerShell** y ejecuta:

```powershell
.\start.ps1
```

### ¿Qué hace automáticamente `start.ps1`?
1. **Limpia procesos colgados:** Cierra cualquier proceso residual que estuviera ocupando el puerto `8000`.
2. **Arranca el Backend FastAPI:** Inicia el servidor con recarga automática (`--reload`) en una ventana dedicada.
3. **Comprueba salud:** Espera hasta que `http://127.0.0.1:8000/health` devuelva `200 OK`.
4. **Arranca el Túnel Estático:** Levanta el túnel con el dominio permanente fijo:
   `https://raging-degraded-reptile.ngrok-free.dev`.
5. **Configura el Frontend:** Actualiza automáticamente `frontend/.env.local` y `frontend/app.json` con la URL del túnel.

*Para detener todo cuando termines de trabajar, simplemente pulsa `Ctrl + C` en esa consola.*

---

## 3. Arranque Manual (Paso a Paso)

Si prefieres controlar cada servicio en terminales independientes:

### Terminal 1: Backend FastAPI
```powershell
cd C:\Users\marie\Desktop\Proyecto_AI\backend
uv run python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
*Comprobación:* Entra en `http://localhost:8000/health` en tu navegador. Debe responder `{"status":"ok"}`.

### Terminal 2: Túnel Permanente
```powershell
cd C:\Users\marie\Desktop\Proyecto_AI
npx --yes ngrok http 8000 --url raging-degraded-reptile.ngrok-free.dev
```
*Comprobación:* Entra en `https://raging-degraded-reptile.ngrok-free.dev/health`. Debe responder `{"status":"ok"}`.

### Terminal 3: Frontend Local (Opcional, solo para desarrollo en PC)
```powershell
cd C:\Users\marie\Desktop\Proyecto_AI\frontend
npx expo start --lan
```

---

## 4. Cómo Conectar el Móvil (PWA)

1. En tu móvil, asegúrate de tener conexión a Internet (Wi-Fi o datos móviles).
2. Abre la app anclada en la pantalla de inicio o visita la web de producción:
   👉 **https://voxdaily.vercel.app/?backend=https://raging-degraded-reptile.ngrok-free.dev**
   *(El parámetro `?backend=...` solo necesitas abrirlo una vez; la app memorizará la URL estática permanentemente en su almacenamiento interno).*
3. Inicia sesión con tu cuenta registrada o crea una nueva desde la pestaña **"Registrarse"**.

---

## 5. Solución de Problemas Frecuentes

### A. "Error: Address already in use (:8000)"
Si el puerto 8000 quedó tomado por un proceso en segundo plano:
```powershell
Get-Process -Name "*python*", "*uvicorn*" | Stop-Process -Force
```

### B. "No se pudo conectar con el servidor: Failed to fetch"
1. Comprueba que el backend responde en `http://localhost:8000/health`.
2. Comprueba que el túnel ngrok está corriendo en la ventana de terminal.
3. Asegúrate de abrir la app con la URL del backend fijada:
   `https://voxdaily.vercel.app/?backend=https://raging-degraded-reptile.ngrok-free.dev`

### C. La app no refresca cambios tras actualizar el código
1. Cierra la app de la multitarea del móvil (deslizar hacia arriba).
2. Vuelve a abrirla para que cargue el último bundle web.
