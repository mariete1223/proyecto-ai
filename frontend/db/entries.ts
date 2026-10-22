import {
  Entry,
  ReminderRecurrence,
  TaskPriority,
  TaskRecurrence,
  TaskStatus,
} from "../types/domain";
import { CANONICAL_CATEGORIES, getCategoryById } from "./categories";
import { DatabaseAdapter, generateUuid } from "./database";

export interface CreateEntryData {
  id?: string;
  category_id: string;
  title?: string | null;
  occurred_at?: string | null;
  content: string;
  task_status?: TaskStatus | null;
  task_recurrence?: TaskRecurrence | null;
  task_priority?: TaskPriority | null;
  capture_session_id?: string | null;
  reminder_enabled?: boolean | null;
  reminder_time?: string | null;
  reminder_end_time?: string | null;
  reminder_recurrence?: ReminderRecurrence | null;
  reminder_offset_minutes?: number | null;
  reminder_offsets_minutes?: number[] | null;
  tag_ids?: string[];
}

export interface UpdateEntryData {
  category_id?: string;
  title?: string | null;
  occurred_at?: string | null;
  content?: string;
  task_status?: TaskStatus | null;
  task_recurrence?: TaskRecurrence | null;
  task_priority?: TaskPriority | null;
  reminder_enabled?: boolean | null;
  reminder_time?: string | null;
  reminder_end_time?: string | null;
  reminder_recurrence?: ReminderRecurrence | null;
  reminder_offset_minutes?: number | null;
  reminder_offsets_minutes?: number[] | null;
  tag_ids?: string[];
}

export interface ListEntryFilters {
  start_at?: string;
  end_at?: string;
  category_ids?: string[];
  tag_ids?: string[];
  include_yearly?: boolean;
}

function parseRowReminderOffsets(raw: unknown): number[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return null;
    }
  }
  return null;
}

function mapEntryRow(row: any, tagIds: string[]): Entry {
  return {
    ...row,
    reminder_enabled: Boolean(row.reminder_enabled),
    reminder_offsets_minutes: parseRowReminderOffsets(
      row.reminder_offsets_minutes,
    ),
    tag_ids: tagIds,
  };
}

export async function createLocalEntry(
  db: DatabaseAdapter,
  userId: string,
  data: CreateEntryData,
): Promise<Entry> {
  const content = data.content.trim();
  if (!content) {
    throw new Error("Entry content cannot be empty.");
  }

  const category = await getCategoryById(db, userId, data.category_id);
  if (!category) {
    throw new Error("Category not found.");
  }

  const isAlertCategory =
    category.id === CANONICAL_CATEGORIES.ALERTA.id ||
    category.name_normalized === "alerta" ||
    category.voice_command_normalized === "alerta" ||
    category.name?.toLowerCase() === "alerta";

  let taskStatus = data.task_status ?? null;
  let taskRecurrence = data.task_recurrence ?? null;
  let taskPriority = data.task_priority ?? null;

  if (category.kind === "TASK" && !isAlertCategory) {
    if (taskStatus === null && taskRecurrence === null) {
      taskStatus = "PENDING";
      taskRecurrence = "ONCE";
    } else if (taskStatus === null || taskRecurrence === null) {
      throw new Error(
        "Task status and task recurrence must both be provided or omitted.",
      );
    }
    if (!taskPriority) {
      taskPriority = "MEDIUM";
    }
  } else if (isAlertCategory) {
    taskStatus = null;
    taskRecurrence = null;
    taskPriority = null;
  } else {
    if (
      taskStatus !== null ||
      taskRecurrence !== null ||
      taskPriority !== null
    ) {
      throw new Error(
        "Task fields can only be set for categories of kind TASK.",
      );
    }
  }

  const id = data.id ?? generateUuid();
  const now = new Date().toISOString();
  const title = data.title ? data.title.trim() : null;
  let occurredAt = data.occurred_at ?? null;
  if (isAlertCategory && !occurredAt) {
    occurredAt = now;
  }
  const tagIds = Array.from(new Set(data.tag_ids ?? []));

  let reminderEnabled = data.reminder_enabled;
  let reminderOffsetMinutes = data.reminder_offset_minutes;
  let reminderOffsetsMinutes = data.reminder_offsets_minutes ?? null;

  if (isAlertCategory) {
    if (reminderEnabled === undefined || reminderEnabled === null) {
      reminderEnabled = true;
    }
    if (reminderOffsetMinutes === undefined || reminderOffsetMinutes === null) {
      reminderOffsetMinutes =
        reminderOffsetsMinutes && reminderOffsetsMinutes.length > 0
          ? reminderOffsetsMinutes[0]
          : 0;
    }
    if (reminderOffsetsMinutes === null && reminderEnabled) {
      reminderOffsetsMinutes = [reminderOffsetMinutes ?? 0];
    }
  } else if (occurredAt) {
    // Para cualquier otra categoría con fecha, el recordatorio por defecto es 1 día antes (1440 min)
    if (reminderEnabled === undefined || reminderEnabled === null) {
      reminderEnabled = true;
    }
    if (reminderOffsetMinutes === undefined || reminderOffsetMinutes === null) {
      reminderOffsetMinutes =
        reminderOffsetsMinutes && reminderOffsetsMinutes.length > 0
          ? reminderOffsetsMinutes[0]
          : 1440;
    }
    if (reminderOffsetsMinutes === null && reminderEnabled) {
      reminderOffsetsMinutes = [reminderOffsetMinutes ?? 1440];
    }
  }

  const reminderOffsetsStr = reminderOffsetsMinutes
    ? JSON.stringify(reminderOffsetsMinutes)
    : null;

  const entry: Entry = {
    id,
    user_id: userId,
    category_id: data.category_id,
    title,
    occurred_at: occurredAt,
    content,
    task_status: taskStatus,
    task_recurrence: taskRecurrence,
    task_priority: taskPriority,
    capture_session_id: data.capture_session_id ?? null,
    reminder_enabled: reminderEnabled ?? null,
    reminder_time: data.reminder_time ?? null,
    reminder_end_time: data.reminder_end_time ?? null,
    reminder_recurrence: data.reminder_recurrence ?? null,
    reminder_offset_minutes: reminderOffsetMinutes ?? null,
    reminder_offsets_minutes: reminderOffsetsMinutes,
    created_at: now,
    updated_at: now,
    version: 1,
    sync_status: "PENDING_PUSH",
    tag_ids: tagIds,
  };

  await db.runAsync(
    `INSERT INTO entries (id, user_id, category_id, title, occurred_at, content, task_status, task_recurrence, task_priority, capture_session_id, reminder_enabled, reminder_time, reminder_end_time, reminder_recurrence, reminder_offset_minutes, reminder_offsets_minutes, created_at, updated_at, version, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      entry.id,
      entry.user_id,
      entry.category_id,
      entry.title ?? null,
      entry.occurred_at,
      entry.content,
      entry.task_status,
      entry.task_recurrence,
      entry.task_priority,
      entry.capture_session_id,
      entry.reminder_enabled ? 1 : 0,
      entry.reminder_time ?? null,
      entry.reminder_end_time ?? null,
      entry.reminder_recurrence ?? null,
      entry.reminder_offset_minutes ?? null,
      reminderOffsetsStr,
      entry.created_at,
      entry.updated_at,
      entry.version,
      entry.sync_status,
    ],
  );

  for (const tagId of tagIds) {
    const etId = generateUuid();
    await db.runAsync(
      `INSERT INTO entry_tags (id, user_id, entry_id, tag_id, created_at, updated_at, version, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [etId, userId, entry.id, tagId, now, now, 1, "PENDING_PUSH"],
    );
  }

  return entry;
}

export async function getEntryById(
  db: DatabaseAdapter,
  userId: string,
  entryId: string,
): Promise<Entry | null> {
  const row = await db.getFirstAsync<Omit<Entry, "tag_ids">>(
    `SELECT * FROM entries WHERE id = ? AND user_id = ?;`,
    [entryId, userId],
  );
  if (!row) {
    return null;
  }

  const etRows = await db.getAllAsync<{ tag_id: string }>(
    `SELECT tag_id FROM entry_tags WHERE entry_id = ? AND user_id = ?;`,
    [entryId, userId],
  );
  const tagIds = etRows.map((r) => r.tag_id);

  return mapEntryRow(row, tagIds);
}

export async function listLocalEntries(
  db: DatabaseAdapter,
  userId: string,
  filters: ListEntryFilters = {},
): Promise<Entry[]> {
  const allRows = await db.getAllAsync<Omit<Entry, "tag_ids">>(
    `SELECT * FROM entries WHERE user_id = ? ORDER BY occurred_at DESC, created_at DESC;`,
    [userId],
  );

  const seenKeys = new Set<string>();
  const uniqueRows: typeof allRows = [];
  const duplicateIdsToRemove: string[] = [];

  for (const row of allRows) {
    const key = `${row.category_id}:::${row.content.trim()}:::${row.occurred_at ?? ""}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueRows.push(row);
    } else {
      duplicateIdsToRemove.push(row.id);
    }
  }

  if (duplicateIdsToRemove.length > 0) {
    for (const dupId of duplicateIdsToRemove) {
      await db.runAsync(`DELETE FROM entries WHERE id = ? AND user_id = ?;`, [
        dupId,
        userId,
      ]);
      await db.runAsync(
        `DELETE FROM entry_tags WHERE entry_id = ? AND user_id = ?;`,
        [dupId, userId],
      );
    }
  }

  let filtered = uniqueRows;

  if (filters.start_at || filters.end_at) {
    filtered = filtered.filter((e) => {
      if (!e.occurred_at) return false;
      if (filters.include_yearly && e.reminder_recurrence === "YEARLY") {
        return true;
      }
      if (filters.start_at && e.occurred_at < filters.start_at) {
        return false;
      }
      if (filters.end_at && e.occurred_at > filters.end_at) {
        return false;
      }
      return true;
    });
  }

  if (filters.category_ids && filters.category_ids.length > 0) {
    const catSet = new Set(filters.category_ids);
    filtered = filtered.filter((e) => catSet.has(e.category_id));
  }

  const result: Entry[] = [];
  for (const row of filtered) {
    const etRows = await db.getAllAsync<{ tag_id: string }>(
      `SELECT tag_id FROM entry_tags WHERE entry_id = ? AND user_id = ?;`,
      [row.id, userId],
    );
    const tagIds = etRows.map((r) => r.tag_id);

    if (filters.tag_ids && filters.tag_ids.length > 0) {
      const match = filters.tag_ids.some((t) => tagIds.includes(t));
      if (!match) continue;
    }

    result.push(mapEntryRow(row, tagIds));
  }

  return result;
}

export async function listPendingDatelessTasks(
  db: DatabaseAdapter,
  userId: string,
): Promise<Entry[]> {
  const taskCategories = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM categories WHERE user_id = ? AND kind = 'TASK';`,
    [userId],
  );
  const taskCatIds = new Set(taskCategories.map((c) => c.id));

  const allEntries = await db.getAllAsync<Omit<Entry, "tag_ids">>(
    `SELECT * FROM entries WHERE user_id = ? ORDER BY created_at DESC;`,
    [userId],
  );

  const pendingDateless = allEntries.filter(
    (e) =>
      taskCatIds.has(e.category_id) &&
      e.occurred_at === null &&
      (e.task_status === "PENDING" || e.task_status === "IN_PROGRESS"),
  );

  const result: Entry[] = [];
  for (const row of pendingDateless) {
    const etRows = await db.getAllAsync<{ tag_id: string }>(
      `SELECT tag_id FROM entry_tags WHERE entry_id = ? AND user_id = ?;`,
      [row.id, userId],
    );
    result.push(
      mapEntryRow(
        row,
        etRows.map((r) => r.tag_id),
      ),
    );
  }

  return result;
}

export async function listDatelessTasks(
  db: DatabaseAdapter,
  userId: string,
): Promise<Entry[]> {
  const taskCategories = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM categories WHERE user_id = ? AND kind = 'TASK';`,
    [userId],
  );
  const taskCatIds = new Set(taskCategories.map((c) => c.id));

  const allEntries = await db.getAllAsync<Omit<Entry, "tag_ids">>(
    `SELECT * FROM entries WHERE user_id = ? ORDER BY created_at DESC;`,
    [userId],
  );

  const datelessTasks = allEntries.filter(
    (e) => taskCatIds.has(e.category_id) && e.task_status !== null,
  );

  const result: Entry[] = [];
  for (const row of datelessTasks) {
    const etRows = await db.getAllAsync<{ tag_id: string }>(
      `SELECT tag_id FROM entry_tags WHERE entry_id = ? AND user_id = ?;`,
      [row.id, userId],
    );
    result.push(
      mapEntryRow(
        row,
        etRows.map((r) => r.tag_id),
      ),
    );
  }

  return result;
}

export async function updateLocalEntry(
  db: DatabaseAdapter,
  userId: string,
  entryId: string,
  data: UpdateEntryData,
): Promise<Entry> {
  const existing = await getEntryById(db, userId, entryId);
  if (!existing) {
    throw new Error("Entry not found.");
  }

  const categoryId = data.category_id ?? existing.category_id;
  const category = await getCategoryById(db, userId, categoryId);
  if (!category) {
    throw new Error("Category not found.");
  }

  let taskStatus =
    data.task_status !== undefined ? data.task_status : existing.task_status;
  let taskRecurrence =
    data.task_recurrence !== undefined
      ? data.task_recurrence
      : existing.task_recurrence;
  let taskPriority =
    data.task_priority !== undefined
      ? data.task_priority
      : (existing.task_priority ?? null);

  const isAlertCategory =
    category.id === CANONICAL_CATEGORIES.ALERTA.id ||
    category.name_normalized === "alerta" ||
    category.voice_command_normalized === "alerta" ||
    category.name?.toLowerCase() === "alerta";

  if (category.kind === "TASK" && !isAlertCategory) {
    if (taskStatus === null && taskRecurrence === null) {
      taskStatus = "PENDING";
      taskRecurrence = "ONCE";
    } else if (taskStatus === null || taskRecurrence === null) {
      throw new Error("Task status and recurrence must be paired.");
    }
    if (!taskPriority) {
      taskPriority = "MEDIUM";
    }
  } else {
    taskStatus = null;
    taskRecurrence = null;
    taskPriority = null;
  }

  const content =
    data.content !== undefined ? data.content.trim() : existing.content;
  if (!content) {
    throw new Error("Entry content cannot be empty.");
  }

  const title =
    data.title !== undefined
      ? data.title
        ? data.title.trim()
        : null
      : (existing.title ?? null);
  const occurredAt =
    data.occurred_at !== undefined ? data.occurred_at : existing.occurred_at;
  const now = new Date().toISOString();
  const newVersion = existing.version + 1;

  const reminderEnabled = isAlertCategory
    ? true
    : data.reminder_enabled !== undefined
      ? data.reminder_enabled
      : (existing.reminder_enabled ?? null);
  const reminderTime =
    data.reminder_time !== undefined
      ? data.reminder_time
      : (existing.reminder_time ?? null);
  const reminderEndTime =
    data.reminder_end_time !== undefined
      ? data.reminder_end_time
      : (existing.reminder_end_time ?? null);
  const reminderRecurrence =
    data.reminder_recurrence !== undefined
      ? data.reminder_recurrence
      : (existing.reminder_recurrence ?? null);
  const reminderOffsetMinutes = isAlertCategory
    ? 0
    : data.reminder_offset_minutes !== undefined
      ? data.reminder_offset_minutes
      : (existing.reminder_offset_minutes ?? null);
  const reminderOffsetsMinutes = isAlertCategory
    ? [0]
    : data.reminder_offsets_minutes !== undefined
      ? data.reminder_offsets_minutes
      : (existing.reminder_offsets_minutes ?? null);
  const reminderOffsetsStr = reminderOffsetsMinutes
    ? JSON.stringify(reminderOffsetsMinutes)
    : null;

  await db.runAsync(
    `UPDATE entries SET category_id = ?, title = ?, occurred_at = ?, content = ?, task_status = ?, task_recurrence = ?, task_priority = ?, reminder_enabled = ?, reminder_time = ?, reminder_end_time = ?, reminder_recurrence = ?, reminder_offset_minutes = ?, reminder_offsets_minutes = ?, updated_at = ?, version = ?, sync_status = 'PENDING_PUSH' WHERE id = ? AND user_id = ?;`,
    [
      categoryId,
      title,
      occurredAt,
      content,
      taskStatus,
      taskRecurrence,
      taskPriority,
      reminderEnabled ? 1 : 0,
      reminderTime,
      reminderEndTime,
      reminderRecurrence,
      reminderOffsetMinutes,
      reminderOffsetsStr,
      now,
      newVersion,
      entryId,
      userId,
    ],
  );

  let updatedTagIds = existing.tag_ids;
  if (data.tag_ids !== undefined) {
    await db.runAsync(
      `DELETE FROM entry_tags WHERE entry_id = ? AND user_id = ?;`,
      [entryId, userId],
    );
    updatedTagIds = Array.from(new Set(data.tag_ids));
    for (const tagId of updatedTagIds) {
      const etId = generateUuid();
      await db.runAsync(
        `INSERT INTO entry_tags (id, user_id, entry_id, tag_id, created_at, updated_at, version, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [etId, userId, entryId, tagId, now, now, 1, "PENDING_PUSH"],
      );
    }
  }

  return {
    ...existing,
    category_id: categoryId,
    title,
    occurred_at: occurredAt,
    content,
    task_status: taskStatus,
    task_recurrence: taskRecurrence,
    task_priority: taskPriority,
    reminder_enabled: reminderEnabled,
    reminder_time: reminderTime,
    reminder_end_time: reminderEndTime,
    reminder_recurrence: reminderRecurrence,
    reminder_offset_minutes: reminderOffsetMinutes,
    reminder_offsets_minutes: reminderOffsetsMinutes,
    updated_at: now,
    version: newVersion,
    sync_status: "PENDING_PUSH",
    tag_ids: updatedTagIds,
  };
}

export async function deleteLocalEntry(
  db: DatabaseAdapter,
  userId: string,
  entryId: string,
): Promise<void> {
  const existing = await getEntryById(db, userId, entryId);
  if (!existing) {
    throw new Error("Entry not found.");
  }

  const now = new Date().toISOString();
  const deletedVersion = existing.version + 1;

  await db.runAsync(
    `DELETE FROM entry_tags WHERE entry_id = ? AND user_id = ?;`,
    [entryId, userId],
  );

  await db.runAsync(`DELETE FROM entries WHERE id = ? AND user_id = ?;`, [
    entryId,
    userId,
  ]);

  const tbId = generateUuid();
  await db.runAsync(
    `INSERT INTO deletion_tombstones (id, user_id, entity_type, entity_id, deleted_at, deleted_version, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [tbId, userId, "ENTRY", entryId, now, deletedVersion, "PENDING_PUSH"],
  );
}

export interface AdoptionResult {
  adoptedEntries: number;
  adoptedCategories: number;
  adoptedTags: number;
}

export async function adoptGuestData(
  db: DatabaseAdapter,
  targetUserId: string,
  guestUserId: string = "user-demo-123",
): Promise<AdoptionResult> {
  if (!targetUserId || targetUserId === guestUserId) {
    return { adoptedEntries: 0, adoptedCategories: 0, adoptedTags: 0 };
  }

  // 1. Obtener todas las categorías existentes del usuario objetivo
  const targetCategories = await db.getAllAsync<{
    id: string;
    name_normalized: string;
    kind: string;
  }>(`SELECT id, name_normalized, kind FROM categories WHERE user_id = ?;`, [
    targetUserId,
  ]);
  const targetCatMap = new Map<string, string>();
  for (const tc of targetCategories) {
    if (tc.name_normalized) {
      targetCatMap.set(tc.name_normalized.toLowerCase(), tc.id);
    }
  }

  // 2. Adoptar categorías huérfanas / de invitado
  const guestCategories = await db.getAllAsync<{
    id: string;
    name: string;
    name_normalized: string;
  }>(`SELECT id, name, name_normalized FROM categories WHERE user_id = ?;`, [
    guestUserId,
  ]);
  let adoptedCategories = 0;
  for (const gc of guestCategories) {
    const norm = (gc.name_normalized || gc.name || "").trim().toLowerCase();
    const existingTargetId = targetCatMap.get(norm);
    if (existingTargetId && existingTargetId !== gc.id) {
      await db.runAsync(
        `UPDATE entries SET category_id = ? WHERE category_id = ?;`,
        [existingTargetId, gc.id],
      );
      await db.runAsync(`DELETE FROM categories WHERE id = ?;`, [gc.id]);
    } else {
      await db.runAsync(
        `UPDATE categories SET user_id = ?, sync_status = 'PENDING_PUSH' WHERE id = ?;`,
        [targetUserId, gc.id],
      );
      targetCatMap.set(norm, gc.id);
      adoptedCategories++;
    }
  }

  // 3. Adoptar etiquetas huérfanas / de invitado
  const targetTags = await db.getAllAsync<{
    id: string;
    name_normalized: string;
  }>(`SELECT id, name_normalized FROM tags WHERE user_id = ?;`, [targetUserId]);
  const targetTagMap = new Map<string, string>();
  for (const tt of targetTags) {
    if (tt.name_normalized) {
      targetTagMap.set(tt.name_normalized.toLowerCase(), tt.id);
    }
  }

  const guestTags = await db.getAllAsync<{
    id: string;
    name: string;
    name_normalized: string;
  }>(`SELECT id, name, name_normalized FROM tags WHERE user_id = ?;`, [
    guestUserId,
  ]);
  let adoptedTags = 0;
  for (const gt of guestTags) {
    const norm = (gt.name_normalized || gt.name || "").trim().toLowerCase();
    const existingTagId = targetTagMap.get(norm);
    if (existingTagId && existingTagId !== gt.id) {
      await db.runAsync(
        `UPDATE entry_tags SET tag_id = ?, user_id = ?, sync_status = 'PENDING_PUSH' WHERE tag_id = ?;`,
        [existingTagId, targetUserId, gt.id],
      );
      await db.runAsync(`DELETE FROM tags WHERE id = ?;`, [gt.id]);
    } else {
      await db.runAsync(
        `UPDATE tags SET user_id = ?, sync_status = 'PENDING_PUSH' WHERE id = ?;`,
        [targetUserId, gt.id],
      );
      targetTagMap.set(norm, gt.id);
      adoptedTags++;
    }
  }

  // 4. Adoptar todas las entradas huérfanas / de invitado
  const guestEntries = await db.getAllAsync<{
    id: string;
    category_id: string;
  }>(`SELECT id, category_id FROM entries WHERE user_id = ?;`, [guestUserId]);

  const fallbackCat = targetCategories[0]?.id || CANONICAL_CATEGORIES.TAREAS.id;
  for (const ge of guestEntries) {
    let catId = ge.category_id;
    if (
      !catId ||
      (!Array.from(targetCatMap.values()).includes(catId) && fallbackCat)
    ) {
      catId = fallbackCat;
    }
    await db.runAsync(
      `UPDATE entries SET user_id = ?, category_id = ?, sync_status = 'PENDING_PUSH' WHERE id = ?;`,
      [targetUserId, catId, ge.id],
    );
  }

  // 5. Adoptar vínculos de etiquetas en entry_tags
  await db.runAsync(
    `UPDATE entry_tags SET user_id = ?, sync_status = 'PENDING_PUSH' WHERE user_id = ?;`,
    [targetUserId, guestUserId],
  );

  return {
    adoptedEntries: guestEntries.length,
    adoptedCategories,
    adoptedTags,
  };
}
