import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { createLocalCategory } from "../db/categories";
import { MemoryDatabaseAdapter, runMigrations } from "../db/database";
import { createLocalEntry } from "../db/entries";
import { createLocalTag } from "../db/tags";
import { getPendingLocalChanges } from "../services/syncEngine";
import { ConflictResolver } from "./ConflictResolver";

describe("ConflictResolver Component (Task 41)", () => {
  let db: MemoryDatabaseAdapter;
  const userId = "user-conflict-123";

  beforeEach(async () => {
    db = new MemoryDatabaseAdapter();
    await runMigrations(db);
  });

  async function insertConflict(
    id: string,
    entityType: "CATEGORY" | "TAG" | "ENTRY",
    entityId: string,
    ownerId = userId,
    serverEntity = "{}",
    errorMessage = "Entity was deleted on server.",
  ) {
    await db.runAsync(
      `INSERT INTO sync_conflicts (id, user_id, entity_type, entity_id, server_entity, error_message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        ownerId,
        entityType,
        entityId,
        serverEntity,
        errorMessage,
        new Date().toISOString(),
      ],
    );
  }

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

  it("accepts a CATEGORY tombstone, reassigns entries, and removes duplicate conflicts", async () => {
    const deletedCategory = await createLocalCategory(db, userId, {
      name: "Proyectos antiguos",
      voice_command: "proyectos antiguos",
    });
    const fallbackCategory = await createLocalCategory(db, userId, {
      name: "Archivo",
      voice_command: "archivo",
    });
    const unrelatedCategory = await createLocalCategory(db, userId, {
      name: "Personal",
      voice_command: "personal",
    });
    const entry = await createLocalEntry(db, userId, {
      category_id: deletedCategory.id,
      content: "Entrada que debe conservarse",
    });

    await insertConflict("category-delete-1", "CATEGORY", deletedCategory.id);
    await insertConflict("category-delete-2", "CATEGORY", deletedCategory.id);
    await insertConflict(
      "unrelated-conflict",
      "CATEGORY",
      unrelatedCategory.id,
    );
    await insertConflict(
      "other-user-conflict",
      "CATEGORY",
      deletedCategory.id,
      "other-user",
    );
    await db.runAsync(
      `INSERT INTO deletion_tombstones (id, user_id, entity_type, entity_id, deleted_at, deleted_version, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        "stale-category-delete",
        userId,
        "CATEGORY",
        deletedCategory.id,
        new Date().toISOString(),
        2,
        "PENDING_PUSH",
      ],
    );

    const { getByTestId, queryByTestId } = await render(
      <ConflictResolver db={db} userId={userId} />,
    );
    await waitFor(() =>
      expect(getByTestId("conflict-card-category-delete-1")).toBeTruthy(),
    );
    fireEvent.press(getByTestId("btn-keep-remote-category-delete-1"));

    await waitFor(() => {
      expect(queryByTestId("conflict-card-category-delete-1")).toBeNull();
      expect(queryByTestId("conflict-card-category-delete-2")).toBeNull();
    });

    expect(
      await db.getFirstAsync(
        `SELECT id FROM categories WHERE id = ? AND user_id = ?;`,
        [deletedCategory.id, userId],
      ),
    ).toBeNull();
    expect(
      await db.getFirstAsync<{ category_id: string }>(
        `SELECT category_id FROM entries WHERE id = ? AND user_id = ?;`,
        [entry.id, userId],
      ),
    ).toMatchObject({ category_id: fallbackCategory.id });
    expect(
      await db.getAllAsync(
        `SELECT id FROM sync_conflicts WHERE user_id = ? AND entity_type = ? AND entity_id = ?;`,
        [userId, "CATEGORY", deletedCategory.id],
      ),
    ).toHaveLength(0);
    expect(
      await db.getFirstAsync(
        `SELECT id FROM sync_conflicts WHERE id = ? AND user_id = ?;`,
        ["unrelated-conflict", userId],
      ),
    ).not.toBeNull();
    expect(
      await db.getFirstAsync(
        `SELECT id FROM sync_conflicts WHERE id = ? AND user_id = ?;`,
        ["other-user-conflict", "other-user"],
      ),
    ).not.toBeNull();
    expect(
      await db.getFirstAsync(
        `SELECT id FROM deletion_tombstones WHERE id = ?;`,
        ["stale-category-delete"],
      ),
    ).toBeNull();
    const pending = await getPendingLocalChanges(db, userId);
    expect(
      pending.some(
        (change) =>
          change.entity_type === "CATEGORY" &&
          change.entity_id === deletedCategory.id,
      ),
    ).toBe(false);
  });

  it("keeps the CATEGORY and conflict when no safe fallback exists", async () => {
    const onlyCategory = await createLocalCategory(db, userId, {
      name: "Única",
      voice_command: "unica",
    });
    const entry = await createLocalEntry(db, userId, {
      category_id: onlyCategory.id,
      content: "No debe quedar huérfana",
    });
    await insertConflict("unsafe-category-delete", "CATEGORY", onlyCategory.id);

    const { getByTestId, findByText } = await render(
      <ConflictResolver db={db} userId={userId} />,
    );
    await waitFor(() =>
      expect(
        getByTestId("btn-keep-remote-unsafe-category-delete"),
      ).toBeTruthy(),
    );
    fireEvent.press(getByTestId("btn-keep-remote-unsafe-category-delete"));

    expect(await findByText(/no existe otra categoría local/i)).toBeTruthy();
    expect(
      await db.getFirstAsync(
        `SELECT id FROM categories WHERE id = ? AND user_id = ?;`,
        [onlyCategory.id, userId],
      ),
    ).not.toBeNull();
    expect(
      await db.getFirstAsync<{ category_id: string }>(
        `SELECT category_id FROM entries WHERE id = ? AND user_id = ?;`,
        [entry.id, userId],
      ),
    ).toMatchObject({ category_id: onlyCategory.id });
    expect(
      await db.getFirstAsync(
        `SELECT id FROM sync_conflicts WHERE id = ? AND user_id = ?;`,
        ["unsafe-category-delete", userId],
      ),
    ).not.toBeNull();
  });

  it("accepts a TAG tombstone and removes only its associations", async () => {
    const category = await createLocalCategory(db, userId, {
      name: "Notas",
      voice_command: "notas",
    });
    const deletedTag = await createLocalTag(db, userId, { name: "Urgente" });
    const keptTag = await createLocalTag(db, userId, { name: "Casa" });
    const entry = await createLocalEntry(db, userId, {
      category_id: category.id,
      content: "Entrada conservada",
      tag_ids: [deletedTag.id, keptTag.id],
    });
    await insertConflict("tag-delete", "TAG", deletedTag.id);

    const { getByTestId } = await render(
      <ConflictResolver db={db} userId={userId} />,
    );
    await waitFor(() =>
      expect(getByTestId("conflict-card-tag-delete")).toBeTruthy(),
    );
    fireEvent.press(getByTestId("btn-keep-remote-tag-delete"));
    await waitFor(() => expect(getByTestId("no-conflicts")).toBeTruthy());

    expect(
      await db.getFirstAsync(
        `SELECT id FROM tags WHERE id = ? AND user_id = ?;`,
        [deletedTag.id, userId],
      ),
    ).toBeNull();
    expect(
      await db.getFirstAsync(
        `SELECT id FROM entries WHERE id = ? AND user_id = ?;`,
        [entry.id, userId],
      ),
    ).not.toBeNull();
    expect(
      await db.getFirstAsync(
        `SELECT id FROM entry_tags WHERE entry_id = ? AND tag_id = ? AND user_id = ?;`,
        [entry.id, deletedTag.id, userId],
      ),
    ).toBeNull();
    expect(
      await db.getFirstAsync(
        `SELECT id FROM entry_tags WHERE entry_id = ? AND tag_id = ? AND user_id = ?;`,
        [entry.id, keptTag.id, userId],
      ),
    ).not.toBeNull();
  });

  it("accepts an ENTRY tombstone and removes only its tag associations", async () => {
    const category = await createLocalCategory(db, userId, {
      name: "Registro",
      voice_command: "registro",
    });
    const tag = await createLocalTag(db, userId, { name: "Compartida" });
    const deletedEntry = await createLocalEntry(db, userId, {
      category_id: category.id,
      content: "Entrada eliminada",
      tag_ids: [tag.id],
    });
    const keptEntry = await createLocalEntry(db, userId, {
      category_id: category.id,
      content: "Entrada conservada",
      tag_ids: [tag.id],
    });
    await insertConflict("entry-delete", "ENTRY", deletedEntry.id);

    const { getByTestId } = await render(
      <ConflictResolver db={db} userId={userId} />,
    );
    await waitFor(() =>
      expect(getByTestId("conflict-card-entry-delete")).toBeTruthy(),
    );
    fireEvent.press(getByTestId("btn-keep-remote-entry-delete"));
    await waitFor(() => expect(getByTestId("no-conflicts")).toBeTruthy());

    expect(
      await db.getFirstAsync(
        `SELECT id FROM entries WHERE id = ? AND user_id = ?;`,
        [deletedEntry.id, userId],
      ),
    ).toBeNull();
    expect(
      await db.getFirstAsync(
        `SELECT id FROM entry_tags WHERE entry_id = ? AND user_id = ?;`,
        [deletedEntry.id, userId],
      ),
    ).toBeNull();
    expect(
      await db.getFirstAsync(
        `SELECT id FROM entries WHERE id = ? AND user_id = ?;`,
        [keptEntry.id, userId],
      ),
    ).not.toBeNull();
    expect(
      await db.getFirstAsync(
        `SELECT id FROM entry_tags WHERE entry_id = ? AND tag_id = ? AND user_id = ?;`,
        [keptEntry.id, tag.id, userId],
      ),
    ).not.toBeNull();
  });
});
