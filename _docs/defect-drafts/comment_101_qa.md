## QA Sign-Off - Issue #101

- [x] Manual verification / UI test: Clicking "⚡ Ahora", "📅 Hoy 18:00", "🌅 Mañana 09:00", and "❌ Sin Fecha" highlights the respective chip with clear active styling (cyan accent for date presets, red accent for clear preset).
- [x] Automated test coverage: `frontend/components/DateTimePicker.test.tsx` tests the active border color on every preset transition.
- [x] Regressions: Full frontend test suite (37 suites, 291 tests) passes without regression.
- [x] Backend consistency: Full backend test suite (124 tests) passes.
- [x] Quality gates: Prettier, ESLint, TypeScript check, Black, Flake8, and Mypy passed.

Status: Approved. Ready to close.
