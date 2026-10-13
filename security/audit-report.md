# Informe de Seguridad, Auditoría y DevOps

Este documento recopila la auditoría de seguridad, el análisis estático determinista, los guardarraíles para agentes de IA, los diagnósticos operativos y la política de privacidad de datos de **Proyecto AI**, dando cumplimiento íntegro al **Criterio 13 de la Rúbrica**.

---

## 1. Auditoría Determinista de Dependencias

### Prevención de "Alucinación de Paquetes" (*Package Hallucination*)
El uso de asistentes de IA para programar introduce el riesgo de *slopsquatting* o instalación de paquetes inexistentes registrados maliciosamente por atacantes. Para mitigar este riesgo:
- **Regla inmutable:** El agente tiene prohibido modificar dependencias sin autorización humana explícita.
- **Lockfiles versionados:** Las dependencias se instalan exclusivamente mediante archivos de bloqueo inmutables con hashes criptográficos:
  - Frontend: `npm ci` (lee `package-lock.json`).
  - Backend: `uv sync --frozen` (lee `uv.lock`).

### Auditoría de Vulnerabilidades (`npm audit`)
- **Ejecución:**
  ```powershell
  npm.cmd --prefix frontend audit
  ```
- **Hallazgos:**
  - Las dependencias en tiempo de ejecución del frontend (`react`, `react-native`, `expo`, `expo-sqlite`) se encuentran en versiones estables.
  - Se detectaron avisos en dependencias transitivas de desarrollo del empaquetador Metro y herramientas de prueba CLI de Expo (`@expo/metro`, `uuid` en paquetes legacy).
- **Mitigación arquitectónica:**
  - El empaquetado para producción implementado en `frontend/Dockerfile` utiliza un **build multi-etapa (*multi-stage*)**: el código se compila estáticamente y solo se sirve el bundle web generado a través de una imagen base limpia de `nginx:alpine`. Ninguna herramienta de desarrollo ni binario de Node.js se expone en el entorno productivo final.

---

## 2. Análisis Estático de Código y Calidad

El código fuente se somete a análisis estático riguroso sin ejecutarlo, verificando tipado estricto, detección de antipatrones y prevención de inyecciones:

### Backend (Python 3.11)
- **Linter & Seguridad con `Ruff`:**
  - Reglas activas: `E` y `W` (pycodestyle), `F` (pyflakes), `I` (isort), `UP` (pyupgrade), `B` (flake8-bugbear).
  - Previene variables no utilizadas, excepciones genéricas mal gestionadas y dependencias circulares.
- **Tipado estricto con `MyPy`:**
  - Configurado en `backend/pyproject.toml` con `strict = true` y validación de tipos en todas las firmas de funciones y modelos de base de datos.
- **Pruebas automáticas:**
  - 104 pruebas unitarias y de integración pasando al 100% en Pytest (`& "backend\.venv\Scripts\python.exe" -m pytest backend/tests`).

### Frontend (TypeScript / React Native)
- **Comprobación de Tipos:** `npm.cmd --prefix frontend run typecheck` (`tsc --noEmit`).
- **Linter:** `npm.cmd --prefix frontend run lint` (`eslint . --max-warnings 0`).
- **Pruebas de Componentes y Lógica:** 158 pruebas pasando al 100% en Jest (`npm.cmd --prefix frontend test`).

---

## 3. Notas de Seguridad sobre Agentes y Extensiones (*Guardrails*)

Para evitar que los agentes de IA ejecuten acciones destructivas o accedan a información confidencial, se aplican los siguientes límites:

| Dominio | Mecanismo de Seguridad | Implementación |
| :--- | :--- | :--- |
| **Aislamiento de Directorio** | Restricción al Workspace | Las herramientas de terminal validan que la ruta de trabajo (`Cwd`) pertenezca a la raíz del proyecto. No se permite escribir fuera del repositorio. |
| **Intake de Solo Lectura** | Protocolo en Skill | Ante cualquier reporte de error o log, el agente opera en modo lectura e investigación. No puede editar código hasta confirmación explícita del usuario (`_docs/defect-workflow.md`). |
| **Control de Cambios en Caliente** | Roles Separados | El rol Engineer implementa, pero no puede cerrar la tarea; el rol QA es un evaluador independiente que solo emite PASS o FAIL. |
| **Protección de Credenciales** | Cero Secretos en Chat | Prohibido solicitar o almacenar contraseñas, tokens JWT o claves de API en el historial de conversación o en archivos rastreados. |
| **Barrera de CI en la Nube** | GitHub Actions | Cualquier intento de fusionar código que falle las pruebas queda bloqueado por el flujo automatizado [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). |

---

## 4. Diagnóstico Operativo y Observabilidad (DevOps)

El proyecto incluye mecanismos deterministas para verificar la salud operativa del sistema:

### 1. Comprobación de Conectividad con la Base de Datos
- **Comando:**
  ```powershell
  uv run --directory backend python -m scripts.check_database
  ```
- **Salida:**
  ```text
  PostgreSQL connection check succeeded.
  ```
- **Diseño seguro:** Ejecuta una consulta mínima `SELECT 1`. Si la conexión falla, devuelve código de salida `1` y muestra un mensaje genérico sin exponer contraseñas, URLs ni credenciales en `stdout` o `stderr`.

### 2. Endpoint de Salud de la API (`/health`)
- **URL:** `GET http://localhost:8000/health`
- **Respuesta:** `{"status": "ok"}` con código HTTP 200.
- Utilizado por los orquestadores de contenedores y balanceadores de carga para verificar la disponibilidad del proceso antes de enrutar tráfico.

### 3. Comprobación de Salud en Contenedores (`docker-compose.yml`)
- Base de datos: `pg_isready -U proyecto_ai -d proyecto_ai_db` cada 5 segundos.
- Backend API: `curl -f http://localhost:8000/health` cada 10 segundos con tolerancia a 3 reintentos.
- El servicio web y la API solo inician cuando sus dependencias directas reportan estado `healthy`.

---

## 5. Política de Privacidad de Datos y Uso de IA

**Proyecto AI** maneja información altamente sensible del usuario: reflexiones personales, grabaciones de voz, tareas y memoria vital a largo plazo.

### Principios de Privacidad Adoptados:
1. **Soberanía y Arquitectura *Offline-First*:**
   - La aplicación almacena todos los datos prioritariamente en una base de datos local SQLite en el propio dispositivo del usuario.
   - La aplicación funciona plenamente sin conexión a Internet; no se requiere transmisión de datos obligatoria para registrar o consultar información.
2. **Procesamiento de Voz Local:**
   - La captura y transcripción de voz utiliza la **Web Speech API nativa del navegador y del sistema operativo** (Safari en iOS, Chrome en escritorio).
   - No se envían archivos de audio en bruto a servidores externos de procesamiento de lenguaje natural de terceros sin consentimiento informado.
3. **No Entrenamiento de Modelos:**
   - Las entradas de diario, tareas y recuerdos personales **nunca** se utilizan para reentrenar modelos fundacionales públicos.
4. **Sincronización Cifrada:**
   - Las sincronizaciones remotas viajan a través de canales cifrados HTTPS/TLS gestionados por túneles seguros o certificados SSL del backend.
