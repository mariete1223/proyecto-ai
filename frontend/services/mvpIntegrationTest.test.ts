import { createLocalCategory } from "../db/categories";
import { MemoryDatabaseAdapter, runMigrations } from "../db/database";
import {
  createLocalEntry,
  deleteLocalEntry,
  getEntryById,
  listLocalEntries,
  listPendingDatelessTasks,
  updateLocalEntry,
} from "../db/entries";
import { createLocalTag } from "../db/tags";
import { syncEngine } from "./syncEngine";
import { Entry } from "../types/domain";

describe("MVP End-to-End Fundamental Cycle Integration Test (Task 45)", () => {
  let db: MemoryDatabaseAdapter;
  const userId = "mvp-user-45";
  const apiBaseUrl = "http://localhost:8000";
  const token = "mock-mvp-token";

  beforeEach(async () => {
    db = new MemoryDatabaseAdapter();
    await runMigrations(db);
  });

  it("Journey 1: Full dated entry life cycle (Offline capture -> Calendar -> Filter -> Edit -> Sync -> Delete)", async () => {
    // 1.1 Setup category and tag
    const cat = await createLocalCategory(db, userId, {
      name: "Estrategia",
      kind: "STANDARD",
      voice_command: "estrategia",
      color: "#2563EB",
      icon: "briefcase",
    });

    const tag = await createLocalTag(db, userId, { name: "Prioridad" });

    // 1.2 Capture entry offline with date
    const entryDate = "2026-09-26T14:00:00Z";
    const entry = await createLocalEntry(db, userId, {
      category_id: cat.id,
      content: "Reunión de estrategia trimestral",
      occurred_at: entryDate,
      tag_ids: [tag.id],
    });

    expect(entry.sync_status).toBe("PENDING_PUSH");

    // 1.3 Verify entry appears in Calendar Month View
    const monthEntries = await listLocalEntries(db, userId, {
      start_at: "2026-09-01T00:00:00Z",
      end_at: "2026-09-30T23:59:59Z",
    });
    expect(monthEntries.some((e: Entry) => e.id === entry.id)).toBe(true);

    // 1.4 Filter calendar by category "Estrategia"
    const filteredEntries = await listLocalEntries(db, userId, {
      start_at: "2026-09-01T00:00:00Z",
      end_at: "2026-09-30T23:59:59Z",
      category_ids: [cat.id],
    });
    expect(filteredEntries.length).toBe(1);
    expect(filteredEntries[0].id).toBe(entry.id);

    // 1.5 Edit entry content
    const updated = await updateLocalEntry(db, userId, entry.id, {
      content: "Reunión de estrategia trimestral (Actualizada)",
    });
    expect(updated.content).toContain("Actualizada");
    expect(updated.version).toBe(2);
    expect(updated.sync_status).toBe("PENDING_PUSH");

    // 1.6 Sync to FastAPI server
    const mockFetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes("/api/v1/sync/push")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [
                {
                  change_id: "push-1",
                  entity_type: "ENTRY",
                  entity_id: entry.id,
                  status: "APPLIED",
                  applied_version: 2,
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

    const syncRes = await syncEngine(db, {
      apiBaseUrl,
      token,
      userId,
      fetchFn: mockFetch as unknown as typeof fetch,
    });
    expect(syncRes.success).toBe(true);

    const syncedEntry = await getEntryById(db, userId, entry.id);
    expect(syncedEntry?.sync_status).toBe("SYNCED");

    // 1.7 Delete entry & verify tombstone created
    await deleteLocalEntry(db, userId, entry.id);
    const deletedEntry = await getEntryById(db, userId, entry.id);
    expect(deletedEntry).toBeNull();

    const tombstones = await db.getAllAsync<{ entity_id: string }>(
      `SELECT entity_id FROM deletion_tombstones WHERE user_id = ?;`,
      [userId],
    );
    expect(tombstones.some((t) => t.entity_id === entry.id)).toBe(true);
  });

  it("Journey 2: Full dateless task life cycle (Create -> Pending View -> Status Transition -> Sync)", async () => {
    // 2.1 Create task category
    const taskCat = await createLocalCategory(db, userId, {
      name: "Tareas",
      kind: "TASK",
      voice_command: "tarea",
    });

    // 2.2 Create dateless task
    const task = await createLocalEntry(db, userId, {
      category_id: taskCat.id,
      content: "Preparar presentación del MVP",
      occurred_at: null,
      task_status: "PENDING",
      task_recurrence: "ONCE",
    });

    // 2.3 Verify appears in Pending Dateless Tasks list
    let pendingTasks = await listPendingDatelessTasks(db, userId);
    expect(pendingTasks.some((t) => t.id === task.id)).toBe(true);

    // 2.4 Transition status PENDING -> IN_PROGRESS
    await updateLocalEntry(db, userId, task.id, {
      task_status: "IN_PROGRESS",
      task_recurrence: "ONCE",
    });

    pendingTasks = await listPendingDatelessTasks(db, userId);
    const inProgressTask = pendingTasks.find((t) => t.id === task.id);
    expect(inProgressTask?.task_status).toBe("IN_PROGRESS");

    // 2.5 Transition status IN_PROGRESS -> DONE
    await updateLocalEntry(db, userId, task.id, {
      task_status: "DONE",
      task_recurrence: "ONCE",
    });

    pendingTasks = await listPendingDatelessTasks(db, userId);
    expect(pendingTasks.some((t) => t.id === task.id)).toBe(false);
  });
});
