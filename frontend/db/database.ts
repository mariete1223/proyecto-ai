export interface DatabaseAdapter {
  execAsync(sql: string): Promise<void>;
  runAsync(
    sql: string,
    params?: unknown[],
  ): Promise<{ lastInsertRowId: number; changes: number }>;
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

export const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        name_normalized TEXT NOT NULL,
        voice_command TEXT NOT NULL,
        voice_command_normalized TEXT NOT NULL,
        description TEXT NOT NULL,
        color TEXT NOT NULL,
        icon TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'SYNCED'
      );

      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        name_normalized TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'SYNCED'
      );

      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        occurred_at TEXT,
        content TEXT NOT NULL,
        task_status TEXT,
        task_recurrence TEXT,
        capture_session_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'PENDING_PUSH'
      );

      CREATE TABLE IF NOT EXISTS entry_tags (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        entry_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'PENDING_PUSH'
      );

      CREATE TABLE IF NOT EXISTS save_preferences (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        mode TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'SYNCED'
      );

      CREATE TABLE IF NOT EXISTS capture_corrections (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        entry_id TEXT NOT NULL,
        capture_session_id TEXT NOT NULL,
        field TEXT NOT NULL,
        interpreted_value TEXT,
        accepted_value TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'PENDING_PUSH'
      );

      CREATE TABLE IF NOT EXISTS deletion_tombstones (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        deleted_at TEXT NOT NULL,
        deleted_version INTEGER NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'PENDING_PUSH'
      );
    `,
  },
];

export async function runMigrations(db: DatabaseAdapter): Promise<number> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const currentVersionRow = await db.getFirstAsync<{ max_v: number | null }>(
    `SELECT MAX(version) as max_v FROM schema_migrations;`,
  );
  let currentVersion = currentVersionRow?.max_v ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      await db.execAsync(migration.sql);
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?);`,
        [migration.version, now],
      );
      currentVersion = migration.version;
    }
  }

  return currentVersion;
}

export class MemoryDatabaseAdapter implements DatabaseAdapter {
  private tables = new Map<string, Record<string, unknown>[]>();
  private migrations: { version: number; applied_at: string }[] = [];

  async execAsync(sql: string): Promise<void> {
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      if (stmt.toUpperCase().includes("CREATE TABLE IF NOT EXISTS")) {
        const match = stmt.match(/CREATE TABLE IF NOT EXISTS\s+([a-z0-9_]+)/i);
        if (match && match[1]) {
          const tableName = match[1].toLowerCase();
          if (!this.tables.has(tableName)) {
            this.tables.set(tableName, []);
          }
        }
      }
    }
  }

  async runAsync(
    sql: string,
    params: unknown[] = [],
  ): Promise<{ lastInsertRowId: number; changes: number }> {
    const trimmed = sql.trim();

    if (trimmed.toUpperCase().startsWith("INSERT INTO SCHEMA_MIGRATIONS")) {
      const version = params[0] as number;
      const appliedAt = params[1] as string;
      this.migrations.push({ version, applied_at: appliedAt });
      return { lastInsertRowId: version, changes: 1 };
    }

    // Parse INSERT INTO <table> (<cols>) VALUES (...)
    const insertMatch = trimmed.match(
      /INSERT INTO\s+([a-z0-9_]+)\s*\(([^)]+)\)\s*VALUES/i,
    );
    if (insertMatch && insertMatch[1] && insertMatch[2]) {
      const tableName = insertMatch[1].toLowerCase();
      const cols = insertMatch[2].split(",").map((c) => c.trim());
      let table = this.tables.get(tableName);
      if (!table) {
        table = [];
        this.tables.set(tableName, table);
      }

      const row: Record<string, unknown> = {};
      cols.forEach((col, idx) => {
        row[col] = params[idx];
      });
      table.push(row);
      return { lastInsertRowId: table.length, changes: 1 };
    }

    // Parse UPDATE <table> SET <sets> WHERE <where>
    const updateMatch = trimmed.match(/UPDATE\s+([a-z0-9_]+)\s+SET\s+(.+)/i);
    if (updateMatch && updateMatch[1] && updateMatch[2]) {
      const tableName = updateMatch[1].toLowerCase();
      const table = this.tables.get(tableName) ?? [];
      const setAndWhere = updateMatch[2];
      const whereSplit = setAndWhere.split(/\s+WHERE\s+/i);
      const setClause = whereSplit[0];
      const whereClause = whereSplit[1];

      const setAssignments = setClause.split(",").map((s) => s.trim());
      let paramIdx = 0;

      const updates: Record<string, unknown> = {};
      for (const assign of setAssignments) {
        const parts = assign.split("=").map((s) => s.trim());
        const col = parts[0];
        const valStr = parts[1];
        if (valStr === "?") {
          updates[col] = params[paramIdx++];
        } else {
          updates[col] = valStr ? valStr.replace(/^'|'$/g, "") : "";
        }
      }

      // Extract where column names
      const whereCols: string[] = [];
      if (whereClause) {
        const conds = whereClause.split(/\s+AND\s+/i);
        for (const cond of conds) {
          const colName = cond.split(/=|!=/)[0].trim();
          whereCols.push(colName);
        }
      }
      const whereVals: unknown[] = [];
      for (let i = 0; i < whereCols.length; i++) {
        whereVals.push(params[paramIdx++]);
      }

      let changes = 0;
      for (const row of table) {
        let match = true;
        for (let i = 0; i < whereCols.length; i++) {
          if (row[whereCols[i]] !== whereVals[i]) {
            match = false;
            break;
          }
        }
        if (match) {
          Object.assign(row, updates);
          changes++;
        }
      }
      return { lastInsertRowId: 0, changes };
    }

    // Parse DELETE FROM <table> WHERE <where>
    const deleteMatch = trimmed.match(
      /DELETE FROM\s+([a-z0-9_]+)\s+WHERE\s+(.+)/i,
    );
    if (deleteMatch && deleteMatch[1] && deleteMatch[2]) {
      const tableName = deleteMatch[1].toLowerCase();
      const table = this.tables.get(tableName) ?? [];
      const whereClause = deleteMatch[2];

      const conds = whereClause.split(/\s+AND\s+/i);
      const whereCols: string[] = [];
      for (const cond of conds) {
        const colName = cond.split(/=|!=/)[0].trim();
        whereCols.push(colName);
      }

      let changes = 0;
      const remaining: Record<string, unknown>[] = [];
      for (const row of table) {
        let match = true;
        for (let i = 0; i < whereCols.length; i++) {
          if (row[whereCols[i]] !== params[i]) {
            match = false;
            break;
          }
        }
        if (match) {
          changes++;
        } else {
          remaining.push(row);
        }
      }
      this.tables.set(tableName, remaining);
      return { lastInsertRowId: 0, changes };
    }

    return { lastInsertRowId: 0, changes: 1 };
  }

  async getFirstAsync<T>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T | null> {
    const results = await this.getAllAsync<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (sql.toUpperCase().includes("MAX(VERSION)")) {
      if (this.migrations.length === 0) {
        return [{ max_v: null }] as unknown as T[];
      }
      const maxV = Math.max(...this.migrations.map((m) => m.version));
      return [{ max_v: maxV }] as unknown as T[];
    }

    const match = sql.match(
      /SELECT\s+.*?\s+FROM\s+([a-z0-9_]+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY.+)?;/i,
    );
    if (match && match[1]) {
      const tableName = match[1].toLowerCase();
      const table = this.tables.get(tableName) ?? [];
      const whereClause = match[2];

      if (!whereClause) {
        return table as unknown as T[];
      }

      const conds = whereClause.split(/\s+AND\s+/i);
      const whereCols: string[] = [];
      const isNotEqual: boolean[] = [];

      for (const cond of conds) {
        if (cond.includes("!=")) {
          const colName = cond.split("!=")[0].trim();
          whereCols.push(colName);
          isNotEqual.push(true);
        } else {
          const colName = cond.split("=")[0].trim();
          whereCols.push(colName);
          isNotEqual.push(false);
        }
      }

      const filtered = table.filter((row) => {
        for (let i = 0; i < whereCols.length; i++) {
          const col = whereCols[i];
          const notEq = isNotEqual[i];
          const expectedVal = params[i];
          if (notEq) {
            if (row[col] === expectedVal) return false;
          } else {
            if (row[col] !== expectedVal) return false;
          }
        }
        return true;
      });

      return filtered as unknown as T[];
    }

    return [];
  }

  getTableNames(): string[] {
    return Array.from(this.tables.keys());
  }

  getAppliedMigrations(): number[] {
    return this.migrations.map((m) => m.version);
  }
}
