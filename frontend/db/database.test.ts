import { MemoryDatabaseAdapter, MIGRATIONS, runMigrations } from "./database";

describe("SQLite Local Database Setup & Migrations", () => {
  it("initializes schema and applies initial migrations on fresh database", async () => {
    const db = new MemoryDatabaseAdapter();
    const version = await runMigrations(db);

    expect(version).toBe(6);
    expect(db.getAppliedMigrations()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(db.getTableNames()).toContain("schema_migrations");
    expect(db.getTableNames()).toContain("categories");
    expect(db.getTableNames()).toContain("tags");
    expect(db.getTableNames()).toContain("entries");
    expect(db.getTableNames()).toContain("entry_tags");
    expect(db.getTableNames()).toContain("save_preferences");
    expect(db.getTableNames()).toContain("capture_corrections");
    expect(db.getTableNames()).toContain("deletion_tombstones");
    expect(db.getTableNames()).toContain("sync_cursors");
    expect(db.getTableNames()).toContain("sync_conflicts");
  });

  it("is idempotent on reopening database with already applied migrations", async () => {
    const db = new MemoryDatabaseAdapter();
    const version1 = await runMigrations(db);
    expect(version1).toBe(6);

    const version2 = await runMigrations(db);
    expect(version2).toBe(6);
    expect(db.getAppliedMigrations()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("correctly tracks migration versions when new migrations are added", async () => {
    const db = new MemoryDatabaseAdapter();
    await runMigrations(db);

    // Simulate adding migration 7
    MIGRATIONS.push({
      version: 7,
      sql: `CREATE TABLE IF NOT EXISTS future_feature (id TEXT PRIMARY KEY);`,
    });

    const newVersion = await runMigrations(db);
    expect(newVersion).toBe(7);
    expect(db.getAppliedMigrations()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(db.getTableNames()).toContain("future_feature");

    // Clean up mock migration array
    MIGRATIONS.pop();
  });

  it("persists tables across reinstantiation when localStorage is available", async () => {
    const mockStorage: Record<string, string> = {};
    const originalWindow = (globalThis as unknown as { window?: unknown })
      .window;
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: {
        getItem: (k: string) => mockStorage[k] ?? null,
        setItem: (k: string, v: string) => {
          mockStorage[k] = v;
        },
      },
    };

    try {
      const db1 = new MemoryDatabaseAdapter("test_db_key");
      await runMigrations(db1);
      await db1.runAsync(
        "INSERT INTO categories (id, user_id, kind, name, name_normalized, voice_command, voice_command_normalized, description, color, icon, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          "cat-test",
          "u1",
          "STANDARD",
          "TestCat",
          "testcat",
          "testcat",
          "testcat",
          "",
          "#fff",
          "folder",
          "2026-01-01",
          "2026-01-01",
          1,
        ],
      );

      const db2 = new MemoryDatabaseAdapter("test_db_key");
      const cats = await db2.getAllAsync<{ id: string }>(
        "SELECT * FROM categories WHERE id = ?",
        ["cat-test"],
      );
      expect(cats.length).toBe(1);
      expect(cats[0].id).toBe("cat-test");
    } finally {
      (globalThis as unknown as { window: unknown }).window = originalWindow;
    }
  });

  describe("IN (...) clause and fail-safe condition parsing (#135)", () => {
    it("selectively deletes rows matching IN (...) without deleting unaffected rows", async () => {
      const db = new MemoryDatabaseAdapter();
      await runMigrations(db);

      // Insert 3 test entries
      await db.runAsync(
        "INSERT INTO entries (id, user_id, category_id, content, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          "id-to-delete-1",
          "user-1",
          "cat-1",
          "Seed 1",
          "2026-10-01",
          "2026-10-01",
          1,
        ],
      );
      await db.runAsync(
        "INSERT INTO entries (id, user_id, category_id, content, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          "id-to-delete-2",
          "user-1",
          "cat-1",
          "Seed 2",
          "2026-10-01",
          "2026-10-01",
          1,
        ],
      );
      await db.runAsync(
        "INSERT INTO entries (id, user_id, category_id, content, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          "id-to-keep",
          "user-1",
          "cat-1",
          "User Entry",
          "2026-10-29",
          "2026-10-29",
          1,
        ],
      );

      // Execute selective DELETE matching the seed purge pattern in App.tsx
      await db.runAsync(
        "DELETE FROM entries WHERE id IN ('id-to-delete-1', 'id-to-delete-2');",
      );

      const remaining = await db.getAllAsync<{ id: string; content: string }>(
        "SELECT * FROM entries WHERE user_id = ?",
        ["user-1"],
      );

      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe("id-to-keep");
      expect(remaining[0].content).toBe("User Entry");
    });

    it("evaluates parameterized IN (?, ?) queries properly in SELECT", async () => {
      const db = new MemoryDatabaseAdapter();
      await runMigrations(db);

      await db.runAsync(
        "INSERT INTO entries (id, user_id, category_id, content, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ["entry-a", "user-1", "cat-1", "A", "2026-10-01", "2026-10-01", 1],
      );
      await db.runAsync(
        "INSERT INTO entries (id, user_id, category_id, content, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ["entry-b", "user-1", "cat-1", "B", "2026-10-01", "2026-10-01", 1],
      );
      await db.runAsync(
        "INSERT INTO entries (id, user_id, category_id, content, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ["entry-c", "user-1", "cat-1", "C", "2026-10-01", "2026-10-01", 1],
      );

      const res = await db.getAllAsync<{ id: string }>(
        "SELECT * FROM entries WHERE id IN (?, ?)",
        ["entry-a", "entry-c"],
      );
      expect(res.map((r) => r.id)).toEqual(["entry-a", "entry-c"]);
    });

    it("fails safely and does not match all rows when given an unrecognized WHERE condition", async () => {
      const db = new MemoryDatabaseAdapter();
      await runMigrations(db);

      await db.runAsync(
        "INSERT INTO entries (id, user_id, category_id, content, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          "safe-entry",
          "user-1",
          "cat-1",
          "Content",
          "2026-10-01",
          "2026-10-01",
          1,
        ],
      );

      // Attempt deletion with an unrecognized condition syntax
      await db.runAsync("DELETE FROM entries WHERE some_unknown_syntax_here;");

      const res = await db.getAllAsync<{ id: string }>(
        "SELECT * FROM entries WHERE user_id = ?",
        ["user-1"],
      );
      // Entry must remain safe, not accidentally deleted
      expect(res.length).toBe(1);
      expect(res[0].id).toBe("safe-entry");
    });

    it("enforces primary key uniqueness on INSERT and evaluates NULL, numeric literals, COALESCE, and version + 1 in UPDATE", async () => {
      const db = new MemoryDatabaseAdapter();
      await runMigrations(db);

      await db.runAsync(
        "INSERT INTO entries (id, user_id, category_id, content, task_status, reminder_enabled, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, 1, ?, ?, 1)",
        [
          "e-1",
          "u-1",
          "cat-1",
          "Tarea 1",
          "PENDING",
          "2026-10-01",
          "2026-10-01",
        ],
      );
      // Duplicate PK insert replaces rather than duplicating row
      await db.runAsync(
        "INSERT INTO entries (id, user_id, category_id, content, task_status, reminder_enabled, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, 1, ?, ?, 1)",
        [
          "e-1",
          "u-1",
          "cat-1",
          "Tarea 1",
          "PENDING",
          "2026-10-01",
          "2026-10-01",
        ],
      );

      const allAfterInsert = await db.getAllAsync<{ id: string }>(
        "SELECT * FROM entries WHERE user_id = ?",
        ["u-1"],
      );
      expect(allAfterInsert.length).toBe(1);

      await db.runAsync(
        "UPDATE entries SET category_id = ?, task_status = 'PENDING', task_priority = COALESCE(task_priority, 'MEDIUM'), reminder_enabled = 0, version = version + 1 WHERE id = ? AND user_id = ?;",
        ["cat-tareas", "e-1", "u-1"],
      );

      const updated = await db.getFirstAsync<{
        category_id: string;
        task_status: string | null;
        task_priority: string | null;
        reminder_enabled: number;
        version: number;
      }>("SELECT * FROM entries WHERE id = ? AND user_id = ?", ["e-1", "u-1"]);

      expect(updated?.category_id).toBe("cat-tareas");
      expect(updated?.task_status).toBe("PENDING");
      expect(updated?.task_priority).toBe("MEDIUM");
      expect(updated?.reminder_enabled).toBe(0);
      expect(updated?.version).toBe(2);

      await db.runAsync(
        "UPDATE entries SET task_status = NULL, task_priority = NULL WHERE id = ? AND user_id = ?;",
        ["e-1", "u-1"],
      );

      const cleared = await db.getFirstAsync<{
        task_status: string | null;
        task_priority: string | null;
      }>("SELECT * FROM entries WHERE id = ? AND user_id = ?", ["e-1", "u-1"]);

      expect(cleared?.task_status).toBeNull();
      expect(cleared?.task_priority).toBeNull();
    });
  });
});
