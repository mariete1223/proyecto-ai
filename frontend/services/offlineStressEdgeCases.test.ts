import {
  DatabaseAdapter,
  MemoryDatabaseAdapter,
  runMigrations,
} from "../db/database";
import {
  createLocalCategory,
  deleteLocalCategory,
  listCategories,
} from "../db/categories";
import { createLocalTag, deleteLocalTag, listTags } from "../db/tags";
import {
  createLocalEntry,
  deleteLocalEntry,
  getEntryById,
  listLocalEntries,
  updateLocalEntry,
} from "../db/entries";
import { getPendingLocalChanges, performSync, SyncConfig } from "./syncEngine";

describe("Offline-First Resilience & Stress Edge Cases Suite (#122)", () => {
  let db: DatabaseAdapter;
  const verifiedUserId = "verified-stress-user-122";
  const apiBaseUrl = "http://localhost:8000";
  const verifiedToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-token-122";

  beforeEach(async () => {
    db = new MemoryDatabaseAdapter();
    await runMigrations(db);
  });

  // =========================================================================
  // EDGE CASE 1: Mutaciones en cadena sucesivas sobre una misma entidad offline
  // =========================================================================
  it("Edge Case 1: Chained offline mutations (create -> multiple edits -> status change) preserve versioning and consolidate correctly", async () => {
    // 1. Crear categoría base de tipo TASK
    const category = await createLocalCategory(db, verifiedUserId, {
      name: "Proyectos en Cadena",
      kind: "TASK",
      voice_command: "cadena",
      color: "#6366F1",
    });

    // 2. Crear entrada inicial
    const entry = await createLocalEntry(db, verifiedUserId, {
      category_id: category.id,
      title: "Versión Inicial",
      content: "Borrador inicial redactado offline",
      task_status: "PENDING",
      task_recurrence: "ONCE",
      task_priority: "LOW",
    });

    expect(entry.version).toBe(1);
    expect(entry.sync_status).toBe("PENDING_PUSH");

    // 3. Mutación 1: Editar título y contenido
    const edit1 = await updateLocalEntry(db, verifiedUserId, entry.id, {
      title: "Versión Intermedia 1",
      content: "Contenido ampliado en segunda edición offline",
    });
    expect(edit1.version).toBe(2);
    expect(edit1.sync_status).toBe("PENDING_PUSH");

    // 4. Mutación 2: Cambiar prioridad y añadir recordatorio
    const edit2 = await updateLocalEntry(db, verifiedUserId, entry.id, {
      task_priority: "HIGH",
      reminder_enabled: true,
      reminder_offset_minutes: 30,
    });
    expect(edit2.version).toBe(3);
    expect(edit2.task_priority).toBe("HIGH");

    // 5. Mutación 3: Marcar tarea como completada
    const edit3 = await updateLocalEntry(db, verifiedUserId, entry.id, {
      task_status: "DONE",
    });
    expect(edit3.version).toBe(4);
    expect(edit3.task_status).toBe("DONE");
    expect(edit3.sync_status).toBe("PENDING_PUSH");

    // 6. Comprobar que en la cola de sincronización solo viaja la versión consolidada más reciente (v4)
    const pending = await getPendingLocalChanges(db, verifiedUserId);
    const entryChange = pending.find(
      (c) => c.entity_type === "ENTRY" && c.entity_id === entry.id,
    );
    expect(entryChange).toBeDefined();
    expect(entryChange?.action).toBe("UPDATE");
    expect(entryChange?.base_version).toBe(3); // base_version para versión 4
    expect((entryChange?.payload as any).task_status).toBe("DONE");
    expect((entryChange?.payload as any).task_priority).toBe("HIGH");
    expect((entryChange?.payload as any).title).toBe("Versión Intermedia 1");

    // 7. Simular creación y eliminación inmediata en offline (debe generar tombstone de DELETE)
    const tempEntry = await createLocalEntry(db, verifiedUserId, {
      category_id: category.id,
      content: "Entrada efímera offline",
      task_status: "PENDING",
      task_recurrence: "ONCE",
    });
    await deleteLocalEntry(db, verifiedUserId, tempEntry.id);

    // Debe existir un tombstone en la base de datos
    const tombstones = await db.getAllAsync<{
      entity_type: string;
      entity_id: string;
    }>(
      `SELECT entity_type, entity_id FROM deletion_tombstones WHERE user_id = ?;`,
      [verifiedUserId],
    );
    expect(
      tombstones.some(
        (t) => t.entity_type === "ENTRY" && t.entity_id === tempEntry.id,
      ),
    ).toBe(true);

    // Y el getPendingLocalChanges debe contener la acción DELETE
    const updatedPending = await getPendingLocalChanges(db, verifiedUserId);
    const deleteAction = updatedPending.find(
      (c) => c.entity_id === tempEntry.id && c.action === "DELETE",
    );
    expect(deleteAction).toBeDefined();
  });

  // =========================================================================
  // EDGE CASE 2: Integridad referencial cruzada (categorías antes de entradas)
  // =========================================================================
  it("Edge Case 2: Cross-referential integrity ensures offline categories precede dependent entries in push payload", async () => {
    // 1. Crear una nueva categoría offline
    const newCategory = await createLocalCategory(db, verifiedUserId, {
      name: "Categoría Dependiente Offline",
      kind: "STANDARD",
      voice_command: "dependiente",
      color: "#10B981",
    });

    // 2. Crear una etiqueta offline
    const newTag = await createLocalTag(db, verifiedUserId, {
      name: "Tag Offline Crítico",
      color: "#EF4444",
    });

    // 3. Crear múltiples entradas que referencian esa categoría y etiqueta
    const entryA = await createLocalEntry(db, verifiedUserId, {
      category_id: newCategory.id,
      title: "Hijo 1",
      content: "Contenido hijo 1",
      tag_ids: [newTag.id],
    });

    const entryB = await createLocalEntry(db, verifiedUserId, {
      category_id: newCategory.id,
      title: "Hijo 2",
      content: "Contenido hijo 2",
    });

    // 4. Obtener lote de cambios pendientes
    const pendingChanges = await getPendingLocalChanges(db, verifiedUserId);

    // 5. Verificar orden estricto: CATEGORY debe aparecer antes que ENTRY y ENTRY_TAG
    const categoryIndex = pendingChanges.findIndex(
      (c) => c.entity_type === "CATEGORY" && c.entity_id === newCategory.id,
    );
    const tagIndex = pendingChanges.findIndex(
      (c) => c.entity_type === "TAG" && c.entity_id === newTag.id,
    );
    const entryAIndex = pendingChanges.findIndex(
      (c) => c.entity_type === "ENTRY" && c.entity_id === entryA.id,
    );
    const entryBIndex = pendingChanges.findIndex(
      (c) => c.entity_type === "ENTRY" && c.entity_id === entryB.id,
    );

    expect(categoryIndex).toBeGreaterThanOrEqual(0);
    expect(tagIndex).toBeGreaterThanOrEqual(0);
    expect(categoryIndex).toBeLessThan(entryAIndex);
    expect(categoryIndex).toBeLessThan(entryBIndex);
    expect(tagIndex).toBeLessThan(entryAIndex);

    // 6. Ejecutar sync simulando que el backend procesa en orden y responde 200
    const mockFetch = jest
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes("/api/v1/sync/push")) {
          const body = JSON.parse(init?.body as string);
          // Verificar que el payload que llega al servidor mantiene la categoría antes de las entradas
          const sentCategoryIndex = body.client_changes.findIndex(
            (c: any) => c.entity_id === newCategory.id,
          );
          const sentEntryIndex = body.client_changes.findIndex(
            (c: any) => c.entity_id === entryA.id,
          );
          expect(sentCategoryIndex).toBeLessThan(sentEntryIndex);

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
                has_more: false,
              }),
          });
        }
        return Promise.reject(new Error("Route not found"));
      });

    const syncResult = await performSync(db, {
      apiBaseUrl,
      token: verifiedToken,
      userId: verifiedUserId,
      fetchFn: mockFetch,
    });

    expect(syncResult.success).toBe(true);
    expect(syncResult.pushed_applied).toBe(pendingChanges.length);

    // Verificar que todas las entidades asociadas ahora están en SYNCED
    const finalCat = (await listCategories(db, verifiedUserId)).find(
      (c) => c.id === newCategory.id,
    );
    expect(finalCat?.sync_status).toBe("SYNCED");

    const finalA = await getEntryById(db, verifiedUserId, entryA.id);
    expect(finalA?.sync_status).toBe("SYNCED");
    expect(finalA?.category_id).toBe(newCategory.id);
  });

  // =========================================================================
  // EDGE CASE 3: Tolerancia a fallo parcial de red y reintento atómico
  // =========================================================================
  it("Edge Case 3: Partial push failure keeps failed items in PENDING_PUSH/ERROR and succeeds on next retry without duplicate items", async () => {
    // 1. Crear dos entradas en offline
    const cat = await createLocalCategory(db, verifiedUserId, {
      name: "Categoría Parcial",
      kind: "STANDARD",
      voice_command: "parcial",
    });

    const entry1 = await createLocalEntry(db, verifiedUserId, {
      category_id: cat.id,
      content: "Entrada 1 que será aceptada",
    });

    const entry2 = await createLocalEntry(db, verifiedUserId, {
      category_id: cat.id,
      content: "Entrada 2 que será rechazada temporalmente por el servidor",
    });

    // 2. Simular respuesta del servidor donde entry1 es APPLIED, pero entry2 es REJECTED (error temporal)
    const partialFetch = jest
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes("/api/v1/sync/push")) {
          const body = JSON.parse(init?.body as string);
          const results = body.client_changes.map((ch: any) => {
            if (ch.entity_id === entry2.id) {
              return {
                change_id: ch.change_id,
                entity_type: ch.entity_type,
                entity_id: ch.entity_id,
                status: "REJECTED",
                error_message: "Temporal database lock in cluster",
              };
            }
            return {
              change_id: ch.change_id,
              entity_type: ch.entity_type,
              entity_id: ch.entity_id,
              status: "APPLIED",
              applied_version: 1,
            };
          });

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
                has_more: false,
              }),
          });
        }
        return Promise.reject(new Error("Route not found"));
      });

    const sync1 = await performSync(db, {
      apiBaseUrl,
      token: verifiedToken,
      userId: verifiedUserId,
      fetchFn: partialFetch,
    });

    expect(sync1.success).toBe(true);
    expect(sync1.pushed_applied).toBeGreaterThanOrEqual(2); // categoría + entry1
    expect(sync1.pushed_errors).toBe(1); // entry2

    // 3. Verificar estados locales: entry1 debe estar SYNCED, entry2 debe estar en ERROR
    const checked1 = await getEntryById(db, verifiedUserId, entry1.id);
    expect(checked1?.sync_status).toBe("SYNCED");

    const checked2 = await getEntryById(db, verifiedUserId, entry2.id);
    expect(checked2?.sync_status).toBe("ERROR");

    // 4. En el siguiente ciclo de sincronización, entry2 se reintenta automáticamente
    const retryPending = await getPendingLocalChanges(db, verifiedUserId);
    expect(retryPending.some((c) => c.entity_id === entry2.id)).toBe(true);

    // Servidor ahora recuperado responde APPLIED para entry2
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
                has_more: false,
              }),
          });
        }
        return Promise.reject(new Error("Route not found"));
      });

    const sync2 = await performSync(db, {
      apiBaseUrl,
      token: verifiedToken,
      userId: verifiedUserId,
      fetchFn: recoveredFetch,
    });

    expect(sync2.success).toBe(true);
    expect(sync2.pushed_applied).toBe(1);

    // Ahora ambas entradas están SYNCED y no hay duplicados
    const finalized2 = await getEntryById(db, verifiedUserId, entry2.id);
    expect(finalized2?.sync_status).toBe("SYNCED");

    const allEntries = await listLocalEntries(db, verifiedUserId);
    expect(allEntries.length).toBe(2);
  });

  // =========================================================================
  // EDGE CASE 4: Resolución de conflictos Last-Write-Wins (LWW) y versionado
  // =========================================================================
  it("Edge Case 4: Server conflict records conflict row and updates local state without crash", async () => {
    const cat = await createLocalCategory(db, verifiedUserId, {
      name: "Categoría Conflicto",
      kind: "STANDARD",
      voice_command: "conflicto",
    });

    const entry = await createLocalEntry(db, verifiedUserId, {
      category_id: cat.id,
      title: "Edición Local",
      content: "Cambio local que entrará en conflicto con otro dispositivo",
    });

    // Servidor detecta conflicto de versión
    const conflictFetch = jest
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes("/api/v1/sync/push")) {
          const body = JSON.parse(init?.body as string);
          const results = body.client_changes.map((ch: any) => {
            if (ch.entity_id === entry.id) {
              return {
                change_id: ch.change_id,
                entity_type: ch.entity_type,
                entity_id: ch.entity_id,
                status: "CONFLICT",
                server_entity: {
                  id: entry.id,
                  category_id: cat.id,
                  title: "Edición Remota Ganadora",
                  content: "Contenido remoto más reciente",
                  version: 5,
                },
                error_message: "Version mismatch: remote is v5, local sent v1",
              };
            }
            return {
              change_id: ch.change_id,
              entity_type: ch.entity_type,
              entity_id: ch.entity_id,
              status: "APPLIED",
              applied_version: 1,
            };
          });

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
                has_more: false,
              }),
          });
        }
        return Promise.reject(new Error("Route not found"));
      });

    const syncResult = await performSync(db, {
      apiBaseUrl,
      token: verifiedToken,
      userId: verifiedUserId,
      fetchFn: conflictFetch,
    });

    expect(syncResult.success).toBe(true);
    expect(syncResult.pushed_conflicts).toBe(1);

    // Entrada local pasa a estado CONFLICT
    const conflictedEntry = await getEntryById(db, verifiedUserId, entry.id);
    expect(conflictedEntry?.sync_status).toBe("CONFLICT");

    // Se registró en sync_conflicts
    const conflictsInDb = await db.getAllAsync<{
      entity_id: string;
      error_message: string;
    }>(
      `SELECT entity_id, error_message FROM sync_conflicts WHERE user_id = ?;`,
      [verifiedUserId],
    );
    expect(conflictsInDb.some((c) => c.entity_id === entry.id)).toBe(true);
    expect(conflictsInDb[0].error_message).toContain("Version mismatch");
  });

  // =========================================================================
  // EDGE CASE 5: Soporte completo de UTF-8, emojis complejos y comillas SQL
  // =========================================================================
  it("Edge Case 5: Preserves complex UTF-8 emojis, multiline strings, SQL quotes and special characters perfectly", async () => {
    const complexCategoryName = "💼 Proyectos & Ideas / 'Especiales' \"2026\"";
    const complexCat = await createLocalCategory(db, verifiedUserId, {
      name: complexCategoryName,
      kind: "TASK",
      voice_command: "especiales",
      color: "#F59E0B",
    });

    const complexContent = `🎙️ Grabación de reunión:
- Punto 1: Revisión de 'persistencia' & "coordinación" offline.
- Punto 2: Caracteres especiales: \`SELECT * FROM users WHERE 1=1;\` \\ / % _ ; --
- Emojis combinados: 👨‍👩‍👧‍👦 🚀 💡 ✅ 📅 ⚠️
- Texto extenso con saltos de línea y tabuladores:
\tLínea tabulada con acentos: ÁÉÍÓÚ ñ Ñ ç Ç ¿ ? ¡ !
Fin de la nota.`;

    const complexEntry = await createLocalEntry(db, verifiedUserId, {
      category_id: complexCat.id,
      title: "Nota con 'Comillas', \"Dobles\", Emojis 🚀 y Símbolos % _",
      content: complexContent,
      task_status: "PENDING",
      task_recurrence: "ONCE",
      task_priority: "HIGH",
    });

    // 1. Verificar persistencia local exacta
    const storedEntry = await getEntryById(db, verifiedUserId, complexEntry.id);
    expect(storedEntry).not.toBeNull();
    expect(storedEntry?.title).toBe(
      "Nota con 'Comillas', \"Dobles\", Emojis 🚀 y Símbolos % _",
    );
    expect(storedEntry?.content).toBe(complexContent);
    expect(storedEntry?.content).toContain("👨‍👩‍👧‍👦");
    expect(storedEntry?.content).toContain("`SELECT * FROM users WHERE 1=1;`");

    // 2. Verificar que al generar el payload de sync, el JSON no corrompe los caracteres
    const pending = await getPendingLocalChanges(db, verifiedUserId);
    const entryChange = pending.find((c) => c.entity_id === complexEntry.id);
    expect(entryChange).toBeDefined();

    const serializedPayload = JSON.stringify(entryChange);
    const parsedBack = JSON.parse(serializedPayload);
    expect(parsedBack.payload.content).toBe(complexContent);
    expect(parsedBack.payload.title).toBe(storedEntry?.title);

    // 3. Simular Push y Pull completo con preservación de UTF-8
    const echoFetch = jest
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
                has_more: false,
              }),
          });
        }
        return Promise.reject(new Error("Route not found"));
      });

    const syncResult = await performSync(db, {
      apiBaseUrl,
      token: verifiedToken,
      userId: verifiedUserId,
      fetchFn: echoFetch,
    });

    expect(syncResult.success).toBe(true);

    const syncedEntry = await getEntryById(db, verifiedUserId, complexEntry.id);
    expect(syncedEntry?.sync_status).toBe("SYNCED");
    expect(syncedEntry?.content).toBe(complexContent);
  });

  // =========================================================================
  // EDGE CASE 6: Gran volumen de datos acumulados en offline (Batch Stress Test)
  // =========================================================================
  it("Edge Case 6: Handles large offline batches (50+ entries created offline) cleanly in a single sync without memory/SQL failure", async () => {
    const cat = await createLocalCategory(db, verifiedUserId, {
      name: "Categoría Masiva",
      kind: "TASK",
      voice_command: "masiva",
      color: "#3B82F6",
    });

    const TOTAL_ENTRIES = 50;
    const createdIds: string[] = [];

    // Crear 50 entradas offline
    for (let i = 1; i <= TOTAL_ENTRIES; i++) {
      const e = await createLocalEntry(db, verifiedUserId, {
        category_id: cat.id,
        title: `Tarea Masiva #${i}`,
        content: `Descripción de prueba para el elemento número ${i} acumulado en modo sin conexión.`,
        task_status: i % 2 === 0 ? "DONE" : "PENDING",
        task_recurrence: "ONCE",
        task_priority: i % 3 === 0 ? "HIGH" : "MEDIUM",
        occurred_at: new Date(2026, 9, (i % 28) + 1).toISOString(),
      });
      createdIds.push(e.id);
    }

    // Verificar que todas están en local y en PENDING_PUSH
    const localEntries = await listLocalEntries(db, verifiedUserId);
    expect(localEntries.length).toBe(TOTAL_ENTRIES);

    const pending = await getPendingLocalChanges(db, verifiedUserId);
    // 50 entradas + 1 categoría = 51 cambios
    expect(pending.length).toBe(TOTAL_ENTRIES + 1);

    // Servidor procesa el batch completo de 51 elementos
    const batchFetch = jest
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes("/api/v1/sync/push")) {
          const body = JSON.parse(init?.body as string);
          expect(body.client_changes.length).toBe(TOTAL_ENTRIES + 1);

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
                has_more: false,
              }),
          });
        }
        return Promise.reject(new Error("Route not found"));
      });

    const syncResult = await performSync(db, {
      apiBaseUrl,
      token: verifiedToken,
      userId: verifiedUserId,
      fetchFn: batchFetch,
    });

    expect(syncResult.success).toBe(true);
    expect(syncResult.pushed_applied).toBe(TOTAL_ENTRIES + 1);

    // Verificar que todas las 50 entradas han pasado a SYNCED
    const finalEntries = await listLocalEntries(db, verifiedUserId);
    expect(finalEntries.length).toBe(TOTAL_ENTRIES);
    expect(finalEntries.every((e) => e.sync_status === "SYNCED")).toBe(true);

    const pendingAfter = await getPendingLocalChanges(db, verifiedUserId);
    expect(pendingAfter.length).toBe(0);
  });

  // =========================================================================
  // EDGE CASE 7: Prevención de Resurrección Zombie de categorías y tags (#124)
  // =========================================================================
  it("Edge Case 7: Deleted categories and tags do not resurrect when remote pull sends them back (#124)", async () => {
    // 1. Crear categoría y etiqueta
    const gymCategory = await createLocalCategory(db, verifiedUserId, {
      name: "Gimnasio",
      kind: "STANDARD",
      voice_command: "gimnasio",
      color: "#EF4444",
    });

    const testTag = await createLocalTag(db, verifiedUserId, {
      name: "Probando",
      color: "#3B82F6",
    });

    // 2. El usuario las elimina localmente
    await deleteLocalCategory(db, verifiedUserId, gymCategory.id);
    await deleteLocalTag(db, verifiedUserId, testTag.id);

    // Verificar que localmente ya no están
    const currentCats = await listCategories(db, verifiedUserId);
    expect(currentCats.some((c) => c.id === gymCategory.id)).toBe(false);

    const currentTags = await listTags(db, verifiedUserId);
    expect(currentTags.some((t) => t.id === testTag.id)).toBe(false);

    // 3. Simular que el servidor (por desfase de cursor o concurrencia) devuelve ambas entidades en el Pull
    const zombieMockFetch = jest
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes("/api/v1/sync/push")) {
          const body = JSON.parse(init?.body as string);
          // Confirmar que el push envía la acción DELETE para los tombstones
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
                  applied_version: 2,
                })),
              }),
          });
        }
        if (url.includes("/api/v1/sync/pull")) {
          // Servidor envía 'Gimnasio' y 'Probando' en changes
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                changes: [
                  {
                    entity_type: "CATEGORY",
                    entity_id: gymCategory.id,
                    action: "CREATE",
                    payload: {
                      id: gymCategory.id,
                      name: "Gimnasio",
                      name_normalized: "gimnasio",
                      kind: "STANDARD",
                      voice_command: "gimnasio",
                      version: 1,
                    },
                  },
                  {
                    entity_type: "TAG",
                    entity_id: testTag.id,
                    action: "CREATE",
                    payload: {
                      id: testTag.id,
                      name: "Probando",
                      name_normalized: "probando",
                      color: "#3B82F6",
                      version: 1,
                    },
                  },
                ],
                tombstones: [],
                has_more: false,
              }),
          });
        }
        return Promise.reject(new Error("Route not found"));
      });

    // 4. Ejecutar sincronización
    const syncRes = await performSync(db, {
      apiBaseUrl,
      token: verifiedToken,
      userId: verifiedUserId,
      fetchFn: zombieMockFetch,
    });

    expect(syncRes.success).toBe(true);

    // 5. ¡Verificar que NO han resucitado!
    const catsAfterSync = await listCategories(db, verifiedUserId);
    expect(catsAfterSync.some((c) => c.id === gymCategory.id)).toBe(false);
    expect(catsAfterSync.some((c) => c.name.toLowerCase() === "gimnasio")).toBe(
      false,
    );

    const tagsAfterSync = await listTags(db, verifiedUserId);
    expect(tagsAfterSync.some((t) => t.id === testTag.id)).toBe(false);
    expect(tagsAfterSync.some((t) => t.name.toLowerCase() === "probando")).toBe(
      false,
    );
  });
});
