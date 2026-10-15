import { Category, CategoryKind, normalizeTextKey } from "../types/domain";
import { DatabaseAdapter, generateUuid } from "./database";

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

export const DEFAULT_PRESET_COLORS = [
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

  let color: string;
  if (data.color) {
    color = data.color.toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(color)) {
      throw new Error("Invalid hex color format.");
    }
    const existingColor = await db.getFirstAsync<Category>(
      `SELECT * FROM categories WHERE user_id = ? AND color = ?;`,
      [userId, color],
    );
    if (existingColor) {
      throw new Error("El color ya está en uso por otra categoría.");
    }
  } else {
    const existingCats = await db.getAllAsync<Category>(
      `SELECT color FROM categories WHERE user_id = ?;`,
      [userId],
    );
    const usedColors = new Set(existingCats.map((c) => c.color?.toUpperCase()));
    const available = DEFAULT_PRESET_COLORS.find((c) => !usedColors.has(c));
    color =
      available ??
      `#${Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, "0")
        .toUpperCase()}`;
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

  const id = data.id ?? generateUuid();
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

export function sortCategoriesCanonically(categories: Category[]): Category[] {
  return [...categories].sort((a, b) => {
    return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
  });
}

export async function listCategories(
  db: DatabaseAdapter,
  userId: string,
): Promise<Category[]> {
  const raw = await db.getAllAsync<Category>(
    `SELECT * FROM categories WHERE user_id = ? ORDER BY created_at ASC;`,
    [userId],
  );

  const mapByName = new Map<string, Category>();
  const duplicateIdsToRemove: string[] = [];

  for (const cat of raw) {
    const key = cat.name_normalized || normalizeTextKey(cat.name);
    if (!mapByName.has(key)) {
      mapByName.set(key, cat);
    } else {
      duplicateIdsToRemove.push(cat.id);
    }
  }

  if (duplicateIdsToRemove.length > 0) {
    for (const dupId of duplicateIdsToRemove) {
      const dupCat = raw.find((c) => c.id === dupId);
      if (dupCat) {
        const key = dupCat.name_normalized || normalizeTextKey(dupCat.name);
        const keeper = mapByName.get(key);
        if (keeper) {
          await db.runAsync(
            `UPDATE entries SET category_id = ? WHERE category_id = ? AND user_id = ?;`,
            [keeper.id, dupId, userId],
          );
        }
      }
      await db.runAsync(
        `DELETE FROM categories WHERE id = ? AND user_id = ?;`,
        [dupId, userId],
      );
    }
  }

  return sortCategoriesCanonically(Array.from(mapByName.values()));
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

  if (newColor !== existing.color) {
    const dupColor = await db.getFirstAsync<Category>(
      `SELECT * FROM categories WHERE user_id = ? AND color = ? AND id != ?;`,
      [userId, newColor, categoryId],
    );
    if (dupColor) {
      throw new Error("El color ya está en uso por otra categoría.");
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

  // Reasignar entradas asociadas a otra categoría existente si hay
  const allCats = await db.getAllAsync<Category>(
    `SELECT * FROM categories WHERE user_id = ? AND id != ?;`,
    [userId, categoryId],
  );
  if (allCats.length > 0) {
    const fallbackId = allCats[0].id;
    await db.runAsync(
      `UPDATE entries SET category_id = ?, updated_at = ?, version = version + 1, sync_status = 'PENDING_PUSH' WHERE category_id = ? AND user_id = ?;`,
      [fallbackId, new Date().toISOString(), categoryId, userId],
    );
  }

  // Registrar tombstone para sincronización
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO deletion_tombstones (id, user_id, entity_type, entity_id, deleted_at, deleted_version, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      generateUuid(),
      userId,
      "CATEGORY",
      categoryId,
      now,
      existing.version + 1,
      "PENDING_PUSH",
    ],
  );

  await db.runAsync(`DELETE FROM categories WHERE id = ? AND user_id = ?;`, [
    categoryId,
    userId,
  ]);
}

export const CANONICAL_CATEGORIES = {
  NOTAS: {
    id: "740d7f77-ae95-4898-a80b-4a31bc58061b",
    name: "Notas",
    voice_command: "nota",
    kind: "STANDARD" as const,
    color: "#6366F1",
    icon: "book",
  },
  TAREAS: {
    id: "20e8f404-c429-43e8-8cf8-af9d51416d58",
    name: "Tareas",
    voice_command: "tarea",
    kind: "TASK" as const,
    color: "#F59E0B",
    icon: "check-square",
  },
  EVENTOS: {
    id: "45e5d9a3-b1d9-4268-acbf-cbe98c0d1ccd",
    name: "Eventos",
    voice_command: "evento",
    kind: "EVENT" as const,
    color: "#10B981",
    icon: "calendar",
  },
  PROYECTOS: {
    id: "994777f6-09d3-4ef9-876a-3b29d09d5fa4",
    name: "Proyectos",
    voice_command: "proyecto",
    kind: "STANDARD" as const,
    color: "#EC4899",
    icon: "folder",
  },
  ALERTA: {
    id: "c3d4e5f6-a7b8-4901-c2d3-e4f5a6b7c8d9",
    name: "Alerta",
    voice_command: "alerta",
    kind: "TASK" as const,
    color: "#EF4444",
    icon: "bell",
  },
};

export async function ensureCanonicalCategories(
  database: DatabaseAdapter,
  uId: string,
): Promise<void> {
  const existing = await listCategories(database, uId);
  const deletedCategoryTombstones = await database.getAllAsync<{
    entity_id: string;
  }>(
    `SELECT entity_id FROM deletion_tombstones WHERE user_id = ? AND entity_type = 'CATEGORY';`,
    [uId],
  );
  const deletedIds = new Set(deletedCategoryTombstones.map((r) => r.entity_id));

  // Remapear categorías si tenían un UUID aleatorio viejo
  const canonicalMap: Record<string, string> = {
    notas: CANONICAL_CATEGORIES.NOTAS.id,
    tareas: CANONICAL_CATEGORIES.TAREAS.id,
    eventos: CANONICAL_CATEGORIES.EVENTOS.id,
    proyectos: CANONICAL_CATEGORIES.PROYECTOS.id,
    alerta: CANONICAL_CATEGORIES.ALERTA.id,
    alertas: CANONICAL_CATEGORIES.ALERTA.id,
  };
  for (const cat of existing) {
    const targetId = canonicalMap[cat.name.toLowerCase()];
    if (targetId && cat.id !== targetId && !deletedIds.has(targetId)) {
      const conflict = await database.getFirstAsync<{ id: string }>(
        `SELECT id FROM categories WHERE id = ?;`,
        [targetId],
      );
      if (!conflict) {
        await database.runAsync(`UPDATE categories SET id = ? WHERE id = ?;`, [
          targetId,
          cat.id,
        ]);
        await database.runAsync(
          `UPDATE entries SET category_id = ? WHERE category_id = ?;`,
          [targetId, cat.id],
        );
      }
    }
  }

  // Si el usuario no tiene ninguna categoría existente y no tiene ningún tombstone de borrado:
  if (existing.length === 0 && deletedIds.size === 0) {
    for (const canonical of Object.values(CANONICAL_CATEGORIES)) {
      await createLocalCategory(database, uId, {
        id: canonical.id,
        name: canonical.name,
        voice_command: canonical.voice_command,
        kind: canonical.kind,
        color: canonical.color,
        icon: canonical.icon,
      });
    }
  } else {
    // Si ya tiene categorías creadas, asegurar que las categorías canónicas nuevas (como Alerta)
    // se añadan si no existen y no han sido eliminadas por el usuario.
    const existingIds = new Set(existing.map((c) => c.id));
    const existingNames = new Set(
      existing.map((c) => c.name_normalized || normalizeTextKey(c.name)),
    );
    const existingCommands = new Set(
      existing.map(
        (c) => c.voice_command_normalized || normalizeTextKey(c.voice_command),
      ),
    );

    for (const canonical of Object.values(CANONICAL_CATEGORIES)) {
      const nameNorm = normalizeTextKey(canonical.name);
      const vcNorm = normalizeTextKey(canonical.voice_command);
      if (
        !existingIds.has(canonical.id) &&
        !deletedIds.has(canonical.id) &&
        !existingNames.has(nameNorm) &&
        !existingCommands.has(vcNorm)
      ) {
        await createLocalCategory(database, uId, {
          id: canonical.id,
          name: canonical.name,
          voice_command: canonical.voice_command,
          kind: canonical.kind,
          color: canonical.color,
          icon: canonical.icon,
        });
      }
    }
  }
}
