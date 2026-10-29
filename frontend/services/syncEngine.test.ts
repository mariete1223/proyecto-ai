import { createLocalCategory } from "../db/categories";
import { MemoryDatabaseAdapter, runMigrations } from "../db/database";
import { createLocalEntry, deleteLocalEntry } from "../db/entries";
import { createLocalTag } from "../db/tags";
import { getPendingLocalChanges, syncEngine } from "./syncEngine";

describe("SyncEngine Service (Task 40)", () => {
  let db: MemoryDatabaseAdapter;
  const userId = "user-sync-123";
  const token = "mock-jwt-token";
  const apiBaseUrl = "http://localhost:8000";

  beforeEach(async () => {
    db = new MemoryDatabaseAdapter();
    await runMigrations(db);
  });

  it("extracts pending local changes for push", async () => {
    const cat = await createLocalCategory(db, userId, {
      name: "Trabajo",
      voice_command: "trabajo",
    });

    const tag = await createLocalTag(db, userId, { name: "Urgente" });

    const ent = await createLocalEntry(db, userId, {
      category_id: cat.id,
      content: "Tarea pendiente de sync",
      tag_ids: [tag.id],
    });

    await deleteLocalEntry(db, userId, ent.id);

    const pending = await getPendingLocalChanges(db, userId);

    expect(pending.length).toBeGreaterThanOrEqual(1);
    const entryDeleteChange = pending.find(
      (c) => c.entity_id === ent.id && c.action === "DELETE",
    );
    expect(entryDeleteChange).toBeTruthy();
  });

  it("performs full sync with push and pull", async () => {
    const cat = await createLocalCategory(db, userId, {
      name: "Notas",
      voice_command: "nota",
    });

    const ent = await createLocalEntry(db, userId, {
      category_id: cat.id,
      content: "Nota local a push",
    });

    const mockFetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes("/api/v1/sync/push")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [
                {
                  change_id: "c-1",
                  entity_type: "ENTRY",
                  entity_id: ent.id,
                  status: "APPLIED",
                  applied_version: 1,
                },
              ],
            }),
        });
      }

      if (url.includes("/api/v1/sync/pull")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              changes: [
                {
                  entity_type: "TAG",
                  entity_id: "remote-tag-1",
                  action: "CREATE",
                  payload: {
                    name: "Remota",
                    name_normalized: "remota",
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    version: 1,
                  },
                },
              ],
              tombstones: [],
              next_cursor: "cursor-abc-123",
              has_more: false,
            }),
        });
      }

      return Promise.reject(new Error("Unknown endpoint"));
    });

    const res = await syncEngine(db, {
      apiBaseUrl,
      token,
      userId,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(res.success).toBe(true);
    expect(res.pushed_applied).toBeGreaterThanOrEqual(1);
    expect(res.pulled_changes).toBe(1);

    // Verify local entry updated to SYNCED
    const syncedEntry = await db.getFirstAsync<{ sync_status: string }>(
      `SELECT sync_status FROM entries WHERE id = ? AND user_id = ?;`,
      [ent.id, userId],
    );
    expect(syncedEntry?.sync_status).toBe("SYNCED");

    // Verify pulled tag saved locally
    const pulledTag = await db.getFirstAsync<{ name: string }>(
      `SELECT name FROM tags WHERE id = ? AND user_id = ?;`,
      ["remote-tag-1", userId],
    );
    expect(pulledTag?.name).toBe("Remota");
  });

  it("handles push conflict response by recording conflict in sync_conflicts table", async () => {
    const cat = await createLocalCategory(db, userId, {
      name: "Proyectos",
      voice_command: "proyecto",
    });

    const ent = await createLocalEntry(db, userId, {
      category_id: cat.id,
      content: "Mi version local divergente",
    });

    const mockFetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes("/api/v1/sync/push")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [
                {
                  change_id: "c-conflict",
                  entity_type: "ENTRY",
                  entity_id: ent.id,
                  status: "CONFLICT",
                  server_entity: {
                    id: ent.id,
                    content: "Version remota en servidor",
                    version: 3,
                  },
                  error_message: "Version mismatch conflict",
                },
              ],
            }),
        });
      }

      if (url.includes("/api/v1/sync/pull")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              changes: [],
              tombstones: [],
              next_cursor: null,
              has_more: false,
            }),
        });
      }

      return Promise.reject(new Error("Unknown endpoint"));
    });

    const res = await syncEngine(db, {
      apiBaseUrl,
      token,
      userId,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(res.success).toBe(true);
    expect(res.pushed_conflicts).toBe(1);

    const conflictedEntry = await db.getFirstAsync<{ sync_status: string }>(
      `SELECT sync_status FROM entries WHERE id = ? AND user_id = ?;`,
      [ent.id, userId],
    );
    expect(conflictedEntry?.sync_status).toBe("CONFLICT");

    const conflictRow = await db.getFirstAsync<{ server_entity: string }>(
      `SELECT server_entity FROM sync_conflicts WHERE entity_id = ? AND user_id = ?;`,
      [ent.id, userId],
    );
    expect(conflictRow).toBeTruthy();
    expect(conflictRow?.server_entity).toContain("Version remota en servidor");
  });

  it("persists reminder fields when pulling new and updated entries from server (#132)", async () => {
    const alertCat = await createLocalCategory(db, userId, {
      id: "c3d4e5f6-a7b8-4901-c2d3-e4f5a6b7c8d9",
      name: "Alerta",
      voice_command: "alerta",
    });

    const mockFetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes("/api/v1/sync/push")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ results: [] }),
        });
      }

      if (url.includes("/api/v1/sync/pull")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              changes: [
                {
                  entity_type: "ENTRY",
                  entity_id: "entry-remote-alert-1",
                  action: "CREATE",
                  payload: {
                    category_id: alertCat.id,
                    title: "Anticonceptivo",
                    occurred_at: "2026-10-31T09:00:00.000Z",
                    content: "Tiene que ponérselo",
                    reminder_enabled: true,
                    reminder_offset_minutes: 0,
                    reminder_recurrence: "NONE",
                    reminder_offsets_minutes: [0],
                    version: 1,
                  },
                },
                {
                  entity_type: "ENTRY",
                  entity_id: "entry-remote-alert-implicit",
                  action: "CREATE",
                  payload: {
                    category_id: alertCat.id,
                    title: "Alerta implícita sin flag",
                    occurred_at: "2026-10-31T12:00:00.000Z",
                    content: "Aviso importante",
                    version: 1,
                  },
                },
              ],
              tombstones: [],
              next_cursor: "cursor-reminders-123",
              has_more: false,
            }),
        });
      }

      return Promise.reject(new Error("Unknown endpoint"));
    });

    const res = await syncEngine(db, {
      apiBaseUrl,
      token,
      userId,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(res.success).toBe(true);
    expect(res.pulled_changes).toBe(2);

    const savedAlert = await db.getFirstAsync<{
      reminder_enabled: number;
      reminder_offset_minutes: number;
      reminder_recurrence: string;
      reminder_offsets_minutes: string;
    }>(
      `SELECT reminder_enabled, reminder_offset_minutes, reminder_recurrence, reminder_offsets_minutes FROM entries WHERE id = ? AND user_id = ?;`,
      ["entry-remote-alert-1", userId],
    );

    expect(savedAlert).toBeTruthy();
    expect(savedAlert?.reminder_enabled).toBe(1);
    expect(savedAlert?.reminder_offset_minutes).toBe(0);
    expect(savedAlert?.reminder_recurrence).toBe("NONE");
    expect(savedAlert?.reminder_offsets_minutes).toBe("[0]");

    // Verify implicit alert entry also receives reminder_enabled = 1
    const savedImplicit = await db.getFirstAsync<{
      reminder_enabled: number;
      reminder_offset_minutes: number;
    }>(
      `SELECT reminder_enabled, reminder_offset_minutes FROM entries WHERE id = ? AND user_id = ?;`,
      ["entry-remote-alert-implicit", userId],
    );
    expect(savedImplicit).toBeTruthy();
    expect(savedImplicit?.reminder_enabled).toBe(1);
    expect(savedImplicit?.reminder_offset_minutes).toBe(0);
  });

  it("preserves task category and does not reassign orphan tasks to alert category (#140)", async () => {
    // Escenario #140: sólo existe la categoría Alerta en local y una tarea con categoría huérfana
    await db.runAsync(`DELETE FROM categories WHERE user_id = ?;`, [userId]);
    const alertCat = await createLocalCategory(db, userId, {
      id: "c3d4e5f6-a7b8-4901-c2d3-e4f5a6b7c8d9",
      name: "Alerta",
      voice_command: "alerta",
    });

    const taskCat = await createLocalCategory(db, userId, {
      id: "20e8f404-c429-43e8-8cf8-af9d51416d58",
      name: "Tareas",
      voice_command: "tarea",
      kind: "TASK",
    });

    const orphanTaskId = "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d";
    // Crear entrada huérfana con task_status
    await db.runAsync(
      `INSERT INTO entries (id, user_id, category_id, content, task_status, version, sync_status) VALUES (?, ?, ?, ?, ?, 1, 'PENDING_PUSH');`,
      [
        orphanTaskId,
        userId,
        "c0a80101-0000-4000-8000-000000000000",
        "Tengo que terminar la tarea",
        "PENDING",
      ],
    );

    const changes = await getPendingLocalChanges(db, userId);
    const entryChange = changes.find((c) => c.entity_id === orphanTaskId);
    expect(entryChange).toBeDefined();
    // Debe haber seleccionado la categoría TASK (Tareas) y NUNCA la categoría Alerta
    expect((entryChange?.payload as any).category_id).toBe(taskCat.id);
    expect((entryChange?.payload as any).category_id).not.toBe(alertCat.id);
  });
});
