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
});
