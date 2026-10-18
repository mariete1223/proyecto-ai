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
      expect(getByTestId("entry-created-at")).toBeTruthy();
      expect(getByTestId("entry-occurred-at")).toBeTruthy();
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

  it("renders custom tag colors and metadata cards in read mode (#56)", async () => {
    const customTag = await createLocalTag(db, userId, {
      name: "Carmen",
      color: "#F59E0B",
    });

    const cat = await createLocalCategory(db, userId, {
      name: "Eventos",
      voice_command: "evento",
      color: "#10B981",
    });

    const customEntry = await createLocalEntry(db, userId, {
      category_id: cat.id,
      title: "Reunión de prueba",
      content: "Detalle completo con diseño premium",
      occurred_at: "2026-10-01T18:03:00Z",
      tag_ids: [customTag.id],
    });

    const { getByTestId, getByText } = await render(
      <EntryDetailView db={db} userId={userId} entryId={customEntry.id} />,
    );

    await waitFor(() => {
      expect(getByTestId("entry-detail-view")).toBeTruthy();
      expect(getByTestId("entry-title-text")).toBeTruthy();
      expect(getByText("📌 Reunión de prueba")).toBeTruthy();
      expect(getByText("Detalle completo con diseño premium")).toBeTruthy();
      expect(getByTestId(`detail-tag-badge-${customTag.id}`)).toBeTruthy();
      expect(getByText("#Carmen")).toBeTruthy();
    });
  });

  it("renders voice edit guide card and applies voice edit command (#68)", async () => {
    const onUpdatedMock = jest.fn();
    const { getByTestId, getByText, findByTestId } = await render(
      <EntryDetailView
        db={db}
        userId={userId}
        entryId={entryId}
        onUpdated={onUpdatedMock}
      />,
    );

    // Guide card should be visible in read mode
    await waitFor(() => {
      expect(getByTestId("voice-edit-guide-card")).toBeTruthy();
      expect(getByText("🎙️ Edición Inteligente por Voz")).toBeTruthy();
      expect(getByTestId("btn-voice-edit-entry")).toBeTruthy();
    });

    // Open voice edit panel
    await act(async () => {
      fireEvent.press(getByTestId("btn-voice-edit-entry"));
    });

    await waitFor(() => {
      expect(getByTestId("voice-edit-panel")).toBeTruthy();
      expect(getByTestId("input-voice-edit-transcript")).toBeTruthy();
    });

    // Type a voice command
    await act(async () => {
      fireEvent.changeText(
        getByTestId("input-voice-edit-transcript"),
        "poner título Tarea Urgente y cambiar la hora a las 19:30 y poner aviso 15 minutos antes",
      );
    });

    // Apply voice command
    await act(async () => {
      fireEvent.press(getByTestId("btn-apply-voice-edit"));
    });

    // Verify success feedback and inline pill
    expect(await findByTestId("entry-detail-success")).toBeTruthy();
    expect(getByTestId("voice-edit-inline-success")).toBeTruthy();
    expect(getByText("📌 Tarea Urgente")).toBeTruthy();
    expect(onUpdatedMock).toHaveBeenCalledTimes(1);

    // Verify detail view remains open and did not unmount
    expect(getByTestId("entry-detail-view")).toBeTruthy();

    // Verify database was updated
    const updatedInDb = await getEntryById(db, userId, entryId);
    expect(updatedInDb?.title).toBe("Tarea Urgente");
    expect(Boolean(updatedInDb?.reminder_enabled)).toBe(true);
    expect(updatedInDb?.reminder_offset_minutes).toBe(15);
    const d = new Date(updatedInDb!.occurred_at!);
    expect(d.getHours()).toBe(19);
    expect(d.getMinutes()).toBe(30);
  });

  it("remains open and displays updated time when applying voice edit (#73)", async () => {
    let currentSelectedId: string | null = entryId;
    const onCloseMock = jest.fn(() => {
      currentSelectedId = null;
    });
    const onUpdatedMock = jest.fn();

    const { getByTestId, getByText, findByTestId } = await render(
      <EntryDetailView
        db={db}
        userId={userId}
        entryId={entryId}
        onClose={onCloseMock}
        onUpdated={onUpdatedMock}
      />,
    );

    await waitFor(() => {
      expect(getByTestId("btn-voice-edit-entry")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-voice-edit-entry"));
    });

    await act(async () => {
      fireEvent.changeText(
        getByTestId("input-voice-edit-transcript"),
        "cambiar la hora a las 18:30",
      );
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-apply-voice-edit"));
    });

    // View must remain open and not trigger close
    expect(onCloseMock).not.toHaveBeenCalled();
    expect(currentSelectedId).toBe(entryId);
    expect(onUpdatedMock).toHaveBeenCalledTimes(1);
    expect(await findByTestId("voice-edit-inline-success")).toBeTruthy();

    // The occurred_at date must reflect 18:30
    const inDb = await getEntryById(db, userId, entryId);
    expect(inDb).toBeTruthy();
    const d = new Date(inDb!.occurred_at!);
    expect(d.getHours()).toBe(18);
    expect(d.getMinutes()).toBe(30);
  });
});
