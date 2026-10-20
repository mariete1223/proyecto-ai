### Engineer Implementation Report — Issue #103

#### Summary of Changes
1. **Domain Types & Formatting (`frontend/types/domain.ts`)**:
   - Added `"YEARLY"` to `ReminderRecurrence` union type (`"NONE" | "DAILY" | "WEEKLY" | "EVERY_4_HOURS" | "YEARLY"`).
   - Updated `formatReminderSummary` to display ` (Anual)` when recurrence is `YEARLY`.

2. **Database Querying (`frontend/db/entries.ts`)**:
   - Added `include_yearly?: boolean` to `ListEntryFilters`.
   - Updated `listLocalEntries` so date range queries include entries with `reminder_recurrence === "YEARLY"` regardless of original creation year when `include_yearly` is enabled.

3. **Reminder Configuration UI (`frontend/components/ReminderConfigSection.tsx`)**:
   - Added `YEARLY` option with label `"Anual (todos los años)"` and description `"Se repite cada año en la misma fecha"`.
   - Included `"YEARLY"` in `standardRecurrenceValues`.

4. **Calendar Projection & Quick Actions (`frontend/components/CalendarMonthView.tsx`)**:
   - Added `matchesCalendarDate(entry, targetDateStr, currentYear)` helper matching month/day for yearly entries.
   - Project yearly entries into the day mapping for all years viewed (`entriesByDayMap`).
   - Enabled `include_yearly: true` in calendar entry fetching.
   - Added `"Anual"` recurrence chip to the quick reminder editor drawer in the calendar view.
   - Refactored toast handling and unmounted component safety.

5. **Notification Services (`frontend/services/notificationService.ts`)**:
   - Added `YEARLY` handling in `scheduleNextRecurrence`, advancing the target date by 1 year (`baseDate.setFullYear(baseDate.getFullYear() + 1)`).

6. **Voice Edit Parsing (`frontend/services/voiceEditParser.ts`)**:
   - Added regex matching for `anual`, `todos los años`, and `cada año` to set `reminder_recurrence: "YEARLY"`.

7. **Backend Push Notification Worker (`backend/app/services/push_worker.py`)**:
   - Added `elif rec == "YEARLY": delta = timedelta(days=365)` for automatic advancement in both recurrence advancement blocks.

8. **Automated Verification**:
   - Added unit tests in `frontend/components/CalendarMonthViewYearly.test.tsx` verifying projection across years and quick drawer selection.
   - Added unit test in `frontend/components/ReminderConfigSection.test.tsx`.
   - Added unit test in `frontend/services/voiceEditParser.test.ts`.
   - Added unit test in `backend/tests/test_push_api.py`.
   - Quality gates: 296/296 frontend tests passed; 120/120 backend tests passed; formatting, linting, and typecheck clean.
