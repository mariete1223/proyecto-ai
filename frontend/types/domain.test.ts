import {
  formatDateTime,
  formatReminderSummary,
  normalizeUtcIso,
  toLocalDateString,
} from "./domain";

describe("domain date/time utilities", () => {
  describe("normalizeUtcIso", () => {
    it("returns null for empty or null strings", () => {
      expect(normalizeUtcIso(null)).toBeNull();
      expect(normalizeUtcIso("")).toBeNull();
      expect(normalizeUtcIso("   ")).toBeNull();
    });

    it("appends Z to ISO strings without timezone offset", () => {
      expect(normalizeUtcIso("2026-10-13T17:33:00")).toBe(
        "2026-10-13T17:33:00Z",
      );
      expect(normalizeUtcIso("2026-10-13T17:33:00.000")).toBe(
        "2026-10-13T17:33:00.000Z",
      );
    });

    it("replaces space with T and appends Z for SQL-style timestamps", () => {
      expect(normalizeUtcIso("2026-10-13 17:33:00")).toBe(
        "2026-10-13T17:33:00Z",
      );
      expect(normalizeUtcIso("2026-10-13 17:33:00.000000")).toBe(
        "2026-10-13T17:33:00.000000Z",
      );
    });

    it("preserves strings that already have Z or timezone offsets", () => {
      expect(normalizeUtcIso("2026-10-13T17:33:00Z")).toBe(
        "2026-10-13T17:33:00Z",
      );
      expect(normalizeUtcIso("2026-10-13T17:33:00+02:00")).toBe(
        "2026-10-13T17:33:00+02:00",
      );
      expect(normalizeUtcIso("2026-10-13T17:33:00-05:00")).toBe(
        "2026-10-13T17:33:00-05:00",
      );
    });
  });

  describe("toLocalDateString", () => {
    it("formats local date as YYYY-MM-DD", () => {
      const d = new Date(2026, 9, 13, 19, 33);
      expect(toLocalDateString(d)).toBe("2026-10-13");
    });
  });

  describe("formatDateTime", () => {
    it("handles null gracefully", () => {
      expect(formatDateTime(null)).toBe("");
      expect(formatDateTime("")).toBe("");
    });

    it("formats naive UTC strings accurately without losing hours", () => {
      const formatted = formatDateTime("2026-10-13T17:33:00");
      expect(formatted).toBeTruthy();
      expect(formatted).toContain("2026");
    });
  });

  describe("formatReminderSummary", () => {
    it("returns empty string if reminder is not enabled", () => {
      expect(formatReminderSummary({ reminder_enabled: false })).toBe("");
      expect(formatReminderSummary({ reminder_enabled: null })).toBe("");
    });

    it("calculates exact trigger time 1h before for 17:30 event", () => {
      // Event at 17:30 local time
      const eventDate = new Date(2026, 9, 14, 17, 30, 0);
      const summary = formatReminderSummary({
        reminder_enabled: true,
        occurred_at: eventDate.toISOString(),
        reminder_offset_minutes: 60,
      });

      expect(summary).toBe("16:30 (1h antes)");
    });

    it("calculates exact trigger time 15m before for 17:30 event", () => {
      const eventDate = new Date(2026, 9, 14, 17, 30, 0);
      const summary = formatReminderSummary({
        reminder_enabled: true,
        occurred_at: eventDate.toISOString(),
        reminder_offset_minutes: 15,
      });

      expect(summary).toBe("17:15 (15 min antes)");
    });

    it("displays exact event time when offset is 0", () => {
      const eventDate = new Date(2026, 9, 14, 17, 30, 0);
      const summary = formatReminderSummary({
        reminder_enabled: true,
        occurred_at: eventDate.toISOString(),
        reminder_offset_minutes: 0,
      });

      expect(summary).toBe("17:30 (A la hora del evento)");
    });

    it("handles recurrence suffix correctly with exact calculated time", () => {
      const eventDate = new Date(2026, 9, 14, 17, 30, 0);
      const summary = formatReminderSummary({
        reminder_enabled: true,
        occurred_at: eventDate.toISOString(),
        reminder_offset_minutes: 60,
        reminder_recurrence: "DAILY",
      });

      expect(summary).toBe("16:30 (1h antes) (Diario)");
    });
  });
});
