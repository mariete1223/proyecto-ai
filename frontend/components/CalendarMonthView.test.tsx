import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { createLocalCategory } from "../db/categories";
import { MemoryDatabaseAdapter, runMigrations } from "../db/database";
import { createLocalEntry, listLocalEntries } from "../db/entries";
import { createLocalTag } from "../db/tags";
import { notificationService } from "../services/notificationService";
import { CalendarMonthView } from "./CalendarMonthView";

describe("CalendarMonthView Component (Task 35)", () => {
  let db: MemoryDatabaseAdapter;
  const userId = "user-789";
  const refDate = new Date("2026-09-15T12:00:00Z");

  let catId: string;

  beforeEach(async () => {
    db = new MemoryDatabaseAdapter();
    await runMigrations(db);

    const cat = await createLocalCategory(db, userId, {
      name: "Trabajo",
      voice_command: "trabajo",
      color: "#38BDF8",
    });
    catId = cat.id;

    // Create 4 entries on Sept 15 to test saturation (+1 indicator)
    for (let i = 1; i <= 4; i++) {
      await createLocalEntry(db, userId, {
        category_id: catId,
        content: `Entrada del día 15 #${i}`,
        occurred_at: `2026-09-15T10:0${i}:00Z`,
      });
    }
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it("renders month title and day grid with entries and test notification button", async () => {
    const sendSpy = jest
      .spyOn(notificationService, "sendNotification")
      .mockReturnValue(true);
    const permSpy = jest
      .spyOn(notificationService, "getPermissionStatus")
      .mockReturnValue("granted");

    const { getByTestId, getByText } = await render(
      <CalendarMonthView db={db} userId={userId} initialDate={refDate} />,
    );

    await waitFor(() => {
      expect(getByTestId("calendar-month-view")).toBeTruthy();
      expect(getByTestId("calendar-month-title")).toBeTruthy();
      expect(getByText("Septiembre 2026")).toBeTruthy();
      expect(getByTestId("day-cell-2026-09-15")).toBeTruthy();
      expect(getByTestId("btn-test-notification")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-test-notification"));
    });

    expect(sendSpy).toHaveBeenCalledWith(
      "🔔 Agenda AI",
      expect.stringContaining("notificaciones"),
    );

    sendSpy.mockRestore();
    permSpy.mockRestore();
  });

  it("handles day saturation (+1 indicator for >3 entries on same day)", async () => {
    const { getByTestId, getByText } = await render(
      <CalendarMonthView db={db} userId={userId} initialDate={refDate} />,
    );

    await waitFor(() => {
      expect(getByTestId("day-cell-2026-09-15")).toBeTruthy();
      expect(getByText("+1")).toBeTruthy();
    });
  });

  it("navigates to previous and next month", async () => {
    const { getByTestId, getByText } = await render(
      <CalendarMonthView db={db} userId={userId} initialDate={refDate} />,
    );

    await waitFor(() => {
      expect(getByText("Septiembre 2026")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-prev-month"));
    });

    await waitFor(() => {
      expect(getByText("Agosto 2026")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-next-month"));
    });

    await waitFor(() => {
      expect(getByText("Septiembre 2026")).toBeTruthy();
    });
  });

  it("opens day detail panel on day press and selects entry", async () => {
    const onSelectMock = jest.fn();
    const { getByTestId, getByText, findByTestId } = await render(
      <CalendarMonthView
        db={db}
        userId={userId}
        initialDate={refDate}
        onSelectEntry={onSelectMock}
      />,
    );

    await waitFor(() => {
      expect(getByTestId("day-cell-2026-09-15")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("day-cell-2026-09-15"));
    });

    expect(await findByTestId("day-detail-panel")).toBeTruthy();
    expect(getByText("Entradas del 2026-09-15")).toBeTruthy();
    expect(getByText("Entrada del día 15 #1")).toBeTruthy();
  });

  it("renders tags on entry cards in the day detail panel (#54)", async () => {
    const customTag = await createLocalTag(db, userId, {
      name: "Urgente",
      color: "#EC4899",
    });

    const taggedEntry = await createLocalEntry(db, userId, {
      category_id: catId,
      content: "Entrada con etiqueta urgente",
      occurred_at: "2026-09-20T10:00:00Z",
      tag_ids: [customTag.id],
    });

    const { getByTestId, getByText, findByTestId } = await render(
      <CalendarMonthView
        db={db}
        userId={userId}
        initialDate={new Date("2026-09-20T10:00:00Z")}
      />,
    );

    await waitFor(() => {
      expect(getByTestId("day-cell-2026-09-20")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("day-cell-2026-09-20"));
    });

    expect(await findByTestId("day-detail-panel")).toBeTruthy();
    expect(getByTestId(`entry-tags-${taggedEntry.id}`)).toBeTruthy();
    expect(getByTestId(`entry-tag-badge-${customTag.id}`)).toBeTruthy();
    expect(getByText("#Urgente")).toBeTruthy();
  });

  it("shows confirmation and deletes entry from day detail panel", async () => {
    const singleEntry = await createLocalEntry(db, userId, {
      category_id: catId,
      content: "Entrada para ser borrada",
      occurred_at: "2026-09-25T14:00:00Z",
    });

    const onEntryUpdatedMock = jest.fn();
    const { getByTestId, getByText, queryByText, findByTestId } = await render(
      <CalendarMonthView
        db={db}
        userId={userId}
        initialDate={new Date("2026-09-25T12:00:00Z")}
        onEntryUpdated={onEntryUpdatedMock}
      />,
    );

    await waitFor(() => {
      expect(getByTestId("day-cell-2026-09-25")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("day-cell-2026-09-25"));
    });

    expect(await findByTestId("day-detail-panel")).toBeTruthy();
    expect(getByText("Entrada para ser borrada")).toBeTruthy();
    expect(getByTestId(`btn-open-delete-${singleEntry.id}`)).toBeTruthy();

    // 1. Click delete button -> shows confirmation prompt
    await act(async () => {
      fireEvent.press(getByTestId(`btn-open-delete-${singleEntry.id}`));
    });

    expect(getByTestId(`delete-confirm-box-${singleEntry.id}`)).toBeTruthy();
    expect(
      getByText("⚠️ ¿Seguro que quieres borrar esta entrada?"),
    ).toBeTruthy();

    // 2. Click cancel -> hides confirmation prompt
    await act(async () => {
      fireEvent.press(getByTestId(`btn-cancel-delete-${singleEntry.id}`));
    });

    expect(
      queryByText("⚠️ ¿Seguro que quieres borrar esta entrada?"),
    ).toBeNull();

    // 3. Click delete again and confirm
    await act(async () => {
      fireEvent.press(getByTestId(`btn-open-delete-${singleEntry.id}`));
    });
    await act(async () => {
      fireEvent.press(getByTestId(`btn-confirm-delete-${singleEntry.id}`));
    });

    await waitFor(() => {
      expect(queryByText("Entrada para ser borrada")).toBeNull();
      expect(onEntryUpdatedMock).toHaveBeenCalled();
    });
  });

  it("toggles task completion status directly from day detail", async () => {
    const taskCat = await createLocalCategory(db, userId, {
      name: "Tareas",
      voice_command: "tareas",
      color: "#F59E0B",
      kind: "TASK",
    });

    const taskEntry = await createLocalEntry(db, userId, {
      category_id: taskCat.id,
      content: "Terminar informe mensual",
      occurred_at: "2026-09-15T15:00:00Z",
      task_status: "PENDING",
      task_recurrence: "ONCE",
    });

    const onEntryUpdatedMock = jest.fn();
    const { getByTestId, findByTestId } = await render(
      <CalendarMonthView
        db={db}
        userId={userId}
        initialDate={refDate}
        onEntryUpdated={onEntryUpdatedMock}
      />,
    );

    await waitFor(() => {
      expect(getByTestId("day-cell-2026-09-15")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("day-cell-2026-09-15"));
    });

    expect(await findByTestId("day-detail-panel")).toBeTruthy();
    const toggleBtn = getByTestId(`btn-toggle-task-${taskEntry.id}`);
    expect(toggleBtn).toBeTruthy();

    // Toggle to COMPLETED
    await act(async () => {
      fireEvent.press(toggleBtn);
    });

    await waitFor(() => {
      expect(onEntryUpdatedMock).toHaveBeenCalled();
    });
  });

  it("configures and saves quick reminder preset directly from calendar", async () => {
    const reminderEntry = await createLocalEntry(db, userId, {
      category_id: catId,
      content: "Dentista revisión anual",
      occurred_at: "2026-09-15T16:00:00Z",
      reminder_enabled: false,
    });

    const scheduleSpy = jest
      .spyOn(notificationService, "scheduleForEntry")
      .mockImplementation(() => {});
    jest
      .spyOn(notificationService, "getPermissionStatus")
      .mockReturnValue("granted");

    const onEntryUpdatedMock = jest.fn();
    const { getByTestId, findByTestId } = await render(
      <CalendarMonthView
        db={db}
        userId={userId}
        initialDate={refDate}
        onEntryUpdated={onEntryUpdatedMock}
      />,
    );

    await waitFor(() => {
      expect(getByTestId("day-cell-2026-09-15")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("day-cell-2026-09-15"));
    });

    expect(await findByTestId("day-detail-panel")).toBeTruthy();

    // Open quick reminder drawer
    const openReminderBtn = getByTestId(
      `btn-open-quick-reminder-${reminderEntry.id}`,
    );
    await act(async () => {
      fireEvent.press(openReminderBtn);
    });

    // Save reminder
    const saveBtn = getByTestId(`btn-save-reminder-${reminderEntry.id}`);
    await act(async () => {
      fireEvent.press(saveBtn);
    });

    await waitFor(() => {
      expect(scheduleSpy).toHaveBeenCalled();
      expect(onEntryUpdatedMock).toHaveBeenCalled();
    });

    scheduleSpy.mockRestore();
  });

  it("renders reminder bell and HOY pill cleanly in day cell without layout conflict", async () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayStr = `${y}-${m}-${d}`;

    await createLocalEntry(db, userId, {
      category_id: catId,
      content: "Recordatorio importante para hoy",
      occurred_at: today.toISOString(),
      reminder_enabled: true,
      reminder_offset_minutes: 60,
    });

    const { getByTestId, getByText } = await render(
      <CalendarMonthView db={db} userId={userId} initialDate={today} />,
    );

    await waitFor(() => {
      expect(getByTestId("calendar-month-title")).toBeTruthy();
      expect(getByTestId(`day-cell-${todayStr}`)).toBeTruthy();
      expect(getByTestId(`day-has-reminder-${todayStr}`)).toBeTruthy();
      expect(getByText("HOY")).toBeTruthy();
    });
  });

  it("creates a new entry directly on the selected day using inline quick add", async () => {
    const onEntryUpdatedMock = jest.fn();
    const { getByTestId, findByTestId, getByText } = await render(
      <CalendarMonthView
        db={db}
        userId={userId}
        initialDate={refDate}
        onEntryUpdated={onEntryUpdatedMock}
      />,
    );

    await waitFor(() => {
      expect(getByTestId("day-cell-2026-09-15")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("day-cell-2026-09-15"));
    });

    expect(await findByTestId("day-detail-panel")).toBeTruthy();

    // Open quick add form
    const quickAddBtn = getByTestId("btn-open-quick-add");
    await act(async () => {
      fireEvent.press(quickAddBtn);
    });

    expect(getByTestId("quick-add-form-card")).toBeTruthy();

    fireEvent.changeText(
      getByTestId("input-quick-add-title"),
      "Reunión de estrategia",
    );
    fireEvent.changeText(
      getByTestId("input-quick-add-content"),
      "Discutir roadmap del Q4 con el equipo",
    );

    await waitFor(() => {
      expect(getByTestId("input-quick-add-title").props.value).toBe(
        "Reunión de estrategia",
      );
      expect(getByTestId("input-quick-add-content").props.value).toBe(
        "Discutir roadmap del Q4 con el equipo",
      );
    });

    fireEvent.press(getByTestId("btn-submit-quick-add"));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 80));
    });

    expect(onEntryUpdatedMock).toHaveBeenCalled();

    const allEntries = await listLocalEntries(db, userId);
    expect(allEntries.some((e) => e.title === "Reunión de estrategia")).toBe(
      true,
    );
  });
});

