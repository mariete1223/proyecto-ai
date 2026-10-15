import { DatabaseAdapter } from "../db/database";

export type RemoteDeletionEntityType = "CATEGORY" | "TAG" | "ENTRY";

/** Apply an accepted server tombstone without creating another local delete. */
export async function applyRemoteDeletion(
  db: DatabaseAdapter,
  userId: string,
  entityType: RemoteDeletionEntityType,
  entityId: string,
): Promise<void> {
  if (entityType === "CATEGORY") {
    const associatedEntries = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM entries WHERE category_id = ? AND user_id = ?;`,
      [entityId, userId],
    );

    if (associatedEntries.length > 0) {
      const fallback = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM categories WHERE user_id = ? AND id != ?;`,
        [userId, entityId],
      );
      if (!fallback) {
        throw new Error(
          "No se puede aplicar el borrado remoto: la categoría contiene entradas y no existe otra categoría local a la que moverlas.",
        );
      }
      await db.runAsync(
        `UPDATE entries SET category_id = ? WHERE category_id = ? AND user_id = ?;`,
        [fallback.id, entityId, userId],
      );
    }

    await db.runAsync(`DELETE FROM categories WHERE id = ? AND user_id = ?;`, [
      entityId,
      userId,
    ]);
  } else if (entityType === "TAG") {
    await db.runAsync(
      `DELETE FROM entry_tags WHERE tag_id = ? AND user_id = ?;`,
      [entityId, userId],
    );
    await db.runAsync(`DELETE FROM tags WHERE id = ? AND user_id = ?;`, [
      entityId,
      userId,
    ]);
  } else {
    await db.runAsync(
      `DELETE FROM entry_tags WHERE entry_id = ? AND user_id = ?;`,
      [entityId, userId],
    );
    await db.runAsync(`DELETE FROM entries WHERE id = ? AND user_id = ?;`, [
      entityId,
      userId,
    ]);
  }

  await db.runAsync(
    `DELETE FROM deletion_tombstones WHERE user_id = ? AND entity_type = ? AND entity_id = ?;`,
    [userId, entityType, entityId],
  );
}
