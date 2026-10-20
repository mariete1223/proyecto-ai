import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
import React from "react";
import { createLocalCategory } from "../db/categories";
import { MemoryDatabaseAdapter, runMigrations } from "../db/database";
import { listLocalEntries } from "../db/entries";
import { CalendarMonthView } from "./CalendarMonthView";

describe("CalendarMonthView Quick Add Priority & Alert Auto-Reminder (#104)", () => {
  let db: MemoryDatabaseAdapter;
  const userId = "test-user-104";
  let taskCatId: string;
  let standardCatId: string;
  let alertCatId: string;
  const refDate = new Date("2026-10-15T12:00:00Z");

  beforeEach(async () => {
    db = new MemoryDatabaseAdapter();
    await runMigrations(db);

    const taskCat = await createLocalCategory(db, userId, {
      name: "Tareas",
      voice_command: "tarea",
      kind: "TASK",
      color: "#3B82F6",
      icon: "check-circle",
    });
    taskCatId = taskCat.id;

    const stdCat = await createLocalCategory(db, userId, {
      name: "Notas",
      voice_command: "nota",
      kind: "STANDARD",
      color: "#10B981",
      icon: "file-text",
    });
    standardCatId = stdCat.id;

    const alertCat = await createLocalCategory(db, userId, {
      name: "Alerta",
      voice_command: "alerta",
      kind: "STANDARD",
      color: "#EF4444",
      icon: "bell",
    });
    alertCatId = alertCat.id;
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it("shows priority selector when task category is selected, allows choosing Alta, and saves task_priority HIGH (#104)", async () => {
    const { getByTestId, queryByTestId } = await render(
      <CalendarMonthView db={db} userId={userId} initialDate={refDate} />,
    );

    // Click day 15
    await waitFor(() => {
      expect(getByTestId("day-cell-2026-10-15")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("day-cell-2026-10-15"));
    });

    // Open quick add form
    await waitFor(() => {
      expect(getByTestId("btn-open-quick-add")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-open-quick-add"));
    });

    // Verify category chips exist and task category is selected
    await waitFor(() => {
      expect(getByTestId("quick-add-form-card")).toBeTruthy();
      expect(getByTestId(`quick-add-cat-${taskCatId}`)).toBeTruthy();
    });

    // Explicitly click Tareas
    await act(async () => {
      fireEvent.press(getByTestId(`quick-add-cat-${taskCatId}`));
    });

    // Priority selector should be visible
    expect(getByTestId("quick-add-priority-HIGH")).toBeTruthy();
    expect(getByTestId("quick-add-priority-MEDIUM")).toBeTruthy();
    expect(getByTestId("quick-add-priority-LOW")).toBeTruthy();

    // Select Alta (HIGH)
    await act(async () => {
      fireEvent.press(getByTestId("quick-add-priority-HIGH"));
    });

    // Enter content
    await act(async () => {
      fireEvent.changeText(
        getByTestId("input-quick-add-content"),
        "Preparar informe urgente",
      );
    });

    // Submit
    await act(async () => {
      fireEvent.press(getByTestId("btn-submit-quick-add"));
    });

    await waitFor(() => {
      expect(queryByTestId("quick-add-form-card")).toBeNull();
    });

    // Check DB
    const entries = await listLocalEntries(db, userId);
    expect(entries.length).toBe(1);
    expect(entries[0].content).toBe("Preparar informe urgente");
    expect(entries[0].task_priority).toBe("HIGH");
    expect(entries[0].task_status).toBe("PENDING");
  });

  it("hides priority selector when non-task category is selected (#104)", async () => {
    const { getByTestId, queryByTestId } = await render(
      <CalendarMonthView db={db} userId={userId} initialDate={refDate} />,
    );

    await waitFor(() => {
      expect(getByTestId("day-cell-2026-10-15")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("day-cell-2026-10-15"));
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-open-quick-add"));
    });

    await waitFor(() => {
      expect(getByTestId(`quick-add-cat-${standardCatId}`)).toBeTruthy();
    });

    // Select Notas
    await act(async () => {
      fireEvent.press(getByTestId(`quick-add-cat-${standardCatId}`));
    });

    // Priority selector should NOT be rendered
    expect(queryByTestId("quick-add-priority-HIGH")).toBeNull();
    expect(queryByTestId("quick-add-priority-MEDIUM")).toBeNull();
    expect(queryByTestId("quick-add-priority-LOW")).toBeNull();

    // Save
    await act(async () => {
      fireEvent.changeText(
        getByTestId("input-quick-add-content"),
        "Nota general de prueba",
      );
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-submit-quick-add"));
    });

    await waitFor(() => {
      expect(queryByTestId("quick-add-form-card")).toBeNull();
    });

    const entries = await listLocalEntries(db, userId);
    expect(entries.length).toBe(1);
    expect(entries[0].task_priority).toBeNull();
    expect(entries[0].task_status).toBeNull();
  });

  it("automatically enables reminder when Alerta category is selected (#104)", async () => {
    const { getByTestId, queryByTestId } = await render(
      <CalendarMonthView db={db} userId={userId} initialDate={refDate} />,
    );

    await waitFor(() => {
      expect(getByTestId("day-cell-2026-10-15")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("day-cell-2026-10-15"));
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-open-quick-add"));
    });

    await waitFor(() => {
      expect(getByTestId(`quick-add-cat-${alertCatId}`)).toBeTruthy();
    });

    // Select Alerta
    await act(async () => {
      fireEvent.press(getByTestId(`quick-add-cat-${alertCatId}`));
    });

    // Checkbox should be checked automatically
    expect(getByTestId("checkbox-quick-add-reminder")).toBeTruthy();
    expect(getByTestId("checkbox-quick-add-reminder").props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: "#F59E0B" }),
      ]),
    );

    // Save
    await act(async () => {
      fireEvent.changeText(
        getByTestId("input-quick-add-content"),
        "Aviso puntual de caldera",
      );
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-submit-quick-add"));
    });

    await waitFor(() => {
      expect(queryByTestId("quick-add-form-card")).toBeNull();
    });

    const entries = await listLocalEntries(db, userId);
    expect(entries.length).toBe(1);
    expect(entries[0].content).toBe("Aviso puntual de caldera");
    expect(entries[0].reminder_enabled).toBe(true);
    expect(entries[0].reminder_offset_minutes).toBe(0);
  });
});
