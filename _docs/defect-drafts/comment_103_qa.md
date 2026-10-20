### QA Review & Verification — Issue #103

#### Test Matrix & Results
- **Projection Across Years**:
  - Verified that an entry created in year 2024 with `reminder_recurrence: "YEARLY"` projects properly onto the calendar month view for September 2026.
  - Verified that tapping on September 20, 2026 shows the entry in the day detail panel with title and content.
- **UI & Recurrence Selection**:
  - Verified `ReminderConfigSection` renders `"Anual (todos los años)"` option and toggling updates recurrence state to `YEARLY`.
  - Verified quick reminder drawer in `CalendarMonthView` contains `"Anual"` chip and saves `reminder_recurrence: "YEARLY"` to local DB.
- **Voice Recognition**:
  - Verified `"poner recordatorio anual"` parses to `reminder_recurrence: "YEARLY"`.
- **Backend Push Advancement**:
  - Verified `check_and_send_due_reminders` advances `reminder_time` by 365 days when due for `YEARLY`.
- **Automated Test Results**:
  - `npm --prefix frontend run check`:
    - Prettier: PASSED
    - ESLint: PASSED (0 warnings)
    - TypeScript: PASSED (0 errors)
    - Jest: 38 test suites passed, 296 tests passed (100%)
  - `uv run --directory backend python scripts/check.py`:
    - Code style (ruff format): PASSED
    - Linting (ruff): PASSED
    - Typecheck (mypy): PASSED (67 source files clean)
    - Pytest: 120 passed, 0 failed

#### Verdict
All acceptance criteria met. Ready to close.
