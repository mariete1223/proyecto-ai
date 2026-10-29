import { DatabaseAdapter } from "../db/database";
import {
  applyRemoteDeletion,
  RemoteDeletionEntityType,
} from "./remoteDeletion";

export interface SyncConfig {
  apiBaseUrl: string;
  token: string;
  userId: string;
  fetchFn?: typeof fetch;
}

export interface SyncResult {
  success: boolean;
  pushed_applied: number;
  pushed_conflicts: number;
  pushed_errors: number;
  pulled_changes: number;
  pulled_tombstones: number;
  error?: string;
}

export interface SyncClientChange {
  change_id: string;
  entity_type: string;
  entity_id: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  base_version: number;
  payload: Record<string, unknown>;
}

export interface SyncPushChangeResult {
  change_id: string;
  entity_type: string;
  entity_id: string;
  status: "APPLIED" | "ALREADY_APPLIED" | "CONFLICT" | "REJECTED";
  applied_version?: number | null;
  server_entity?: Record<string, unknown> | null;
  error_message?: string | null;
}

export interface SyncPushResponse {
  results: SyncPushChangeResult[];
}

export interface SyncPullChange {
  entity_type: string;
  entity_id: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  payload: Record<string, unknown>;
}

export interface SyncTombstone {
  entity_type: string;
  entity_id: string;
  deleted_at: string;
  deleted_version: number;
}

export interface SyncPullResponse {
  changes: SyncPullChange[];
  tombstones: SyncTombstone[];
  next_cursor?: string | null;
  has_more: boolean;
}

function generateUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(id: unknown): boolean {
  return typeof id === "string" && UUID_REGEX.test(id);
}

export async function getPendingLocalChanges(
  db: DatabaseAdapter,
  userId: string,
): Promise<SyncClientChange[]> {
  const changes: SyncClientChange[] = [];

  // 1. Categories
  const catPending = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM categories WHERE user_id = ? AND sync_status = 'PENDING_PUSH';`,
    [userId],
  );
  const catError = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM categories WHERE user_id = ? AND sync_status = 'ERROR';`,
    [userId],
  );
  const categories = [...catPending, ...catError];
  for (const cat of categories) {
    let catId = String(cat.id);
    if (!isUuid(catId)) {
      const newUuid = generateUuid();
      await db.runAsync(`UPDATE categories SET id = ? WHERE id = ?;`, [
        newUuid,
        catId,
      ]);
      await db.runAsync(
        `UPDATE entries SET category_id = ? WHERE category_id = ?;`,
        [newUuid, catId],
      );
      catId = newUuid;
      cat.id = newUuid;
    }
    const { sync_status, ...payload } = cat;
    payload.id = catId;
    const version = typeof cat.version === "number" ? cat.version : 1;
    changes.push({
      change_id: generateUuid(),
      entity_type: "CATEGORY",
      entity_id: catId,
      action: version === 1 ? "CREATE" : "UPDATE",
      base_version: version === 1 ? 0 : version - 1,
      payload: payload as Record<string, unknown>,
    });
  }

  // 2. Tags
  const tagPending = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM tags WHERE user_id = ? AND sync_status = 'PENDING_PUSH';`,
    [userId],
  );
  const tagError = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM tags WHERE user_id = ? AND sync_status = 'ERROR';`,
    [userId],
  );
  const tags = [...tagPending, ...tagError];
  for (const tag of tags) {
    let tagId = String(tag.id);
    if (!isUuid(tagId)) {
      const newUuid = generateUuid();
      await db.runAsync(`UPDATE tags SET id = ? WHERE id = ?;`, [
        newUuid,
        tagId,
      ]);
      tagId = newUuid;
      tag.id = newUuid;
    }
    const { sync_status, ...payload } = tag;
    payload.id = tagId;
    const version = typeof tag.version === "number" ? tag.version : 1;
    changes.push({
      change_id: generateUuid(),
      entity_type: "TAG",
      entity_id: tagId,
      action: version === 1 ? "CREATE" : "UPDATE",
      base_version: version === 1 ? 0 : version - 1,
      payload: payload as Record<string, unknown>,
    });
  }

  // 3. Entries
  // Sanear posibles categorías huérfanas antes de subir
  const validCats = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM categories WHERE user_id = ?;`,
    [userId],
  );
  const validCatIds = new Set(validCats.map((c) => c.id));
  const fallbackCatId = validCats[0]?.id;

  const entPending = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM entries WHERE user_id = ? AND sync_status = 'PENDING_PUSH';`,
    [userId],
  );
  const entError = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM entries WHERE user_id = ? AND sync_status = 'ERROR';`,
    [userId],
  );
  const entries = [...entPending, ...entError];
  for (const entry of entries) {
    let entryId = String(entry.id);
    if (!isUuid(entryId)) {
      const newUuid = generateUuid();
      await db.runAsync(`UPDATE entries SET id = ? WHERE id = ?;`, [
        newUuid,
        entryId,
      ]);
      entryId = newUuid;
      entry.id = newUuid;
    }
    let currentCatId = String(entry.category_id || "");
    if ((!currentCatId || !validCatIds.has(currentCatId)) && fallbackCatId) {
      currentCatId = fallbackCatId;
      entry.category_id = fallbackCatId;
      await db.runAsync(`UPDATE entries SET category_id = ? WHERE id = ?;`, [
        fallbackCatId,
        entryId,
      ]);
    }
    const { sync_status, ...payload } = entry;
    payload.id = entryId;
    payload.category_id = currentCatId;
    const version = typeof entry.version === "number" ? entry.version : 1;
    changes.push({
      change_id: generateUuid(),
      entity_type: "ENTRY",
      entity_id: entryId,
      action: version === 1 ? "CREATE" : "UPDATE",
      base_version: version === 1 ? 0 : version - 1,
      payload: payload as Record<string, unknown>,
    });
  }

  // 4. Capture Corrections
  const corrPending = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM capture_corrections WHERE user_id = ? AND sync_status = 'PENDING_PUSH';`,
    [userId],
  );
  const corrError = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM capture_corrections WHERE user_id = ? AND sync_status = 'ERROR';`,
    [userId],
  );
  const corrections = [...corrPending, ...corrError];
  for (const corr of corrections) {
    let corrId = String(corr.id);
    if (!isUuid(corrId)) {
      const newUuid = generateUuid();
      await db.runAsync(`UPDATE capture_corrections SET id = ? WHERE id = ?;`, [
        newUuid,
        corrId,
      ]);
      corrId = newUuid;
      corr.id = newUuid;
    }
    const { sync_status, ...payload } = corr;
    payload.id = corrId;
    const version = typeof corr.version === "number" ? corr.version : 1;
    changes.push({
      change_id: generateUuid(),
      entity_type: "CAPTURE_CORRECTION",
      entity_id: corrId,
      action: version === 1 ? "CREATE" : "UPDATE",
      base_version: version === 1 ? 0 : version - 1,
      payload: payload as Record<string, unknown>,
    });
  }

  // 5. Entry Tags
  const etPending = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM entry_tags WHERE user_id = ? AND sync_status = 'PENDING_PUSH';`,
    [userId],
  );
  const etError = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM entry_tags WHERE user_id = ? AND sync_status = 'ERROR';`,
    [userId],
  );
  const entryTags = [...etPending, ...etError];
  for (const et of entryTags) {
    let etId = String(et.id);
    if (!isUuid(etId)) {
      const newUuid = generateUuid();
      await db.runAsync(`UPDATE entry_tags SET id = ? WHERE id = ?;`, [
        newUuid,
        etId,
      ]);
      etId = newUuid;
      et.id = newUuid;
    }
    const { sync_status, ...payload } = et;
    payload.id = etId;
    const version = typeof et.version === "number" ? et.version : 1;
    changes.push({
      change_id: generateUuid(),
      entity_type: "ENTRY_TAG",
      entity_id: etId,
      action: version === 1 ? "CREATE" : "UPDATE",
      base_version: version === 1 ? 0 : version - 1,
      payload: payload as Record<string, unknown>,
    });
  }

  // 6. Deletion Tombstones
  const tombstones = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM deletion_tombstones WHERE user_id = ? AND sync_status = 'PENDING_PUSH';`,
    [userId],
  );
  for (const tb of tombstones) {
    const deletedVersion =
      typeof tb.deleted_version === "number" ? tb.deleted_version : 2;
    changes.push({
      change_id: generateUuid(),
      entity_type: String(tb.entity_type),
      entity_id: String(tb.entity_id),
      action: "DELETE",
      base_version: deletedVersion > 1 ? deletedVersion - 1 : 1,
      payload: {},
    });
  }

  return changes;
}

export async function processPushResults(
  db: DatabaseAdapter,
  userId: string,
  results: SyncPushChangeResult[],
): Promise<{ applied: number; conflicts: number; errors: number }> {
  let applied = 0;
  let conflicts = 0;
  let errors = 0;

  const now = new Date().toISOString();

  for (const res of results) {
    const entityType = res.entity_type;
    const entityId = res.entity_id;

    if (res.status === "APPLIED" || res.status === "ALREADY_APPLIED") {
      applied++;
      const appliedVersion = res.applied_version;

      if (entityType === "CATEGORY") {
        if (appliedVersion) {
          await db.runAsync(
            `UPDATE categories SET sync_status = 'SYNCED', version = ? WHERE id = ? AND user_id = ?;`,
            [appliedVersion, entityId, userId],
          );
        } else {
          await db.runAsync(
            `UPDATE categories SET sync_status = 'SYNCED' WHERE id = ? AND user_id = ?;`,
            [entityId, userId],
          );
        }
      } else if (entityType === "TAG") {
        if (appliedVersion) {
          await db.runAsync(
            `UPDATE tags SET sync_status = 'SYNCED', version = ? WHERE id = ? AND user_id = ?;`,
            [appliedVersion, entityId, userId],
          );
        } else {
          await db.runAsync(
            `UPDATE tags SET sync_status = 'SYNCED' WHERE id = ? AND user_id = ?;`,
            [entityId, userId],
          );
        }
      } else if (entityType === "ENTRY") {
        if (appliedVersion) {
          await db.runAsync(
            `UPDATE entries SET sync_status = 'SYNCED', version = ? WHERE id = ? AND user_id = ?;`,
            [appliedVersion, entityId, userId],
          );
        } else {
          await db.runAsync(
            `UPDATE entries SET sync_status = 'SYNCED' WHERE id = ? AND user_id = ?;`,
            [entityId, userId],
          );
        }
      } else if (entityType === "CAPTURE_CORRECTION") {
        if (appliedVersion) {
          await db.runAsync(
            `UPDATE capture_corrections SET sync_status = 'SYNCED', version = ? WHERE id = ? AND user_id = ?;`,
            [appliedVersion, entityId, userId],
          );
        } else {
          await db.runAsync(
            `UPDATE capture_corrections SET sync_status = 'SYNCED' WHERE id = ? AND user_id = ?;`,
            [entityId, userId],
          );
        }
      } else if (entityType === "ENTRY_TAG") {
        if (appliedVersion) {
          await db.runAsync(
            `UPDATE entry_tags SET sync_status = 'SYNCED', version = ? WHERE id = ? AND user_id = ?;`,
            [appliedVersion, entityId, userId],
          );
        } else {
          await db.runAsync(
            `UPDATE entry_tags SET sync_status = 'SYNCED' WHERE id = ? AND user_id = ?;`,
            [entityId, userId],
          );
        }
      }

      // Mark local deletion tombstones as synced
      await db.runAsync(
        `UPDATE deletion_tombstones SET sync_status = 'SYNCED' WHERE entity_type = ? AND entity_id = ? AND user_id = ?;`,
        [entityType, entityId, userId],
      );
    } else if (res.status === "CONFLICT") {
      conflicts++;

      if (entityType === "CATEGORY") {
        await db.runAsync(
          `UPDATE categories SET sync_status = 'CONFLICT' WHERE id = ? AND user_id = ?;`,
          [entityId, userId],
        );
      } else if (entityType === "TAG") {
        await db.runAsync(
          `UPDATE tags SET sync_status = 'CONFLICT' WHERE id = ? AND user_id = ?;`,
          [entityId, userId],
        );
      } else if (entityType === "ENTRY") {
        await db.runAsync(
          `UPDATE entries SET sync_status = 'CONFLICT' WHERE id = ? AND user_id = ?;`,
          [entityId, userId],
        );
      }

      // Record conflict in sync_conflicts table for manual resolution
      const serverEntityStr = res.server_entity
        ? JSON.stringify(res.server_entity)
        : "{}";
      const conflictId = generateUuid();
      await db.runAsync(
        `INSERT INTO sync_conflicts (id, user_id, entity_type, entity_id, server_entity, error_message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [
          conflictId,
          userId,
          entityType,
          entityId,
          serverEntityStr,
          res.error_message ?? "Conflict detected during sync",
          now,
        ],
      );
    } else if (res.status === "REJECTED") {
      errors++;

      if (entityType === "CATEGORY") {
        await db.runAsync(
          `UPDATE categories SET sync_status = 'ERROR' WHERE id = ? AND user_id = ?;`,
          [entityId, userId],
        );
      } else if (entityType === "TAG") {
        await db.runAsync(
          `UPDATE tags SET sync_status = 'ERROR' WHERE id = ? AND user_id = ?;`,
          [entityId, userId],
        );
      } else if (entityType === "ENTRY") {
        await db.runAsync(
          `UPDATE entries SET sync_status = 'ERROR' WHERE id = ? AND user_id = ?;`,
          [entityId, userId],
        );
      }
    }
  }

  return { applied, conflicts, errors };
}

export async function applyRemoteChanges(
  db: DatabaseAdapter,
  userId: string,
  changes: SyncPullChange[],
  tombstones: SyncTombstone[],
): Promise<{ pulled_changes: number; pulled_tombstones: number }> {
  let pulledChangesCount = 0;
  let pulledTombstonesCount = 0;

  // Load local deletion tombstones to prevent resurrecting deleted entities (Zombie Resurrection #124)
  const localTombstones = await db.getAllAsync<{
    entity_type: string;
    entity_id: string;
  }>(
    `SELECT entity_type, entity_id FROM deletion_tombstones WHERE user_id = ?;`,
    [userId],
  );
  const deletedEntityIds = new Set(
    localTombstones.map((t) => `${t.entity_type}:${t.entity_id}`),
  );

  // Process pulled changes (CREATE / UPDATE)
  for (const c of changes) {
    const entityType = c.entity_type;
    const entityId = c.entity_id;

    // Discard any remote change for entities that were deleted locally
    if (deletedEntityIds.has(`${entityType}:${entityId}`)) {
      continue;
    }

    pulledChangesCount++;
    const payload = c.payload;

    if (entityType === "CATEGORY") {
      // Buscar primero por ID (caso normal de sync)
      const existingById = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM categories WHERE id = ? AND user_id = ?;`,
        [entityId, userId],
      );

      if (existingById) {
        // Actualizar por ID
        await db.runAsync(
          `UPDATE categories SET kind = ?, name = ?, name_normalized = ?, voice_command = ?, voice_command_normalized = ?, description = ?, color = ?, icon = ?, updated_at = ?, version = ?, sync_status = 'SYNCED' WHERE id = ? AND user_id = ?;`,
          [
            payload.kind ?? "STANDARD",
            payload.name ?? "",
            payload.name_normalized ?? "",
            payload.voice_command ?? "",
            payload.voice_command_normalized ?? "",
            payload.description ?? "",
            payload.color ?? "#000000",
            payload.icon ?? "folder",
            payload.updated_at ?? new Date().toISOString(),
            payload.version ?? 1,
            entityId,
            userId,
          ],
        );
      } else {
        // Buscar por nombre normalizado para evitar duplicados
        // (ocurre cuando el item local tiene UUID distinto al del servidor)
        const existingByName = await db.getFirstAsync<{ id: string }>(
          `SELECT id FROM categories WHERE name_normalized = ? AND user_id = ?;`,
          [payload.name_normalized ?? "", userId],
        );

        if (existingByName) {
          // Re-vincular todas las entradas locales asociadas a este nuevo ID de categoría
          await db.runAsync(
            `UPDATE entries SET category_id = ?, sync_status = 'PENDING_PUSH' WHERE category_id = ? AND user_id = ?;`,
            [entityId, existingByName.id, userId],
          );
          // Actualizar el registro local con el ID del servidor y marcarlo como SYNCED
          await db.runAsync(
            `UPDATE categories SET id = ?, kind = ?, name = ?, name_normalized = ?, voice_command = ?, voice_command_normalized = ?, description = ?, color = ?, icon = ?, updated_at = ?, version = ?, sync_status = 'SYNCED' WHERE id = ? AND user_id = ?;`,
            [
              entityId, // re-asignar el UUID del servidor
              payload.kind ?? "STANDARD",
              payload.name ?? "",
              payload.name_normalized ?? "",
              payload.voice_command ?? "",
              payload.voice_command_normalized ?? "",
              payload.description ?? "",
              payload.color ?? "#000000",
              payload.icon ?? "folder",
              payload.updated_at ?? new Date().toISOString(),
              payload.version ?? 1,
              existingByName.id, // buscar por el ID local antiguo
              userId,
            ],
          );
        } else {
          // No existe ni por ID ni por nombre → insertar como nuevo
          await db.runAsync(
            `INSERT INTO categories (id, user_id, kind, name, name_normalized, voice_command, voice_command_normalized, description, color, icon, created_at, updated_at, version, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED');`,
            [
              entityId,
              userId,
              payload.kind ?? "STANDARD",
              payload.name ?? "",
              payload.name_normalized ?? "",
              payload.voice_command ?? "",
              payload.voice_command_normalized ?? "",
              payload.description ?? "",
              payload.color ?? "#000000",
              payload.icon ?? "folder",
              payload.created_at ?? new Date().toISOString(),
              payload.updated_at ?? new Date().toISOString(),
              payload.version ?? 1,
            ],
          );
        }
      }
    } else if (entityType === "TAG") {
      const existing = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM tags WHERE id = ? AND user_id = ?;`,
        [entityId, userId],
      );
      if (existing) {
        await db.runAsync(
          `UPDATE tags SET name = ?, name_normalized = ?, color = COALESCE(?, color), updated_at = ?, version = ?, sync_status = 'SYNCED' WHERE id = ? AND user_id = ?;`,
          [
            payload.name ?? "",
            payload.name_normalized ?? "",
            payload.color ?? null,
            payload.updated_at ?? new Date().toISOString(),
            payload.version ?? 1,
            entityId,
            userId,
          ],
        );
      } else {
        const existingByName = await db.getFirstAsync<{ id: string }>(
          `SELECT id FROM tags WHERE name_normalized = ? AND user_id = ?;`,
          [payload.name_normalized ?? "", userId],
        );
        if (existingByName) {
          const existingLinks = await db.getAllAsync<{
            id: string;
            entry_id: string;
          }>(
            `SELECT id, entry_id FROM entry_tags WHERE tag_id = ? AND user_id = ?;`,
            [existingByName.id, userId],
          );
          for (const link of existingLinks) {
            const hasTarget = await db.getFirstAsync<{ id: string }>(
              `SELECT id FROM entry_tags WHERE entry_id = ? AND tag_id = ? AND user_id = ?;`,
              [link.entry_id, entityId, userId],
            );
            if (hasTarget) {
              await db.runAsync(`DELETE FROM entry_tags WHERE id = ?;`, [
                link.id,
              ]);
            } else {
              await db.runAsync(
                `UPDATE entry_tags SET tag_id = ? WHERE id = ?;`,
                [entityId, link.id],
              );
            }
          }
          await db.runAsync(
            `UPDATE tags SET id = ?, name = ?, name_normalized = ?, color = COALESCE(?, color), updated_at = ?, version = ?, sync_status = 'SYNCED' WHERE id = ? AND user_id = ?;`,
            [
              entityId,
              payload.name ?? "",
              payload.name_normalized ?? "",
              payload.color ?? null,
              payload.updated_at ?? new Date().toISOString(),
              payload.version ?? 1,
              existingByName.id,
              userId,
            ],
          );
        } else {
          await db.runAsync(
            `INSERT INTO tags (id, user_id, name, name_normalized, color, created_at, updated_at, version, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED');`,
            [
              entityId,
              userId,
              payload.name ?? "",
              payload.name_normalized ?? "",
              payload.color ?? "#64748B",
              payload.created_at ?? new Date().toISOString(),
              payload.updated_at ?? new Date().toISOString(),
              payload.version ?? 1,
            ],
          );
        }
      }
    } else if (entityType === "ENTRY") {
      const existing = await db.getFirstAsync<{
        id: string;
        title?: string | null;
        reminder_enabled?: number | null;
        reminder_time?: string | null;
        reminder_end_time?: string | null;
        reminder_recurrence?: string | null;
        reminder_offset_minutes?: number | null;
        reminder_offsets_minutes?: string | null;
      }>(
        `SELECT id, title, reminder_enabled, reminder_time, reminder_end_time, reminder_recurrence, reminder_offset_minutes, reminder_offsets_minutes FROM entries WHERE id = ? AND user_id = ?;`,
        [entityId, userId],
      );
      const titleToUse =
        payload.title !== undefined &&
        payload.title !== null &&
        payload.title !== ""
          ? String(payload.title).trim()
          : (existing?.title ?? null);

      const ALERT_CAT_ID = "c3d4e5f6-a7b8-4901-c2d3-e4f5a6b7c8d9";
      let isAlertCategory = payload.category_id === ALERT_CAT_ID;
      if (!isAlertCategory && payload.category_id) {
        const cat = await db.getFirstAsync<{
          name?: string | null;
          name_normalized?: string | null;
        }>(`SELECT name, name_normalized FROM categories WHERE id = ?;`, [
          payload.category_id,
        ]);
        if (
          cat &&
          (cat.name_normalized === "alerta" ||
            cat.name?.trim().toLowerCase() === "alerta")
        ) {
          isAlertCategory = true;
        }
      }

      let reminderEnabled: number;
      if (isAlertCategory) {
        reminderEnabled = 1;
      } else if (
        payload.reminder_enabled !== undefined &&
        payload.reminder_enabled !== null
      ) {
        reminderEnabled = payload.reminder_enabled ? 1 : 0;
      } else if (
        existing?.reminder_enabled !== undefined &&
        existing?.reminder_enabled !== null
      ) {
        reminderEnabled = existing.reminder_enabled ? 1 : 0;
      } else {
        reminderEnabled = 0;
      }

      const reminderTime =
        payload.reminder_time !== undefined
          ? payload.reminder_time
            ? String(payload.reminder_time)
            : null
          : (existing?.reminder_time ?? null);

      const reminderEndTime =
        payload.reminder_end_time !== undefined
          ? payload.reminder_end_time
            ? String(payload.reminder_end_time)
            : null
          : (existing?.reminder_end_time ?? null);

      const reminderRecurrence =
        payload.reminder_recurrence !== undefined
          ? payload.reminder_recurrence
            ? String(payload.reminder_recurrence)
            : null
          : isAlertCategory
            ? "NONE"
            : (existing?.reminder_recurrence ?? null);

      let reminderOffsetMinutes: number | null = null;
      if (
        payload.reminder_offset_minutes !== undefined &&
        payload.reminder_offset_minutes !== null
      ) {
        reminderOffsetMinutes = Number(payload.reminder_offset_minutes);
      } else if (
        existing?.reminder_offset_minutes !== undefined &&
        existing?.reminder_offset_minutes !== null
      ) {
        reminderOffsetMinutes = Number(existing.reminder_offset_minutes);
      } else if (isAlertCategory) {
        reminderOffsetMinutes = 0;
      }

      let reminderOffsetsMinutesStr: string | null = null;
      if (Array.isArray(payload.reminder_offsets_minutes)) {
        reminderOffsetsMinutesStr = JSON.stringify(
          payload.reminder_offsets_minutes,
        );
      } else if (typeof payload.reminder_offsets_minutes === "string") {
        reminderOffsetsMinutesStr = payload.reminder_offsets_minutes;
      } else if (existing?.reminder_offsets_minutes) {
        reminderOffsetsMinutesStr = existing.reminder_offsets_minutes;
      } else if (isAlertCategory && reminderEnabled) {
        reminderOffsetsMinutesStr = JSON.stringify([
          reminderOffsetMinutes ?? 0,
        ]);
      }

      if (existing) {
        await db.runAsync(
          `UPDATE entries SET category_id = ?, title = ?, occurred_at = ?, content = ?, task_status = ?, task_recurrence = ?, task_priority = ?, capture_session_id = ?, reminder_enabled = ?, reminder_time = ?, reminder_end_time = ?, reminder_recurrence = ?, reminder_offset_minutes = ?, reminder_offsets_minutes = ?, updated_at = ?, version = ?, sync_status = 'SYNCED' WHERE id = ? AND user_id = ?;`,
          [
            payload.category_id,
            titleToUse,
            payload.occurred_at ?? null,
            payload.content ?? "",
            payload.task_status ?? null,
            payload.task_recurrence ?? null,
            payload.task_priority ?? null,
            payload.capture_session_id ?? null,
            reminderEnabled,
            reminderTime,
            reminderEndTime,
            reminderRecurrence,
            reminderOffsetMinutes,
            reminderOffsetsMinutesStr,
            payload.updated_at ?? new Date().toISOString(),
            payload.version ?? 1,
            entityId,
            userId,
          ],
        );
      } else {
        // Comprobar si ya existe una entrada local con el mismo contenido exacto
        // (por ejemplo, entradas semilla creadas con UUIDs locales distintos)
        const existingByContent = await db.getFirstAsync<{
          id: string;
          title?: string | null;
        }>(`SELECT id, title FROM entries WHERE user_id = ? AND content = ?;`, [
          userId,
          payload.content ?? "",
        ]);

        if (existingByContent) {
          const resolvedTitle =
            payload.title !== undefined &&
            payload.title !== null &&
            payload.title !== ""
              ? String(payload.title).trim()
              : (existingByContent.title ?? null);
          // Re-identificar la entrada local con el ID del servidor para no duplicar
          await db.runAsync(
            `UPDATE entries SET id = ?, category_id = ?, title = ?, occurred_at = ?, task_status = ?, task_recurrence = ?, task_priority = ?, capture_session_id = ?, reminder_enabled = ?, reminder_time = ?, reminder_end_time = ?, reminder_recurrence = ?, reminder_offset_minutes = ?, reminder_offsets_minutes = ?, updated_at = ?, version = ?, sync_status = 'SYNCED' WHERE id = ? AND user_id = ?;`,
            [
              entityId,
              payload.category_id,
              resolvedTitle,
              payload.occurred_at ?? null,
              payload.task_status ?? null,
              payload.task_recurrence ?? null,
              payload.task_priority ?? null,
              payload.capture_session_id ?? null,
              reminderEnabled,
              reminderTime,
              reminderEndTime,
              reminderRecurrence,
              reminderOffsetMinutes,
              reminderOffsetsMinutesStr,
              payload.updated_at ?? new Date().toISOString(),
              payload.version ?? 1,
              existingByContent.id,
              userId,
            ],
          );
          // Actualizar tags vinculadas si las hubiera
          await db.runAsync(
            `UPDATE entry_tags SET entry_id = ? WHERE entry_id = ? AND user_id = ?;`,
            [entityId, existingByContent.id, userId],
          );
        } else {
          await db.runAsync(
            `INSERT INTO entries (id, user_id, category_id, title, occurred_at, content, task_status, task_recurrence, task_priority, capture_session_id, reminder_enabled, reminder_time, reminder_end_time, reminder_recurrence, reminder_offset_minutes, reminder_offsets_minutes, created_at, updated_at, version, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED');`,
            [
              entityId,
              userId,
              payload.category_id,
              payload.title ? String(payload.title).trim() : null,
              payload.occurred_at ?? null,
              payload.content ?? "",
              payload.task_status ?? null,
              payload.task_recurrence ?? null,
              payload.task_priority ?? null,
              payload.capture_session_id ?? null,
              reminderEnabled,
              reminderTime,
              reminderEndTime,
              reminderRecurrence,
              reminderOffsetMinutes,
              reminderOffsetsMinutesStr,
              payload.created_at ?? new Date().toISOString(),
              payload.updated_at ?? new Date().toISOString(),
              payload.version ?? 1,
            ],
          );
        }
      }
    } else if (entityType === "ENTRY_TAG") {
      const entryId = String(payload.entry_id);
      const tagId = String(payload.tag_id);
      const existing = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM entry_tags WHERE id = ? AND user_id = ?;`,
        [entityId, userId],
      );
      if (existing) {
        await db.runAsync(
          `UPDATE entry_tags SET entry_id = ?, tag_id = ?, updated_at = ?, version = ?, sync_status = 'SYNCED' WHERE id = ? AND user_id = ?;`,
          [
            entryId,
            tagId,
            payload.updated_at ?? new Date().toISOString(),
            payload.version ?? 1,
            entityId,
            userId,
          ],
        );
      } else {
        const existingLink = await db.getFirstAsync<{ id: string }>(
          `SELECT id FROM entry_tags WHERE entry_id = ? AND tag_id = ? AND user_id = ?;`,
          [entryId, tagId, userId],
        );
        if (!existingLink) {
          await db.runAsync(
            `INSERT INTO entry_tags (id, user_id, entry_id, tag_id, created_at, updated_at, version, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, 'SYNCED');`,
            [
              entityId,
              userId,
              entryId,
              tagId,
              payload.created_at ?? new Date().toISOString(),
              payload.updated_at ?? new Date().toISOString(),
              payload.version ?? 1,
            ],
          );
        } else {
          await db.runAsync(
            `UPDATE entry_tags SET id = ?, sync_status = 'SYNCED', version = ? WHERE id = ? AND user_id = ?;`,
            [entityId, payload.version ?? 1, existingLink.id, userId],
          );
        }
      }
    }
  }

  // Process tombstones (DELETE)
  for (const tb of tombstones) {
    pulledTombstonesCount++;
    const entityType = tb.entity_type;
    const entityId = tb.entity_id;

    if (
      entityType === "CATEGORY" ||
      entityType === "TAG" ||
      entityType === "ENTRY"
    ) {
      await applyRemoteDeletion(
        db,
        userId,
        entityType as RemoteDeletionEntityType,
        entityId,
      );
    } else if (entityType === "ENTRY_TAG") {
      await db.runAsync(
        `DELETE FROM entry_tags WHERE id = ? AND user_id = ?;`,
        [entityId, userId],
      );
    }
  }

  return {
    pulled_changes: pulledChangesCount,
    pulled_tombstones: pulledTombstonesCount,
  };
}

export async function syncEngine(
  db: DatabaseAdapter,
  config: SyncConfig,
): Promise<SyncResult> {
  const fetchImpl = config.fetchFn ?? fetch;
  let pushedApplied = 0;
  let pushedConflicts = 0;
  let pushedErrors = 0;
  let totalPulledChanges = 0;
  let totalPulledTombstones = 0;

  try {
    // Phase 1: Push local pending changes
    const pendingChanges = await getPendingLocalChanges(db, config.userId);
    if (pendingChanges.length > 0) {
      const pushRes = await fetchImpl(`${config.apiBaseUrl}/api/v1/sync/push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.token}`,
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ client_changes: pendingChanges }),
      });

      if (!pushRes.ok) {
        return {
          success: false,
          pushed_applied: 0,
          pushed_conflicts: 0,
          pushed_errors: 0,
          pulled_changes: 0,
          pulled_tombstones: 0,
          error: `Push error: HTTP ${pushRes.status}`,
        };
      }

      const pushData = (await pushRes.json()) as SyncPushResponse;
      const stats = await processPushResults(
        db,
        config.userId,
        pushData.results || [],
      );
      pushedApplied = stats.applied;
      pushedConflicts = stats.conflicts;
      pushedErrors = stats.errors;
    }

    // Phase 2: Pull remote changes with cursor pagination
    let cursorRow = await db.getFirstAsync<{ cursor: string }>(
      `SELECT cursor FROM sync_cursors WHERE user_id = ?;`,
      [config.userId],
    );
    let cursor = cursorRow?.cursor ?? null;
    let hasMore = true;

    while (hasMore) {
      let pullUrl = `${config.apiBaseUrl}/api/v1/sync/pull?limit=50`;
      if (cursor) {
        pullUrl += `&cursor=${encodeURIComponent(cursor)}`;
      }

      const pullRes = await fetchImpl(pullUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "ngrok-skip-browser-warning": "true",
        },
      });

      if (!pullRes.ok) {
        return {
          success: false,
          pushed_applied: pushedApplied,
          pushed_conflicts: pushedConflicts,
          pushed_errors: pushedErrors,
          pulled_changes: totalPulledChanges,
          pulled_tombstones: totalPulledTombstones,
          error: `Pull error: HTTP ${pullRes.status}`,
        };
      }

      const pullData = (await pullRes.json()) as SyncPullResponse;
      const pullStats = await applyRemoteChanges(
        db,
        config.userId,
        pullData.changes || [],
        pullData.tombstones || [],
      );

      totalPulledChanges += pullStats.pulled_changes;
      totalPulledTombstones += pullStats.pulled_tombstones;

      if (pullData.next_cursor) {
        cursor = pullData.next_cursor;
        const now = new Date().toISOString();
        const existingCursor = await db.getFirstAsync<{ user_id: string }>(
          `SELECT user_id FROM sync_cursors WHERE user_id = ?;`,
          [config.userId],
        );
        if (existingCursor) {
          await db.runAsync(
            `UPDATE sync_cursors SET cursor = ?, updated_at = ? WHERE user_id = ?;`,
            [cursor, now, config.userId],
          );
        } else {
          await db.runAsync(
            `INSERT INTO sync_cursors (user_id, cursor, updated_at) VALUES (?, ?, ?);`,
            [config.userId, cursor, now],
          );
        }
      }

      hasMore = Boolean(pullData.has_more);
    }

    return {
      success: true,
      pushed_applied: pushedApplied,
      pushed_conflicts: pushedConflicts,
      pushed_errors: pushedErrors,
      pulled_changes: totalPulledChanges,
      pulled_tombstones: totalPulledTombstones,
    };
  } catch (err: unknown) {
    return {
      success: false,
      pushed_applied: pushedApplied,
      pushed_conflicts: pushedConflicts,
      pushed_errors: pushedErrors,
      pulled_changes: totalPulledChanges,
      pulled_tombstones: totalPulledTombstones,
      error:
        err instanceof Error
          ? err.message
          : "Network or database failure during sync",
    };
  }
}

export const performSync = syncEngine;
