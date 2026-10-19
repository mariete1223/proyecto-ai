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

  describe("Task Priority in Entries", () => {
    it("creates a task with explicit priority and defaults to MEDIUM when omitted", async () => {
      const highTask = await createLocalEntry(db, userId, {
        category_id: taskCatId,
        content: "High priority task",
        task_priority: "HIGH",
      });
      expect(highTask.task_priority).toBe("HIGH");

      const defaultTask = await createLocalEntry(db, userId, {
        category_id: taskCatId,
        content: "Default priority task",
      });
      expect(defaultTask.task_priority).toBe("MEDIUM");

      const fetchedHigh = await getEntryById(db, userId, highTask.id);
      expect(fetchedHigh?.task_priority).toBe("HIGH");
    });

    it("prevents setting task_priority on non-task category", async () => {
      await expect(
        createLocalEntry(db, userId, {
          category_id: stdCatId,
          content: "Invalid task priority on standard note",
          task_priority: "HIGH",
        }),
      ).rejects.toThrow(
        "Task fields can only be set for categories of kind TASK.",
      );
    });

    it("updates task_priority successfully", async () => {
      const task = await createLocalEntry(db, userId, {
        category_id: taskCatId,
        content: "Task to change priority",
        task_priority: "LOW",
      });
      expect(task.task_priority).toBe("LOW");

      const updated = await updateLocalEntry(db, userId, task.id, {
        task_priority: "HIGH",
      });
      expect(updated.task_priority).toBe("HIGH");

      const fetched = await getEntryById(db, userId, task.id);
      expect(fetched?.task_priority).toBe("HIGH");
    });

    it("automatically enables reminder for Alerta category when occurred_at is set", async () => {
      const alertaCat = await createLocalCategory(db, userId, {
        name: "Alerta",
        voice_command: "alerta",
        kind: "TASK",
      });

      const entry = await createLocalEntry(db, userId, {
        category_id: alertaCat.id,
        content: "Tomar antibiótico",
        occurred_at: "2026-10-15T08:00:00.000Z",
      });

      expect(entry.reminder_enabled).toBe(true);
      expect(entry.reminder_offset_minutes).toBe(0);
      expect(entry.reminder_offsets_minutes).toEqual([0]);

      // Si el usuario especificó explícitamente desactivarlo, se respeta false
      const disabledEntry = await createLocalEntry(db, userId, {
        category_id: alertaCat.id,
        content: "Alerta sin notificacion",
        occurred_at: "2026-10-15T09:00:00.000Z",
        reminder_enabled: false,
      });

      expect(disabledEntry.reminder_enabled).toBe(false);
    });

    it("automatically defaults occurred_at to now, sets reminder, and clears task fields for Alerta even with null occurred_at (#92)", async () => {
      const alertaCat = await createLocalCategory(db, userId, {
        name: "Alerta",
        voice_command: "alerta",
        kind: "TASK",
      });

      const entry = await createLocalEntry(db, userId, {
        category_id: alertaCat.id,
        content: "Alerta sin fecha explícita",
      });

      expect(entry.occurred_at).toBeTruthy();
      expect(entry.reminder_enabled).toBe(true);
      expect(entry.reminder_offset_minutes).toBe(0);
      expect(entry.task_status).toBeNull();
      expect(entry.task_priority).toBeNull();
    });

    it("automatically sets reminder 1 day before (1440 min) for non-Alerta categories when occurred_at is set", async () => {
      // Tareas con fecha
      const taskWithDate = await createLocalEntry(db, userId, {
        category_id: taskCatId,
        content: "Entrega de proyecto",
        occurred_at: "2026-10-20T10:00:00.000Z",
      });

      expect(taskWithDate.reminder_enabled).toBe(true);
      expect(taskWithDate.reminder_offset_minutes).toBe(1440);
      expect(taskWithDate.reminder_offsets_minutes).toEqual([1440]);

      // Notas estándar con fecha
      const noteWithDate = await createLocalEntry(db, userId, {
        category_id: stdCatId,
        content: "Cita médica",
        occurred_at: "2026-10-21T16:00:00.000Z",
      });

      expect(noteWithDate.reminder_enabled).toBe(true);
      expect(noteWithDate.reminder_offset_minutes).toBe(1440);
      expect(noteWithDate.reminder_offsets_minutes).toEqual([1440]);

      // Entrada sin fecha no activa recordatorio automático
      const datelessEntry = await createLocalEntry(db, userId, {
        category_id: taskCatId,
        content: "Tarea sin fecha ni hora",
      });

      expect(datelessEntry.reminder_enabled).toBeFalsy();
      expect(datelessEntry.reminder_offset_minutes).toBeNull();

      // Respeta false explícito
      const explicitFalseEntry = await createLocalEntry(db, userId, {
        category_id: taskCatId,
        content: "Tarea con fecha pero sin aviso",
        occurred_at: "2026-10-22T10:00:00.000Z",
        reminder_enabled: false,
      });

      expect(explicitFalseEntry.reminder_enabled).toBe(false);

      // Respeta offsets personalizados especificados explícitamente
      const customOffsetsEntry = await createLocalEntry(db, userId, {
        category_id: taskCatId,
        content: "Tarea con aviso 1 hora antes",
        occurred_at: "2026-10-22T10:00:00.000Z",
        reminder_enabled: true,
        reminder_offset_minutes: 60,
        reminder_offsets_minutes: [60],
      });

      expect(customOffsetsEntry.reminder_enabled).toBe(true);
      expect(customOffsetsEntry.reminder_offset_minutes).toBe(60);
      expect(customOffsetsEntry.reminder_offsets_minutes).toEqual([60]);
    });
  });
});
