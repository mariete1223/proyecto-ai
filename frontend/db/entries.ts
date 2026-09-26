import { Entry, TaskRecurrence, TaskStatus } from "../types/domain";
import { getCategoryById } from "./categories";
import { DatabaseAdapter } from "./database";

export interface CreateEntryData {
  id?: string;
  category_id: string;
  occurred_at?: string | null;
  content: string;
  task_status?: TaskStatus | null;
  task_recurrence?: TaskRecurrence | null;
  capture_session_id?: string | null;
  tag_ids?: string[];
}

export interface UpdateEntryData {
  category_id?: string;
  occurred_at?: string | null;
  content?: string;
  task_status?: TaskStatus | null;
  task_recurrence?: TaskRecurrence | null;
  tag_ids?: string[];
}

export interface ListEntryFilters {
  start_at?: string;
  end_at?: string;
  category_ids?: string[];
  tag_ids?: string[];
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

  let taskStatus = data.task_status ?? null;
  let taskRecurrence = data.task_recurrence ?? null;

  if (category.kind === "TASK") {
    if (taskStatus === null && taskRecurrence === null) {
      taskStatus = "PENDING";
      taskRecurrence = "ONCE";
    } else if (taskStatus === null || taskRecurrence === null) {
      throw new Error(
        "Task status and task recurrence must both be provided or omitted.",
      );
    }
  } else {
    if (taskStatus !== null || taskRecurrence !== null) {
      throw new Error(
        "Task fields can only be set for categories of kind TASK.",
      );
    }
  }

  const id = data.id ?? Math.random().toString(36).substring(2, 15);
  const now = new Date().toISOString();
  const occurredAt = data.occurred_at ?? null;
  const tagIds = Array.from(new Set(data.tag_ids ?? []));

  const entry: Entry = {
    id,
    user_id: userId,
    category_id: data.category_id,
    occurred_at: occurredAt,
    content,
    task_status: taskStatus,
    task_recurrence: taskRecurrence,
    capture_session_id: data.capture_session_id ?? null,
    created_at: now,
    updated_at: now,
    version: 1,
    sync_status: "PENDING_PUSH",
    tag_ids: tagIds,
  };

  await db.runAsync(
    `INSERT INTO entries (id, user_id, category_id, occurred_at, content, task_status, task_recurrence, capture_session_id, created_at, updated_at, version, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      entry.id,
      entry.user_id,
      entry.category_id,
      entry.occurred_at,
      entry.content,
      entry.task_status,
      entry.task_recurrence,
      entry.capture_session_id,
      entry.created_at,
      entry.updated_at,
      entry.version,
      entry.sync_status,
    ],
  );

  for (const tagId of tagIds) {
    const etId = Math.random().toString(36).substring(2, 15);
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

  return {
    ...row,
    tag_ids: tagIds,
  };
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

  let filtered = allRows;

  if (filters.start_at) {
    filtered = filtered.filter(
      (e) => e.occurred_at && e.occurred_at >= filters.start_at!,
    );
  }

  if (filters.end_at) {
    filtered = filtered.filter(
      (e) => e.occurred_at && e.occurred_at <= filters.end_at!,
    );
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

    result.push({
      ...row,
      tag_ids: tagIds,
    });
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
    result.push({
      ...row,
      tag_ids: etRows.map((r) => r.tag_id),
    });
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

  if (category.kind === "TASK") {
    if (taskStatus === null && taskRecurrence === null) {
      taskStatus = "PENDING";
      taskRecurrence = "ONCE";
    } else if (taskStatus === null || taskRecurrence === null) {
      throw new Error("Task status and recurrence must be paired.");
    }
  } else {
    taskStatus = null;
    taskRecurrence = null;
  }

  const content =
    data.content !== undefined ? data.content.trim() : existing.content;
  if (!content) {
    throw new Error("Entry content cannot be empty.");
  }

  const occurredAt =
    data.occurred_at !== undefined ? data.occurred_at : existing.occurred_at;
  const now = new Date().toISOString();
  const newVersion = existing.version + 1;

  await db.runAsync(
    `UPDATE entries SET category_id = ?, occurred_at = ?, content = ?, task_status = ?, task_recurrence = ?, updated_at = ?, version = ?, sync_status = 'PENDING_PUSH' WHERE id = ? AND user_id = ?;`,
    [
      categoryId,
      occurredAt,
      content,
      taskStatus,
      taskRecurrence,
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
      const etId = Math.random().toString(36).substring(2, 15);
      await db.runAsync(
        `INSERT INTO entry_tags (id, user_id, entry_id, tag_id, created_at, updated_at, version, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [etId, userId, entryId, tagId, now, now, 1, "PENDING_PUSH"],
      );
    }
  }

  return {
    ...existing,
    category_id: categoryId,
    occurred_at: occurredAt,
    content,
    task_status: taskStatus,
    task_recurrence: taskRecurrence,
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

  const tbId = Math.random().toString(36).substring(2, 15);
  await db.runAsync(
    `INSERT INTO deletion_tombstones (id, user_id, entity_type, entity_id, deleted_at, deleted_version, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [tbId, userId, "ENTRY", entryId, now, deletedVersion, "PENDING_PUSH"],
  );
}
