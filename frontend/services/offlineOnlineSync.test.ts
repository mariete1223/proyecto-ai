import {
  DatabaseAdapter,
  MemoryDatabaseAdapter,
  runMigrations,
} from "../db/database";
import { createLocalCategory, listCategories } from "../db/categories";
import { createLocalTag, listTags } from "../db/tags";
import {
  createLocalEntry,
  deleteLocalEntry,
  getEntryById,
  listLocalEntries,
  updateLocalEntry,
} from "../db/entries";
import { getPendingLocalChanges, performSync, SyncConfig } from "./syncEngine";

describe("Offline-to-Online Seamless Synchronization & Persistence Suite (#121)", () => {
  let db: DatabaseAdapter;
  const verifiedUserId = "verified-user-121";
  const apiBaseUrl = "http://localhost:8000";
  const verifiedToken =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-verified-token";

  beforeEach(async () => {
    db = new MemoryDatabaseAdapter();
    await runMigrations(db);
  });

  it("Step 1: Offline mutations (create/update/delete) persist locally without network and queue PENDING_PUSH", async () => {
    // 1.1 Crear categoría en offline
    const customCategory = await createLocalCategory(db, verifiedUserId, {
      name: "Proyectos Offline",
      kind: "TASK",
      voice_command: "proyecto",
      color: "#8B5CF6",
      icon: "rocket",
    });
    expect(customCategory.id).toBeTruthy();
    expect(customCategory.sync_status).toBe("PENDING_PUSH");

    // 1.2 Crear etiqueta en offline
    const customTag = await createLocalTag(db, verifiedUserId, {
      name: "Urgente Offline",
      color: "#EF4444",
    });
    expect(customTag.id).toBeTruthy();
    expect(customTag.sync_status).toBe("PENDING_PUSH");

    // 1.3 Crear entrada (tarea) en offline asociada a categoría y etiqueta
    const taskEntry = await createLocalEntry(db, verifiedUserId, {
      category_id: customCategory.id,
      title: "Planificación de entrega",
      content: "Terminar informe de persistencia y sincronización",
      task_status: "PENDING",
      task_recurrence: "ONCE",
      task_priority: "HIGH",
      occurred_at: "2026-10-30T10:00:00Z",
      tag_ids: [customTag.id],
    });
    expect(taskEntry.id).toBeTruthy();
    expect(taskEntry.sync_status).toBe("PENDING_PUSH");
    expect(taskEntry.task_priority).toBe("HIGH");

    // 1.4 Crear entrada de alerta en offline
    const alertEntry = await createLocalEntry(db, verifiedUserId, {
      category_id: customCategory.id,
      title: "Alerta de sistema",
      content: "Verificar conexión restablecida",
      reminder_enabled: true,
      reminder_offset_minutes: 15,
      occurred_at: "2026-10-30T10:00:00Z",
    });
    expect(alertEntry.id).toBeTruthy();
    expect(alertEntry.reminder_enabled).toBe(true);
    expect(alertEntry.sync_status).toBe("PENDING_PUSH");

    // 1.5 Crear una nota que luego se eliminará en offline
    const noteToDelete = await createLocalEntry(db, verifiedUserId, {
      category_id: customCategory.id,
      content: "Nota temporal que será borrada",
    });
    expect(noteToDelete.id).toBeTruthy();

    // 1.6 Actualizar la tarea en offline
    const updatedTask = await updateLocalEntry(
      db,
      verifiedUserId,
      taskEntry.id,
      {
        content: "Terminar informe de persistencia y sincronización (Revisado)",
        task_status: "DONE",
      },
    );
    expect(updatedTask.task_status).toBe("DONE");
    expect(updatedTask.content).toContain("(Revisado)");
    expect(updatedTask.version).toBe(2);
    expect(updatedTask.sync_status).toBe("PENDING_PUSH");

    // 1.7 Eliminar la nota temporal en offline
    await deleteLocalEntry(db, verifiedUserId, noteToDelete.id);

    // Verificar que la nota ya no está en la base de datos local
    const retrievedDeleted = await getEntryById(
      db,
      verifiedUserId,
      noteToDelete.id,
    );
    expect(retrievedDeleted).toBeNull();

    // Verificar que las consultas locales reflejan todo el estado offline inmediatamente
    const localCategories = await listCategories(db, verifiedUserId);
    expect(localCategories.some((c) => c.id === customCategory.id)).toBe(true);

    const localTags = await listTags(db, verifiedUserId);
    expect(localTags.some((t) => t.id === customTag.id)).toBe(true);

    const localEntries = await listLocalEntries(db, verifiedUserId);
    expect(localEntries.length).toBe(2); // taskEntry + alertEntry
    expect(
      localEntries.some(
        (e) => e.id === taskEntry.id && e.task_status === "DONE",
      ),
    ).toBe(true);
    expect(localEntries.some((e) => e.id === alertEntry.id)).toBe(true);

    // 1.8 Verificar cola de cambios pendientes acumulados para sincronizar
    const pendingChanges = await getPendingLocalChanges(db, verifiedUserId);
    expect(pendingChanges.length).toBeGreaterThanOrEqual(5);

    // Debe incluir la categoría, la etiqueta, la tarea actualizada, la alerta, el link de etiqueta y el tombstone de eliminación
    const entityTypes = pendingChanges.map((c) => c.entity_type);
    expect(entityTypes).toContain("CATEGORY");
    expect(entityTypes).toContain("TAG");
    expect(entityTypes).toContain("ENTRY");
    expect(entityTypes).toContain("ENTRY_TAG");
  });

  it("Step 2: Transition from Offline to Online synchronizes all queued changes to backend smoothly", async () => {
    // 2.1 Crear entidades mientras se estaba offline
    const cat = await createLocalCategory(db, verifiedUserId, {
      name: "Trabajo Offline",
      kind: "STANDARD",
      voice_command: "trabajo",
      color: "#10B981",
    });

    const entry = await createLocalEntry(db, verifiedUserId, {
      category_id: cat.id,
      title: "Nota Offline",
      content: "Contenido redactado sin internet",
      occurred_at: "2026-10-31T15:00:00Z",
    });

    const pendingBeforeSync = await getPendingLocalChanges(db, verifiedUserId);
    expect(pendingBeforeSync.length).toBe(2);

    // 2.2 Simular que se recupera la conexión online: el servidor responde HTTP 200 con APPLIED
    const mockFetch = jest
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes("/api/v1/sync/push")) {
          const body = JSON.parse(init?.body as string);
          const results = body.client_changes.map((ch: any) => ({
            change_id: ch.change_id,
            entity_type: ch.entity_type,
            entity_id: ch.entity_id,
            status: "APPLIED",
            applied_version: (ch.base_version || 0) + 1,
          }));
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ results }),
          });
        }
        if (url.includes("/api/v1/sync/pull")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                changes: [],
                tombstones: [],
                next_cursor: "cursor-2026-10-31",
                has_more: false,
              }),
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

    const config: SyncConfig = {
      apiBaseUrl,
      token: verifiedToken,
      userId: verifiedUserId,
      fetchFn: mockFetch,
    };

    // Ejecutar sincronización
    const syncResult = await performSync(db, config);

    expect(syncResult.success).toBe(true);
    expect(syncResult.pushed_applied).toBe(2);
    expect(syncResult.pushed_errors).toBe(0);
    expect(syncResult.pushed_conflicts).toBe(0);

    // 2.3 Verificar que el estado local ha pasado a SYNCED
    const syncedCat = (await listCategories(db, verifiedUserId)).find(
      (c) => c.id === cat.id,
    );
    expect(syncedCat?.sync_status).toBe("SYNCED");

    const syncedEntry = await getEntryById(db, verifiedUserId, entry.id);
    expect(syncedEntry?.sync_status).toBe("SYNCED");

    // 2.4 La cola de cambios pendientes ahora está vacía
    const pendingAfterSync = await getPendingLocalChanges(db, verifiedUserId);
    expect(pendingAfterSync.length).toBe(0);
  });

  it("Step 3: Transient network failure during sync handles errors gracefully and keeps local data safe", async () => {
    // 3.1 Crear entrada local
    const cat = await createLocalCategory(db, verifiedUserId, {
      name: "Seguridad de Datos",
      kind: "STANDARD",
      voice_command: "seguridad",
    });

    const entry = await createLocalEntry(db, verifiedUserId, {
      category_id: cat.id,
      content: "Datos cruciales que no deben perderse ante error de red",
    });

    // 3.2 Simular caída de red durante la llamada fetch
    const failingFetch = jest
      .fn()
      .mockRejectedValue(
        new Error("Network connection lost (Failed to fetch)"),
      );

    const config: SyncConfig = {
      apiBaseUrl,
      token: verifiedToken,
      userId: verifiedUserId,
      fetchFn: failingFetch,
    };

    const syncResult = await performSync(db, config);

    // Sync reporta que no tuvo éxito sin lanzar un error fatal
    expect(syncResult.success).toBe(false);
    expect(syncResult.error).toContain("Network connection lost");

    // Los datos locales permanecen 100% íntegros y seguros en PENDING_PUSH
    const safeEntry = await getEntryById(db, verifiedUserId, entry.id);
    expect(safeEntry).not.toBeNull();
    expect(safeEntry?.content).toBe(
      "Datos cruciales que no deben perderse ante error de red",
    );
    expect(safeEntry?.sync_status).toBe("PENDING_PUSH");

    // 3.3 Al recuperarse la red en el siguiente intento, sincroniza con éxito
    const recoveredFetch = jest
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes("/api/v1/sync/push")) {
          const body = JSON.parse(init?.body as string);
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                results: body.client_changes.map((ch: any) => ({
                  change_id: ch.change_id,
                  entity_type: ch.entity_type,
                  entity_id: ch.entity_id,
                  status: "APPLIED",
                  applied_version: 1,
                })),
              }),
          });
        }
        if (url.includes("/api/v1/sync/pull")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                changes: [],
                tombstones: [],
                next_cursor: "cursor-recovered",
                has_more: false,
              }),
          });
        }
        return Promise.reject(new Error("Unknown route"));
      });

    const retryResult = await performSync(db, {
      ...config,
      fetchFn: recoveredFetch,
    });

    expect(retryResult.success).toBe(true);
    expect(retryResult.pushed_applied).toBe(2);

    const finalizedEntry = await getEntryById(db, verifiedUserId, entry.id);
    expect(finalizedEntry?.sync_status).toBe("SYNCED");
  });

  it("Step 4: Pulling remote changes does not duplicate items already matching local content", async () => {
    // 4.1 Categoría existente
    const cat = await createLocalCategory(db, verifiedUserId, {
      name: "Notas Compartidas",
      kind: "STANDARD",
      voice_command: "compartidas",
    });

    // 4.2 Entrada creada en local
    const localEntry = await createLocalEntry(db, verifiedUserId, {
      category_id: cat.id,
      title: "Mismo Titulo",
      content: "Contenido idéntico que el servidor también tiene",
    });

    // 4.3 Servidor envía una entrada remota con el mismo contenido
    const remoteServerId = "server-uuid-9999-4444";
    const pullMockFetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes("/api/v1/sync/push")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ results: [] }),
        });
      }
      if (url.includes("/api/v1/sync/pull")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              changes: [
                {
                  entity_type: "ENTRY",
                  entity_id: remoteServerId,
                  action: "CREATE",
                  payload: {
                    id: remoteServerId,
                    category_id: cat.id,
                    title: "Mismo Titulo",
                    content: "Contenido idéntico que el servidor también tiene",
                    updated_at: new Date().toISOString(),
                    version: 1,
                  },
                },
              ],
              tombstones: [],
              next_cursor: "cursor-dedup",
              has_more: false,
            }),
        });
      }
      return Promise.reject(new Error("Unknown route"));
    });

    const res = await performSync(db, {
      apiBaseUrl,
      token: verifiedToken,
      userId: verifiedUserId,
      fetchFn: pullMockFetch,
    });

    expect(res.success).toBe(true);

    // Verificar que no se duplicó: solo existe 1 entrada con ese contenido
    const allEntries = await listLocalEntries(db, verifiedUserId);
    const matching = allEntries.filter(
      (e) => e.content === "Contenido idéntico que el servidor también tiene",
    );
    expect(matching.length).toBe(1);
    expect(matching[0].sync_status).toBe("SYNCED");
  });
});
