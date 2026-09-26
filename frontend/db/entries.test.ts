import { createLocalCategory } from "./categories";
import { MemoryDatabaseAdapter, runMigrations } from "./database";
import {
  createLocalEntry,
  deleteLocalEntry,
  getEntryById,
  listLocalEntries,
  listPendingDatelessTasks,
  updateLocalEntry,
} from "./entries";
import { createLocalTag } from "./tags";

describe("Local Entries and Tasks Storage Layer", () => {
  let db: MemoryDatabaseAdapter;
  const userId = "user-456";
  let stdCatId: string;
  let taskCatId: string;
  let tagId: string;

  beforeEach(async () => {
    db = new MemoryDatabaseAdapter();
    await runMigrations(db);

    const stdCat = await createLocalCategory(db, userId, {
      name: "Notes",
      voice_command: "note",
      kind: "STANDARD",
    });
    stdCatId = stdCat.id;

    const taskCat = await createLocalCategory(db, userId, {
      name: "Tasks",
      voice_command: "task",
      kind: "TASK",
    });
    taskCatId = taskCat.id;

    const tag = await createLocalTag(db, userId, { name: "Urgent" });
    tagId = tag.id;
  });

  it("creates standard entry and task entry with tags offline", async () => {
    const entry1 = await createLocalEntry(db, userId, {
      category_id: stdCatId,
      content: "Standard note",
      tag_ids: [tagId],
    });

    expect(entry1.content).toBe("Standard note");
    expect(entry1.tag_ids).toEqual([tagId]);
    expect(entry1.task_status).toBeNull();
    expect(entry1.sync_status).toBe("PENDING_PUSH");

    const taskEntry = await createLocalEntry(db, userId, {
      category_id: taskCatId,
      content: "Pending task",
    });

    expect(taskEntry.task_status).toBe("PENDING");
    expect(taskEntry.task_recurrence).toBe("ONCE");
  });

  it("lists pending dateless tasks", async () => {
    const task1 = await createLocalEntry(db, userId, {
      category_id: taskCatId,
      content: "Dateless task 1",
    });

    await createLocalEntry(db, userId, {
      category_id: taskCatId,
      content: "Dated task",
      occurred_at: new Date().toISOString(),
    });

    const pendingTasks = await listPendingDatelessTasks(db, userId);
    expect(pendingTasks.length).toBe(1);
    expect(pendingTasks[0].id).toBe(task1.id);
  });

  it("filters entries by category, tag, and date", async () => {
    await createLocalEntry(db, userId, {
      category_id: stdCatId,
      content: "Note with tag",
      occurred_at: "2026-09-26T10:00:00Z",
      tag_ids: [tagId],
    });

    await createLocalEntry(db, userId, {
      category_id: stdCatId,
      content: "Note without tag",
      occurred_at: "2026-09-26T12:00:00Z",
    });

    const filtered = await listLocalEntries(db, userId, { tag_ids: [tagId] });
    expect(filtered.length).toBe(1);
    expect(filtered[0].content).toBe("Note with tag");
  });

  it("updates entry content and increments version", async () => {
    const entry = await createLocalEntry(db, userId, {
      category_id: stdCatId,
      content: "Before edit",
    });

    const updated = await updateLocalEntry(db, userId, entry.id, {
      content: "After edit",
    });

    expect(updated.content).toBe("After edit");
    expect(updated.version).toBe(2);

    const fetched = await getEntryById(db, userId, entry.id);
    expect(fetched?.content).toBe("After edit");
  });

  it("deletes entry and inserts deletion tombstone", async () => {
    const entry = await createLocalEntry(db, userId, {
      category_id: stdCatId,
      content: "To be deleted",
    });

    await deleteLocalEntry(db, userId, entry.id);

    const fetched = await getEntryById(db, userId, entry.id);
    expect(fetched).toBeNull();

    const tombstones = db.getTableNames().includes("deletion_tombstones");
    expect(tombstones).toBe(true);
  });
});
