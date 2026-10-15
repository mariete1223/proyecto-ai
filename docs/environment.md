# Guía de Entorno Local: FastAPI y PostgreSQL (Task 43)

## Visión General
Esta guía describe la configuración, arranque, parada y mantenimiento reproducible del backend FastAPI y la base de datos PostgreSQL mediante Docker Compose.

---

## 1. Configuración de Variables de Entorno

Copiar el archivo de plantilla `.env.example` a `.env`:
```bash
cp .env.example .env
```

> **Importante:** Nunca subir `.env` con contraseñas reales al repositorio de Git.

---

## 2. Arranque y Parada del Entorno

### Arrancar los servicios en segundo plano:
```bash
docker-compose up -d --build
```

### Ver estado de salud de los contenedores:
```bash
docker-compose ps
```

### Consultar los logs del backend:
```bash
docker-compose logs -f api
```

### Detener los servicios conservando los datos:
```bash
docker-compose down
```

### Detener los servicios eliminando volúmenes (¡destruye la base de datos!):
```bash
docker-compose down -v
```

---

## 3. Migraciones Automáticas y Comprobación de Salud

- Al iniciar el contenedor `proyecto_ai_api`, se ejecutan automáticamente las migraciones con Alembic: `alembic upgrade head`.
- **Healthcheck del Backend:** `GET http://localhost:8000/health` devuelve HTTP 200 `{"status": "ok"}`.
- **Healthcheck de PostgreSQL:** El contenedor ejecuta `pg_isready`.

---

## 4. Copia de Seguridad y Restauración (Backup & Restore)

### Crear una copia de seguridad de la base de datos:
```bash
docker exec -t proyecto_ai_db pg_dump -U proyecto_ai -d proyecto_ai_db > backup_proyecto_ai.sql
```

### Restaurar una copia de seguridad:
```bash
cat backup_proyecto_ai.sql | docker exec -i proyecto_ai_db psql -U proyecto_ai -d proyecto_ai_db
```
