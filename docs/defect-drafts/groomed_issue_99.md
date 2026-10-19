## Goal

Mencionar explícitamente en la descripción inicial y guía de bienvenida de la aplicación que el usuario puede crear todas las categorías y etiquetas que necesite para organizar sus notas, tareas y eventos a su medida.

## Acceptance criteria

- [ ] En `OnboardingModal.tsx`:
  - En la descripción inicial del tutorial de bienvenida (`ONBOARDING_STEPS`), indicar claramente que se pueden crear y personalizar todas las categorías y etiquetas necesarias.
  - Añadir un paso dedicado o enriquecer los pasos clave con `🏷️ CATEGORÍAS Y ETIQUETAS`, explicando la creación ilimitada de categorías con comandos de voz propios, colores y etiquetas para clasificar la información libremente.
- [ ] En `MobileHomeVoiceView.tsx`:
  - En la vista inicial de voz y en su tarjeta de chuleta/comandos, añadir una nota clara informando al usuario de que puede crear las categorías y etiquetas que necesite desde el Explorador.
- [ ] En `manifest.json` e `index.html`:
  - Actualizar la descripción de la aplicación para incluir la creación y personalización de categorías y etiquetas.
- [ ] Pruebas unitarias actualizadas en `OnboardingModal.test.tsx` verificando la presencia de las descripciones actualizadas y navegación de pasos.
- [ ] Verificación completa con `npm run check` pasando al 100% (Prettier, ESLint, TypeScript, Jest).

## Out of scope

- Modificar la lógica interna de creación o almacenamiento de categorías y etiquetas en la base de datos (ya funciona correctamente en CategoryManager y TagManager).

## Constraints

- Mantener la coherencia estética con el sistema de diseño oscuro de la aplicación.
- No añadir librerías externas.
