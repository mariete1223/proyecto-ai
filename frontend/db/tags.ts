import { normalizeTagName, Tag } from "../types/domain";
import { DatabaseAdapter, generateUuid } from "./database";

export const DEFAULT_TAG_PRESET_COLORS = [
  "#38BDF8", // Sky Blue
  "#3B82F6", // Royal Blue
  "#6366F1", // Indigo
  "#8B5CF6", // Purple
  "#A855F7", // Violet
  "#D946EF", // Fuchsia
  "#EC4899", // Pink
  "#F43F5E", // Rose
  "#EF4444", // Red
  "#F97316", // Orange
  "#F59E0B", // Amber
  "#EAB308", // Yellow / Gold
  "#84CC16", // Lime
  "#10B981", // Emerald
  "#14B8A6", // Teal
  "#06B6D4", // Cyan
];

export interface CreateTagData {
  id?: string;
  name: string;
  color?: string;
}

export interface UpdateTagData {
  name?: string;
  color?: string;
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

  let color: string;
  if (data.color) {
    color = data.color.trim().toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(color)) {
      throw new Error("Invalid hex color format.");
    }
    const existingColor = await db.getFirstAsync<Tag>(
      `SELECT * FROM tags WHERE user_id = ? AND color = ?;`,
      [userId, color],
    );
    if (existingColor) {
      throw new Error("El color ya está en uso por otra etiqueta.");
    }
  } else {
    const existingTags = await db.getAllAsync<Tag>(
      `SELECT color FROM tags WHERE user_id = ?;`,
      [userId],
    );
    const usedColors = new Set(
      existingTags.map((t) => t.color?.toUpperCase()).filter(Boolean),
    );
    const available = DEFAULT_TAG_PRESET_COLORS.find((c) => !usedColors.has(c));
    color =
      available ??
      `#${Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, "0")
        .toUpperCase()}`;
  }

  const id = data.id ?? generateUuid();
  const now = new Date().toISOString();
  const tag: Tag = {
    id,
    user_id: userId,
    name: rawName,
    name_normalized: nameNormalized,
    color,
    created_at: now,
    updated_at: now,
    version: 1,
    sync_status: "PENDING_PUSH",
  };

  await db.runAsync(
    `INSERT INTO tags (id, user_id, name, name_normalized, color, created_at, updated_at, version, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      tag.id,
      tag.user_id,
      tag.name,
      tag.name_normalized,
      tag.color,
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
  const raw = await db.getAllAsync<Tag>(
    `SELECT * FROM tags WHERE user_id = ? ORDER BY created_at ASC;`,
    [userId],
  );

  const mapByName = new Map<string, Tag>();
  const duplicateIdsToRemove: string[] = [];

  for (const tag of raw) {
    const key = tag.name_normalized || normalizeTagName(tag.name);
    if (!mapByName.has(key)) {
      mapByName.set(key, tag);
    } else {
      duplicateIdsToRemove.push(tag.id);
    }
  }

  if (duplicateIdsToRemove.length > 0) {
    for (const dupId of duplicateIdsToRemove) {
      const dupTag = raw.find((t) => t.id === dupId);
      if (dupTag) {
        const key = dupTag.name_normalized || normalizeTagName(dupTag.name);
        const keeper = mapByName.get(key);
        if (keeper) {
          // Reasociar entradas que apuntaban a dupId hacia keeper.id
          const associatedEntries = await db.getAllAsync<{ entry_id: string }>(
            `SELECT entry_id FROM entry_tags WHERE tag_id = ? AND user_id = ?;`,
            [dupId, userId],
          );
          for (const row of associatedEntries) {
            const alreadyHasKeeper = await db.getFirstAsync<{ id: string }>(
              `SELECT id FROM entry_tags WHERE entry_id = ? AND tag_id = ? AND user_id = ?;`,
              [row.entry_id, keeper.id, userId],
            );
            if (alreadyHasKeeper) {
              await db.runAsync(
                `DELETE FROM entry_tags WHERE entry_id = ? AND tag_id = ? AND user_id = ?;`,
                [row.entry_id, dupId, userId],
              );
            } else {
              await db.runAsync(
                `UPDATE entry_tags SET tag_id = ? WHERE entry_id = ? AND tag_id = ? AND user_id = ?;`,
                [keeper.id, row.entry_id, dupId, userId],
              );
            }
          }
        }
      }
      await db.runAsync(`DELETE FROM tags WHERE id = ? AND user_id = ?;`, [
        dupId,
        userId,
      ]);
    }
  }

  return Array.from(mapByName.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
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

  const newRawName = data.name !== undefined ? data.name.trim() : existing.name;
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

  let newColor = existing.color ?? "#64748B";
  if (data.color !== undefined) {
    newColor = data.color.trim().toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(newColor)) {
      throw new Error("Invalid hex color format.");
    }
    if (newColor !== (existing.color ?? "").toUpperCase()) {
      const dupColor = await db.getFirstAsync<Tag>(
        `SELECT * FROM tags WHERE user_id = ? AND color = ? AND id != ?;`,
        [userId, newColor, tagId],
      );
      if (dupColor) {
        throw new Error("El color ya está en uso por otra etiqueta.");
      }
    }
  }

  const now = new Date().toISOString();
  const updatedVersion = existing.version + 1;

  await db.runAsync(
    `UPDATE tags SET name = ?, name_normalized = ?, color = ?, updated_at = ?, version = ?, sync_status = 'PENDING_PUSH' WHERE id = ? AND user_id = ?;`,
    [newRawName, nameNormalized, newColor, now, updatedVersion, tagId, userId],
  );

  return {
    ...existing,
    name: newRawName,
    name_normalized: nameNormalized,
    color: newColor,
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

  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO deletion_tombstones (id, user_id, entity_type, entity_id, deleted_at, deleted_version, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      generateUuid(),
      userId,
      "TAG",
      tagId,
      now,
      existing.version + 1,
      "PENDING_PUSH",
    ],
  );

  await db.runAsync(
    `DELETE FROM entry_tags WHERE tag_id = ? AND user_id = ?;`,
    [tagId, userId],
  );

  await db.runAsync(`DELETE FROM tags WHERE id = ? AND user_id = ?;`, [
    tagId,
    userId,
  ]);
}
