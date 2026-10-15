---
fingerprint: categories-project-cannot-delete
status: published
github_issue: https://github.com/mariete1223/proyecto-ai/issues/50
first_seen: 2026-10-11
last_seen: 2026-10-11
---

# Defect: la categoría Proyecto no se puede eliminar

## Observed behaviour

El usuario pulsa la opción de borrar de la categoría «Proyecto» y la categoría no queda eliminada.

## Expected behaviour

Tras confirmar el borrado, la categoría debería desaparecer y permanecer eliminada, o la interfaz debería explicar claramente que se trata de una categoría obligatoria que no puede borrarse.

## Reproduction

1. Abrir la gestión de categorías con la categoría «Proyecto» presente.
2. Pulsar la opción para borrarla.
3. Observar que no se elimina.

Frequency: reproducible after synchronization

## Environment

- Client: web
- Device or browser: navegador de escritorio; versión no facilitada
- Backend or build: backend local y frontend de desarrollo

## Evidence

- Reporte del usuario en conversación del 2026-10-11: «le he dado borrar a la categoria proyecto y no me deja».
- Captura posterior aportada en la conversación: conflicto `CATEGORY #994777f6-09d3-4ef9-876a-3b29d09d5fa4`, versión local «Proyectos» v5, versión remota sin contenido y motivo `Entity was deleted on server.`

## Triage

- Classification: confirmed
- Impact: impide gestionar o eliminar una categoría visible desde la interfaz
- Facts:
  - La interfaz ofrece una acción de borrado para la categoría activa.
  - La capa local contiene una operación de borrado que reasigna las entradas asociadas antes de eliminar la categoría.
  - `App.tsx` trata «Proyectos» como una de cuatro categorías canónicas que deben existir siempre y la vuelve a crear cuando falta durante la inicialización y la sincronización.
- Hypotheses:
  - La recreación canónica antes y después de sincronizar es la causa del regreso de la categoría borrada.
- Missing information: none required for initial confirmation
- Possible duplicates checked:
  - Issues abiertas y cerradas de GitHub buscadas por borrado/eliminación de categorías; no se encontró un síntoma equivalente.
  - `_docs/defect-drafts/` revisado; no existe un borrador equivalente.

## Publication history

- 2026-10-11: borrador local creado como `needs-triage` mientras se concreta el resultado visible; no se publica todavía como issue confirmada.
- 2026-10-11: la captura del conflicto confirmó el cliente web, el UUID canónico y el borrado remoto; publicado como GitHub issue #50.
