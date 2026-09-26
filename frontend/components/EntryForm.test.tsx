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
});
