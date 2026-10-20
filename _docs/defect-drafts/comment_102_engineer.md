## Engineer Implementation Notes - Issue #102

### Cause Analysis
In `frontend/components/CalendarMonthView.tsx`, `selectedDayEntries` was initialized to `null`. On initial mount and subsequent data fetches, if `selectedDayEntries` was `null`, the component did not select any date, requiring the user to explicitly tap on a day cell to view entries.

### Changes
1. Added `hasAutoSelectedToday` ref to track initial mount auto-selection.
2. In `fetchData` in `CalendarMonthView.tsx`:
   - If `selectedDayEntries` is currently `null` and `hasAutoSelectedToday` has not fired yet, it checks whether today's local date (`toLocalDateString()`) belongs to the viewed month (`year` and `month`).
   - If true, it automatically populates `selectedDayEntries` with today's date string and today's items.
   - If the user explicitly dismisses the detail panel ("✕ Cerrar"), `hasAutoSelectedToday` remains true so the panel is not unexpectedly reopened on subsequent background sync cycles.
3. Added unit tests in `frontend/components/CalendarMonthView.test.tsx` verifying that entering the calendar view with default / current month automatically displays `day-detail-panel` with today's entries and title, marks today's cell as selected, and closes when requested.

### Verification
- `npx jest components/CalendarMonthView.test.tsx`: 14 passed.
- `npm --prefix frontend run check`: Prettier, ESLint, TypeScript check, and 37 test suites passed.
- `uv run --directory backend python scripts/check.py`: Black, Flake8, Mypy, and 124 pytest tests passed.
