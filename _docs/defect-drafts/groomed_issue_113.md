## Goal

Optimizar la experiencia de usuario en la autenticación permitiendo el uso offline automático cuando no hay conexión, fusionando los datos locales al iniciar sesión, y estructurando el ciclo de verificación de email: mostrar ventana de verificación tras el registro (cerrable libremente) y volver a desplegar la ventana de verificación automáticamente si el usuario intenta iniciar sesión con una cuenta aún no verificada.

## Acceptance criteria

- [ ] Si el cliente no tiene conexión a internet o el backend no responde (`checkBackendHealth` es false), la aplicación entra automáticamente en modo offline/invitado (`userId = "user-demo-123"`) sin bloquear la pantalla con un modal obligatorio.
- [ ] Si hay conexión con el backend y no hay sesión activa, la app muestra la pantalla/modal de autenticación.
- [ ] Al registrar un nuevo usuario con éxito, se transiciona automáticamente a la ventana/formulario de verificación ("verify") solicitando el token de verificación recibido por email.
- [ ] La ventana/formulario de verificación permite al usuario cerrarla o volver atrás si no desea verificar en ese instante.
- [ ] Si un usuario intenta iniciar sesión y el backend indica que la cuenta no está verificada (HTTP 403 / "not verified"), la interfaz transiciona automáticamente a la vista de verificación con un mensaje claro para que introduzca el código y no le permite iniciar sesión hasta que esté verificada.
- [ ] Cuando el usuario introduce el token y completa la verificación con éxito, se confirma la activación y se le invita/permite acceder.
- [ ] Al iniciar sesión con éxito con una cuenta verificada, todas las notas, categorías, tags y tareas creadas previamente en modo invitado (`user-demo-123`) se transfieren y fusionan automáticamente a la cuenta del usuario (`session.userId`) y se sincronizan con el backend.

## Out of scope

- Autenticación federada mediante OAuth2 / Google / Apple.
- Envío de SMS para doble factor de autenticación.

## Constraints

- Cambios concentrados en `frontend/components/AuthScreen.tsx`, `frontend/components/AuthModal.tsx` y `frontend/App.tsx`.
- Mantener intacto el contrato de endpoints en `backend/app/api/v1/auth.py`.
- Ninguna nueva dependencia externa.
- Cumplimiento de `npm run check` en frontend y `uv run pytest` en backend.
