# Product Specification: Auto-select Today on Entering Calendar (#102)

## 1. Problem Statement & Context
When a user opens or navigates to the Calendar view (`CalendarMonthView`), no date is selected by default (`selectedDayEntries` is `null`).
The user must manually locate and tap on today's cell to check their agenda for the current day.
User explicitly requested:
> "Tambien quiero que automaticamente al entrar en el calendario se muestren las entradas del dia de hoy"

## 2. Functional Requirements
1. **Auto-selection on entering calendar**:
   - When `CalendarMonthView` mounts, if the rendered month corresponds to the current real-time month (which is the default when entering the calendar), today's date (`toLocalDateString()`) must be automatically selected.
   - The entries list for today (`selectedDayEntries`) must be populated with all entries matching today's date key.
   - The detail panel (`day-detail-panel`) must be visible immediately showing today's entries (or the empty state "No hay entradas para este día" if there are none).
   - The day cell for today must receive the `dayCellSelected` visual styling.
2. **User Interaction & Navigational Integrity**:
   - If the user explicitly closes the detail panel via "✕ Cerrar" (`btn-close-day-detail`), the selection should clear and not immediately reappear on background sync signals.
   - If the user clicks on another day in the calendar grid, that day becomes the active selection.
   - If the user navigates to previous or next months, `selectedDayEntries` resets to `null`.
   - If the calendar is opened with an explicit `initialDate` pointing to a different month/year (e.g. past archives), it should not force selection of today unless that month contains today.

## 3. Acceptance Criteria
- [x] Entering the Calendar tab with default current date automatically selects today.
- [x] Today's cell has `dayCellSelected` styling upon initial load.
- [x] Today's entries appear in the detail panel without requiring an initial tap.
- [x] Tapping another day switches the detail panel to that day.
- [x] Closing the panel dismisses it properly.
- [x] Unit test in `CalendarMonthView.test.tsx` validates auto-selection on mount.
