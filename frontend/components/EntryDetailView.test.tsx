import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { createLocalCategory } from "../db/categories";
import { MemoryDatabaseAdapter, runMigrations } from "../db/database";
import { createLocalEntry, getEntryById } from "../db/entries";
import { createLocalTag } from "../db/tags";
import { EntryDetailView } from "./EntryDetailView";

describe("EntryDetailView Component (Task 38)", () => {
  let db: MemoryDatabaseAdapter;
  const userId = "user-789";

  let entryId: string;

  beforeEach(async () => {
    db = new MemoryDatabaseAdapter();
    await runMigrations(db);

    const cat = await createLocalCategory(db, userId, {
      name: "Notas",
      voice_command: "nota",
    });

    const tag = await createLocalTag(db, userId, { name: "Importante" });

    const ent = await createLocalEntry(db, userId, {
      category_id: cat.id,
      content: "Contenido original de la nota",
      occurred_at: "2026-09-26T12:00:00Z",
      tag_ids: [tag.id],
    });
    entryId = ent.id;
  });

  it("renders entry details in read mode", async () => {
    const { getByTestId, getByText } = await render(
      <EntryDetailView db={db} userId={userId} entryId={entryId} />,
    );

    await waitFor(() => {
      expect(getByTestId("entry-detail-view")).toBeTruthy();
      expect(getByText("Notas")).toBeTruthy();
      expect(getByText("Contenido original de la nota")).toBeTruthy();
      expect(getByText("Fecha: 2026-09-26")).toBeTruthy();
      expect(getByText("#Importante")).toBeTruthy();
    });
  });

  it("edits entry content and saves changes to SQLite", async () => {
    const onUpdatedMock = jest.fn();
    const { getByTestId, getByText, findByTestId } = await render(
      <EntryDetailView
        db={db}
        userId={userId}
        entryId={entryId}
        onUpdated={onUpdatedMock}
      />,
    );

    await waitFor(() => {
      expect(getByText("Contenido original de la nota")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-start-edit-entry"));
    });

    await act(async () => {
      fireEvent.changeText(
        getByTestId("input-edit-content"),
        "Contenido modificado y actualizado",
      );
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-save-edit-entry"));
    });

    expect(await findByTestId("entry-detail-success")).toBeTruthy();
    expect(getByText("Contenido modificado y actualizado")).toBeTruthy();
    expect(onUpdatedMock).toHaveBeenCalledTimes(1);

    const entryInDb = await getEntryById(db, userId, entryId);
    expect(entryInDb?.content).toBe("Contenido modificado y actualizado");
    expect(entryInDb?.version).toBe(2);
    expect(entryInDb?.sync_status).toBe("PENDING_PUSH");
  });

  it("permanently deletes entry on confirmation and creates deletion tombstone", async () => {
    const onDeletedMock = jest.fn();
    const { getByTestId, getByText, findByTestId } = await render(
      <EntryDetailView
        db={db}
        userId={userId}
        entryId={entryId}
        onDeleted={onDeletedMock}
      />,
    );

    await waitFor(() => {
      expect(getByText("Contenido original de la nota")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-prompt-delete-entry"));
    });

    expect(await findByTestId("delete-confirm-panel")).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId("btn-confirm-delete-entry"));
    });

    await waitFor(() => {
      expect(onDeletedMock).toHaveBeenCalledTimes(1);
    });

    const entryInDb = await getEntryById(db, userId, entryId);
    expect(entryInDb).toBeNull();

    // Verify deletion tombstone created in SQLite
    const tombstones = await db.getAllAsync<{ entity_id: string }>(
      `SELECT entity_id FROM deletion_tombstones WHERE user_id = ? AND entity_type = 'ENTRY';`,
      [userId],
    );
    expect(tombstones.some((t) => t.entity_id === entryId)).toBe(true);
  });
});
