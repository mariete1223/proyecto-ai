import { notificationService } from "./notificationService";
import { Entry } from "../types/domain";

describe("NotificationService", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("handles permissions and support checks gracefully", () => {
    expect(typeof notificationService.isSupported()).toBe("boolean");
    expect(["granted", "denied", "default", "unsupported"]).toContain(
      notificationService.getPermissionStatus(),
    );
  });

  it("cancels active notification without error", () => {
    expect(() => {
      notificationService.cancelNotification("non-existent-id");
    }).not.toThrow();
  });

  it("does not schedule notification if reminder_enabled is false", () => {
    const entry: Entry = {
      id: "entry-1",
      user_id: "user-1",
      category_id: "cat-1",
      content: "No reminder entry",
      reminder_enabled: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
    };

    expect(() => {
      notificationService.scheduleForEntry(entry);
    }).not.toThrow();
  });

  it("returns false from subscribeToWebPush if baseUrl or token is missing", async () => {
    const result = await notificationService.subscribeToWebPush("", "");
    expect(result).toBe(false);
  });

  it("does not fire duplicate local notification when reminder time has elapsed (in the past)", () => {
    const sendSpy = jest.spyOn(notificationService, "sendNotification");
    const pastEntry: Entry = {
      id: "past-entry-1",
      user_id: "user-1",
      category_id: "cat-1",
      content: "Past reminder that was already handled by Web Push",
      reminder_enabled: true,
      reminder_time: new Date(Date.now() - 15000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
    };

    notificationService.scheduleForEntry(pastEntry);
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("schedules reminder subtracting reminder_offset_minutes from event time", () => {
    const setTimeoutSpy = jest.spyOn(window, "setTimeout");
    const now = Date.now();
    // Event is 2 hours (120 mins) in future, offset is 60 mins -> diffMs should be ~60 mins (3600000ms), NOT 120 mins
    const eventTime = new Date(now + 120 * 60 * 1000).toISOString();

    const entry: Entry = {
      id: "offset-entry-1",
      user_id: "user-1",
      category_id: "cat-1",
      content: "Evento a las 17:30 con aviso 1h antes",
      reminder_enabled: true,
      occurred_at: eventTime,
      reminder_time: eventTime, // Form may populate reminder_time with eventTime
      reminder_offset_minutes: 60,
      reminder_recurrence: "NONE",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
    };

    notificationService.scheduleForEntry(entry);

    expect(setTimeoutSpy).toHaveBeenCalled();
    const delayArg = setTimeoutSpy.mock.calls[setTimeoutSpy.mock.calls.length - 1][1];
    // Delay should be approximately 60 mins (3,600,000 ms), with tolerance of 5000 ms
    expect(delayArg).toBeGreaterThan(3590000);
    expect(delayArg).toBeLessThan(3610000);

    notificationService.cancelNotification(entry.id);
  });

  it("advances reminder by X hours when recurrence is EVERY_X_HOURS", () => {
    const setTimeoutSpy = jest.spyOn(window, "setTimeout");
    const now = Date.now();
    const pastTime = new Date(now - 1000).toISOString();
    const entry: Entry = {
      id: "hourly-rec-entry",
      user_id: "user-1",
      category_id: "cat-1",
      content: "Recordatorio periódico cada 4 horas",
      reminder_enabled: true,
      occurred_at: pastTime,
      reminder_time: pastTime,
      reminder_offset_minutes: 0,
      reminder_recurrence: "EVERY_4_HOURS",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
    };

    notificationService.scheduleForEntry(entry);

    expect(setTimeoutSpy).toHaveBeenCalled();
    const lastCall = setTimeoutSpy.mock.calls[setTimeoutSpy.mock.calls.length - 1];
    const delayArg = lastCall[1];
    // Next recurrence should be in ~4 hours (14,400,000 ms)
    expect(delayArg).toBeGreaterThan(14390000);
    expect(delayArg).toBeLessThan(14410000);

    notificationService.cancelNotification(entry.id);
  });

  it("stops recurrence if next cycle exceeds reminder_end_time", () => {
    const setTimeoutSpy = jest.spyOn(window, "setTimeout");
    const now = Date.now();
    const pastTime = new Date(now - 1000).toISOString();
    // End time was in the past or immediately after pastTime (e.g. +1 hour), but cycle is 4 hours
    const endTime = new Date(now + 60 * 60 * 1000).toISOString();

    const entry: Entry = {
      id: "hourly-cutoff-entry",
      user_id: "user-1",
      category_id: "cat-1",
      content: "Recordatorio con fecha fin",
      reminder_enabled: true,
      occurred_at: pastTime,
      reminder_time: pastTime,
      reminder_end_time: endTime,
      reminder_offset_minutes: 0,
      reminder_recurrence: "EVERY_4_HOURS",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
    };

    const initialCalls = setTimeoutSpy.mock.calls.length;
    notificationService.scheduleForEntry(entry);
    // Should NOT schedule a new timer because pastTime + 4h > endTime
    expect(setTimeoutSpy.mock.calls.length).toBe(initialCalls);
  });
});

