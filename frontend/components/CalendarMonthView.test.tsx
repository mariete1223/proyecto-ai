import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
import React from "react";
import { StyleSheet } from "react-native";
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

  afterEach(async () => {
    cleanup();
    jest.restoreAllMocks();
    await new Promise((r) => setTimeout(r, 70));
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

  it("handles day saturation (+2 indicator for 4 entries on same day)", async () => {
    const { getByTestId, getByText } = await render(
      <CalendarMonthView db={db} userId={userId} initialDate={refDate} />,
    );

    await waitFor(() => {
      expect(getByTestId("day-cell-2026-09-15")).toBeTruthy();
      expect(getByTestId("day-extra-count-2026-09-15")).toBeTruthy();
      expect(getByText("+2")).toBeTruthy();
    });
  });

  it("limits visible entry dots to 2 and shows correct +X indicator dynamically", async () => {
    // Add 1 entry to Sept 10 (1 entry -> 1 dot, no extra count)
    await createLocalEntry(db, userId, {
      category_id: catId,
      content: "Solo una entrada",
      occurred_at: "2026-09-10T10:00:00Z",
    });

    // Add 2 entries to Sept 11 (2 entries -> 2 dots, no extra count)
    await createLocalEntry(db, userId, {
      category_id: catId,
      content: "Entrada 1 en día 11",
      occurred_at: "2026-09-11T10:00:00Z",
    });
    await createLocalEntry(db, userId, {
      category_id: catId,
      content: "Entrada 2 en día 11",
      occurred_at: "2026-09-11T11:00:00Z",
    });

    // Add 3 entries to Sept 12 (3 entries -> 2 dots + +1)
    for (let i = 1; i <= 3; i++) {
      await createLocalEntry(db, userId, {
        category_id: catId,
        content: `Entrada ${i} en día 12`,
        occurred_at: `2026-09-12T10:0${i}:00Z`,
      });
    }

    // Add 5 entries to Sept 13 (5 entries -> 2 dots + +3)
    for (let i = 1; i <= 5; i++) {
      await createLocalEntry(db, userId, {
        category_id: catId,
        content: `Entrada ${i} en día 13`,
        occurred_at: `2026-09-13T10:0${i}:00Z`,
      });
    }

    const { getByTestId, queryByTestId } = await render(
      <CalendarMonthView db={db} userId={userId} initialDate={refDate} />,
    );

    await waitFor(() => {
      // 1 entry: day-cell-2026-09-10 should NOT have extra count badge
      expect(getByTestId("day-cell-2026-09-10")).toBeTruthy();
      expect(queryByTestId("day-extra-count-2026-09-10")).toBeNull();

      // 2 entries: day-cell-2026-09-11 should NOT have extra count badge
      expect(getByTestId("day-cell-2026-09-11")).toBeTruthy();
      expect(queryByTestId("day-extra-count-2026-09-11")).toBeNull();

      // 3 entries: day-cell-2026-09-12 should show +1
      expect(getByTestId("day-extra-count-2026-09-12")).toBeTruthy();
      expect(getByTestId("day-extra-count-2026-09-12").props.children).toBe(
        "+1",
      );

      // 5 entries: day-cell-2026-09-13 should show +3
      expect(getByTestId("day-extra-count-2026-09-13")).toBeTruthy();
      expect(getByTestId("day-extra-count-2026-09-13").props.children).toBe(
        "+3",
      );
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

  it("provides voice dictation option and unified close action in day detail (#87)", async () => {
    const { getByTestId, findByTestId, getByText, queryByText } = await render(
      <CalendarMonthView db={db} userId={userId} initialDate={refDate} />,
    );

    await waitFor(() => {
      expect(getByTestId("day-cell-2026-09-15")).toBeTruthy();
    });

    fireEvent.press(getByTestId("day-cell-2026-09-15"));
    expect(await findByTestId("day-detail-panel")).toBeTruthy();

    // Verify presence of Manual, Dictar, and a single Cerrar button
    expect(getByTestId("btn-open-quick-add")).toBeTruthy();
    expect(getByText("✍️ Manual")).toBeTruthy();
    expect(getByTestId("btn-quick-voice-add")).toBeTruthy();
    expect(getByText("🎙️ Dictar")).toBeTruthy();
    expect(getByTestId("btn-close-day-detail")).toBeTruthy();
    expect(getByText("✕ Cerrar")).toBeTruthy();

    // Verify absence of confusing duplicate Cancelar button in the header (#87)
    expect(queryByText("✕ Cancelar")).toBeNull();

    // Open quick voice flow for the day
    await act(async () => {
      fireEvent.press(getByTestId("btn-quick-voice-add"));
    });
    expect(await findByTestId("quick-voice-card")).toBeTruthy();
    expect(getByText(/Dictar para el 2026-09-15/)).toBeTruthy();

    // Settle catalog loading microtasks
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });

    // Header still has only a single Cerrar button
    expect(queryByText("✕ Cancelar")).toBeNull();

    // Close day detail
    await act(async () => {
      fireEvent.press(getByTestId("btn-close-day-detail"));
    });
    await waitFor(() => {
      expect(queryByText(/Entradas del 2026-09-15/)).toBeNull();
    });
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
    const futureDate = new Date(Date.now() + 86400000 * 3);
    const futureIso = futureDate.toISOString();
    const dateKey = futureIso.slice(0, 10);

    const reminderEntry = await createLocalEntry(db, userId, {
      category_id: catId,
      content: "Dentista revisión anual",
      occurred_at: futureIso,
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
        initialDate={futureDate}
        onEntryUpdated={onEntryUpdatedMock}
      />,
    );

    await waitFor(() => {
      expect(getByTestId(`day-cell-${dateKey}`)).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId(`day-cell-${dateKey}`));
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

    // Reminder on today (stays on today's date regardless of test execution hour)
    const todayReminderTime = new Date(today);
    todayReminderTime.setHours(today.getHours(), today.getMinutes() + 5, 0, 0);
    // If setting +5 minutes rolled to next day (e.g. at 23:58), clamp to 23:59 today
    if (todayReminderTime.getDate() !== today.getDate()) {
      todayReminderTime.setDate(today.getDate());
      todayReminderTime.setHours(23, 59, 0, 0);
    }
    await createLocalEntry(db, userId, {
      category_id: catId,
      content: "Recordatorio importante para hoy",
      occurred_at: todayReminderTime.toISOString(),
      reminder_enabled: true,
      reminder_offset_minutes: 0,
    });

    // Reminder on another regular day in the current month (e.g. tomorrow or end of month in future)
    const otherDay = new Date(today);
    otherDay.setDate(
      today.getDate() >= 25 ? today.getDate() - 2 : today.getDate() + 2,
    );
    // Ensure otherDay is set into future relative to now for pending bell test
    const futureDay = new Date(today.getTime() + 24 * 3600 * 1000);
    if (futureDay.getMonth() !== today.getMonth()) {
      futureDay.setDate(1);
    }
    const otherY = futureDay.getFullYear();
    const otherM = String(futureDay.getMonth() + 1).padStart(2, "0");
    const otherD = String(futureDay.getDate()).padStart(2, "0");
    const otherDayStr = `${otherY}-${otherM}-${otherD}`;

    await createLocalEntry(db, userId, {
      category_id: catId,
      content: "Recordatorio en otro día",
      occurred_at: futureDay.toISOString(),
      reminder_enabled: true,
      reminder_offset_minutes: 0,
    });

    const { getByTestId, getByText } = await render(
      <CalendarMonthView db={db} userId={userId} initialDate={today} />,
    );

    await waitFor(() => {
      expect(getByTestId("calendar-month-title")).toBeTruthy();
      expect(getByTestId(`day-cell-${todayStr}`)).toBeTruthy();
      expect(getByTestId(`day-has-reminder-${todayStr}`)).toBeTruthy();
      expect(getByText("HOY")).toBeTruthy();

      // Today cell deconflicts bell by positioning on top-left (left: 2)
      const todayBellStyle = StyleSheet.flatten(
        getByTestId(`day-has-reminder-${todayStr}`).props.style,
      );
      expect(todayBellStyle.left).toBe(2);
      expect(todayBellStyle.right).toBeUndefined();

      // Regular day positions bell on top-right (right: 2)
      expect(getByTestId(`day-has-reminder-${otherDayStr}`)).toBeTruthy();
      const regularBellStyle = StyleSheet.flatten(
        getByTestId(`day-has-reminder-${otherDayStr}`).props.style,
      );
      expect(regularBellStyle.right).toBe(2);
      expect(regularBellStyle.left).toBeUndefined();
    });
  });

  it("renders a task created for today in the today cell and detail panel", async () => {
    const taskCat = await createLocalCategory(db, userId, {
      name: "Tareas",
      voice_command: "tarea",
      color: "#F59E0B",
      kind: "TASK",
    });

    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayStr = `${y}-${m}-${d}`;

    const createdTask = await createLocalEntry(db, userId, {
      category_id: taskCat.id,
      content: "Comprar leche para el desayuno",
      occurred_at: today.toISOString(),
      task_status: "PENDING",
      task_recurrence: "ONCE",
      task_priority: "HIGH",
    });

    const { getByTestId, findByTestId, getByText } = await render(
      <CalendarMonthView db={db} userId={userId} initialDate={today} />,
    );

    await waitFor(() => {
      expect(getByTestId(`day-cell-${todayStr}`)).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId(`day-cell-${todayStr}`));
    });

    expect(await findByTestId("day-detail-panel")).toBeTruthy();
    expect(getByText("Comprar leche para el desayuno")).toBeTruthy();
    expect(getByTestId(`btn-toggle-task-${createdTask.id}`)).toBeTruthy();
  });

  it("automatically displays today's entries when opening/entering calendar view (#102)", async () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayStr = `${y}-${m}-${d}`;

    await createLocalEntry(db, userId, {
      category_id: catId,
      title: "Reunión de Hoy Automática",
      content: "Contenido para validar auto-selección de hoy",
      occurred_at: today.toISOString(),
    });

    const { getByTestId, getByText, queryByTestId } = await render(
      <CalendarMonthView db={db} userId={userId} initialDate={today} />,
    );

    await waitFor(() => {
      expect(getByTestId(`day-cell-${todayStr}`)).toBeTruthy();
      expect(getByTestId("day-detail-panel")).toBeTruthy();
      expect(getByText(`Entradas del ${todayStr}`)).toBeTruthy();
      expect(getByText(/Reunión de Hoy Automática/)).toBeTruthy();
      expect(
        getByText("Contenido para validar auto-selección de hoy"),
      ).toBeTruthy();
    });

    // Verify today's cell is marked selected
    const todayCell = getByTestId(`day-cell-${todayStr}`);
    expect(todayCell).toBeTruthy();

    // Close button dismisses detail panel
    fireEvent.press(getByTestId("btn-close-day-detail"));
    await waitFor(() => {
      expect(queryByTestId("day-detail-panel")).toBeNull();
    });
  });

  it("creates a new entry directly on the selected day using inline quick add", async () => {
    const onEntryUpdatedMock = jest.fn();
    const { getByTestId, queryByTestId, getByText } = await render(
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
    await waitFor(() => {
      expect(getByTestId("day-detail-panel")).toBeTruthy();
    });

    // Open quick add form
    const quickAddBtn = getByTestId("btn-open-quick-add");
    await act(async () => {
      fireEvent.press(quickAddBtn);
    });

    await waitFor(() => {
      expect(getByTestId("quick-add-form-card")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.changeText(
        getByTestId("input-quick-add-title"),
        "Reunión de estrategia",
      );
      fireEvent.changeText(
        getByTestId("input-quick-add-content"),
        "Discutir roadmap del Q4 con el equipo",
      );
    });

    await waitFor(() => {
      expect(getByTestId("input-quick-add-title").props.value).toBe(
        "Reunión de estrategia",
      );
      expect(getByTestId("input-quick-add-content").props.value).toBe(
        "Discutir roadmap del Q4 con el equipo",
      );
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-submit-quick-add"));
    });

    await waitFor(() => {
      expect(onEntryUpdatedMock).toHaveBeenCalled();
      expect(queryByTestId("quick-add-form-card")).toBeNull();
      expect(getByText(/Reunión de estrategia/)).toBeTruthy();
    });

    const allEntries = await listLocalEntries(db, userId);
    expect(allEntries.some((e) => e.title === "Reunión de estrategia")).toBe(
      true,
    );
  });

  it("automatically opens and selects the day specified in initialSelectedDateStr even in a different month (#105)", async () => {
    const targetDate = "2026-11-20";
    await createLocalEntry(db, userId, {
      category_id: catId,
      title: "Reunión de Noviembre",
      content: "Plan de fin de año",
      occurred_at: "2026-11-20T10:00:00.000Z",
    });

    const { getByTestId, getByText } = await render(
      <CalendarMonthView
        db={db}
        userId={userId}
        initialSelectedDateStr={targetDate}
      />,
    );

    await waitFor(() => {
      expect(getByTestId("day-detail-panel")).toBeTruthy();
      expect(getByText(/Entradas del 2026-11-20/)).toBeTruthy();
      expect(getByText(/Reunión de Noviembre/)).toBeTruthy();
    });
  });

  it("does not render task checkbox for alert entries and cannot mark them as completed (#106)", async () => {
    // Create an Alerta category (canonical STANDARD kind)
    const alertCat = await createLocalCategory(db, userId, {
      name: "Alerta",
      voice_command: "alerta",
      color: "#EF4444",
    });

    const alertEntry = await createLocalEntry(db, userId, {
      category_id: alertCat.id,
      content: "Aviso de reunión importante",
      occurred_at: "2026-09-15T09:00:00Z",
    });

    const { queryByTestId, getByTestId } = await render(
      <CalendarMonthView db={db} userId={userId} initialDate={refDate} />,
    );

    await waitFor(() => {
      expect(getByTestId("day-cell-2026-09-15")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("day-cell-2026-09-15"));
    });

    await waitFor(() => {
      expect(getByTestId("day-detail-panel")).toBeTruthy();
    });

    // Alert entry must NOT have a task checkbox
    expect(queryByTestId(`btn-toggle-task-${alertEntry.id}`)).toBeNull();
  });

  it("renders task checkbox only for TASK category entries and not for STANDARD entries (#106)", async () => {
    const taskCat = await createLocalCategory(db, userId, {
      name: "Tareas",
      voice_command: "tarea",
      color: "#F59E0B",
      kind: "TASK",
    });

    const taskEntry = await createLocalEntry(db, userId, {
      category_id: taskCat.id,
      content: "Tarea con checkbox",
      occurred_at: "2026-09-15T10:00:00Z",
    });

    const standardEntry = await createLocalEntry(db, userId, {
      category_id: catId,
      content: "Nota estándar sin checkbox",
      occurred_at: "2026-09-15T11:00:00Z",
    });

    const { queryByTestId, getByTestId } = await render(
      <CalendarMonthView db={db} userId={userId} initialDate={refDate} />,
    );

    await waitFor(() => {
      expect(getByTestId("day-cell-2026-09-15")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("day-cell-2026-09-15"));
    });

    await waitFor(() => {
      expect(getByTestId("day-detail-panel")).toBeTruthy();
    });

    // Task entry MUST have a checkbox
    expect(getByTestId(`btn-toggle-task-${taskEntry.id}`)).toBeTruthy();
    // Standard entry must NOT have a checkbox
    expect(queryByTestId(`btn-toggle-task-${standardEntry.id}`)).toBeNull();
  });

  it("does not render reminder bell in calendar cell if the alert or event is in the past (#109)", async () => {
    const refDate = new Date();
    const pastDate = new Date(refDate.getTime() - 48 * 3600 * 1000); // 2 days ago
    const futureDate = new Date(refDate.getTime() + 48 * 3600 * 1000); // 2 days ahead

    // Keep both in same month view by using refDate
    const pastDayStr = `${pastDate.getFullYear()}-${String(pastDate.getMonth() + 1).padStart(2, "0")}-${String(pastDate.getDate()).padStart(2, "0")}`;
    const futureDayStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, "0")}-${String(futureDate.getDate()).padStart(2, "0")}`;

    // Past alert entry with reminder_enabled = true
    await createLocalEntry(db, userId, {
      category_id: catId,
      content: "Alerta pasada con notificación habilitada",
      occurred_at: pastDate.toISOString(),
      reminder_enabled: true,
      reminder_offset_minutes: 0,
    });

    // Future alert entry with reminder_enabled = true
    await createLocalEntry(db, userId, {
      category_id: catId,
      content: "Alerta futura con notificación habilitada",
      occurred_at: futureDate.toISOString(),
      reminder_enabled: true,
      reminder_offset_minutes: 0,
    });

    const { queryByTestId, getByTestId } = await render(
      <CalendarMonthView db={db} userId={userId} initialDate={refDate} />,
    );

    await waitFor(() => {
      expect(getByTestId("calendar-grid")).toBeTruthy();
    });

    // If pastDate is in the visible month view, its bell must NOT be rendered
    if (pastDate.getMonth() === refDate.getMonth()) {
      expect(queryByTestId(`day-has-reminder-${pastDayStr}`)).toBeNull();
    }

    // If futureDate is in the visible month view, its bell MUST be rendered
    if (futureDate.getMonth() === refDate.getMonth()) {
      expect(getByTestId(`day-has-reminder-${futureDayStr}`)).toBeTruthy();
    }
  });

  it("renders reminder bell in day cell and reminder badge in day detail for alert entries (#132)", async () => {
    const alertCat = await createLocalCategory(db, userId, {
      id: "c3d4e5f6-a7b8-4901-c2d3-e4f5a6b7c8d9",
      name: "Alerta",
      voice_command: "alerta",
    });

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);
    const targetY = targetDate.getFullYear();
    const targetM = String(targetDate.getMonth() + 1).padStart(2, "0");
    const targetD = String(targetDate.getDate()).padStart(2, "0");
    const targetDateStr = `${targetY}-${targetM}-${targetD}`;

    const alertEntry = await createLocalEntry(db, userId, {
      category_id: alertCat.id,
      title: "Anticonceptivo",
      content: "Tiene que ponérselo",
      occurred_at: targetDate.toISOString(),
      reminder_enabled: true,
      reminder_offset_minutes: 0,
    });

    const { getByTestId, findByTestId } = await render(
      <CalendarMonthView db={db} userId={userId} initialDate={targetDate} />,
    );

    await waitFor(() => {
      expect(getByTestId("calendar-grid")).toBeTruthy();
    });

    // Expect bell in day cell
    expect(getByTestId(`day-has-reminder-${targetDateStr}`)).toBeTruthy();

    // Click on the day cell to open detail panel
    fireEvent.press(getByTestId(`day-cell-${targetDateStr}`));

    // Expect reminder badge on entry card
    const reminderBadge = await findByTestId(
      `entry-reminder-badge-${alertEntry.id}`,
    );
    expect(reminderBadge).toBeTruthy();
  });

  it("opens month-year picker modal, displays category breakdown, and jumps to selected month (#117)", async () => {
    // Create entries in March 2025 and June 2025
    await createLocalEntry(db, userId, {
      category_id: catId,
      title: "Entrada Marzo 2025",
      content: "Contenido de diario",
      occurred_at: "2025-03-10T12:00:00Z",
    });
    await createLocalEntry(db, userId, {
      category_id: catId,
      title: "Entrada Junio 2025",
      content: "Contenido de verano",
      occurred_at: "2025-06-20T12:00:00Z",
    });

    const { getByTestId, queryByTestId, findByTestId } = await render(
      <CalendarMonthView
        db={db}
        userId={userId}
        initialDate={new Date("2026-09-15T12:00:00Z")}
      />,
    );

    await waitFor(() => {
      expect(getByTestId("calendar-month-title")).toBeTruthy();
    });

    // Tap month title button to open picker
    await act(async () => {
      fireEvent.press(getByTestId("btn-open-month-year-picker"));
    });

    const pickerModal = await findByTestId("month-year-picker-modal");
    expect(pickerModal).toBeTruthy();

    // Verify current year in picker is 2026, then navigate to 2025
    expect(getByTestId("picker-current-year").props.children).toBe(2026);
    await act(async () => {
      fireEvent.press(getByTestId("btn-picker-prev-year"));
    });

    await waitFor(() => {
      expect(getByTestId("picker-current-year").props.children).toBe(2025);
    });

    // Select March (index 2)
    await act(async () => {
      fireEvent.press(getByTestId("btn-pick-month-2"));
    });

    // Picker modal should be closed
    await waitFor(() => {
      expect(queryByTestId("month-year-picker-modal")).toBeNull();
    });

    // Calendar title should now be Marzo 2025
    expect(getByTestId("calendar-month-title").props.children).toBe(
      "Marzo 2025",
    );

    // Day cell 2025-03-10 should be in the grid
    await waitFor(() => {
      expect(getByTestId("day-cell-2025-03-10")).toBeTruthy();
    });
  }, 15000);

  it("handles recurrence chips wrapping to avoid screen overflow on mobile (#127)", async () => {
    // Create an entry
    const entry = await createLocalEntry(db, userId, {
      category_id: catId,
      content: "Reunión con cliente",
      occurred_at: "2026-09-15T15:00:00Z",
    });

    const { getByTestId } = await render(
      <CalendarMonthView db={db} userId={userId} initialDate={refDate} />,
    );

    await waitFor(() => {
      expect(getByTestId("day-cell-2026-09-15")).toBeTruthy();
    });

    // Open day detail
    await act(async () => {
      fireEvent.press(getByTestId("day-cell-2026-09-15"));
    });

    // Open quick reminder drawer
    await waitFor(() => {
      expect(getByTestId(`btn-open-quick-reminder-${entry.id}`)).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId(`btn-open-quick-reminder-${entry.id}`));
    });

    await waitFor(() => {
      expect(getByTestId(`quick-reminder-drawer-${entry.id}`)).toBeTruthy();
    });

    // Verify recurrence row has flexWrap: wrap
    const recurrenceRow = getByTestId("quick-reminder-recurrence-row");
    expect(recurrenceRow).toBeTruthy();
    const rowStyle = Array.isArray(recurrenceRow.props.style)
      ? Object.assign({}, ...recurrenceRow.props.style)
      : recurrenceRow.props.style;
    expect(rowStyle.flexWrap).toBe("wrap");
  });

  it("disables exact time preset when event time has already passed today for one-time reminders (#128)", async () => {
    // Create an entry that occurred in the past (e.g. 1 hour ago)
    const pastDate = new Date(Date.now() - 3600000);
    const pastIso = pastDate.toISOString();
    const pastEntry = await createLocalEntry(db, userId, {
      category_id: catId,
      content: "Cita que ya ocurrió hoy",
      occurred_at: pastIso,
    });

    const { getByTestId, getByText } = await render(
      <CalendarMonthView db={db} userId={userId} initialDate={pastDate} />,
    );

    const dateKey = pastIso.slice(0, 10);
    await waitFor(() => {
      expect(getByTestId(`day-cell-${dateKey}`)).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId(`day-cell-${dateKey}`));
    });

    await waitFor(() => {
      expect(
        getByTestId(`btn-open-quick-reminder-${pastEntry.id}`),
      ).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId(`btn-open-quick-reminder-${pastEntry.id}`));
    });

    await waitFor(() => {
      expect(getByTestId(`quick-reminder-drawer-${pastEntry.id}`)).toBeTruthy();
    });

    // The 'A la hora exacta' (offset: 0) preset button must be disabled for one-time past events
    const exactPreset = getByTestId(`preset-offset-0-${pastEntry.id}`);
    expect(exactPreset.props.accessibilityState?.disabled).toBe(true);

    // Warning preview message about past event should be displayed
    expect(getByText(/Aviso en el pasado/)).toBeTruthy();
  });

  it("renders Google Calendar daily timeline view with hours and free slots, and allows toggling to list view (#133)", async () => {
    // Create an entry at 14:00 on 2026-09-15
    const timelineEntry = await createLocalEntry(db, userId, {
      category_id: catId,
      title: "Reunión de Estrategia",
      content: "Planificar Q4 a las 14:00",
      occurred_at: "2026-09-15T14:00:00Z",
    });

    const { getByTestId, getByText, queryByTestId } = await render(
      <CalendarMonthView db={db} userId={userId} initialDate={refDate} />,
    );

    await waitFor(() => {
      expect(getByTestId("day-cell-2026-09-15")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("day-cell-2026-09-15"));
    });

    // 1. Verify day detail panel is open and defaults to timeline view
    await waitFor(() => {
      expect(getByTestId("day-detail-panel")).toBeTruthy();
      expect(getByTestId("day-timeline-view")).toBeTruthy();
      expect(getByTestId("day-view-mode-toggle")).toBeTruthy();
    });

    // 2. Verify summary bar with metric
    expect(getByText(/con actividad •/)).toBeTruthy();

    // 3. Verify the 14:00 hour slot contains the entry
    const hour = new Date(timelineEntry.occurred_at!).getHours();
    expect(getByTestId(`timeline-hour-row-${hour}`)).toBeTruthy();
    expect(getByTestId(`entry-item-${timelineEntry.id}`)).toBeTruthy();
    expect(getByText(/Reunión de Estrategia/)).toBeTruthy();

    // 4. Verify free slots are present for unoccupied hours (e.g. 10:00)
    const freeSlotHour = (hour + 2) % 24;
    const freeSlotBtn = getByTestId(`timeline-slot-${freeSlotHour}`);
    expect(freeSlotBtn).toBeTruthy();

    // 5. Tapping a free slot opens quick add form pre-filled with that hour
    await act(async () => {
      fireEvent.press(freeSlotBtn);
    });

    await waitFor(() => {
      expect(getByTestId("quick-add-form-card")).toBeTruthy();
      const timeInput = getByTestId("input-quick-add-time");
      const expectedTimePrefix = `${String(freeSlotHour).padStart(2, "0")}:00`;
      expect(timeInput.props.value).toBe(expectedTimePrefix);
    });

    // 6. Switch to list mode and verify day-list-view is shown
    const listModeBtn = getByTestId("btn-view-mode-list");
    await act(async () => {
      fireEvent.press(listModeBtn);
    });

    await waitFor(() => {
      expect(getByTestId("day-list-view")).toBeTruthy();
      expect(queryByTestId("day-timeline-view")).toBeNull();
      expect(getByTestId(`entry-item-${timelineEntry.id}`)).toBeTruthy();
    });

    // 7. Switch back to timeline mode
    const timelineModeBtn = getByTestId("btn-view-mode-timeline");
    await act(async () => {
      fireEvent.press(timelineModeBtn);
    });

    await waitFor(() => {
      expect(getByTestId("day-timeline-view")).toBeTruthy();
      expect(queryByTestId("day-list-view")).toBeNull();
    });
  });
});
