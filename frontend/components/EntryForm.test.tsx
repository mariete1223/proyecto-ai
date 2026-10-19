import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { createLocalCategory, listCategories } from "../db/categories";
import { MemoryDatabaseAdapter, runMigrations } from "../db/database";
import { createLocalTag } from "../db/tags";
import { EntryForm } from "./EntryForm";

describe("EntryForm Component", () => {
  let db: MemoryDatabaseAdapter;
  const userId = "user-789";

  beforeEach(async () => {
    db = new MemoryDatabaseAdapter();
    await runMigrations(db);

    await createLocalCategory(db, userId, {
      name: "Notas",
      voice_command: "nota",
      kind: "STANDARD",
    });

    await createLocalCategory(db, userId, {
      name: "Tareas",
      voice_command: "tarea",
      kind: "TASK",
    });

    await createLocalTag(db, userId, { name: "Prioritario" });
  });

  it("renders form elements and catalog chips", async () => {
    const { getByTestId, getByText } = await render(
      <EntryForm db={db} userId={userId} />,
    );

    await waitFor(() => {
      expect(getByTestId("entry-form-container")).toBeTruthy();
      expect(getByText("Notas")).toBeTruthy();
      expect(getByText("Tareas")).toBeTruthy();
    });
  });

  it("shows validation error when content is empty", async () => {
    const { getByText, getByTestId } = await render(
      <EntryForm db={db} userId={userId} />,
    );

    await waitFor(() => {
      expect(getByText("Notas")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-submit-entry"));
    });

    await waitFor(() => {
      expect(getByTestId("entry-form-error")).toBeTruthy();
      expect(getByText("El contenido no puede estar vacío.")).toBeTruthy();
    });
  });

  it("submits entry and saves to SQLite successfully", async () => {
    const onSuccessMock = jest.fn();
    const { getByText, getByTestId, findByTestId } = await render(
      <EntryForm db={db} userId={userId} onSuccess={onSuccessMock} />,
    );

    await waitFor(() => {
      expect(getByText("Notas")).toBeTruthy();
    });

    const categories = await listCategories(db, userId);
    await act(async () => {
      fireEvent.press(getByTestId(`cat-chip-${categories[0].id}`));
      fireEvent.changeText(getByTestId("input-content"), "Test entry content");
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-submit-entry"));
    });

    expect(await findByTestId("entry-form-success")).toBeTruthy();
    expect(onSuccessMock).toHaveBeenCalledTimes(1);
  });

  it("shows inline error text, error styling on input-content, and submit-error-banner when content is empty (#91)", async () => {
    const { getByTestId, queryByTestId } = await render(
      <EntryForm db={db} userId={userId} />,
    );

    await waitFor(() => {
      expect(getByTestId("entry-form-container")).toBeTruthy();
    });

    expect(queryByTestId("content-error-text")).toBeNull();
    expect(queryByTestId("submit-error-banner")).toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId("btn-submit-entry"));
    });

    await waitFor(() => {
      expect(getByTestId("content-error-text")).toBeTruthy();
      expect(getByTestId("submit-error-banner")).toBeTruthy();
    });

    // Verify typing into input-content clears the error reactively
    await act(async () => {
      fireEvent.changeText(
        getByTestId("input-content"),
        "Contenido de prueba ahora completo",
      );
    });

    expect(queryByTestId("content-error-text")).toBeNull();
    expect(queryByTestId("submit-error-banner")).toBeNull();
  });

  it("treats Alerta as non-task, hides task-options, and sets default alarm and occurredAt (#92)", async () => {
    // Create an Alerta category with kind TASK to simulate legacy contaminated data
    const alertaCat = await createLocalCategory(db, userId, {
      name: "Alerta",
      voice_command: "alerta",
      kind: "TASK",
    });

    const { getByTestId, queryByTestId, findByTestId } = await render(
      <EntryForm db={db} userId={userId} />,
    );

    await waitFor(() => {
      expect(getByTestId(`cat-chip-${alertaCat.id}`)).toBeTruthy();
    });

    // Selecting Alerta
    await act(async () => {
      fireEvent.press(getByTestId(`cat-chip-${alertaCat.id}`));
    });

    // 1. Task options should NOT be rendered for Alerta
    expect(queryByTestId("task-options")).toBeNull();

    // 2. Filling content and submitting
    await act(async () => {
      fireEvent.changeText(
        getByTestId("input-content"),
        "Cita médica urgente mañana",
      );
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-submit-entry"));
    });

    expect(await findByTestId("entry-form-success")).toBeTruthy();

    // 3. Verify entry in SQLite has no task fields and has reminder enabled with occurred_at
    const savedEntry = await db.getFirstAsync<{
      category_id: string;
      task_status: string | null;
      task_priority: string | null;
      reminder_enabled: number;
      occurred_at: string | null;
    }>(
      `SELECT category_id, task_status, task_priority, reminder_enabled, occurred_at FROM entries WHERE category_id = ?;`,
      [alertaCat.id],
    );

    expect(savedEntry).toBeTruthy();
    expect(savedEntry?.task_status).toBeNull();
    expect(savedEntry?.task_priority).toBeNull();
    expect(savedEntry?.reminder_enabled).toBe(1);
    expect(savedEntry?.occurred_at).toBeTruthy();
  });
});
