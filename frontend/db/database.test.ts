import { MemoryDatabaseAdapter, MIGRATIONS, runMigrations } from "./database";

describe("SQLite Local Database Setup & Migrations", () => {
  it("initializes schema and applies initial migrations on fresh database", async () => {
    const db = new MemoryDatabaseAdapter();
    const version = await runMigrations(db);

    expect(version).toBe(2);
    expect(db.getAppliedMigrations()).toEqual([1, 2]);
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
    expect(version1).toBe(2);

    const version2 = await runMigrations(db);
    expect(version2).toBe(2);
    expect(db.getAppliedMigrations()).toEqual([1, 2]);
  });

  it("correctly tracks migration versions when new migrations are added", async () => {
    const db = new MemoryDatabaseAdapter();
    await runMigrations(db);

    // Simulate adding migration 3
    MIGRATIONS.push({
      version: 3,
      sql: `CREATE TABLE IF NOT EXISTS future_feature (id TEXT PRIMARY KEY);`,
    });

    const newVersion = await runMigrations(db);
    expect(newVersion).toBe(3);
    expect(db.getAppliedMigrations()).toEqual([1, 2, 3]);
    expect(db.getTableNames()).toContain("future_feature");

    // Clean up mock migration array
    MIGRATIONS.pop();
  });
});
