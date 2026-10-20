## Engineer Implementation Notes - Issue #101

### Cause Analysis
In `frontend/components/DateTimePicker.tsx`, only the `preset-none` ("❌ Sin Fecha") button had conditional styling bound to `!dateStr` with `presetChipActiveDanger`. The preset chips for "⚡ Ahora", "📅 Hoy 18:00", and "🌅 Mañana 09:00" lacked state tracking and active styling, remaining visually unselected upon press.

### Changes
1. Added reactive preset selection state (`activePreset: PresetType`) and matched it against the current date/time to determine if "Ahora", "Hoy 18:00", "Mañana 09:00", or "Sin Fecha" is actively selected.
2. Implemented `presetChipActive` (`borderColor: "#38BDF8"`, `backgroundColor: "rgba(56, 189, 248, 0.2)"`) and active text styling (`presetChipTextActive`) for standard presets, preserving `presetChipActiveDanger` for clearing the date.
3. Added comprehensive automated tests in `frontend/components/DateTimePicker.test.tsx` verifying that pressing each preset chip properly applies its active border styling (`#38BDF8` and `#ef4444`).

### Verification
- `npm --prefix frontend test -- components/DateTimePicker.test.tsx`: 4 passed.
- `npm --prefix frontend run check`: Prettier, ESLint, TypeScript, and 37 test suites passed.
- `uv run --directory backend python scripts/check.py`: Black, Flake8, Mypy, and 124 pytest tests passed.
