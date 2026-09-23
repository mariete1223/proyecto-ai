# Arquitectura técnica

## Aplicación personal de memoria y organización

**MVP v0.1**

Documento de arquitectura · iPhone-first · offline-first · infraestructura privada

> **Expo / React Native + SQLite local → Tailscale → FastAPI + PostgreSQL en PC**

**Propósito.** Definir la arquitectura acordada para el MVP, separando claramente las decisiones estructurales de los detalles de implementación que se concretarán después.

# 1. Objetivos arquitectónicos
- Mobile-first, con iPhone como dispositivo principal y acceso web desde ordenador.
- Offline-first: registrar y editar información sin depender de que el PC esté encendido o accesible.
- Privacidad por defecto: el backend no se expone públicamente a Internet.
- Coste inicial cero de infraestructura: backend y base de datos se ejecutan en el ordenador personal.
- Bajo lock-in: tecnologías estándar y componentes sustituibles para facilitar futuras migraciones.
- Simplicidad en el MVP sin comprometer mantenibilidad, testing ni capacidad de evolución.

# 2. Arquitectura de alto nivel

```text
iPhone (Expo / React Native)          Ordenador (Expo Web)
        │                                      │
   SQLite local                           Cliente web
   offline-first                               │
        └────────── Tailscale / red privada ───┘
                         │
                         ▼
                 FastAPI en el PC
                         │
                         ▼
              PostgreSQL + SQLAlchemy
                    + Alembic
```

La aplicación puede trabajar localmente en el iPhone. La sincronización con el backend es posterior y no forma parte del camino crítico de captura.

# 3. Organización del repositorio

Se utilizará un monorepo para mantener frontend, backend, documentación e infraestructura versionados de forma coordinada.

```text
project/
├── frontend/        # Expo / React Native / TypeScript
├── backend/         # FastAPI / Python
├── docs/            # Especificación funcional y arquitectura
├── .github/         # Automatización y CI cuando se incorpore
├── README.md
└── .gitignore
```

# 4. Frontend

**Stack:** Expo + React Native + TypeScript.
- iPhone es la plataforma prioritaria de diseño y pruebas.
- La misma base de código proporcionará una versión web para uso desde ordenador.
- No se desarrollarán aplicaciones nativas separadas para Windows o macOS en el MVP.
- La interfaz debe funcionar incluso cuando el backend no esté accesible.

## 4.1 Persistencia local

El iPhone utilizará SQLite local como almacenamiento operativo. La creación y edición de datos ocurre primero localmente; la sincronización con PostgreSQL sucede cuando el backend está disponible.

**Responsabilidad principal:** garantizar que registrar algo nunca dependa de cobertura, Internet, Tailscale ni de que el ordenador esté encendido.

# 5. Subsistema de voz

La captura hablada utilizará el sistema de reconocimiento de voz de Apple en iOS. Se permitirá que iOS utilice procesamiento online cuando ello mejore la calidad de la transcripción.
- La salida relevante del subsistema es texto transcrito.
- El audio no se conservará por defecto una vez obtenida la transcripción.
- El flujo normal de captura no dependerá de un modelo de lenguaje.
- La interpretación de los comandos estructurados se realizará mediante reglas deterministas.

# 6. Backend

**Stack:** Python + FastAPI.

El backend concentra la lógica de negocio compartida, autenticación, sincronización y acceso a la persistencia central. No debe contener dependencias innecesarias respecto al entorno donde se ejecute.

## 6.1 Estructura interna

```text
backend/
├── app/
│   ├── main.py      # Inicialización de FastAPI
│   ├── api/         # Endpoints HTTP
│   ├── models/      # Modelos SQLAlchemy
│   ├── schemas/     # Modelos Pydantic de entrada/salida
│   ├── services/    # Lógica de negocio
│   ├── db/          # Sesiones, conexión y utilidades de persistencia
│   └── core/        # Configuración, seguridad y logging
├── migrations/      # Alembic
├── tests/
├── alembic.ini
└── pyproject.toml
```

No se introducirán inicialmente capas como repository pattern, CQRS, event sourcing o microservicios. Solo se añadirán abstracciones cuando exista una necesidad real.

# 7. Persistencia central

**Base de datos:** PostgreSQL.

**ORM:** SQLAlchemy 2.x.

**Migraciones:** Alembic desde el primer cambio de esquema.
- PostgreSQL es una decisión arquitectónica; el proveedor de PostgreSQL no lo es.
- La aplicación no debe depender de extensiones propietarias para su funcionamiento básico.
- Los cambios de esquema se versionarán mediante migraciones reproducibles.
- El acceso a datos estará centralizado en el backend; el frontend no hablará directamente con PostgreSQL.

# 8. Infraestructura y red privada

Durante el MVP, FastAPI y PostgreSQL se ejecutarán en el ordenador personal del usuario. No se contratará hosting cloud mientras esta configuración resulte suficiente.
- No se abrirán puertos del router para publicar la API.
- No se requiere una IP pública para el backend.
- El acceso remoto desde el iPhone se realizará mediante Tailscale.
- Tailscale actúa como red privada entre los dispositivos autorizados; no como parte de la lógica de negocio.
- Si en el futuro se cambia Tailscale por otra VPN o solución privada, el resto de la arquitectura debe permanecer intacto.

# 9. Autenticación del MVP

La autenticación será deliberadamente mínima, pero no inexistente.
- Un único usuario en el MVP.
- Inicio de sesión mediante email y contraseña.
- Contraseña almacenada mediante hash seguro, nunca en texto plano.
- La sesión se mantendrá en los clientes para evitar inicios de sesión repetitivos.
- El modelo se diseñará para poder evolucionar a múltiples usuarios sin rehacer la persistencia principal.

# 10. Estrategia offline-first y sincronización

La sincronización no debe bloquear el uso de la aplicación. SQLite local permite operar de forma autónoma y PostgreSQL actúa como almacenamiento central cuando existe conectividad con el PC.

| **Paso** | **Comportamiento**                                                                   |
|----------|--------------------------------------------------------------------------------------|
| 1        | El usuario crea o modifica una entrada en el iPhone.                                 |
| 2        | El cambio se persiste inmediatamente en SQLite.                                      |
| 3        | El elemento queda pendiente de sincronización.                                       |
| 4        | Cuando FastAPI está accesible mediante Tailscale, el cliente sincroniza los cambios. |

## 10.1 Conflictos

Cada registro sincronizable dispondrá de una versión. Si cliente y servidor han modificado de forma divergente la misma versión, el sistema no sobrescribirá silenciosamente ninguno de los cambios.
- Sin conflicto: sincronización automática.
- Con conflicto: se conservan ambas variantes y el usuario elige manualmente cuál mantener.
- El objetivo prioritario es evitar pérdida silenciosa de información.

# 11. Flujos principales

## 11.1 Captura hablada

1.  Micrófono del iPhone

2.  Reconocimiento de voz de Apple

3.  Texto transcrito

4.  Parser determinista

5.  Persistencia en SQLite

6.  Sincronización posterior con FastAPI/PostgreSQL

## 11.2 Uso desde ordenador

7.  El usuario abre la versión web del frontend

8.  El cliente accede al backend a través de la red privada

9.  FastAPI aplica autenticación y lógica de negocio

10. Los cambios se persisten en PostgreSQL

11. El iPhone recibe posteriormente los cambios durante la sincronización

# 12. Portabilidad y ausencia de lock-in

La arquitectura debe permitir evolucionar desde el despliegue local hacia infraestructura externa sin rediseñar la aplicación.

| **Componente** | **Decisión estable** | **Elemento sustituible**              |
|----------------|----------------------|---------------------------------------|
| Frontend       | Expo / React Native  | Entorno de distribución y hosting web |
| Backend        | FastAPI / Python     | Máquina o proveedor donde se ejecuta  |
| Persistencia   | PostgreSQL           | Hosting de PostgreSQL                 |
| ORM            | SQLAlchemy           | Proveedor de base de datos compatible |
| Red privada    | Acceso privado       | Tailscale u otra solución VPN         |

Una futura migración a un VPS, servidor doméstico dedicado o proveedor cloud debería consistir principalmente en cambiar configuración y despliegue, no en reescribir la lógica de producto.

# 13. Principios de calidad
- Separación clara entre rutas HTTP, validación, lógica de negocio y persistencia.
- Tipado y validación explícitos tanto en Python como en TypeScript.
- Migraciones de base de datos reproducibles.
- Tests para reglas de negocio y sincronización.
- Configuración y secretos fuera del código fuente.
- Evitar dependencias de proveedor dentro de los modelos de dominio.
- Añadir complejidad solo cuando el producto la requiera.

# 14. Decisiones deliberadamente aplazadas

Los siguientes puntos son detalles de diseño o implementación y no forman parte de esta arquitectura base:
- Modelo de datos definitivo, relaciones y contrato exacto de endpoints.
- Algoritmo y formato preciso del protocolo de sincronización.
- Reglas exactas del parser de comandos hablados.
- Librerías de estado, diseño visual y componentes UI del frontend.
- Adjuntos y uso opcional de IA para procesar capturas desestructuradas.

# 15. Arquitectura acordada
- **Frontend:** Expo + React Native + TypeScript
- **Cliente principal:** iPhone
- **Cliente secundario:** Web
- **Almacenamiento local:** SQLite
- **Backend:** Python + FastAPI
- **ORM:** SQLAlchemy 2.x
- **Migraciones:** Alembic
- **Persistencia central:** PostgreSQL
- **Despliegue inicial:** ordenador personal
- **Red privada:** Tailscale
- **Modelo operativo:** offline-first con sincronización y control de versiones

Este documento fija la arquitectura del MVP. Los detalles de implementación se especificarán en documentos posteriores.
