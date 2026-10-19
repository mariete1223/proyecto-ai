### QA Validation Report (Issue #99)

#### Test Results:
- **Status**: PASS
- **Target**: Issue #99 (Mencionar en la descripción inicial de la aplicación la creación de categorías y etiquetas personalizadas)

#### Acceptance Criteria Verification:
1. **Onboarding / Guía de bienvenida (`OnboardingModal.tsx`)**:
   - Status: PASS.
   - Paso 1 destaca la posibilidad de crear categorías y etiquetas a medida.
   - Paso 2 dedicado (`🏷️ CATEGORÍAS Y ETIQUETAS`) explica la creación personalizada con nombres, colores y comandos de voz.
2. **Vista de inicio móvil (`MobileHomeVoiceView.tsx`)**:
   - Status: PASS.
   - El subtítulo principal y la caja informativa en la chuleta de comandos indican que se pueden crear categorías y etiquetas libremente desde el Explorador.
3. **Metadatos web & PWA (`manifest.json`, `index.html`)**:
   - Status: PASS.
   - Descripciones actualizadas correctamente.
4. **Verificación de pruebas automatizadas**:
   - Status: PASS.
   - `npm --prefix frontend run check`:
     - Prettier: 100% OK.
     - ESLint: 100% OK (0 warnings).
     - TypeScript: 100% OK.
     - Jest: 37/37 suites passed (282 tests passed).
   - Backend `pytest`: 119 passed, 5 skipped (0 failures).

#### Recommendation:
Ready to close Issue #99 and merge/push to `main`.
