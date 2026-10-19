## Goal

Hacer que el botón 'Regrabar' (`reRecordBtn` y `quickRerecordBtn`) en `VoiceCaptureFlow.tsx` tenga un color de fondo 100% opaco y sólido en lugar de translúcido (`rgba`), proporcionando un contraste nítido y alta legibilidad sobre el fondo oscuro de la interfaz.

## Acceptance criteria

- [ ] En `VoiceCaptureFlow.tsx`:
  - `reRecordBtn` utiliza un color de fondo opaco (sólido) `#0284C7` (o azul corporativo de alto contraste), borde `#38BDF8` o similar, y texto en blanco `#FFFFFF` con `fontWeight: "bold"`.
  - `quickRerecordBtn` utiliza un color de fondo opaco sólido compatible (`#0284C7` o `#4F46E5`) con texto `#FFFFFF`, garantizando que ambos botones de regrabación sean plenamente opacos y visibles.
- [ ] Pruebas unitarias de frontend (`VoiceCaptureFlow.test.tsx`) verificando los estilos actualizados y pasando la suite completa (`npm run check`).

## Out of scope

- Modificaciones en la lógica de reconocimiento o procesamiento de voz.
- Cambios en el botón 'Guardar' o en otros componentes.

## Constraints

- Modificar solo `frontend/components/VoiceCaptureFlow.tsx` y pruebas asociadas.
- Mantener la suite de frontend con el 100% de tests pasando.
- No añadir dependencias en `package.json`.
