import { Category, CategoryKind, normalizeTextKey } from "../types/domain";
import { DatabaseAdapter } from "./database";

export interface CreateCategoryData {
  id?: string;
  name: string;
  voice_command: string;
  description?: string;
  color?: string;
  icon?: string;
  kind?: CategoryKind;
}

export interface UpdateCategoryData {
  name?: string;
  voice_command?: string;
  description?: string;
  color?: string;
  icon?: string;
}

export async function createLocalCategory(
  db: DatabaseAdapter,
  userId: string,
  data: CreateCategoryData,
): Promise<Category> {
  const name = data.name.trim();
  const voiceCommand = data.voice_command.trim();
  if (!name || !voiceCommand) {
    throw new Error("Name and voice command cannot be empty.");
  }

  const color = (data.color ?? "#000000").toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(color)) {
    throw new Error("Invalid hex color format.");
  }

  const nameNormalized = normalizeTextKey(name);
  const vcNormalized = normalizeTextKey(voiceCommand);

  // Uniqueness check
  const existingName = await db.getFirstAsync<Category>(
    `SELECT * FROM categories WHERE user_id = ? AND name_normalized = ?;`,
    [userId, nameNormalized],
  );
  if (existingName) {
    throw new Error("Category name already exists.");
  }

  const existingVc = await db.getFirstAsync<Category>(
    `SELECT * FROM categories WHERE user_id = ? AND voice_command_normalized = ?;`,
    [userId, vcNormalized],
  );
  if (existingVc) {
    throw new Error("Voice command already exists.");
  }

  const id = data.id ?? Math.random().toString(36).substring(2, 15);
  const now = new Date().toISOString();
  const category: Category = {
    id,
    user_id: userId,
    kind: data.kind ?? "STANDARD",
    name,
    name_normalized: nameNormalized,
    voice_command: voiceCommand,
    voice_command_normalized: vcNormalized,
    description: (data.description ?? "").trim(),
    color,
    icon: (data.icon ?? "folder").trim(),
    created_at: now,
    updated_at: now,
    version: 1,
    sync_status: "PENDING_PUSH",
  };

  await db.runAsync(
    `INSERT INTO categories (id, user_id, kind, name, name_normalized, voice_command, voice_command_normalized, description, color, icon, created_at, updated_at, version, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      category.id,
      category.user_id,
      category.kind,
      category.name,
      category.name_normalized,
      category.voice_command,
      category.voice_command_normalized,
      category.description,
      category.color,
      category.icon,
      category.created_at,
      category.updated_at,
      category.version,
      category.sync_status,
    ],
  );

  return category;
}

export async function getCategoryById(
  db: DatabaseAdapter,
  userId: string,
  categoryId: string,
): Promise<Category | null> {
  return db.getFirstAsync<Category>(
    `SELECT * FROM categories WHERE id = ? AND user_id = ?;`,
    [categoryId, userId],
  );
}

export async function listCategories(
  db: DatabaseAdapter,
  userId: string,
): Promise<Category[]> {
  return db.getAllAsync<Category>(
    `SELECT * FROM categories WHERE user_id = ? ORDER BY name ASC;`,
    [userId],
  );
}

export async function updateLocalCategory(
  db: DatabaseAdapter,
  userId: string,
  categoryId: string,
  data: UpdateCategoryData,
): Promise<Category> {
  const existing = await getCategoryById(db, userId, categoryId);
  if (!existing) {
    throw new Error("Category not found.");
  }

  const newName = data.name !== undefined ? data.name.trim() : existing.name;
  const newVc =
    data.voice_command !== undefined
      ? data.voice_command.trim()
      : existing.voice_command;
  const newColor =
    data.color !== undefined ? data.color.toUpperCase() : existing.color;
  const newDesc =
    data.description !== undefined
      ? data.description.trim()
      : existing.description;
  const newIcon = data.icon !== undefined ? data.icon.trim() : existing.icon;

  if (!newName || !newVc) {
    throw new Error("Name and voice command cannot be empty.");
  }

  if (!/^#[0-9A-F]{6}$/.test(newColor)) {
    throw new Error("Invalid hex color format.");
  }

  const nameNorm = normalizeTextKey(newName);
  const vcNorm = normalizeTextKey(newVc);

  if (nameNorm !== existing.name_normalized) {
    const dupName = await db.getFirstAsync<Category>(
      `SELECT * FROM categories WHERE user_id = ? AND name_normalized = ? AND id != ?;`,
      [userId, nameNorm, categoryId],
    );
    if (dupName) {
      throw new Error("Category name already exists.");
    }
  }

  if (vcNorm !== existing.voice_command_normalized) {
    const dupVc = await db.getFirstAsync<Category>(
      `SELECT * FROM categories WHERE user_id = ? AND voice_command_normalized = ? AND id != ?;`,
      [userId, vcNorm, categoryId],
    );
    if (dupVc) {
      throw new Error("Voice command already exists.");
    }
  }

  const now = new Date().toISOString();
  const updatedVersion = existing.version + 1;

  await db.runAsync(
    `UPDATE categories SET name = ?, name_normalized = ?, voice_command = ?, voice_command_normalized = ?, description = ?, color = ?, icon = ?, updated_at = ?, version = ?, sync_status = 'PENDING_PUSH' WHERE id = ? AND user_id = ?;`,
    [
      newName,
      nameNorm,
      newVc,
      vcNorm,
      newDesc,
      newColor,
      newIcon,
      now,
      updatedVersion,
      categoryId,
      userId,
    ],
  );

  return {
    ...existing,
    name: newName,
    name_normalized: nameNorm,
    voice_command: newVc,
    voice_command_normalized: vcNorm,
    description: newDesc,
    color: newColor,
    icon: newIcon,
    updated_at: now,
    version: updatedVersion,
    sync_status: "PENDING_PUSH",
  };
}

export async function deleteLocalCategory(
  db: DatabaseAdapter,
  userId: string,
  categoryId: string,
): Promise<void> {
  const existing = await getCategoryById(db, userId, categoryId);
  if (!existing) {
    throw new Error("Category not found.");
  }

  await db.runAsync(`DELETE FROM categories WHERE id = ? AND user_id = ?;`, [
    categoryId,
    userId,
  ]);
}
