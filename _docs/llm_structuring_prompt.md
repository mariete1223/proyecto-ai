# Guía y Especificación de Prompts para Estructurar Capturas con LLM (IA)

Este documento define la especificación del prompt y el formato JSON necesario para convertir notas desestructuradas, escrituras libres o volcados diarios de texto/voz en entradas estructuradas compatibles con **Proyecto AI**.

---

## 1. Propósito y Flujo de Trabajo

El objetivo es permitir al usuario dictar o escribir un gran volumen de información libre durante el día (un diario, un volcado de ideas, reuniones o notas mixtas) y posteriormente procesarlo mediante un Modelo de Lenguaje (LLM como ChatGPT, Claude, Gemini o DeepSeek) para separar esa nota en múltiples entradas bien categorizadas, fechadas y etiquetadas en la aplicación.

### Flujo paso a paso:
1. **Guardar la Captura Libre en la App:** El usuario crea una entrada libre en la app (usando la categoría `Captura`, `Nota` o escritura libre).
2. **Copiar Prompt para el LLM:** El usuario copia el texto de la captura junto con las instrucciones del prompt indicadas abajo.
3. **Procesar con el LLM:** El LLM analiza el texto libre y genera un array en formato **JSON estructurado**.
4. **Importar a la App:** El usuario pega el JSON devuelto por el LLM en el módulo de **"Importar desde LLM / IA"** dentro de la app, el cual valida las entradas y las guarda en la base de datos de SQLite en un solo clic.

---

## 2. Especificación del JSON de Salida

El LLM **DEBE** responder exclusivamente con un bloque de código JSON valido (un array de objetos) con la siguiente estructura:

```json
[
  {
    "category_name": "Nombre exacto de la categoría (ej: Tareas, Notas, Recuerdos, Ideas, Aprendizaje, Captura)",
    "title": "Título resumido y claro para la entrada (opcional)",
    "content": "Detalle explicativo y limpio del acontecimiento o tarea",
    "occurred_at": "Fecha/hora en ISO 8601 UTC (ej: 2026-10-01T15:30:00Z) o YYYY-MM-DD (ej: 2026-10-01). Usar null si no aplica",
    "task_status": "PENDING" | "COMPLETED" | null,
    "tags": ["Etiqueta1", "Etiqueta2"]
  }
]
```

### Reglas de Conversión:
- **`category_name`**: Debe coincidir con alguna de las categorías del usuario. Si es una acción/pendiente, usar `Tareas`. Si es un acontecimiento vivido, `Recuerdos`. Si es algo aprendido, `Aprendizaje` o `Notas`.
- **`title`**: Resumen breve de 3 a 7 palabras.
- **`content`**: El texto explicativo sin las frases de comando ni muletillas.
- **`occurred_at`**: **IMPORTANTE:** Para notas desestructuradas o notas generales, usar **siempre `null`** (NO extraer una sola fecha del texto como tal, ya que una nota desestructurada puede referenciar múltiples fechas pasadas, presentes o futuras y forzar una fecha rompería la integridad). Se deben conservar íntegras todas las referencias temporales dentro del campo `content`. Únicamente rellenar `occurred_at` (formato ISO 8601 UTC o YYYY-MM-DD) si la entrada es un evento puntual o una tarea con fecha límite fija concreta.
- **`task_status`**: Asignar `"PENDING"` obligatoriamente si `category_name` es una tarea. Para otras categorías, usar `null`.
- **`tags`**: Lista de etiquetas relevantes extraídas o inferidas del texto (ej. `["Salud", "Trabajo", "Urgente"]`).

---

## 3. Plantilla de Prompt Completa para Copiar al LLM

> **Instrucciones para el usuario:** Copia el siguiente bloque de texto completo, reemplaza la fecha y tus notas libres, y pégalo en tu LLM (ChatGPT / Claude / Gemini / etc.).

```text
Actúa como un asistente experto en estructuración de información personal para la aplicación Proyecto AI.

Tu tarea es analizar el siguiente texto de escritura libre / diario del día y extraer TODAS las ideas, tareas, recuerdos o notas individuales en un array de objetos en formato JSON estricto.

### CATEGORÍAS DISPONIBLES EN MI APP:
- Notas (voice_command: "nota")
- Tareas (voice_command: "tarea")
- Recuerdos (voice_command: "recuerdo")
- Ideas (voice_command: "idea")
- Captura (escritura libre)

### ETIQUETAS HABITUALES:
- Urgente, Salud, Trabajo, Personal, Compras, Proyecto

### FECHA DE REFERENCIA DE HOY:
2026-10-01

### FORMATO DE SALIDA REQUERIDO (Solo responde con el código JSON sin texto adicional ni introducciones):
[
  {
    "category_name": "Nombre de Categoría",
    "title": "Título corto y descriptivo",
    "content": "Contenido detallado y limpio de la entrada",
    "occurred_at": null,
    "task_status": "PENDING" (si es tarea) o null,
    "tags": ["Etiqueta1", "Etiqueta2"]
  }
]

### REGLAS IMPORTANTES:
1. NOTAS DESESTRUCTURADAS: Para notas desestructuradas o notas generales ("Notas"), NO debes extraer una fecha como tal en "occurred_at" (debe ser null). Las notas desestructuradas pueden contener múltiples fechas o referencias temporales variadas; conserva intactas todas las fechas y horas dentro del texto en "content".
2. TAREAS Y EVENTOS: Solo incluye fecha en "occurred_at" (formato ISO 8601 UTC o YYYY-MM-DD) si la entrada es un evento puntual con fecha concreta o una tarea con fecha límite única. En cualquier otro caso, usa null.

### MI TEXTO LIBRE DEL DÍA PARA ESTRUCTURAR:
"""
[AQUÍ PEGA TU NOTA O DIARIO LIBRE DEL DÍA]
"""
```

---

## 4. Ejemplo Práctico de Conversión

### Entrada Libre (Texto bruto del usuario):
> "Hoy he pasado un día estupendo con Carmen en el parque. Por cierto, recordar que mañana a las 4 de la tarde tengo que llamar al médico para pedir los resultados de la analítica de salud. También se me ha ocurrido una idea para mejorar la app: añadir un botón de exportar en JSON. Ah y no olvidar comprar leche y fruta urgente."

### Respuesta del LLM (JSON estructurado listo para la app):
```json
[
  {
    "category_name": "Recuerdos",
    "title": "Día con Carmen en el parque",
    "content": "Un día muy bonito y estupendo disfrutando con Carmen en el parque.",
    "occurred_at": null,
    "task_status": null,
    "tags": ["Personal"]
  },
  {
    "category_name": "Tareas",
    "title": "Llamar al médico por analítica",
    "content": "Llamar al médico para pedir los resultados de la analítica de salud.",
    "occurred_at": "2026-10-02T16:00:00Z",
    "task_status": "PENDING",
    "tags": ["Salud", "Urgente"]
  },
  {
    "category_name": "Ideas",
    "title": "Botón de exportación JSON en app",
    "content": "Añadir un botón de exportación e importación en JSON para la aplicación.",
    "occurred_at": null,
    "task_status": null,
    "tags": ["Proyecto"]
  },
  {
    "category_name": "Tareas",
    "title": "Comprar leche y fruta",
    "content": "Comprar leche y fruta urgente en el supermercado.",
    "occurred_at": null,
    "task_status": "PENDING",
    "tags": ["Compras", "Urgente"]
  }
]
```

---

## 5. Integración en la App

La aplicación cuenta con el componente `LlmBatchProcessor` accesible en la barra superior o en el visor de entradas:
- **Copiar Prompt Automático:** Al pulsar el botón "🤖 Copiar Prompt IA" en cualquier entrada o captura, la app genera automáticamente el prompt con la lista actualizada de categorías del usuario, la fecha actual de referencia y el contenido de la nota.
- **Importación Directa:** Al seleccionar "📥 Importar desde IA", el usuario pega el código JSON de la IA. La app auto-asocia los nombres de categorías y etiquetas con los IDs correspondientes de la base de datos de SQLite, ofreciendo una vista previa antes de guardar.
