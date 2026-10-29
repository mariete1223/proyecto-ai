export function generateUuid(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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
        color TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'SYNCED'
      );

      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        title TEXT,
        occurred_at TEXT,
        content TEXT NOT NULL,
        task_status TEXT,
        task_recurrence TEXT,
        task_priority TEXT,
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
  {
    version: 2,
    sql: `
      CREATE TABLE IF NOT EXISTS sync_cursors (
        user_id TEXT PRIMARY KEY,
        cursor TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_conflicts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        server_entity TEXT NOT NULL,
        error_message TEXT,
        created_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 3,
    sql: `
      ALTER TABLE entries ADD COLUMN reminder_enabled INTEGER DEFAULT 0;
      ALTER TABLE entries ADD COLUMN reminder_time TEXT;
      ALTER TABLE entries ADD COLUMN reminder_end_time TEXT;
      ALTER TABLE entries ADD COLUMN reminder_recurrence TEXT;
      ALTER TABLE entries ADD COLUMN reminder_offset_minutes INTEGER DEFAULT 0;
    `,
  },
  {
    version: 4,
    sql: `
      ALTER TABLE tags ADD COLUMN color TEXT;
    `,
  },
  {
    version: 5,
    sql: `
      ALTER TABLE entries ADD COLUMN reminder_offsets_minutes TEXT;
    `,
  },
  {
    version: 6,
    sql: `
      CREATE INDEX IF NOT EXISTS idx_entries_occurred_at ON entries (user_id, occurred_at);
      CREATE INDEX IF NOT EXISTS idx_entry_tags_entry_user ON entry_tags (entry_id, user_id);
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

function parseWhereConditions(
  whereClause: string | undefined,
  params: unknown[],
  startParamIdx: number = 0,
): {
  matchRow: (row: Record<string, unknown>) => boolean;
  consumedParams: number;
} {
  if (!whereClause || !whereClause.trim()) {
    return { matchRow: () => true, consumedParams: 0 };
  }

  let paramIdx = startParamIdx;
  const orParts = whereClause.split(/\s+OR\s+/i);
  const orBranches: ((row: Record<string, unknown>) => boolean)[][] = [];

  for (const orPart of orParts) {
    let cleanedOrPart = orPart.trim();
    if (
      cleanedOrPart.startsWith("(") &&
      cleanedOrPart.endsWith(")") &&
      !/^\([a-z0-9_]+\s+(IN|NOT\s+IN)\s*\(/i.test(cleanedOrPart)
    ) {
      cleanedOrPart = cleanedOrPart.slice(1, -1).trim();
    }
    const rawConds = cleanedOrPart.split(/\s+AND\s+/i);
    const andMatchers: ((row: Record<string, unknown>) => boolean)[] = [];

    for (const rawCond of rawConds) {
      let cond = rawCond.trim();
      while (
        cond.startsWith("(") &&
        cond.endsWith(")") &&
        !/\s+(IN|NOT\s+IN)\s*\(/i.test(cond)
      ) {
        cond = cond.slice(1, -1).trim();
      }
      const openCount = (cond.match(/\(/g) || []).length;
      const closeCount = (cond.match(/\)/g) || []).length;
      if (closeCount > openCount && cond.endsWith(")")) {
        cond = cond.slice(0, -(closeCount - openCount)).trim();
      } else if (openCount > closeCount && cond.startsWith("(")) {
        cond = cond.slice(openCount - closeCount).trim();
      }
      if (!cond) continue;

      // IS NOT NULL
      const isNotNullMatch = cond.match(/^([a-z0-9_]+)\s+IS\s+NOT\s+NULL$/i);
      if (isNotNullMatch && isNotNullMatch[1]) {
        const col = isNotNullMatch[1].toLowerCase();
        andMatchers.push((row) => row[col] !== null && row[col] !== undefined);
        continue;
      }

      // IS NULL
      const isNullMatch = cond.match(/^([a-z0-9_]+)\s+IS\s+NULL$/i);
      if (isNullMatch && isNullMatch[1]) {
        const col = isNullMatch[1].toLowerCase();
        andMatchers.push((row) => row[col] === null || row[col] === undefined);
        continue;
      }

      // trim(col) != ''
      const trimNotEqMatch = cond.match(
        /^trim\(([a-z0-9_]+)\)\s*(!=|<>)\s*['"](.*)['"]$/i,
      );
      if (trimNotEqMatch && trimNotEqMatch[1]) {
        const col = trimNotEqMatch[1].toLowerCase();
        const val = trimNotEqMatch[3] ?? "";
        andMatchers.push((row) => {
          const strVal =
            typeof row[col] === "string" ? (row[col] as string).trim() : "";
          return strVal !== val;
        });
        continue;
      }

      // IN (...) or NOT IN (...)
      const inMatch = cond.match(
        /^([a-z0-9_]+)\s+(NOT\s+IN|IN)\s*\(([^)]+)\)$/i,
      );
      if (inMatch && inMatch[1] && inMatch[2] && inMatch[3]) {
        const col = inMatch[1].toLowerCase();
        const isNotIn = inMatch[2].toUpperCase().includes("NOT");
        const rawTokens = inMatch[3].split(",").map((s) => s.trim());
        const targetValues: unknown[] = [];
        for (const token of rawTokens) {
          if (token === "?") {
            targetValues.push(params[paramIdx++]);
          } else {
            targetValues.push(token.replace(/^['"]|['"]$/g, ""));
          }
        }
        andMatchers.push((row) => {
          const rowVal = row[col];
          const has = targetValues.some(
            (tv) => tv === rowVal || String(tv) === String(rowVal),
          );
          return isNotIn ? !has : has;
        });
        continue;
      }

      // Comparison operators: >=, <=, !=, <>, >, <, =
      const compMatch = cond.match(
        /^([a-z0-9_]+)\s*(>=|<=|!=|<>|>|<|=)\s*(.+)$/i,
      );
      if (compMatch && compMatch[1] && compMatch[2] && compMatch[3]) {
        const col = compMatch[1].toLowerCase();
        const op = compMatch[2];
        const rightSide = compMatch[3].trim();

        let targetVal: unknown;
        if (rightSide === "?") {
          targetVal = params[paramIdx++];
        } else {
          targetVal = rightSide.replace(/^['"]|['"]$/g, "");
        }

        andMatchers.push((row) => {
          const rowVal = row[col];
          if (op === "=") {
            return rowVal === targetVal;
          } else if (op === "!=" || op === "<>") {
            return rowVal !== targetVal;
          } else if (op === ">=") {
            if (rowVal === null || rowVal === undefined) return false;
            return (rowVal as any) >= (targetVal as any);
          } else if (op === "<=") {
            if (rowVal === null || rowVal === undefined) return false;
            return (rowVal as any) <= (targetVal as any);
          } else if (op === ">") {
            if (rowVal === null || rowVal === undefined) return false;
            return (rowVal as any) > (targetVal as any);
          } else if (op === "<") {
            if (rowVal === null || rowVal === undefined) return false;
            return (rowVal as any) < (targetVal as any);
          }
          return true;
        });
        continue;
      }

      // Si una condición no fue reconocida pero el texto no estaba vacío,
      // fail-safe: no permitir que evalúe a true indiscriminadamente.
      andMatchers.push(() => false);
    }

    if (
      andMatchers.length === 0 &&
      rawConds.filter((s) => s.trim()).length > 0
    ) {
      andMatchers.push(() => false);
    }

    orBranches.push(andMatchers);
  }

  return {
    matchRow: (row: Record<string, unknown>) =>
      orBranches.some((branch) => branch.every((m) => m(row))),
    consumedParams: paramIdx - startParamIdx,
  };
}

export class MemoryDatabaseAdapter implements DatabaseAdapter {
  private tables = new Map<string, Record<string, unknown>[]>();
  private migrations: { version: number; applied_at: string }[] = [];
  private storageKey: string | null;

  constructor(storageKey: string | null = "proyecto_ai_db_v1") {
    this.storageKey = storageKey;
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (
      this.storageKey &&
      typeof window !== "undefined" &&
      window.localStorage
    ) {
      try {
        const raw = window.localStorage.getItem(this.storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.tables) {
            Object.entries(parsed.tables).forEach(([table, rows]) => {
              this.tables.set(table, rows as Record<string, unknown>[]);
            });
          }
          if (parsed.migrations) {
            this.migrations = parsed.migrations;
          }
        }
      } catch {
        // Fallback ignore
      }
    }
  }

  private saveToStorage() {
    if (
      this.storageKey &&
      typeof window !== "undefined" &&
      window.localStorage
    ) {
      try {
        const tablesObj: Record<string, Record<string, unknown>[]> = {};
        this.tables.forEach((rows, table) => {
          tablesObj[table] = rows;
        });
        window.localStorage.setItem(
          this.storageKey,
          JSON.stringify({
            tables: tablesObj,
            migrations: this.migrations,
          }),
        );
      } catch {
        // Fallback ignore
      }
    }
  }

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
    this.saveToStorage();
  }

  async runAsync(
    sql: string,
    params: unknown[] = [],
  ): Promise<{ lastInsertRowId: number; changes: number }> {
    const trimmed = sql.trim().replace(/;$/, "");

    if (trimmed.toUpperCase().startsWith("INSERT INTO SCHEMA_MIGRATIONS")) {
      const version = params[0] as number;
      const appliedAt = params[1] as string;
      this.migrations.push({ version, applied_at: appliedAt });
      this.saveToStorage();
      return { lastInsertRowId: version, changes: 1 };
    }

    // Parse INSERT INTO <table> (<cols>) VALUES (<values>)
    const insertMatch = trimmed.match(
      /INSERT INTO\s+([a-z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i,
    );
    if (insertMatch && insertMatch[1] && insertMatch[2]) {
      const tableName = insertMatch[1].toLowerCase();
      const cols = insertMatch[2].split(",").map((c) => c.trim());
      const rawVals = insertMatch[3]
        ? insertMatch[3].split(",").map((v) => v.trim())
        : [];
      let table = this.tables.get(tableName);
      if (!table) {
        table = [];
        this.tables.set(tableName, table);
      }

      const row: Record<string, unknown> = {};
      let pIdx = 0;
      cols.forEach((col, idx) => {
        const rawVal = rawVals[idx];
        if (rawVal !== undefined && rawVal !== "?") {
          row[col] = rawVal.replace(/^'|'$/g, "");
        } else {
          row[col] = params[pIdx++];
        }
      });
      table.push(row);
      this.saveToStorage();
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

      const { matchRow } = parseWhereConditions(whereClause, params, paramIdx);

      let changes = 0;
      for (const row of table) {
        if (matchRow(row)) {
          Object.assign(row, updates);
          changes++;
        }
      }
      this.saveToStorage();
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

      const { matchRow } = parseWhereConditions(whereClause, params, 0);

      let changes = 0;
      const remaining: Record<string, unknown>[] = [];
      for (const row of table) {
        if (matchRow(row)) {
          changes++;
        } else {
          remaining.push(row);
        }
      }
      this.tables.set(tableName, remaining);
      this.saveToStorage();
      return { lastInsertRowId: 0, changes };
    }

    this.saveToStorage();
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
    const trimmed = sql.trim().replace(/;$/, "");

    if (trimmed.toUpperCase().includes("MAX(VERSION)")) {
      if (this.migrations.length === 0) {
        return [{ max_v: null }] as unknown as T[];
      }
      const maxV = Math.max(...this.migrations.map((m) => m.version));
      return [{ max_v: maxV }] as unknown as T[];
    }

    const match = trimmed.match(
      /SELECT\s+.*?\s+FROM\s+([a-z0-9_]+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY.+)?$/i,
    );
    if (match && match[1]) {
      const tableName = match[1].toLowerCase();
      const table = this.tables.get(tableName) ?? [];
      let whereClause = match[2];
      if (whereClause) {
        whereClause = whereClause.replace(/\s+ORDER\s+BY.+$/i, "").trim();
      }

      if (!whereClause) {
        return table as unknown as T[];
      }

      const { matchRow } = parseWhereConditions(whereClause, params, 0);
      const filtered = table.filter(matchRow);
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
