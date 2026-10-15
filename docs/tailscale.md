# Guía de Acceso Privado mediante Tailscale (Task 44)

## Objetivo
Conectar el iPhone y el PC a través de una red privada virtual de confianza (Tailnet) sin exponer la API FastAPI públicamente ni abrir ningún puerto en el router.

---

## Paso 1: Instalación de Tailscale

1. **En el PC (Windows/macOS/Linux):**
   - Descargar e instalar Tailscale desde [tailscale.com](https://tailscale.com/).
2. **En el iPhone:**
   - Descargar e instalar la aplicación **Tailscale** desde la App Store.

---

## Paso 2: Autenticación e Identificación de Dispositivos

1. Iniciar sesión en Tailscale en ambos dispositivos con la misma cuenta (por ejemplo, Google, GitHub o Microsoft).
2. Ambos dispositivos quedarán conectados a la misma red mesh privada (Tailnet).
3. En el PC, obtener la dirección IP privada asignada por Tailscale:
   - En la consola del PC ejecutando `tailscale ip -4` o desde el icono de la barra de tareas.
   - Ejemplo de IP obtenida: `100.115.42.89`.

---

## Paso 3: Configuración de la URL de FastAPI en el iPhone

1. En la app del iPhone (o desde el navegador Safari del iPhone), configurar la URL base de FastAPI usando la IP de Tailscale del PC:
   ```
   http://100.115.42.89:8000
   ```

---

## Paso 4: Comprobación del Acceso (Healthcheck)

1. Abrir Safari en el iPhone conectado a Tailscale e ir a:
   ```
   http://100.115.42.89:8000/health
   ```
2. Respuesta esperada:
   ```json
   {"status": "ok"}
   ```

---

## Paso 5: Diagnóstico de Errores Habituales

| Problema | Causa Posible | Solución |
| :--- | :--- | :--- |
| **Tiempo de espera agotado (Timeout)** | El Firewall de Windows bloquea conexiones entrantes al puerto 8000 | Añadir una regla de entrada en el Firewall de Windows para permitir el puerto TCP 8000 en la red de Tailscale. |
| **No se encuentra el host** | Los dispositivos están en cuentas de Tailscale distintas | Verificar en la consola de administración de Tailscale que ambos dispositivos figuran en la misma Tailnet. |
| **Error HTTP 500 / Conexión rechazada** | El servidor FastAPI o Docker no está arrancado | Verificar que los contenedores están corriendo con `docker-compose ps` o `uvicorn`. |

---

## Advertencia de Seguridad

> **IMPORTANTE:** No abrir NUNCA el puerto 8000 ni ningún otro puerto en el router hacia Internet (sin port forwarding / sin DMZ). Tailscale cifra todo el tráfico punto a punto (WireGuard) y garantiza el acceso 100% privado.
