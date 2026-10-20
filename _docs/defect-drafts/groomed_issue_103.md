# Product Specification: Yearly Recurring Entries Across All Calendar Years (#103)

## 1. Goal
Enable users to create yearly recurring events/entries (e.g. birthdays, anniversaries, annual renewals) with recurrence `"YEARLY"` ("Todos los años"). These entries must appear on the calendar on their matching day and month in any year viewed (past, present, future), and their reminder notifications must advance annually (+1 year).

## 2. Functional Requirements
1. **Recurrence Domain & UI Selection**:
   - `ReminderRecurrence` in `frontend/types/domain.ts` includes `"YEARLY"`.
   - `formatReminderSummary` formats `YEARLY` with `(Anual)`.
   - `ReminderConfigSection` offers an explicit option for "Anual (todos los años)" (`YEARLY`).
   - Quick recurrence options in `CalendarMonthView` include "Anual" (`YEARLY`).
   - Voice editing parser (`voiceEditParser.ts`) detects expressions like "anual", "todos los años", "cada año" and assigns `YEARLY`.
2. **Calendar Projection Across All Years**:
   - In `CalendarMonthView`, entries with `reminder_recurrence === "YEARLY"` are fetched and projected onto the matching day and month of the currently viewed year (past, current, and future years).
   - In the calendar grid, day cells show entry indicators / dots for yearly entries matching that day and month.
   - When a day is selected (including initial auto-select of today or clicking any day), the detail panel displays the projected yearly recurring entry.
3. **Notification Advancement**:
   - In `notificationService.ts`, when rescheduling or calculating the next recurrence, `YEARLY` advances by 1 year (`baseDate.setFullYear(baseDate.getFullYear() + 1)`).
   - In `push_worker.py` (backend), recurring notification advancement handles `YEARLY` appropriately.
4. **Data Layer**:
   - `ListEntryFilters` and `listLocalEntries` in `frontend/db/entries.ts` support `include_yearly?: boolean` so that date-bounded calendar queries also retrieve all yearly entries to be projected.

## 3. Acceptance Criteria
- [ ] In `ReminderConfigSection` and quick reminder recurrence selector, "Anual" / "Todos los años" (`YEARLY`) is available and selectable.
- [ ] Voice commands containing "anual", "todos los años", or "cada año" set recurrence to `YEARLY`.
- [ ] An entry created with `YEARLY` recurrence (e.g. on 2024-05-15) is visible in the calendar grid on May 15 for 2024, 2025, 2026, 2027, etc.
- [ ] Clicking on May 15 in any year displays the yearly entry in the day detail panel.
- [ ] If today's date matches the month/day of a yearly entry, auto-select on calendar open includes this entry in the detail panel.
- [ ] Reminder advancement properly advances by 1 year for `YEARLY` entries.
- [ ] Unit tests in `CalendarMonthView.test.tsx` verify projection of yearly entries across different years.
- [ ] All frontend checks (`npm run check`) and backend checks (`python scripts/check.py`) pass 100%.

## 4. Out of Scope
- Custom leap day (Feb 29) rollover rules (standard JS Date rollover applies).
- New database tables or migration scripts (field is already a string column).

## 5. Constraints
- Zero new third-party dependencies.
- Maintain existing DAILY and WEEKLY recurrence without regressions.
