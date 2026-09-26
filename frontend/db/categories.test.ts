import {
  createLocalCategory,
  deleteLocalCategory,
  getCategoryById,
  listCategories,
  updateLocalCategory,
} from "./categories";
import { MemoryDatabaseAdapter, runMigrations } from "./database";

describe("Local Categories Storage Layer", () => {
  let db: MemoryDatabaseAdapter;
  const userId = "user-123";

  beforeEach(async () => {
    db = new MemoryDatabaseAdapter();
    await runMigrations(db);
  });

  it("creates and lists categories for a user", async () => {
    const cat1 = await createLocalCategory(db, userId, {
      name: "Work",
      voice_command: "work",
      color: "#FF0000",
      icon: "briefcase",
    });

    expect(cat1.name).toBe("Work");
    expect(cat1.name_normalized).toBe("work");
    expect(cat1.version).toBe(1);
    expect(cat1.sync_status).toBe("PENDING_PUSH");

    const fetched = await getCategoryById(db, userId, cat1.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe("Work");

    const all = await listCategories(db, userId);
    expect(all.length).toBe(1);
  });

  it("prevents duplicate category names or voice commands for same user", async () => {
    await createLocalCategory(db, userId, {
      name: "Work",
      voice_command: "work",
    });

    await expect(
      createLocalCategory(db, userId, {
        name: "Work",
        voice_command: "other",
      }),
    ).rejects.toThrow("Category name already exists.");

    await expect(
      createLocalCategory(db, userId, {
        name: "Unique",
        voice_command: "work",
      }),
    ).rejects.toThrow("Voice command already exists.");
  });

  it("updates an existing category and increments version", async () => {
    const cat = await createLocalCategory(db, userId, {
      name: "Personal",
      voice_command: "pers",
    });

    const updated = await updateLocalCategory(db, userId, cat.id, {
      name: "Personal Updated",
    });

    expect(updated.name).toBe("Personal Updated");
    expect(updated.version).toBe(2);

    const fetched = await getCategoryById(db, userId, cat.id);
    expect(fetched?.name).toBe("Personal Updated");
  });

  it("deletes a category", async () => {
    const cat = await createLocalCategory(db, userId, {
      name: "Temp",
      voice_command: "temp",
    });

    await deleteLocalCategory(db, userId, cat.id);
    const fetched = await getCategoryById(db, userId, cat.id);
    expect(fetched).toBeNull();
  });
});
