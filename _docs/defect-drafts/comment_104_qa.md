### QA Review & Sign-off

#### Verification Summary
- **Test Scenarios**:
  - [x] Selecting a Task category in calendar quick-add reveals priority options (`🔴 Alta`, `🟡 Media`, `🔵 Baja`).
  - [x] Selecting `Alta` saves entry into local DB with `task_priority: "HIGH"` and `task_status: "PENDING"`.
  - [x] Selecting a non-task category (`kind === "STANDARD"`) hides the priority selector and stores `task_priority: null`.
  - [x] Selecting "Alerta" automatically marks reminder checkbox active with 0 offset.
  - [x] Submitting form clears fields, resets priority to `MEDIUM`, and dismisses drawer.
- **Suite Results**:
  - `npm test -- CalendarMonthViewQuickAdd.test.tsx`: 3/3 passed.
  - `npm --prefix frontend run check`: 39 suites passed, 299 tests passed.
  - `uv run --directory backend python scripts/check.py`: 120 tests passed, 0 failures.

#### Conclusion
All acceptance criteria specified in the grooming document have been fully met without regression. Ready to close.
