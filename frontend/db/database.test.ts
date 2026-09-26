import { MemoryDatabaseAdapter, MIGRATIONS, runMigrations } from "./database";

describe("SQLite Local Database Setup & Migrations", () => {
  it("initializes schema and applies initial migration on fresh database", async () => {
    const db = new MemoryDatabaseAdapter();
    const version = await runMigrations(db);

    expect(version).toBe(1);
    expect(db.getAppliedMigrations()).toEqual([1]);
    expect(db.getTableNames()).toContain("schema_migrations");
    expect(db.getTableNames()).toContain("categories");
    expect(db.getTableNames()).toContain("tags");
    expect(db.getTableNames()).toContain("entries");
    expect(db.getTableNames()).toContain("entry_tags");
    expect(db.getTableNames()).toContain("save_preferences");
    expect(db.getTableNames()).toContain("capture_corrections");
    expect(db.getTableNames()).toContain("deletion_tombstones");
  });

  it("is idempotent on reopening database with already applied migrations", async () => {
    const db = new MemoryDatabaseAdapter();
    const version1 = await runMigrations(db);
    expect(version1).toBe(1);

    const version2 = await runMigrations(db);
    expect(version2).toBe(1);
    expect(db.getAppliedMigrations()).toEqual([1]);
  });

  it("correctly tracks migration versions when new migrations are added", async () => {
    const db = new MemoryDatabaseAdapter();
    await runMigrations(db);

    // Simulate adding migration 2
    MIGRATIONS.push({
      version: 2,
      sql: `CREATE TABLE IF NOT EXISTS future_feature (id TEXT PRIMARY KEY);`,
    });

    const newVersion = await runMigrations(db);
    expect(newVersion).toBe(2);
    expect(db.getAppliedMigrations()).toEqual([1, 2]);
    expect(db.getTableNames()).toContain("future_feature");

    // Clean up mock migration array
    MIGRATIONS.pop();
  });
});
