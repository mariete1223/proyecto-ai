import {
  createLocalCategory,
  deleteLocalCategory,
  ensureCanonicalCategories,
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

  it("seeds canonical categories for a fresh user including Alerta", async () => {
    await ensureCanonicalCategories(db, "fresh-user");
    const categories = await listCategories(db, "fresh-user");
    expect(categories.length).toBe(5);
    const names = categories.map((c) => c.name);
    expect(names).toContain("Notas");
    expect(names).toContain("Tareas");
    expect(names).toContain("Eventos");
    expect(names).toContain("Proyectos");
    expect(names).toContain("Alerta");

    const alerta = categories.find((c) => c.name === "Alerta");
    expect(alerta).toBeDefined();
    expect(alerta?.kind).toBe("STANDARD");
    expect(alerta?.voice_command).toBe("alerta");
    expect(alerta?.color).toBe("#EF4444");
    expect(alerta?.icon).toBe("bell");
  });

  it("heals existing Alerta category from TASK to STANDARD kind (#74)", async () => {
    await createLocalCategory(db, "legacy-user", {
      id: "c3d4e5f6-a7b8-4901-c2d3-e4f5a6b7c8d9",
      name: "Alerta",
      voice_command: "alerta",
      kind: "TASK",
    });

    let cat = await getCategoryById(
      db,
      "legacy-user",
      "c3d4e5f6-a7b8-4901-c2d3-e4f5a6b7c8d9",
    );
    expect(cat?.kind).toBe("TASK");

    await ensureCanonicalCategories(db, "legacy-user");

    cat = await getCategoryById(
      db,
      "legacy-user",
      "c3d4e5f6-a7b8-4901-c2d3-e4f5a6b7c8d9",
    );
    expect(cat?.kind).toBe("STANDARD");
  });

  it("migrates existing users to add canonical Alerta category if missing and not deleted", async () => {
    // Simular un usuario previo que solo tiene Notas, Tareas, Eventos
    await createLocalCategory(db, "migrated-user", {
      name: "Notas",
      voice_command: "nota",
      kind: "STANDARD",
    });
    await createLocalCategory(db, "migrated-user", {
      name: "Tareas",
      voice_command: "tarea",
      kind: "TASK",
    });

    let cats = await listCategories(db, "migrated-user");
    expect(cats.length).toBe(2);

    await ensureCanonicalCategories(db, "migrated-user");

    cats = await listCategories(db, "migrated-user");
    const names = cats.map((c) => c.name);
    expect(names).toContain("Alerta");
  });

  it("does not recreate Proyectos or Alerta after they are deleted", async () => {
    await ensureCanonicalCategories(db, userId);
    let categories = await listCategories(db, userId);
    expect(categories.length).toBe(5);

    const proyectos = categories.find((c) => c.name === "Proyectos");
    const alerta = categories.find((c) => c.name === "Alerta");
    expect(proyectos).toBeDefined();
    expect(alerta).toBeDefined();

    // Borrar Proyectos y Alerta
    await deleteLocalCategory(db, userId, proyectos!.id);
    await deleteLocalCategory(db, userId, alerta!.id);

    // Verificar que se registraron los tombstones
    const tombstones = await db.getAllAsync<{ entity_id: string }>(
      `SELECT entity_id FROM deletion_tombstones WHERE user_id = ? AND entity_type = 'CATEGORY';`,
      [userId],
    );
    const tombstoneIds = tombstones.map((t) => t.entity_id);
    expect(tombstoneIds).toContain(proyectos!.id);
    expect(tombstoneIds).toContain(alerta!.id);

    // Volver a llamar a ensureCanonicalCategories (como ocurre en refrescos / arranques)
    await ensureCanonicalCategories(db, userId);

    categories = await listCategories(db, userId);
    expect(categories.find((c) => c.name === "Proyectos")).toBeUndefined();
    expect(categories.find((c) => c.name === "Alerta")).toBeUndefined();
    expect(categories.length).toBe(3);
  });

  it("prevents creating or updating categories with duplicate colors for same user", async () => {
    const cat1 = await createLocalCategory(db, userId, {
      name: "Cat 1",
      voice_command: "cat1",
      color: "#FF0000",
    });

    await expect(
      createLocalCategory(db, userId, {
        name: "Cat 2",
        voice_command: "cat2",
        color: "#ff0000",
      }),
    ).rejects.toThrow("El color ya está en uso por otra categoría.");

    await updateLocalCategory(db, userId, cat1.id, {
      color: "#FF0000",
    });

    const cat2 = await createLocalCategory(db, userId, {
      name: "Cat 2",
      voice_command: "cat2",
      color: "#00FF00",
    });

    await expect(
      updateLocalCategory(db, userId, cat2.id, {
        color: "#FF0000",
      }),
    ).rejects.toThrow("El color ya está en uso por otra categoría.");
  });
});
