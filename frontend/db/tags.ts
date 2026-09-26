import { normalizeTagName, Tag } from "../types/domain";
import { DatabaseAdapter } from "./database";

export interface CreateTagData {
  id?: string;
  name: string;
}

export interface UpdateTagData {
  name: string;
}

export async function createLocalTag(
  db: DatabaseAdapter,
  userId: string,
  data: CreateTagData,
): Promise<Tag> {
  const rawName = data.name.trim();
  if (!rawName) {
    throw new Error("Tag name cannot be empty.");
  }

  const nameNormalized = normalizeTagName(rawName);

  const existing = await db.getFirstAsync<Tag>(
    `SELECT * FROM tags WHERE user_id = ? AND name_normalized = ?;`,
    [userId, nameNormalized],
  );
  if (existing) {
    throw new Error("Tag name already exists.");
  }

  const id = data.id ?? Math.random().toString(36).substring(2, 15);
  const now = new Date().toISOString();
  const tag: Tag = {
    id,
    user_id: userId,
    name: rawName,
    name_normalized: nameNormalized,
    created_at: now,
    updated_at: now,
    version: 1,
    sync_status: "PENDING_PUSH",
  };

  await db.runAsync(
    `INSERT INTO tags (id, user_id, name, name_normalized, created_at, updated_at, version, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      tag.id,
      tag.user_id,
      tag.name,
      tag.name_normalized,
      tag.created_at,
      tag.updated_at,
      tag.version,
      tag.sync_status,
    ],
  );

  return tag;
}

export async function getTagById(
  db: DatabaseAdapter,
  userId: string,
  tagId: string,
): Promise<Tag | null> {
  return db.getFirstAsync<Tag>(
    `SELECT * FROM tags WHERE id = ? AND user_id = ?;`,
    [tagId, userId],
  );
}

export async function listTags(
  db: DatabaseAdapter,
  userId: string,
): Promise<Tag[]> {
  return db.getAllAsync<Tag>(
    `SELECT * FROM tags WHERE user_id = ? ORDER BY name ASC;`,
    [userId],
  );
}

export async function updateLocalTag(
  db: DatabaseAdapter,
  userId: string,
  tagId: string,
  data: UpdateTagData,
): Promise<Tag> {
  const existing = await getTagById(db, userId, tagId);
  if (!existing) {
    throw new Error("Tag not found.");
  }

  const newRawName = data.name.trim();
  if (!newRawName) {
    throw new Error("Tag name cannot be empty.");
  }

  const nameNormalized = normalizeTagName(newRawName);
  if (nameNormalized !== existing.name_normalized) {
    const dup = await db.getFirstAsync<Tag>(
      `SELECT * FROM tags WHERE user_id = ? AND name_normalized = ? AND id != ?;`,
      [userId, nameNormalized, tagId],
    );
    if (dup) {
      throw new Error("Tag name already exists.");
    }
  }

  const now = new Date().toISOString();
  const updatedVersion = existing.version + 1;

  await db.runAsync(
    `UPDATE tags SET name = ?, name_normalized = ?, updated_at = ?, version = ?, sync_status = 'PENDING_PUSH' WHERE id = ? AND user_id = ?;`,
    [newRawName, nameNormalized, now, updatedVersion, tagId, userId],
  );

  return {
    ...existing,
    name: newRawName,
    name_normalized: nameNormalized,
    updated_at: now,
    version: updatedVersion,
    sync_status: "PENDING_PUSH",
  };
}

export async function getTagUsageCount(
  db: DatabaseAdapter,
  userId: string,
  tagId: string,
): Promise<number> {
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM entry_tags WHERE tag_id = ? AND user_id = ?;`,
    [tagId, userId],
  );
  return rows.length;
}

export async function deleteLocalTag(
  db: DatabaseAdapter,
  userId: string,
  tagId: string,
): Promise<void> {
  const existing = await getTagById(db, userId, tagId);
  if (!existing) {
    throw new Error("Tag not found.");
  }

  await db.runAsync(
    `DELETE FROM entry_tags WHERE tag_id = ? AND user_id = ?;`,
    [tagId, userId],
  );

  await db.runAsync(`DELETE FROM tags WHERE id = ? AND user_id = ?;`, [
    tagId,
    userId,
  ]);
}
