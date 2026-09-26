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

  it("handles offline network failures gracefully without throwing", async () => {
    const mockOfflineFetch = jest
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch"));

    const res = await syncEngine(db, {
      apiBaseUrl,
      token,
      userId,
      fetchFn: mockOfflineFetch as unknown as typeof fetch,
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe("Failed to fetch");
  });
});
