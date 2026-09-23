# Backlog del MVP v0.1

## 1. Preparar el proyecto vacío y una prueba mínima
Goal: Crear el monorepo vacío con una prueba automatizada que pase.
Description: Preparar las carpetas `frontend`, `backend` y `_docs`, junto con la configuración mínima de Expo/TypeScript y FastAPI/Python. Añadir una prueba mínima por cada entorno y documentar un único procedimiento para instalarlas y ejecutarlas correctamente.

## 2. Configurar comprobaciones de calidad locales
Goal: Poder validar formato, lint, tipos y tests con comandos reproducibles.
Description: Configurar las herramientas de calidad apropiadas para TypeScript y Python, con reglas mínimas compartidas por el proyecto. Documentar los comandos y comprobar que funcionan sobre el proyecto vacío sin modificar archivos inesperadamente.

## 3. Añadir integración continua
Goal: Ejecutar automáticamente las comprobaciones del proyecto en cada cambio.
Description: Crear un flujo de CI que instale de forma reproducible las dependencias de frontend y backend y ejecute lint, tipos y tests. El flujo debe fallar de manera clara si cualquiera de las comprobaciones no pasa y no debe necesitar secretos.

## 4. Definir el modelo de dominio inicial
Goal: Especificar las entidades y reglas que sostendrán el MVP.
Description: Documentar los campos, identificadores, relaciones, estados y restricciones de usuario, categoría, etiqueta, entrada, tarea, preferencia y corrección. Incluir las decisiones necesarias para soportar borrado definitivo, fechas opcionales de tareas, recurrencia simple y evolución futura a varios usuarios.

## 5. Configurar el acceso del backend a PostgreSQL
Goal: Conectar FastAPI con PostgreSQL mediante SQLAlchemy 2.x.
Description: Añadir configuración por entorno, creación de sesiones y comprobación controlada de conectividad, manteniendo credenciales fuera del código. Incluir tests que sustituyan la infraestructura real y verifiquen el ciclo de vida de las sesiones.

## 6. Inicializar las migraciones de base de datos
Goal: Disponer de un esquema central reproducible mediante Alembic.
Description: Configurar Alembic contra los modelos SQLAlchemy y crear una migración inicial para las tablas del dominio acordado. Verificar tanto la aplicación como la reversión de la migración sobre una base de datos de prueba.

## 7. Implementar la creación del usuario único
Goal: Poder dar de alta de forma segura al usuario inicial del MVP.
Description: Crear el modelo y servicio necesarios para registrar un email único y una contraseña almacenada con un hash seguro. Añadir validaciones y tests para email duplicado, contraseña inválida y ausencia de almacenamiento en texto plano.

## 8. Implementar inicio y persistencia de sesión
Goal: Autenticar al usuario y mantener su sesión entre usos.
Description: Añadir el endpoint de inicio de sesión, emisión y validación de credenciales de sesión, y cierre de sesión. Cubrir con tests las credenciales correctas, los rechazos, la expiración y el acceso a una ruta protegida.

## 9. Crear la API de categorías
Goal: Permitir crear, consultar y modificar categorías configurables.
Description: Implementar endpoints y lógica de negocio para nombre, comando de voz, descripción, color e icono, siempre asociados al usuario. Validar unicidad y valores requeridos, e incluir tests de autorización y errores de entrada.

## 10. Añadir las categorías iniciales
Goal: Ofrecer al usuario nuevo un conjunto útil de categorías de partida.
Description: Crear de forma idempotente las categorías propuestas para el MVP, incluidas Tarea, Evento y Captura, sin impedir categorías personalizadas. Definir sus comandos de voz, colores e iconos iniciales y probar que el proceso no genera duplicados.

## 11. Crear la API de etiquetas
Goal: Gestionar un catálogo plano de etiquetas previamente creadas.
Description: Implementar creación, listado, modificación y eliminación de etiquetas asociadas al usuario. Aplicar normalización y unicidad para evitar variantes accidentales, además de impedir referencias a etiquetas inexistentes.

## 12. Crear y consultar entradas mediante la API
Goal: Guardar unidades de información con categoría, fecha, contenido y etiquetas.
Description: Implementar los esquemas, servicio y endpoints para crear una entrada y consultar su detalle. La fecha debe usar el instante actual cuando se omita, y las categorías y etiquetas deben existir y pertenecer al usuario autenticado.

## 13. Listar y filtrar entradas mediante la API
Goal: Recuperar entradas por intervalo temporal, categorías y etiquetas.
Description: Añadir un endpoint de listado paginado con filtros combinables y un orden estable por fecha. Incluir tests para límites temporales, múltiples filtros, resultados vacíos y aislamiento entre usuarios.

## 14. Editar y eliminar entradas mediante la API
Goal: Permitir al usuario controlar la versión final de cualquier entrada.
Description: Implementar la modificación de categoría, fecha, contenido y etiquetas, junto con eliminación permanente y confirmación explícita en el contrato. Probar validaciones, recursos inexistentes y que los datos eliminados dejan de poder consultarse.

## 15. Añadir los datos específicos de tareas
Goal: Representar estado, fecha opcional y recurrencia simple en entradas de tipo tarea.
Description: Extender el dominio y la API para admitir los estados Pendiente, En progreso y Realizada, así como recurrencia Única o Recurrente. Validar que estos campos solo se usen en la categoría Tarea y que una tarea pueda existir sin fecha.

## 16. Crear las consultas de tareas pendientes
Goal: Obtener las tareas sin fecha y actualizar su estado con rapidez.
Description: Añadir una consulta específica para tareas pendientes sin fecha y una operación para cambiar su estado. Definir orden y paginación estables, y cubrir transiciones válidas, tareas ya realizadas y recursos ajenos.

## 17. Implementar la preferencia de modo de guardado
Goal: Persistir la elección global entre Fast Forward y Preview Before Save.
Description: Añadir una preferencia por usuario con valor predeterminado explícito y endpoints para leerla y cambiarla. Validar los dos únicos valores admitidos y probar que la preferencia se conserva entre sesiones.

## 18. Registrar correcciones de interpretación
Goal: Conservar la diferencia entre valores interpretados y valores aceptados durante una captura.
Description: Modelar y almacenar correcciones de categoría, fecha, contenido o etiquetas vinculadas a la captura que las originó. Distinguir estas correcciones de ediciones normales posteriores y añadir tests que garanticen que no alteran el contenido final de la entrada.

## 19. Definir el contrato de sincronización
Goal: Especificar un protocolo versionado entre SQLite y PostgreSQL que evite pérdidas silenciosas.
Description: Documentar identificadores, versiones, marcas temporales, estados de borrado, cursores y formatos de petición y respuesta. Incluir ejemplos completos de creación, actualización, eliminación, reintento idempotente y detección de conflicto.

## 20. Implementar el endpoint de envío de cambios
Goal: Aceptar en el servidor cambios locales de forma idempotente.
Description: Crear la operación de sincronización que reciba lotes de altas, modificaciones y eliminaciones con su versión conocida. Aplicar los cambios no conflictivos, rechazar datos inválidos y devolver resultados individuales aptos para reintentos seguros.

## 21. Implementar el endpoint de descarga de cambios
Goal: Entregar al cliente únicamente los cambios posteriores a su último cursor.
Description: Crear una consulta incremental y paginada que incluya altas, modificaciones y eliminaciones relevantes para el usuario. Probar cursores válidos y caducados, páginas consecutivas y ausencia de duplicados u omisiones.

## 22. Implementar la detección y conservación de conflictos
Goal: Evitar que una sincronización sobrescriba cambios divergentes.
Description: Comparar versiones base al aplicar cambios y almacenar ambas variantes cuando servidor y cliente hayan editado el mismo registro. Devolver información suficiente para que la interfaz pueda mostrar y resolver manualmente el conflicto.

## 23. Configurar SQLite en la aplicación Expo
Goal: Disponer de persistencia local funcional en iPhone sin conexión.
Description: Inicializar SQLite con un esquema versionado equivalente a las necesidades locales del dominio y un mecanismo de migraciones. Añadir pruebas para creación, reapertura y actualización de la base de datos local.

## 24. Crear la capa local de categorías y etiquetas
Goal: Consultar y modificar categorías y etiquetas desde SQLite.
Description: Implementar operaciones tipadas de alta, lectura, modificación y eliminación para ambos catálogos. Aplicar localmente las mismas reglas esenciales de unicidad y referencias que en el backend, con pruebas aisladas de persistencia.

## 25. Crear la capa local de entradas y tareas
Goal: Guardar y consultar entradas y tareas completamente offline.
Description: Implementar operaciones tipadas sobre SQLite para crear, listar, filtrar, editar y eliminar entradas, incluidos los campos especiales de tarea. Marcar cada cambio local con los metadatos que posteriormente necesitará la sincronización.

## 26. Construir el formulario manual de entrada
Goal: Crear una entrada rellenando todos sus campos desde la interfaz.
Description: Diseñar una pantalla accesible para seleccionar categoría y fecha, escribir contenido y escoger cero o más etiquetas existentes. Validar los campos, guardar primero en SQLite y mostrar estados claros de éxito y error.

## 27. Construir la gestión de categorías en la interfaz
Goal: Permitir crear y editar categorías desde la aplicación.
Description: Añadir listado y formulario para nombre, comando de voz, descripción, color e icono. Prevenir valores inválidos o duplicados antes de guardar y reflejar los cambios inmediatamente en las pantallas que usan categorías.

## 28. Construir la gestión de etiquetas en la interfaz
Goal: Permitir mantener el catálogo de etiquetas desde la aplicación.
Description: Añadir listado, creación, edición y eliminación con confirmación cuando una etiqueta esté en uso. Facilitar la selección de etiquetas existentes sin permitir texto libre accidental durante la edición de una entrada.

## 29. Implementar el parser de comandos hablados
Goal: Convertir una transcripción delimitada en una entrada estructurada sin IA.
Description: Interpretar el formato Categoría, Fecha, Contenido y Etiquetas, admitiendo que fecha y etiquetas sean opcionales. Crear una batería de tests en español para delimitadores, comandos desconocidos, contenido ambiguo, fechas relativas y errores recuperables.

## 30. Integrar el reconocimiento de voz de iOS
Goal: Obtener una transcripción desde el micrófono del iPhone.
Description: Solicitar permisos, iniciar y detener la captura, mostrar estados de escucha y error, y entregar el texto transcrito al flujo de entrada. No conservar el audio después de la transcripción y documentar las limitaciones de ejecución fuera de iOS.

## 31. Crear el flujo de captura hablada completa
Goal: Registrar una entrada a partir de un único comando de voz estructurado.
Description: Conectar la transcripción con el parser, resolver categoría y etiquetas existentes y mostrar errores que el usuario pueda corregir. Usar la fecha actual cuando corresponda y guardar el resultado en SQLite según el modo de guardado configurado.

## 32. Crear el flujo de captura mixta
Goal: Combinar campos seleccionados manualmente con contenido dictado.
Description: Permitir elegir categoría y fecha en la interfaz y dictar únicamente el contenido, manteniendo disponibles las etiquetas existentes. Asegurar que el resultado sea la misma entidad local que genera la captura manual o hablada.

## 33. Implementar Preview Before Save
Goal: Revisar y corregir una captura interpretada antes de guardarla.
Description: Mostrar categoría, fecha, contenido y etiquetas interpretados en un formulario editable antes de confirmar. Guardar las diferencias como correcciones de interpretación y permitir cancelar sin crear datos residuales.

## 34. Implementar Fast Forward
Goal: Guardar una captura válida inmediatamente con fricción mínima.
Description: Omitir la previsualización cuando la preferencia global sea Fast Forward y persistir primero en SQLite. Mostrar una confirmación breve y ofrecer acceso directo a la entrada para corregirla mediante la edición normal.

## 35. Construir la vista mensual del calendario
Goal: Mostrar las entradas fechadas en la pantalla inicial de la aplicación.
Description: Crear una vista mensual legible que agrupe entradas por día y use el color e icono de su categoría. Resolver la saturación de días con muchas entradas y permitir abrir el detalle sin depender de conectividad.

## 36. Añadir filtros temporales al calendario
Goal: Elegir qué categorías aparecen durante la consulta actual.
Description: Incorporar selección de una o varias categorías, opción para mostrar todas y una acción clara para restablecer el filtro. Mantener el filtro solo durante la sesión de la vista y probar su combinación con el cambio de mes.

## 37. Crear la navegación por categorías y etiquetas
Goal: Localizar información fuera del calendario mediante sus clasificaciones.
Description: Añadir pantallas que listen categorías y etiquetas y abran las entradas asociadas con paginación u otra carga incremental. Mantener colores, iconos y estados vacíos coherentes con el resto de la aplicación.

## 38. Crear el detalle, edición y eliminación de entradas
Goal: Consultar y modificar cualquier entrada guardada desde la aplicación.
Description: Construir una pantalla de detalle con edición de los campos permitidos y eliminación permanente mediante confirmación inequívoca. Persistir las operaciones primero en SQLite y marcarlas para sincronización posterior.

## 39. Crear la pantalla de tareas pendientes
Goal: Gestionar las tareas sin fecha al margen del calendario.
Description: Mostrar tareas pendientes sin fecha, permitir cambiar entre Pendiente, En progreso y Realizada, y abrir su detalle. Actualizar SQLite inmediatamente y representar con claridad los estados vacío, cargando y error.

## 40. Implementar el motor de sincronización del cliente
Goal: Intercambiar cambios entre SQLite y FastAPI sin bloquear el uso de la app.
Description: Enviar cambios locales pendientes, descargar cambios remotos por cursor y actualizar versiones y estados de sincronización de forma transaccional. Añadir reintentos seguros, detección de conectividad y pruebas ante interrupciones en distintos puntos del proceso.

## 41. Crear la resolución manual de conflictos
Goal: Permitir que el usuario elija qué variante conservar tras cambios divergentes.
Description: Mostrar lado a lado los campos locales y remotos de cada conflicto y permitir seleccionar una variante completa o valores por campo. Guardar la resolución como una nueva versión sincronizable sin descartar ninguna variante antes de la confirmación.

## 42. Adaptar los flujos principales a Expo Web
Goal: Usar desde el ordenador las funciones esenciales del MVP.
Description: Verificar y adaptar autenticación, calendario, consulta, creación, edición y eliminación para navegadores de escritorio. En web, acceder a los datos mediante FastAPI y ofrecer mensajes claros cuando el backend privado no esté disponible.

## 43. Preparar el entorno local de FastAPI y PostgreSQL
Goal: Arrancar el backend y la base de datos de manera reproducible en el PC.
Description: Definir la configuración de desarrollo y producción local, persistencia de PostgreSQL, migraciones al iniciar y comprobaciones de salud. Mantener secretos fuera del repositorio y documentar arranque, parada, copia de seguridad y restauración.

## 44. Documentar el acceso privado mediante Tailscale
Goal: Conectar iPhone y PC sin exponer la API públicamente.
Description: Escribir una guía verificable para instalar Tailscale, autorizar ambos dispositivos, configurar la URL de FastAPI y comprobar el acceso. Incluir diagnóstico de errores habituales y dejar explícito que no deben abrirse puertos del router.

## 45. Ejecutar una prueba integral del ciclo fundamental
Goal: Validar de extremo a extremo la hipótesis operativa del MVP.
Description: Automatizar o documentar de forma reproducible un recorrido que capture una entrada offline, la muestre en calendario, la filtre, la edite, la sincronice y finalmente la elimine. Añadir un segundo recorrido para una tarea sin fecha y registrar cualquier limitación conocida antes de dar por terminado el MVP.
