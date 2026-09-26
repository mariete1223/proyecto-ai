import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { createLocalCategory } from "../db/categories";
import { MemoryDatabaseAdapter, runMigrations } from "../db/database";
import { createLocalEntry } from "../db/entries";
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

  test("renders empty state when there are no dateless pending tasks", async () => {
    const { getByTestId, getByText } = await render(
      <PendingTasksView db={db} userId={userId} />,
    );

    await waitFor(() => {
      expect(getByTestId("empty-container")).toBeTruthy();
      expect(getByText("No hay tareas pendientes sin fecha")).toBeTruthy();
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

    const { getByTestId, getByText, queryByText } = await render(
      <PendingTasksView
        db={db}
        userId={userId}
        onSelectEntry={onSelectEntry}
      />,
    );

    await waitFor(() => {
      expect(getByText("Comprar leche")).toBeTruthy();
    });

    // Select task card
    fireEvent.press(getByTestId(`task-card-${task1.id}`));
    expect(onSelectEntry).toHaveBeenCalledWith(
      expect.objectContaining({ id: task1.id }),
    );

    // Change status to IN_PROGRESS
    await act(async () => {
      fireEvent.press(getByTestId(`status-inprogress-${task1.id}`));
    });

    await waitFor(() => {
      expect(getByText("Estado actual: En progreso")).toBeTruthy();
    });

    // Change status to DONE (which removes it from pending dateless list)
    await act(async () => {
      fireEvent.press(getByTestId(`status-done-${task1.id}`));
    });

    await waitFor(() => {
      expect(queryByText("Comprar leche")).toBeNull();
      expect(getByTestId("empty-container")).toBeTruthy();
    });
  });

  test("renders error state when fetchTasks throws error", async () => {
    const fetchError = jest.fn().mockImplementation(() => {
      return Promise.reject(new Error("DB failure"));
    });

    const { getByTestId, getByText } = await render(
      <PendingTasksView db={db} userId={userId} fetchTasks={fetchError} />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(getByTestId("error-container")).toBeTruthy();
      expect(getByText("DB failure")).toBeTruthy();
    });
  });
});
