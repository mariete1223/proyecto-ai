import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { createLocalCategory } from "../db/categories";
import { listLocalCorrectionsForEntry } from "../db/corrections";
import { MemoryDatabaseAdapter, runMigrations } from "../db/database";
import { listLocalEntries } from "../db/entries";
import { createLocalTag } from "../db/tags";
import { ParsedSpokenCommand } from "../services/voiceParser";
import { PreviewBeforeSave } from "./PreviewBeforeSave";

describe("PreviewBeforeSave Component (Task 33)", () => {
  let db: MemoryDatabaseAdapter;
  const userId = "user-789";
  const captureSessionId = "session-abc-123";

  let catNotaId: string;
  let catTareaId: string;
  let tagId: string;

  beforeEach(async () => {
    db = new MemoryDatabaseAdapter();
    await runMigrations(db);

    const cat1 = await createLocalCategory(db, userId, {
      name: "Notas",
      voice_command: "nota",
    });
    catNotaId = cat1.id;

    const cat2 = await createLocalCategory(db, userId, {
      name: "Tareas",
      voice_command: "tarea",
      kind: "TASK",
    });
    catTareaId = cat2.id;

    const t = await createLocalTag(db, userId, { name: "Urgente" });
    tagId = t.id;
  });

  it("renders interpreted command fields", async () => {
    const interpreted: ParsedSpokenCommand = {
      categoryId: catNotaId,
      categoryName: "Notas",
      occurredAt: "2026-09-26T12:00:00Z",
      content: "Comprar leche fresca",
      tagIds: [tagId],
      tagNames: ["Urgente"],
      errors: [],
      isSuccess: true,
    };

    const { getByTestId, getByText } = await render(
      <PreviewBeforeSave
        db={db}
        userId={userId}
        captureSessionId={captureSessionId}
        interpretedCommand={interpreted}
      />,
    );

    await waitFor(() => {
      expect(getByTestId("preview-before-save")).toBeTruthy();
      expect(getByText("Notas")).toBeTruthy();
      expect(getByText("#Urgente")).toBeTruthy();
    });
  });

  it("triggers onCancelled and creates no residual records in SQLite on cancel", async () => {
    const onCancelledMock = jest.fn();
    const interpreted: ParsedSpokenCommand = {
      categoryId: catNotaId,
      categoryName: "Notas",
      occurredAt: null,
      content: "Probar cancelación",
      tagIds: [],
      tagNames: [],
      errors: [],
      isSuccess: true,
    };

    const { getByTestId, getByText } = await render(
      <PreviewBeforeSave
        db={db}
        userId={userId}
        captureSessionId={captureSessionId}
        interpretedCommand={interpreted}
        onCancelled={onCancelledMock}
      />,
    );

    await waitFor(() => {
      expect(getByText("Notas")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-cancel-preview"));
    });

    expect(onCancelledMock).toHaveBeenCalledTimes(1);

    const entries = await listLocalEntries(db, userId);
    expect(entries.length).toBe(0);
  });

  it("saves entry and records capture corrections when fields are modified", async () => {
    const onSavedMock = jest.fn();
    const interpreted: ParsedSpokenCommand = {
      categoryId: catNotaId,
      categoryName: "Notas",
      occurredAt: "2026-09-26T12:00:00Z",
      content: "Comprar leche",
      tagIds: [],
      tagNames: [],
      errors: [],
      isSuccess: true,
    };

    const { getByTestId, getByText } = await render(
      <PreviewBeforeSave
        db={db}
        userId={userId}
        captureSessionId={captureSessionId}
        interpretedCommand={interpreted}
        onSaved={onSavedMock}
      />,
    );

    await waitFor(() => {
      expect(getByText("Notas")).toBeTruthy();
    });

    // Change category to Tareas and edit content
    await act(async () => {
      fireEvent.press(getByTestId(`cat-chip-${catTareaId}`));
      fireEvent.changeText(
        getByTestId("input-preview-content"),
        "Comprar leche y pan",
      );
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-confirm-preview"));
    });

    await waitFor(() => {
      expect(onSavedMock).toHaveBeenCalledTimes(1);
    });

    const entries = await listLocalEntries(db, userId);
    expect(entries.length).toBe(1);
    expect(entries[0].category_id).toBe(catTareaId);
    expect(entries[0].content).toBe("Comprar leche y pan");

    // Check recorded corrections in SQLite
    const corrections = await listLocalCorrectionsForEntry(
      db,
      userId,
      entries[0].id,
    );
    expect(corrections.length).toBeGreaterThanOrEqual(2);
    expect(corrections.some((c) => c.field === "category_id")).toBe(true);
    expect(corrections.some((c) => c.field === "content")).toBe(true);
  });
});
