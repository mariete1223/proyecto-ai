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
import {
  createLocalEntry,
  updateLocalEntry as defaultUpdateLocalEntry,
} from "../db/entries";
import { PendingTasksView } from "./PendingTasksView";

describe("PendingTasksView Component", () => {
  let db: MemoryDatabaseAdapter;
  const userId = "user-123";
  let taskCatId: string;

  beforeEach(async () => {
    db = new MemoryDatabaseAdapter();
    await runMigrations(db);
    const cat = await createLocalCategory(db, userId, {
      name: "Tarea",
      kind: "TASK",
      voice_command: "tarea",
      color: "#000000",
      icon: "check",
    });
    taskCatId = cat.id;
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  test("renders empty state when there are no dateless pending tasks", async () => {
    const { getByTestId, getByText } = await render(
      <PendingTasksView db={db} userId={userId} />,
    );

    await waitFor(() => {
      expect(getByTestId("empty-container")).toBeTruthy();
      expect(getByText("No hay tareas pendientes sin fecha")).toBeTruthy();
    });
  });

  test("renders error state when fetchTasks throws error", async () => {
    const fetchError = jest
      .fn()
      .mockImplementation(() => Promise.reject(new Error("DB failure")));

    const { getByTestId, getByText } = await render(
      <PendingTasksView db={db} userId={userId} fetchTasks={fetchError} />,
    );

    await waitFor(() => {
      expect(getByTestId("error-container")).toBeTruthy();
      expect(getByText("DB failure")).toBeTruthy();
    });
  });

  test("handles status change and selection", async () => {
    const task1 = await createLocalEntry(db, userId, {
      category_id: taskCatId,
      content: "Comprar leche",
      occurred_at: null,
      task_status: "PENDING",
      task_recurrence: "ONCE",
    });

    const onSelectEntry = jest.fn();

    const updateEntryMock = jest
      .fn()
      .mockImplementation(defaultUpdateLocalEntry);

    const { getAllByText, getByTestId, getByText, queryByText } = await render(
      <PendingTasksView
        db={db}
        userId={userId}
        onSelectEntry={onSelectEntry}
        updateEntry={updateEntryMock}
      />,
    );

    await waitFor(() => {
      expect(getByText("Comprar leche")).toBeTruthy();
    });

    // Select task card
    await act(async () => {
      fireEvent.press(getByTestId(`task-card-${task1.id}`));
    });
    expect(onSelectEntry).toHaveBeenCalledWith(
      expect.objectContaining({ id: task1.id }),
    );

    // Change status to IN_PROGRESS
    await act(async () => {
      fireEvent.press(getByTestId(`status-inprogress-${task1.id}`));
    });

    // Switch to IN_PROGRESS tab
    await act(async () => {
      fireEvent.press(getByTestId("tab-filter-inprogress"));
    });

    await waitFor(() => {
      expect(getAllByText(/En progreso/).length).toBeGreaterThan(0);
    });

    // Change status to DONE (which moves it to Realizadas tab)
    await act(async () => {
      fireEvent.press(getByTestId(`status-done-${task1.id}`));
    });

    await waitFor(() => {
      expect(queryByText("Comprar leche")).toBeNull();
      expect(getByTestId("empty-container")).toBeTruthy();
    });

    // Switch to Realizadas tab
    await act(async () => {
      fireEvent.press(getByTestId("tab-filter-done"));
    });

    await waitFor(() => {
      expect(getByText("Comprar leche")).toBeTruthy();
    });

    // Switch back to Pendientes tab
    await act(async () => {
      fireEvent.press(getByTestId("tab-filter-pending"));
    });
  });

  test("filters tasks by search query and exports JSON data", async () => {
    await createLocalEntry(db, userId, {
      category_id: taskCatId,
      occurred_at: null,
      content: "Comprar pan",
      task_status: "PENDING",
      task_recurrence: "ONCE",
    });

    await createLocalEntry(db, userId, {
      category_id: taskCatId,
      occurred_at: null,
      content: "Llamar al médico",
      task_status: "PENDING",
      task_recurrence: "ONCE",
    });

    const { getByTestId, getByText, queryByText } = await render(
      <PendingTasksView db={db} userId={userId} />,
    );

    await waitFor(() => {
      expect(getByText("Comprar pan")).toBeTruthy();
      expect(getByText("Llamar al médico")).toBeTruthy();
    });

    // Type in search query
    await act(async () => {
      fireEvent.changeText(getByTestId("input-search-tasks"), "Llamar");
    });

    await waitFor(() => {
      expect(queryByText("Comprar pan")).toBeNull();
      expect(getByText("Llamar al médico")).toBeTruthy();
    });

    // Test JSON export
    await act(async () => {
      fireEvent.press(getByTestId("btn-export-json"));
    });

    await waitFor(() => {
      expect(getByTestId("export-json-banner")).toBeTruthy();
    });

    // Close export banner
    await act(async () => {
      fireEvent.press(getByTestId("btn-close-export"));
    });

    await waitFor(() => {
      expect(queryByText("Exportación de Datos (JSON):")).toBeNull();
    });
  });
});
