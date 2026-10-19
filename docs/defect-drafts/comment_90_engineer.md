### Software Engineer Implementation Report: Issue #90

#### Summary of Changes

1. **Discarded Suspended / Delayed Local Timers**:
   - In `frontend/services/notificationService.ts` (`scheduleForEntry`): Added background suspension detection.
   - When the `window.setTimeout` callback executes, it checks `Date.now() - targetDate.getTime()`.
   - If the callback fires late (`> 5000 ms`), it indicates the device or browser was suspended/asleep in background when the reminder was due, during which the backend `push_worker.py` already delivered the Web Push notification to the lock screen.
   - In this case, `sendNotification` is bypassed entirely, eliminating duplicate local popups and chime sounds upon entering the app, while properly advancing recurring reminders if configured.

2. **Unified Notification Tag Across Frontend and Backend**:
   - In `frontend/services/notificationService.ts`: Added optional `tag?: string` parameter to `sendNotification()`, passing `entry-reminder-${entry.id}` from `scheduleForEntry`.
   - In `backend/app/services/push_worker.py`: Ensured Web Push payload contains `tag: f"entry-reminder-{entry.id}"` and explicit `entry_id: entry.id`.
   - Coordinated tags ensure native OS notification centers coalesce and update notifications instead of stacking duplicate alerts.

3. **Client-Worker Synchronization and LocalStorage Persistence**:
   - In `frontend/services/notificationService.ts`:
     - Initialized `notifiedEntryIds` from `localStorage` (`agenda_notified_reminders`) and persisted on each reminder delivery, ensuring cross-session and cross-reload deduplication.
     - Added `serviceWorker` message listener to process `PUSH_DELIVERED` events.
   - In `frontend/public/sw.js`:
     - Upon receiving a `push` event, broadcasts `PUSH_DELIVERED` with `tag` and `entryId` to all active client windows.

4. **Testing and Verification**:
   - In `frontend/services/notificationService.test.ts`:
     - Added dedicated unit tests under `Issue #90: Duplicate notification prevention on app open/resume`.
     - Verified timely timer execution (`<= 5000ms delay`) triggers `sendNotification` with `entry-reminder-${id}` tag.
     - Verified late timer execution (`> 5000ms delay`) discards local `sendNotification` completely.
     - Verified `localStorage` deduplication skips already notified reminders across reloads.
   - `npm --prefix frontend run check`: Prettier clean, ESLint clean (0 warnings), TypeScript clean (0 errors), 37 test suites passed (269 tests).
   - Backend `pytest`: 117 passed, 5 skipped.
