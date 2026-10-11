import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CalendarCategoryFilter } from "./components/CalendarCategoryFilter";
import { CalendarMonthView } from "./components/CalendarMonthView";
import { ClassificationExplorer } from "./components/ClassificationExplorer";
import { ConflictResolver } from "./components/ConflictResolver";
import { EntryDetailView } from "./components/EntryDetailView";
import { EntryForm } from "./components/EntryForm";
import { LlmBatchProcessor } from "./components/LlmBatchProcessor";
import { MobileHomeVoiceView } from "./components/MobileHomeVoiceView";
import { MobileMainLayout, MobileTab } from "./components/MobileMainLayout";
import { PendingTasksView } from "./components/PendingTasksView";
import { VoiceCaptureFlow } from "./components/VoiceCaptureFlow";
import { WebMainLayout } from "./components/WebMainLayout";
import {
  CANONICAL_CATEGORIES,
  ensureCanonicalCategories,
  listCategories,
} from "./db/categories";
import {
  DatabaseAdapter,
  MemoryDatabaseAdapter,
  runMigrations,
} from "./db/database";
import {
  createLocalEntry,
  listLocalEntries,
  listPendingDatelessTasks,
} from "./db/entries";
import { createLocalTag, listTags } from "./db/tags";
import { theme } from "./styles/theme";
import { Category, Entry, Tag } from "./types/domain";

import { performSync } from "./services/syncEngine";
import { notificationService } from "./services/notificationService";
import appConfig from "./app.json";

// Lee la URL del backend en tiempo de ejecución
const getBackendUrl = (): string => {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.location?.hostname) {
      return `http://${window.location.hostname}:8000`;
    }
  }
  // 1. Variable de entorno inyectada vía .env.local
  const fromEnv = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();

  // 2. Extra configurado en app.json (actualizado automáticamente por start.ps1)
  const fromAppJson = (appConfig as any)?.expo?.extra?.backendUrl;
  if (fromAppJson && fromAppJson.trim()) return fromAppJson.trim();

  // 3. Fallback al túnel Cloudflare activo
  return "https://vector-middle-entity-television.trycloudflare.com";
};

const defaultApiConfig = {
  baseUrl: getBackendUrl(),
  fetchFn: globalThis.fetch ? globalThis.fetch.bind(globalThis) : undefined,
};

export default function App() {
  const [db] = useState(() => new MemoryDatabaseAdapter("proyecto_ai_local_db"));
  const [userId] = useState("user-demo-123");
  const [isInitialized, setIsInitialized] = useState(false);

  const [activeTab, setActiveTab] = useState<
    "VOICE_CAPTURE" | "CALENDAR" | "PENDING_TASKS" | "EXPLORER" | "CONFLICTS" | "LLM_IMPORT"
  >(Platform.OS === "web" ? "CALENDAR" : "VOICE_CAPTURE");

  const [categories, setCategories] = useState<Category[]>([]);
  const [, setTags] = useState<Tag[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [pendingTasksCount, setPendingTasksCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(Date.now());
  const [isSyncing, setIsSyncing] = useState(false);

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showVoiceCaptureModal, setShowVoiceCaptureModal] = useState(false);
  const [showEntryFormModal, setShowEntryFormModal] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const mainScrollViewRef = React.useRef<ScrollView>(null);

  useEffect(() => {
    if (selectedEntryId || showVoiceCaptureModal || showEntryFormModal) {
      mainScrollViewRef.current?.scrollTo({ y: 0, animated: true });
      if (
        typeof window !== "undefined" &&
        typeof window.scrollTo === "function"
      ) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  }, [selectedEntryId, showVoiceCaptureModal, showEntryFormModal]);

  // Ref que indica si hay formulario/modal abierto.
  // Debe declararse ANTES de loadDatabaseState para que la función pueda leerlo.
  const isFormOpenRef = useRef(false);

  const CANONICAL_NOTAS_ID = CANONICAL_CATEGORIES.NOTAS.id;
  const CANONICAL_TAREAS_ID = CANONICAL_CATEGORIES.TAREAS.id;
  const CANONICAL_EVENTOS_ID = CANONICAL_CATEGORIES.EVENTOS.id;
  const CANONICAL_PROYECTOS_ID = CANONICAL_CATEGORIES.PROYECTOS.id;

  // Deduplicar entradas repetidas y restaurar la categoría adecuada a cada una
  const deduplicateAndHealEntries = async (database: DatabaseAdapter, uId: string) => {
    const all = await listLocalEntries(database, uId);
    const seenContent = new Map<string, string>();
    const toDeleteIds: string[] = [];

    for (const entry of all) {
      const trimmed = (entry.content || "").trim();
      if (!trimmed) continue;

      // 1. Restaurar la categoría correcta según semántica de contenido
      let properCatId = entry.category_id;
      let properTaskStatus = entry.task_status;

      if (
        trimmed.toLowerCase().includes("rediseño con tema glassmorphism") ||
        trimmed.toLowerCase().includes("rediseno con tema glassmorphism") ||
        trimmed.toLowerCase().includes("completado el rediseño")
      ) {
        properCatId = CANONICAL_NOTAS_ID;
        properTaskStatus = null;
      } else if (
        trimmed.toLowerCase().includes("reunión de revisión") ||
        trimmed.toLowerCase().includes("reunion de revision")
      ) {
        properCatId = CANONICAL_EVENTOS_ID;
        properTaskStatus = null;
      } else if (
        trimmed.toLowerCase().includes("revisar la configuración") ||
        trimmed.toLowerCase().includes("revisar la configuracion") ||
        trimmed.toLowerCase().includes("servidor backend y fastapi")
      ) {
        properCatId = CANONICAL_TAREAS_ID;
        properTaskStatus = properTaskStatus || "PENDING";
      }

      if (properCatId !== entry.category_id || properTaskStatus !== entry.task_status) {
        await database.runAsync(
          `UPDATE entries SET category_id = ?, task_status = ?, sync_status = 'PENDING_PUSH' WHERE id = ?;`,
          [properCatId, properTaskStatus, entry.id],
        );
      }

      // 2. Deduplicar por contenido exacto
      if (seenContent.has(trimmed)) {
        toDeleteIds.push(entry.id);
      } else {
        seenContent.set(trimmed, entry.id);
      }
    }

    for (const delId of toDeleteIds) {
      await database.runAsync(`DELETE FROM entries WHERE id = ? AND user_id = ?;`, [delId, uId]);
      await database.runAsync(`DELETE FROM entry_tags WHERE entry_id = ? AND user_id = ?;`, [delId, uId]);
    }
  };

  const loadDatabaseState = useCallback(async (forceReload: boolean = false) => {
    // Si hay un formulario abierto y no se fuerza recarga, solo sincronizar en background sin tocar el estado de React.
    if (isFormOpenRef.current && !forceReload) {
      try {
        await performSync(db, {
          apiBaseUrl: getBackendUrl(),
          token: "demo-token",
          userId,
        });
      } catch (_) {
        // silencioso
      }
      return;
    }

    setIsSyncing(true);
    try {
      // 1. Deduplicar en local antes del sync
      await deduplicateAndHealEntries(db, userId);

      // 2. Sincronizar con el backend
      try {
        const syncRes = await performSync(db, {
          apiBaseUrl: getBackendUrl(),
          token: "demo-token",
          userId,
        });
        if (!syncRes.success && syncRes.error) {
          console.warn("[Sync] Engine returned warning:", syncRes.error);
        }
      } catch (syncErr) {
        console.warn("[Sync] Perform sync error:", syncErr);
      }

      // 3. Post-sync: deduplicar entradas recibidas
      await deduplicateAndHealEntries(db, userId);

      const cats = await listCategories(db, userId);
      const tgs = await listTags(db, userId);
      const allEntries = await listLocalEntries(db, userId);
      const datelessPending = await listPendingDatelessTasks(db, userId);

      // Doble check: puede que el usuario abriera el formulario MIENTRAS el sync corría
      if (isFormOpenRef.current && !forceReload) return;

      // Solo actualizar el estado si los datos realmente cambiaron
      setCategories((prev) => {
        const next = JSON.stringify(cats);
        return JSON.stringify(prev) === next ? prev : cats;
      });
      setTags((prev) => {
        const next = JSON.stringify(tgs);
        return JSON.stringify(prev) === next ? prev : tgs;
      });
      setEntries((prev) => {
        const next = JSON.stringify(allEntries);
        return JSON.stringify(prev) === next ? prev : allEntries;
      });
      setPendingTasksCount((prev) =>
        prev === datelessPending.length ? prev : datelessPending.length,
      );
      setLastSyncTime(Date.now());

      // Sincronizar todos los recordatorios activos en el servicio de notificaciones
      notificationService.syncAllReminders(db, userId);
    } catch (err) {
      console.error("Error al cargar la base de datos:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [db, userId]);

  useEffect(() => {
    let isMounted = true;

    async function initApp() {
      await runMigrations(db);
      try {
        await db.execAsync("ALTER TABLE entries ADD COLUMN title TEXT;");
      } catch {
        // Column may already exist
      }
      try {
        await db.execAsync("ALTER TABLE entries ADD COLUMN task_priority TEXT;");
      } catch {
        // Column may already exist
      }
      try {
        await db.execAsync("ALTER TABLE entries ADD COLUMN reminder_enabled INTEGER DEFAULT 0;");
      } catch {
        // Column may already exist
      }
      try {
        await db.execAsync("ALTER TABLE entries ADD COLUMN reminder_time TEXT;");
      } catch {
        // Column may already exist
      }
      try {
        await db.execAsync("ALTER TABLE entries ADD COLUMN reminder_recurrence TEXT;");
      } catch {
        // Column may already exist
      }
      try {
        await db.execAsync("ALTER TABLE entries ADD COLUMN reminder_offset_minutes INTEGER DEFAULT 0;");
      } catch {
        // Column may already exist
      }
      await ensureCanonicalCategories(db, userId);
      await deduplicateAndHealEntries(db, userId);

      const existingEntries = await listLocalEntries(db, userId);
      if (existingEntries.length === 0) {
        const nowIso = new Date().toISOString();
        const SEED_TASK_ID = "00000000-0000-0000-0000-000000000011";
        const SEED_NOTE_ID = "00000000-0000-0000-0000-000000000012";
        const SEED_EVENT_ID = "00000000-0000-0000-0000-000000000013";

        await createLocalEntry(db, userId, {
          id: SEED_TASK_ID,
          category_id: CANONICAL_TAREAS_ID,
          content: "Revisar la configuración del servidor backend y FastAPI",
          occurred_at: null,
          task_status: "PENDING",
          task_recurrence: "ONCE",
        });

        await createLocalEntry(db, userId, {
          id: SEED_NOTE_ID,
          category_id: CANONICAL_NOTAS_ID,
          content: "Completado el rediseño con tema Glassmorphism y panel Web",
          occurred_at: nowIso,
        });

        await createLocalEntry(db, userId, {
          id: SEED_EVENT_ID,
          category_id: CANONICAL_EVENTOS_ID,
          content: "Reunión de revisión de arquitectura del Proyecto AI",
          occurred_at: nowIso,
        });
      }

      if (isMounted) {
        await loadDatabaseState(true);
        setIsInitialized(true);
      }
    }

    initApp();

    return () => {
      isMounted = false;
    };
  }, [db, userId, loadDatabaseState]);

  // Mantener el ref sincronizado con el estado de modales
  useEffect(() => {
    isFormOpenRef.current = showVoiceCaptureModal || showEntryFormModal || !!selectedEntryId;
  }, [showVoiceCaptureModal, showEntryFormModal, selectedEntryId]);

  useEffect(() => {
    if (!isInitialized) return;

    // En web: no hacemos auto-refresh por temporizador
    if (Platform.OS === "web") {
      return () => {};
    }

    // En móvil: AppState para detectar cuando vuelve al primer plano (sin polling repetitivo)
    const { AppState } = require("react-native");
    const subscription = AppState.addEventListener("change", (state: string) => {
      if (state === "active") {
        loadDatabaseState();
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [isInitialized, loadDatabaseState]);

  const handleTabChange = (
    tab: "CALENDAR" | "PENDING_TASKS" | "EXPLORER" | "CONFLICTS" | "LLM_IMPORT",
  ) => {
    setActiveTab(tab);
    // Auto-close any open modal when user switches navigation tabs
    setShowVoiceCaptureModal(false);
    setShowEntryFormModal(false);
    setSelectedEntryId(null);
    loadDatabaseState();
  };

  if (!isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Iniciando Proyecto AI Hub...</Text>
      </View>
    );
  }

  const renderMainTabContent = () => {
    if (selectedEntryId || showVoiceCaptureModal || showEntryFormModal) {
      return (
        <View>
          <View style={styles.overlayNavHeader}>
            <Pressable
              style={styles.backToViewButton}
              onPress={() => {
                setSelectedEntryId(null);
                setShowVoiceCaptureModal(false);
                setShowEntryFormModal(false);
              }}
              testID="btn-back-to-previous-view"
            >
              <Text style={styles.backToViewButtonText}>
                {`⬅️ Volver a ${
                  activeTab === "VOICE_CAPTURE"
                    ? "Captura"
                    : activeTab === "CALENDAR"
                      ? "Calendario"
                      : activeTab === "PENDING_TASKS"
                        ? "Tareas Pendientes"
                        : activeTab === "EXPLORER"
                          ? "Categorías"
                          : activeTab === "LLM_IMPORT"
                            ? "Estructurar con IA"
                            : "Conflictos Sync"
                }`}
              </Text>
            </Pressable>
          </View>

          {/* Voice Capture Modal Banner */}
          {showVoiceCaptureModal && (
            <View style={styles.modalBanner}>
              <VoiceCaptureFlow
                db={db}
                userId={userId}
                saveMode="PREVIEW_BEFORE_SAVE"
                onEntryCreated={() => {
                  setShowVoiceCaptureModal(false);
                  isFormOpenRef.current = false;
                  loadDatabaseState(true);
                }}
                onClose={() => setShowVoiceCaptureModal(false)}
              />
            </View>
          )}

          {/* Entry Form Modal Banner */}
          {showEntryFormModal && (
            <View style={styles.modalBanner}>
              <View style={styles.modalBannerHeader}>
                <Text style={styles.modalBannerTitle}>
                  ➕ Crear Entrada Manual
                </Text>
                <Pressable
                  style={styles.closeModalButton}
                  onPress={() => setShowEntryFormModal(false)}
                >
                  <Text style={styles.closeModalText}>✕ Cerrar</Text>
                </Pressable>
              </View>
              <EntryForm
                db={db}
                userId={userId}
                onSuccess={() => {
                  setShowEntryFormModal(false);
                  isFormOpenRef.current = false;
                  loadDatabaseState(true);
                }}
              />
            </View>
          )}

          {/* Entry Extended Detail & Edit Modal Banner */}
          {selectedEntryId && (
            <View style={styles.modalBanner}>
              <EntryDetailView
                db={db}
                userId={userId}
                entryId={selectedEntryId}
                onClose={() => setSelectedEntryId(null)}
                onUpdated={() => {
                  setSelectedEntryId(null);
                  isFormOpenRef.current = false;
                  loadDatabaseState(true);
                }}
                onDeleted={() => {
                  setSelectedEntryId(null);
                  isFormOpenRef.current = false;
                  loadDatabaseState(true);
                }}
              />
            </View>
          )}
        </View>
      );
    }

    return (
      <View>
        {/* Floating Action Bar (Web view) */}
        {Platform.OS === "web" && (
          <View style={styles.topActionsBar}>
            <Pressable
              style={styles.voiceCaptureButton}
              onPress={() => {
                setShowVoiceCaptureModal(true);
                setShowEntryFormModal(false);
                setSelectedEntryId(null);
              }}
              testID="btn-open-voice-modal"
            >
              <Text style={styles.voiceCaptureButtonText}>
                🎙️ Captura por Voz
              </Text>
            </Pressable>

            <Pressable
              style={styles.addEntryButton}
              onPress={() => {
                setShowEntryFormModal(true);
                setShowVoiceCaptureModal(false);
                setSelectedEntryId(null);
              }}
              testID="btn-open-entry-form"
            >
              <Text style={styles.addEntryButtonText}>
                ✍️ Escritura Libre / Manual
              </Text>
            </Pressable>
          </View>
        )}

        {/* Tab 0: VOICE CAPTURE HERO VIEW (Mobile Home) */}
        {activeTab === "VOICE_CAPTURE" && (
          <MobileHomeVoiceView
            key={`voice-${lastSyncTime}`}
            db={db}
            userId={userId}
            onOpenManualForm={() => setShowEntryFormModal(true)}
            onOpenLlmImport={() => setActiveTab("LLM_IMPORT")}
            onEntryCreated={() => loadDatabaseState(true)}
          />
        )}

        {/* Tab 1: CALENDAR */}
        {activeTab === "CALENDAR" && (
          <View style={styles.tabContainer} key={`cal-container-${lastSyncTime}`}>
            <CalendarCategoryFilter
              key={`filter-${lastSyncTime}`}
              db={db}
              userId={userId}
              onFilterChange={setSelectedCategoryIds}
              onTagFilterChange={setSelectedTagIds}
            />
            <CalendarMonthView
              key="calendar-view"
              db={db}
              userId={userId}
              selectedCategoryIds={
                selectedCategoryIds.length > 0
                  ? selectedCategoryIds
                  : undefined
              }
              selectedTagIds={
                selectedTagIds.length > 0
                  ? selectedTagIds
                  : undefined
              }
              refreshSignal={lastSyncTime}
              onSelectEntry={(entryId) => setSelectedEntryId(entryId)}
              onEntryUpdated={() => loadDatabaseState(true)}
            />
          </View>
        )}

        {/* Tab 2: PENDING TASKS */}
        {activeTab === "PENDING_TASKS" && (
          <View style={styles.tabContainer}>
            <PendingTasksView
              key="tasks-view"
              db={db}
              userId={userId}
              refreshSignal={lastSyncTime}
              onSelectEntry={(entry) => setSelectedEntryId(entry.id)}
              onTaskUpdated={() => loadDatabaseState(true)}
            />
          </View>
        )}

        {/* Tab 3: EXPLORER (Categories & Tags) */}
        {activeTab === "EXPLORER" && (
          <View style={styles.tabContainer}>
            <ClassificationExplorer
              key="explorer-view"
              db={db}
              userId={userId}
              onSelectEntry={(entryId) => setSelectedEntryId(entryId)}
              onCatalogUpdated={() => loadDatabaseState(true)}
              refreshTrigger={lastSyncTime}
            />
          </View>
        )}

        {/* Tab 4: CONFLICTS */}
        {activeTab === "CONFLICTS" && (
          <View style={styles.tabContainer}>
            <ConflictResolver
              db={db}
              userId={userId}
              onResolved={() => loadDatabaseState(true)}
            />
          </View>
        )}

        {/* Tab 5: LLM_IMPORT */}
        {activeTab === "LLM_IMPORT" && (
          <View style={styles.tabContainer}>
            <LlmBatchProcessor
              db={db}
              userId={userId}
              onImportCompleted={() => loadDatabaseState(true)}
            />
          </View>
        )}
      </View>
    );
  };

  if (Platform.OS !== "web") {
    return (
      <MobileMainLayout
        apiConfig={defaultApiConfig}
        activeTab={(activeTab === "CONFLICTS" ? "EXPLORER" : activeTab) as MobileTab}
        onTabChange={(t) => handleTabChange(t as any)}
        stats={{
          totalEntries: entries.length,
          pendingTasks: pendingTasksCount,
          totalCategories: categories.length,
        }}
        onSync={loadDatabaseState}
        isSyncing={isSyncing}
      >
        <ScrollView
          ref={mainScrollViewRef}
          style={styles.mainScrollView}
          contentContainerStyle={styles.mainScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {renderMainTabContent()}
        </ScrollView>
      </MobileMainLayout>
    );
  }

  return (
    <WebMainLayout
      apiConfig={defaultApiConfig}
      onTabChange={handleTabChange}
      stats={{
        totalEntries: entries.length,
        pendingTasks: pendingTasksCount,
        totalCategories: categories.length,
      }}
      onSync={loadDatabaseState}
      isSyncing={isSyncing}
    >
      <StatusBar style="light" />

      <ScrollView
        ref={mainScrollViewRef}
        style={styles.mainScrollView}
        contentContainerStyle={styles.mainScrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {renderMainTabContent()}
      </ScrollView>
    </WebMainLayout>
  );
}

const styles = StyleSheet.create({
  mainScrollView: {
    flex: 1,
    width: "100%",
  },
  mainScrollContent: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.bgApp,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    fontWeight: "500",
  },
  topActionsBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
    justifyContent: "flex-start",
    alignItems: "center",
    width: "100%",
  },
  overlayNavHeader: {
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  backToViewButton: {
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  backToViewButtonText: {
    color: "#38bdf8",
    fontWeight: "700",
    fontSize: 13,
  },
  voiceCaptureButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    ...theme.shadows.card,
  },
  voiceCaptureButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
  },
  addEntryButton: {
    backgroundColor: "rgba(59, 130, 246, 0.2)",
    borderWidth: 1.5,
    borderColor: "#3b82f6",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addEntryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
  },
  modalBanner: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    ...theme.shadows.glow,
  },
  modalBannerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  modalBannerTitle: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  closeModalButton: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  closeModalText: {
    color: "#f87171",
    fontWeight: "700",
    fontSize: 13,
  },
  tabContainer: {
    flex: 1,
  },
});
