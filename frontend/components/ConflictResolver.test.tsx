import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { createLocalCategory } from "../db/categories";
import { MemoryDatabaseAdapter, runMigrations } from "../db/database";
import { createLocalEntry } from "../db/entries";
import { ConflictResolver } from "./ConflictResolver";

describe("ConflictResolver Component (Task 41)", () => {
  let db: MemoryDatabaseAdapter;
  const userId = "user-conflict-123";

  beforeEach(async () => {
    db = new MemoryDatabaseAdapter();
    await runMigrations(db);
  });

  it("renders empty state when no conflicts exist", async () => {
    const { getByTestId, getByText } = await render(
      <ConflictResolver db={db} userId={userId} />,
    );

    await waitFor(() => {
      expect(getByTestId("no-conflicts")).toBeTruthy();
      expect(
        getByText("No hay conflictos pendientes de resolución"),
      ).toBeTruthy();
    });
  });

  it("displays local and remote variants side-by-side and allows keeping local variant", async () => {
    const cat = await createLocalCategory(db, userId, {
      name: "Trabajo",
      voice_command: "trabajo",
    });

    const ent = await createLocalEntry(db, userId, {
      category_id: cat.id,
      content: "Contenido local original",
    });

    const conflictId = "conflict-1";
    const serverEntity = JSON.stringify({
      id: ent.id,
      content: "Contenido remoto del servidor",
      version: 2,
    });

    await db.runAsync(
      `INSERT INTO sync_conflicts (id, user_id, entity_type, entity_id, server_entity, error_message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        conflictId,
        userId,
        "ENTRY",
        ent.id,
        serverEntity,
        "Version mismatch conflict",
        new Date().toISOString(),
      ],
    );

    const onResolved = jest.fn();

    const { getByTestId, getByText } = await render(
      <ConflictResolver db={db} userId={userId} onResolved={onResolved} />,
    );

    await waitFor(() => {
      expect(getByTestId(`conflict-card-${conflictId}`)).toBeTruthy();
      expect(getByText("Contenido local original")).toBeTruthy();
      expect(getByText("Contenido remoto del servidor")).toBeTruthy();
    });

    // Press Keep Local
    fireEvent.press(getByTestId(`btn-keep-local-${conflictId}`));

    await waitFor(() => {
      expect(onResolved).toHaveBeenCalled();
      expect(getByTestId("no-conflicts")).toBeTruthy();
    });

    // Check database
    const remainingConflict = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM sync_conflicts WHERE id = ?;`,
      [conflictId],
    );
    expect(remainingConflict).toBeNull();
  });

  it("allows keeping remote variant", async () => {
    const cat = await createLocalCategory(db, userId, {
      name: "Personal",
      voice_command: "personal",
    });

    const ent = await createLocalEntry(db, userId, {
      category_id: cat.id,
      content: "Contenido local a reemplazar",
    });

    const conflictId = "conflict-2";
    const serverEntity = JSON.stringify({
      id: ent.id,
      category_id: cat.id,
      content: "Contenido remoto aceptado",
      version: 5,
    });

    await db.runAsync(
      `INSERT INTO sync_conflicts (id, user_id, entity_type, entity_id, server_entity, error_message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        conflictId,
        userId,
        "ENTRY",
        ent.id,
        serverEntity,
        "Version mismatch conflict",
        new Date().toISOString(),
      ],
    );

    const { getByTestId } = await render(
      <ConflictResolver db={db} userId={userId} />,
    );

    await waitFor(() => {
      expect(getByTestId(`conflict-card-${conflictId}`)).toBeTruthy();
    });

    // Press Keep Remote
    fireEvent.press(getByTestId(`btn-keep-remote-${conflictId}`));

    await waitFor(() => {
      expect(getByTestId("no-conflicts")).toBeTruthy();
    });

    // Verify local entry updated to server content
    const updatedEntry = await db.getFirstAsync<{ content: string }>(
      `SELECT content FROM entries WHERE id = ? AND user_id = ?;`,
      [ent.id, userId],
    );
    expect(updatedEntry?.content).toBe("Contenido remoto aceptado");
  });
});
