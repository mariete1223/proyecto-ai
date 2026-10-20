### Engineer Implementation Report

#### Root Cause Analysis
In `CalendarMonthView.tsx`, the inline day quick-add drawer (`showQuickAddForm`) only handled generic properties and hardcoded `task_priority: isTask ? "MEDIUM" : null` without exposing any UI chip controls to the user to choose priority (`HIGH`, `MEDIUM`, `LOW`). In addition, selecting the "Alerta" category did not automatically enable the reminder checkbox or configure default immediate notification offset, requiring extra manual taps.

#### Key Changes
1. **Priority Selector for Tasks**:
   - Added state `quickAddPriority` initialized to `"MEDIUM"`.
   - Rendered priority chips (`🔴 Alta`, `🟡 Media`, `🔵 Baja`) in the quick add form whenever the selected category is of kind `TASK` (and not an alert).
   - In `handleQuickCreateEntry`, passed `task_priority: isTask ? quickAddPriority : null`.
   - Reset `quickAddPriority` back to `"MEDIUM"` upon entry creation.
2. **Auto-Reminder for Alerta Category**:
   - Added `isCategoryAlert` helper detecting alert category by id (`c3d4e5f6-a7b8-4901-c2d3-e4f5a6b7c8d9`), name, or normalized voice command.
   - When opening manual quick-add or clicking category chips, if the category is an Alert, automatically set `quickAddReminderEnabled = true` and `quickAddReminderOffset = 0`.
   - If switching from Alert to a non-alert category, automatically turn off reminder to prevent unwanted push notifications.
3. **Automated Testing**:
   - Created `frontend/components/CalendarMonthViewQuickAdd.test.tsx` verifying priority selector rendering, choosing Alta (`HIGH`), auto-alert reminder toggle, and DB persistence.

#### Verification
- `npm test -- CalendarMonthViewQuickAdd.test.tsx` (3 passed).
- `npm --prefix frontend run check` (39 test suites passed, 299 tests passed, 0 errors).
- `uv run --directory backend python scripts/check.py` (formatting, ruff, mypy, 120 tests passed).
