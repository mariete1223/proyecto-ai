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
});
