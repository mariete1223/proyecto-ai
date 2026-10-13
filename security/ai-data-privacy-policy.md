# Política de Privacidad de Datos y Uso de Inteligencia Artificial

**Fecha de entrada en vigor:** Octubre 2026  
**Proyecto:** Proyecto AI — Asistente Personal de Memoria y Organización

---

## 1. Compromiso de Privacidad
Proyecto AI es una herramienta de memoria personal diseñada bajo el principio de **mínima exposición de datos** (*privacy-by-design*). Reconocemos que el diario de vida, notas personales y tareas de un usuario contienen información íntima y confidencial.

## 2. Tratamiento de Datos de Voz y Audio
- **Procesamiento en el dispositivo:** La captura de voz se apoya en las interfaces de reconocimiento de voz nativas del cliente (Web Speech API).
- **Cero almacenamiento de audio en la nube:** Los archivos de audio en bruto no se graban ni se transmiten a servidores remotos para almacenamiento persistente.
- **Extracción de texto efímera:** Una vez que la voz se convierte a texto en el cliente, el flujo de audio se libera inmediatamente de la memoria.

## 3. Almacenamiento y Persistencia (*Offline-First*)
- **Base de datos local prioritaria:** Todos los registros, categorías, fechas y etiquetas se guardan en la base de datos local SQLite del dispositivo (`expo-sqlite` / almacenamiento del navegador).
- **Sincronización opcional:** La sincronización con el servidor remoto FastAPI / PostgreSQL es controlada por el usuario y viaja exclusivamente a través de conexiones cifradas (HTTPS/TLS).

## 4. Uso de Modelos de Inteligencia Artificial
- Los datos personales del usuario **no se utilizan para entrenar, reentrenar ni ajustar modelos de lenguaje (LLMs)**.
- Cualquier procesamiento semántico guiado por IA se realiza de forma puntual y transitoria conforme a los esquemas estrictos descritos en [`docs/llm_structuring_prompt.md`](../docs/llm_structuring_prompt.md).

## 5. Derechos del Usuario
- El usuario puede exportar, modificar o eliminar permanentemente cualquier entrada, categoría o etiqueta en cualquier momento, reflejándose inmediatamente tanto en local como mediante lápidas (*tombstones*) en el servidor remoto.
