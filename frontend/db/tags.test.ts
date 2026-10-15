import { MemoryDatabaseAdapter, runMigrations } from "./database";
import {
  createLocalTag,
  deleteLocalTag,
  getTagById,
  listTags,
  updateLocalTag,
} from "./tags";

describe("Local Tags Storage Layer", () => {
  let db: MemoryDatabaseAdapter;
  const userId = "user-123";

  beforeEach(async () => {
    db = new MemoryDatabaseAdapter();
    await runMigrations(db);
  });

  it("creates and lists tags for a user", async () => {
    const tag1 = await createLocalTag(db, userId, { name: "Urgent Project" });

    expect(tag1.name).toBe("Urgent Project");
    expect(tag1.name_normalized).toBe("urgent project");
    expect(tag1.version).toBe(1);
    expect(tag1.sync_status).toBe("PENDING_PUSH");

    const fetched = await getTagById(db, userId, tag1.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe("Urgent Project");

    const all = await listTags(db, userId);
    expect(all.length).toBe(1);
  });

  it("normalizes tag name spaces and prevents duplicates", async () => {
    await createLocalTag(db, userId, { name: "Urgent  Project" });

    await expect(
      createLocalTag(db, userId, { name: "urgent-project" }),
    ).rejects.toThrow("Tag name already exists.");
  });

  it("updates an existing tag and increments version", async () => {
    const tag = await createLocalTag(db, userId, { name: "Old Tag" });

    const updated = await updateLocalTag(db, userId, tag.id, {
      name: "New Tag",
    });

    expect(updated.name).toBe("New Tag");
    expect(updated.version).toBe(2);

    const fetched = await getTagById(db, userId, tag.id);
    expect(fetched?.name).toBe("New Tag");
  });

  it("deletes a tag", async () => {
    const tag = await createLocalTag(db, userId, { name: "Temp Tag" });

    await deleteLocalTag(db, userId, tag.id);
    const fetched = await getTagById(db, userId, tag.id);
    expect(fetched).toBeNull();
  });

  it("deduplicates tags with the same normalized name and heals entry_tags associations", async () => {
    // Insertar dos tags directamente simulando sync / creación concurrente con UUIDs distintos
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO tags (id, user_id, name, name_normalized, created_at, updated_at, version, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      ["tag-1", userId, "Urgente", "urgente", now, now, 1, "SYNCED"],
    );
    await db.runAsync(
      `INSERT INTO tags (id, user_id, name, name_normalized, created_at, updated_at, version, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      ["tag-2", userId, "#urgente", "urgente", now, now, 1, "SYNCED"],
    );

    // Asociar una entrada a tag-1, otra a tag-2 y otra a ambos
    await db.runAsync(
      `INSERT INTO entry_tags (id, user_id, entry_id, tag_id, created_at) VALUES (?, ?, ?, ?, ?);`,
      ["link-1", userId, "entry-1", "tag-1", now],
    );
    await db.runAsync(
      `INSERT INTO entry_tags (id, user_id, entry_id, tag_id, created_at) VALUES (?, ?, ?, ?, ?);`,
      ["link-2", userId, "entry-2", "tag-2", now],
    );
    await db.runAsync(
      `INSERT INTO entry_tags (id, user_id, entry_id, tag_id, created_at) VALUES (?, ?, ?, ?, ?);`,
      ["link-3a", userId, "entry-3", "tag-1", now],
    );
    await db.runAsync(
      `INSERT INTO entry_tags (id, user_id, entry_id, tag_id, created_at) VALUES (?, ?, ?, ?, ?);`,
      ["link-3b", userId, "entry-3", "tag-2", now],
    );

    const tags = await listTags(db, userId);
    expect(tags.length).toBe(1);
    expect(tags[0].name_normalized).toBe("urgente");

    // Comprobar que en la tabla tags solo queda 1 registro
    const rawTags = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM tags WHERE user_id = ?;`,
      [userId],
    );
    expect(rawTags.length).toBe(1);

    // Comprobar que entry_tags tiene exactamente 3 vínculos válidos (uno por entrada)
    const links = await db.getAllAsync<{ entry_id: string; tag_id: string }>(
      `SELECT entry_id, tag_id FROM entry_tags WHERE user_id = ?;`,
      [userId],
    );
    expect(links.length).toBe(3);
    expect(links.every((l) => l.tag_id === "tag-1")).toBe(true);
  });

  it("handles tag colors and prevents duplicate colors for the same user", async () => {
    // 1. Tag with explicit color
    const t1 = await createLocalTag(db, userId, {
      name: "Tag1",
      color: "#38BDF8",
    });
    expect(t1.color).toBe("#38BDF8");

    // 2. Reject duplicate color for same user
    await expect(
      createLocalTag(db, userId, { name: "Tag2", color: "#38bdf8" }),
    ).rejects.toThrow("El color ya está en uso por otra etiqueta.");

    // 3. Different user CAN use same color
    const otherUser = "user-999";
    const tOther = await createLocalTag(db, otherUser, {
      name: "OtherTag",
      color: "#38BDF8",
    });
    expect(tOther.color).toBe("#38BDF8");

    // 4. Auto-assigns unique available colors when omitted
    const t3 = await createLocalTag(db, userId, { name: "Tag3" });
    const t4 = await createLocalTag(db, userId, { name: "Tag4" });
    expect(t3.color).toBeDefined();
    expect(t4.color).toBeDefined();
    expect(t3.color).not.toBe(t1.color);
    expect(t4.color).not.toBe(t3.color);

    // 5. Updating to duplicate color throws error
    await expect(
      updateLocalTag(db, userId, t3.id, { color: "#38BDF8" }),
    ).rejects.toThrow("El color ya está en uso por otra etiqueta.");

    // 6. Updating to its own color succeeds
    const updated = await updateLocalTag(db, userId, t3.id, {
      color: t3.color,
    });
    expect(updated.color).toBe(t3.color);
  });
});
