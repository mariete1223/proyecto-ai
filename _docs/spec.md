# Especificación funcional — MVP v0.1

## 1. Visión del producto

La aplicación será una herramienta personal para **registrar, organizar y consultar información relevante de la vida diaria**.

Su propósito principal es actuar como una memoria externa que permita conservar de forma sencilla acontecimientos, recuerdos, aprendizajes, momentos importantes y otra información que el usuario quiera mantener a largo plazo.

De manera complementaria, permitirá gestionar tareas y eventos dentro del mismo entorno, evitando separar la memoria personal de la organización diaria.

La aplicación estará pensada para utilizarse tanto desde ordenador como desde móvil.

La **voz será uno de los mecanismos principales de interacción**, ya que el objetivo es reducir al máximo la fricción necesaria para registrar información.

---

# 2. Principios del producto

### Capturar debe ser rápido

Registrar algo debe requerir el menor esfuerzo posible.

La aplicación debe permitir guardar información hablándola sin necesidad de rellenar formularios complejos.

### La información debe ser estructurada

Cada registro debe pertenecer a una categoría y disponer de una fecha asociada.

Esto permitirá posteriormente navegar por la información de forma ordenada.

### Una captura normal representa una sola cosa

Cada grabación normal debe corresponderse con una única entrada.

Por ejemplo:

> Aprendizaje → una cosa aprendida.

No se pretende que una grabación contenga múltiples acontecimientos diferentes.

### Debe existir una excepción: Captura

Cuando el usuario no pueda registrar las cosas individualmente podrá utilizar una categoría especial denominada **Captura**.

Una captura permite almacenar información libre y potencialmente desestructurada.

En el futuro podrá utilizarse inteligencia artificial para convertir esa captura en múltiples entradas estructuradas.

El contenido original deberá conservarse hasta que el usuario decida eliminarlo.

### La inteligencia artificial no debe ser necesaria

El funcionamiento básico de la aplicación no dependerá de inteligencia artificial.

La IA podrá utilizarse posteriormente como herramienta opcional para procesar capturas u ofrecer funcionalidades adicionales.

### El sistema debe poder crecer

Las funcionalidades iniciales deben ser simples, pero el producto debe concebirse para poder incorporar nuevos tipos de información y nuevas características en el futuro.

---

# 3. Entradas

Una **entrada** representa una unidad de información registrada por el usuario.

Cada entrada tendrá como mínimo:

- Categoría.
- Fecha y hora.
- Contenido.
- Cero o más etiquetas.

Las entradas podrán editarse posteriormente.

Las entradas también podrán eliminarse definitivamente.

No existirá inicialmente papelera ni sistema de recuperación de elementos eliminados.

---

# 4. Categorías

Toda entrada deberá pertenecer a una categoría.

Las categorías serán completamente configurables por el usuario.

No existirán únicamente categorías cerradas definidas por la aplicación.

Cada categoría tendrá:

**Nombre**

Nombre visible de la categoría.

Ejemplo:

> Aprendizaje

**Comando de voz**

Palabra que permitirá seleccionar esa categoría al realizar una captura hablada.

Ejemplo:

> aprendizaje

**Descripción**

Explicación del significado de la categoría y del tipo de información que debería almacenarse en ella.

Ejemplo:

> Información o conocimientos que he aprendido y quiero recordar en el futuro.

**Color**

Color utilizado para identificar visualmente las entradas pertenecientes a esa categoría.

**Icono**

Icono utilizado para identificar rápidamente la categoría en la interfaz.

El usuario podrá crear nuevas categorías desde la aplicación.

También deberá contemplarse la posibilidad de crear categorías mediante voz.

### Categorías iniciales propuestas

El MVP podrá comenzar con algunas categorías predefinidas como:

Recuerdo, aprendizaje, momento bonito, evento canónico, frase, tarea, evento, captura, libro, película, vídeo y suceso.

Estas categorías iniciales no limitan las categorías futuras.

El usuario podrá crear otras como:

> Árbol  
> Restaurante  
> Paper  
> Idea de vídeo

o cualquier otra que considere útil.

---

# 5. Etiquetas

Las etiquetas permitirán clasificar transversalmente las entradas independientemente de su categoría.

Una entrada podrá contener **cualquier número de etiquetas**.

Las etiquetas serán planas.

No existirán inicialmente jerarquías, subetiquetas ni relaciones padre-hijo.

### Las etiquetas deben existir previamente

No será posible introducir cualquier texto libre como etiqueta.

Una etiqueta deberá haber sido creada previamente para poder utilizarse.

Esto evita crear accidentalmente variantes como:

> IA  
> ia  
> Inteligencia Artificial  
> inteligencia-artificial

como etiquetas distintas.

Las etiquetas podrán crearse:

- Manualmente desde la aplicación.
- Mediante voz.

Las etiquetas podrán añadirse o modificarse posteriormente.

---

# 6. Formas de introducir una entrada

La aplicación deberá soportar tres formas principales de creación.

### Captura completamente hablada

Toda la información se proporciona mediante voz.

El formato será:

> Categoría → fecha → contenido → etiquetas

La fecha y las etiquetas serán opcionales.

Ejemplo:

> Aprendizaje. Fecha, ayer a las seis. Contenido, he aprendido cómo funciona el EEG. Etiquetas, inteligencia artificial, salud.

### Captura mixta

El usuario selecciona manualmente algunos elementos desde la interfaz, como:

categoría y fecha.

Posteriormente dicta únicamente el contenido.

### Captura completamente manual

El usuario podrá escribir todos los campos manualmente cuando no pueda o no quiera utilizar la voz.

Las tres formas deben producir conceptualmente el mismo tipo de entrada.

---

# 7. Formato de comandos hablados

Los comandos hablados utilizarán palabras delimitadoras explícitas para simplificar su interpretación.

Formato general:

> [Categoría]. Fecha, [fecha y hora]. Contenido, [contenido]. Etiquetas, [etiquetas].

Ejemplo:

> Recuerdo. Fecha, 15 de septiembre a las nueve de la noche. Contenido, cené en Shanghái viendo la ciudad iluminada. Etiquetas, China, viaje.

### Fecha opcional

El bloque `Fecha` será opcional.

Si no se proporciona:

> Aprendizaje. Contenido, hoy he aprendido...

la aplicación utilizará automáticamente la fecha y hora actuales.

El bloque `Fecha` podrá incluir tanto fecha como hora.

No existirán comandos separados para fecha y hora.

### Etiquetas opcionales

El bloque `Etiquetas` aparecerá siempre después del contenido y será opcional.

---

# 8. Modos de guardado

La aplicación tendrá una configuración global denominada **modo de guardado**.

Existirán dos posibilidades.

### Fast Forward

La información interpretada se guarda directamente.

El usuario podrá revisarla y modificarla posteriormente si lo desea.

Este modo prioriza la velocidad y la mínima fricción.

### Preview Before Save

Antes de guardar se mostrará una previsualización de la entrada.

El usuario podrá revisar y modificar:

categoría, fecha y hora, contenido y etiquetas.

Una vez revisada, podrá confirmar el guardado.

La opción elegida será una preferencia global y se aplicará a todas las nuevas capturas hasta que sea modificada.

---

# 9. Registro de correcciones

Cuando el sistema interprete una entrada y el usuario tenga que corregirla, deberá poder conservarse constancia de la diferencia entre la interpretación inicial y el valor finalmente aceptado.

Ejemplos:

> Categoría detectada: Recuerdo  
> Categoría final: Momento bonito

o:

> Fecha detectada: 18:00  
> Fecha final: 19:00

El objetivo es disponer posteriormente de información sobre qué errores ocurren con mayor frecuencia y poder mejorar el sistema.

Las modificaciones normales realizadas días después sobre una entrada no necesitan considerarse necesariamente errores del sistema.

---

# 10. Tareas

Las tareas constituyen una categoría con algunas características adicionales.

Una tarea podrá tener fecha o no tenerla.

### Tareas con fecha

Aparecerán asociadas al día correspondiente dentro del calendario.

### Tareas sin fecha

Formarán parte de una sección de **Tareas pendientes**.

Esto permitirá registrar cosas que se quieren hacer aunque todavía no exista una fecha concreta.

### Estado

Una tarea tendrá uno de estos tres estados:

> Pendiente  
> En progreso  
> Realizada

### Recurrencia

Una tarea podrá marcarse simplemente como:

> Única  
> Recurrente

En el MVP no será necesario definir configuraciones avanzadas de recurrencia.

---

# 11. Eventos

Los eventos serán inicialmente simples.

Tendrán los mismos elementos principales de cualquier entrada:

categoría, fecha/hora, contenido y etiquetas.

No será necesario incluir inicialmente duración, ubicación, participantes u otras propiedades.

Estas características podrán añadirse posteriormente.

---

# 12. Calendario

El calendario será una de las partes centrales de la aplicación.

Será también, inicialmente, la **pantalla principal al abrir la aplicación**.

Esta decisión podrá revisarse posteriormente según la experiencia de uso.

### Vista inicial

La vista por defecto será:

> Mensual

El diseño tomará como referencia conceptual la claridad y facilidad de lectura de Google Calendar.

Las entradas deberán utilizar los colores e iconos de sus respectivas categorías para facilitar la identificación visual.

### Filtrado

El usuario podrá decidir qué categorías desea visualizar en el calendario.

Por ejemplo:

> Solo tareas y eventos.

o:

> Recuerdos + momentos bonitos + sucesos.

o:

> Todas las categorías.

Los filtros serán temporales y manuales.

No será necesario guardar combinaciones de filtros como vistas personalizadas durante el MVP.

### Saturación visual

La vista mensual deberá mantenerse legible incluso cuando existan múltiples entradas.

La solución concreta para representar días con muchas entradas se decidirá durante el diseño de interfaz.

No se utilizará como requisito inicial el comportamiento `+3 más` de Google Calendar.

---

# 13. Navegación y consulta

El MVP deberá permitir localizar información mediante tres mecanismos principales.

### Calendario

Permite navegar cronológicamente por toda la información registrada.

### Categorías

Permite consultar únicamente entradas pertenecientes a determinadas categorías.

### Etiquetas

Permite consultar entradas relacionadas mediante etiquetas previamente creadas.

No será necesaria inicialmente una búsqueda completa mediante texto libre.

---

# 14. Edición

Cualquier entrada podrá modificarse posteriormente.

El usuario podrá cambiar, entre otros elementos:

categoría, fecha/hora, contenido y etiquetas.

La información no tendrá carácter inmutable.

El usuario tendrá siempre control sobre la versión final de sus entradas.

---

# 15. Eliminación

El usuario podrá eliminar definitivamente cualquier entrada.

El MVP no incluirá:

papelera, archivado temporal ni recuperación automática.

La eliminación será permanente.

---

# 16. Funcionalidades fuera del MVP

Quedan deliberadamente fuera de esta primera versión:

archivos adjuntos, fotografías, vídeos y documentos; búsqueda semántica o búsqueda libre avanzada; generación automática de resúmenes diarios; creación automática de una línea temporal mediante IA; detección automática de personas, lugares o temas; jerarquías de etiquetas; funcionalidades avanzadas de eventos; configuraciones avanzadas de recurrencia; sincronizaciones externas; análisis inteligente de la vida del usuario.

La arquitectura futura podrá contemplarlas, pero **no son requisitos del MVP**.

---

# 17. Experiencia fundamental del MVP

El producto será considerado funcional cuando permita realizar correctamente este ciclo:

> Tengo algo que quiero recordar → abro la aplicación → lo digo o escribo → queda asociado a una categoría y momento → puedo verlo posteriormente dentro del calendario → puedo filtrarlo mediante categorías o etiquetas → puedo editarlo o eliminarlo cuando quiera.

Para las tareas:

> Tengo algo que hacer → lo registro → puede tener fecha o quedar pendiente → puedo cambiar su estado → puedo encontrarlo posteriormente.

Para situaciones donde no pueda registrar cada cosa individualmente:

> Utilizo Captura → guardo toda la información libremente → queda almacenada para poder revisarla o procesarla posteriormente.

---

# 18. Objetivo del MVP

El MVP no pretende sustituir Notion, Google Calendar, Todoist ni crear un asistente inteligente completo.

Su objetivo es comprobar una hipótesis mucho más concreta:

**¿Puede una aplicación personal basada principalmente en captura por voz convertirse en una forma suficientemente cómoda de registrar y consultar de manera continuada los acontecimientos relevantes de la vida diaria?**

Si la respuesta mediante el uso real es positiva, el producto podrá evolucionar posteriormente hacia funcionalidades más avanzadas.