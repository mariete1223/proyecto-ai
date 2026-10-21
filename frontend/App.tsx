import { StatusBar } from "expo-status-bar";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
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
import { StartupPermissionsPrompt } from "./components/StartupPermissionsPrompt";
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
  getEntryById,
  listLocalEntries,
  listPendingDatelessTasks,
} from "./db/entries";
import { createLocalTag, listTags } from "./db/tags";
import { theme } from "./styles/theme";
import {
  Category,
  Entry,
  Tag,
  normalizeUtcIso,
  toLocalDateString,
} from "./types/domain";

import { performSync } from "./services/syncEngine";
import { notificationService } from "./services/notificationService";
import { checkBackendHealth } from "./services/webApi";
import { AuthModal } from "./components/AuthModal";
import { AuthScreen } from "./components/AuthScreen";
import {
  OnboardingModal,
  isOnboardingCompleted,
} from "./components/OnboardingModal";
import { AuthSession, authStorage } from "./services/authService";
import appConfig from "./app.json";

const ACTIVE_BACKEND_TUNNEL = "https://raging-degraded-reptile.ngrok-free.dev";

const getBackendUrl = (): string => {
  // 1. En navegador web:
  if (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.location?.hostname
  ) {
    // A. Query param (?backend=https://...) o localStorage override
    try {
      if (typeof window.location.search === "string") {
        const urlParams = new URLSearchParams(window.location.search);
        const queryBackend = urlParams.get("backend");
        if (queryBackend && queryBackend.trim()) {
          const clean = queryBackend.trim().replace(/\/+$/, "");
          window.localStorage?.setItem("custom_backend_url", clean);
          return clean;
        }
      }
      const savedBackend = window.localStorage?.getItem("custom_backend_url");
      if (savedBackend && savedBackend.trim()) {
        const clean = savedBackend.trim().replace(/\/+$/, "");
        if (clean.includes("trycloudflare.com")) {
          window.localStorage?.removeItem("custom_backend_url");
        } else {
          return clean;
        }
      }
    } catch {
      // ignore
    }

    const host = window.location.hostname;
    // Si estamos en localhost o 127.0.0.1
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return `http://${host}:8000`;
    }
    // Si estamos en la red local Wi-Fi de casa (192.168.x.x o 10.x.x.x)
    if (
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
    ) {
      return `http://${host}:8000`;
    }
    // Si estamos en el túnel Cloudflare Web o en Vercel (acceso remoto/móvil por internet):
    if (host.includes("trycloudflare.com") || host.includes("vercel.app")) {
      const fromEnv = process.env.EXPO_PUBLIC_BACKEND_URL;
      if (
        fromEnv &&
        fromEnv.trim() &&
        !fromEnv.includes("trycloudflare.com") &&
        !fromEnv.includes("explorer-server-forgot-engineering")
      ) {
        return fromEnv.trim();
      }
      return ACTIVE_BACKEND_TUNNEL;
    }
  }

  const fromEnv = process.env.EXPO_PUBLIC_BACKEND_URL;

  if (
    fromEnv &&
    fromEnv.trim() &&
    !fromEnv.includes("trycloudflare.com") &&
    !fromEnv.includes("explorer-server-forgot-engineering")
  ) {
    return fromEnv.trim();
  }

  const fromAppJson = (appConfig as any)?.expo?.extra?.backendUrl;
  if (
    fromAppJson &&
    fromAppJson.trim() &&
    !fromAppJson.includes("trycloudflare.com") &&
    !fromAppJson.includes("explorer-server-forgot-engineering")
  ) {
    return fromAppJson.trim();
  }

  // 3. Fallback a la URL estática permanente para backend
  return ACTIVE_BACKEND_TUNNEL;
};

const defaultApiConfig = {
  get baseUrl() {
    return getBackendUrl();
  },
  fetchFn: globalThis.fetch ? globalThis.fetch.bind(globalThis) : undefined,
};

export default function App() {
  const [db] = useState(
    () => new MemoryDatabaseAdapter("proyecto_ai_local_db"),
  );
  const [authSession, setAuthSession] = useState<AuthSession | null>(() =>
    authStorage.loadSession(),
  );
  const [bypassAuth, setBypassAuth] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const userId = authSession ? authSession.userId : "user-demo-123";
  const userToken = authSession ? authSession.token : "demo-token";
  const [isInitialized, setIsInitialized] = useState(false);
  const { width } = useWindowDimensions();
  const isMobileScreen =
    Platform.OS !== "web" ||
    width < 768 ||
    (typeof navigator !== "undefined" &&
      /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

  const [activeTab, setActiveTab] = useState<
    | "VOICE_CAPTURE"
    | "CALENDAR"
    | "PENDING_TASKS"
    | "EXPLORER"
    | "CONFLICTS"
    | "LLM_IMPORT"
  >(() => {
    if (Platform.OS !== "web") return "VOICE_CAPTURE";
    if (typeof window !== "undefined") {
      if (
        window.innerWidth < 768 ||
        /Mobi|Android|iPhone|iPad|iPod/i.test(navigator?.userAgent || "")
      ) {
        return "VOICE_CAPTURE";
      }
    }
    return "CALENDAR";
  });

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
  const [calendarFocusDateStr, setCalendarFocusDateStr] = useState<
    string | null
  >(null);

  const handleEntryCreatedNavigate = async (createdEntryId?: string) => {
    if (createdEntryId) {
      try {
        const ent = await getEntryById(db, userId, createdEntryId);
        if (ent && ent.occurred_at) {
          const norm = normalizeUtcIso(ent.occurred_at) || ent.occurred_at;
          const d = new Date(norm);
          if (!isNaN(d.getTime())) {
            setCalendarFocusDateStr(toLocalDateString(d));
          }
        }
      } catch (err) {
        console.warn(
          "Error al obtener fecha de entrada creada para calendario:",
          err,
        );
      }
    }
    await loadDatabaseState(true);
    setActiveTab("CALENDAR");
  };

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

  useEffect(() => {
    if (authSession?.token) {
      notificationService.setAuth(getBackendUrl(), authSession.token);
      if (notificationService.getPermissionStatus() === "granted") {
        notificationService
          .subscribeToWebPush(getBackendUrl(), authSession.token)
          .catch(() => {});
      }
    }
  }, [authSession]);

  // Ref que indica si hay formulario/modal abierto.
  // Debe declararse ANTES de loadDatabaseState para que la función pueda leerlo.
  const isFormOpenRef = useRef(false);

  const CANONICAL_NOTAS_ID = CANONICAL_CATEGORIES.NOTAS.id;
  const CANONICAL_TAREAS_ID = CANONICAL_CATEGORIES.TAREAS.id;
  const CANONICAL_EVENTOS_ID = CANONICAL_CATEGORIES.EVENTOS.id;
  const CANONICAL_PROYECTOS_ID = CANONICAL_CATEGORIES.PROYECTOS.id;
  const CANONICAL_ALERTA_ID = CANONICAL_CATEGORIES.ALERTA.id;

  // Deduplicar entradas repetidas y restaurar la categoría adecuada a cada una
  const deduplicateAndHealEntries = async (
    database: DatabaseAdapter,
    uId: string,
  ) => {
    const all = await listLocalEntries(database, uId);
    const seenContent = new Map<string, string>();
    const toDeleteIds: string[] = [];

    for (const entry of all) {
      const trimmed = (entry.content || "").trim();
      if (!trimmed) continue;

      // Eliminar notas semilla predeterminadas si quedaron guardadas previamente
      if (
        entry.id === "00000000-0000-0000-0000-000000000011" ||
        entry.id === "00000000-0000-0000-0000-000000000012" ||
        entry.id === "00000000-0000-0000-0000-000000000013" ||
        trimmed.toLowerCase().includes("rediseño con tema glassmorphism") ||
        trimmed.toLowerCase().includes("rediseno con tema glassmorphism") ||
        trimmed
          .toLowerCase()
          .includes("reunión de revisión de arquitectura del proyecto ai") ||
        trimmed
          .toLowerCase()
          .includes("reunion de revision de arquitectura del proyecto ai") ||
        trimmed.toLowerCase().includes("servidor backend y fastapi")
      ) {
        toDeleteIds.push(entry.id);
        continue;
      }

      // 2. Deduplicar por contenido exacto
      if (seenContent.has(trimmed)) {
        toDeleteIds.push(entry.id);
      } else {
        seenContent.set(trimmed, entry.id);
      }
    }

    for (const delId of toDeleteIds) {
      await database.runAsync(
        `DELETE FROM entries WHERE id = ? AND user_id = ?;`,
        [delId, uId],
      );
      await database.runAsync(
        `DELETE FROM entry_tags WHERE entry_id = ? AND user_id = ?;`,
        [delId, uId],
      );
    }

    // 3. Reparar tareas existentes sin fecha asignándoles su created_at para que aparezcan en el calendario
    for (const entry of all) {
      if (
        entry.task_status &&
        entry.occurred_at === null &&
        !toDeleteIds.includes(entry.id)
      ) {
        const fallbackDate = entry.created_at || new Date().toISOString();
        await database.runAsync(
          `UPDATE entries SET occurred_at = ? WHERE id = ? AND user_id = ?;`,
          [fallbackDate, entry.id, uId],
        );
      }
    }

    // 4. Limpiar atributos de tarea en entradas de categoría Alerta (avisos puntuales sin estado ni prioridad de tarea)
    await database.runAsync(
      `UPDATE entries SET task_status = NULL, task_priority = NULL, task_recurrence = NULL WHERE category_id = ? AND user_id = ?;`,
      [CANONICAL_ALERTA_ID, uId],
    );
  };

  const loadDatabaseState = useCallback(
    async (forceReload: boolean = false) => {
      // Si hay un formulario abierto y no se fuerza recarga, solo sincronizar en background sin tocar el estado de React.
      if (isFormOpenRef.current && !forceReload) {
        try {
          await performSync(db, {
            apiBaseUrl: getBackendUrl(),
            token: userToken,
            userId,
          });
        } catch (_) {
          // silencioso
        }
        return;
      }

      setIsSyncing(true);
      try {
        // Adoptar / migrar automáticamente cualquier entrada creada previamente en modo invitado
        if (userId && userId !== "user-demo-123") {
          try {
            await db.runAsync(
              `UPDATE entries SET user_id = ? WHERE user_id = 'user-demo-123';`,
              [userId],
            );
            await db.runAsync(
              `UPDATE entry_tags SET user_id = ? WHERE user_id = 'user-demo-123';`,
              [userId],
            );
            await db.runAsync(
              `UPDATE categories SET user_id = ? WHERE user_id = 'user-demo-123';`,
              [userId],
            );
            await db.runAsync(
              `UPDATE tags SET user_id = ? WHERE user_id = 'user-demo-123';`,
              [userId],
            );
          } catch (_) {}
        }

        // 1. Deduplicar en local antes del sync
        await deduplicateAndHealEntries(db, userId);

        // 2. Sincronizar con el backend
        try {
          const syncRes = await performSync(db, {
            apiBaseUrl: getBackendUrl(),
            token: userToken,
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

        // Sincronizar todos los recordatorios activos en el servicio de notificaciones y suscripción push en servidor
        notificationService.syncAllReminders(
          db,
          userId,
          getBackendUrl(),
          authSession ? authSession.token : undefined,
        );
      } catch (err) {
        console.error("Error al cargar la base de datos:", err);
      } finally {
        setIsSyncing(false);
      }
    },
    [db, userId, userToken],
  );

  // Sincronización silenciosa en background para cambios locales granulares.
  // No altera isSyncing visualmente ni dispara lastSyncTime a menos que lleguen cambios remotos nuevos del servidor.
  const syncSilentlyInBackground = useCallback(async () => {
    try {
      if (authSession?.token) {
        notificationService.setAuth(getBackendUrl(), authSession.token);
      }
      const syncRes = await performSync(db, {
        apiBaseUrl: getBackendUrl(),
        token: userToken,
        userId,
      });

      // Actualizar conteos del encabezado sin parpadear
      const [allEntries, cats, datelessPending] = await Promise.all([
        listLocalEntries(db, userId),
        listCategories(db, userId),
        listPendingDatelessTasks(db, userId),
      ]);

      setEntries((prev) =>
        prev.length === allEntries.length ? prev : allEntries,
      );
      setCategories((prev) => (prev.length === cats.length ? prev : cats));
      setPendingTasksCount((prev) =>
        prev === datelessPending.length ? prev : datelessPending.length,
      );

      // Si llegaron cambios externos del servidor que requieren actualizar otras vistas:
      if (
        syncRes.success &&
        (syncRes.pulled_changes > 0 ||
          syncRes.pulled_tombstones > 0 ||
          syncRes.pushed_conflicts > 0)
      ) {
        setLastSyncTime(Date.now());
      }
    } catch {
      // Silencioso en background
    }
  }, [db, userId, userToken, authSession]);

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
        await db.execAsync(
          "ALTER TABLE entries ADD COLUMN task_priority TEXT;",
        );
      } catch {
        // Column may already exist
      }
      try {
        await db.execAsync(
          "ALTER TABLE entries ADD COLUMN reminder_enabled INTEGER DEFAULT 0;",
        );
      } catch {
        // Column may already exist
      }
      try {
        await db.execAsync(
          "ALTER TABLE entries ADD COLUMN reminder_time TEXT;",
        );
      } catch {
        // Column may already exist
      }
      try {
        await db.execAsync(
          "ALTER TABLE entries ADD COLUMN reminder_recurrence TEXT;",
        );
      } catch {
        // Column may already exist
      }
      try {
        await db.execAsync(
          "ALTER TABLE entries ADD COLUMN reminder_offset_minutes INTEGER DEFAULT 0;",
        );
      } catch {
        // Column may already exist
      }
      await ensureCanonicalCategories(db, userId);
      await deduplicateAndHealEntries(db, userId);

      // Purgar notas semilla predeterminadas para garantizar una lista de notas completamente limpia
      await db.runAsync(
        "DELETE FROM entries WHERE id IN ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000013');",
      );
      await db.runAsync(
        "DELETE FROM entry_tags WHERE entry_id IN ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000013');",
      );

      if (isMounted) {
        if (!authSession) {
          const isHealthy = await checkBackendHealth(defaultApiConfig);
          if (!isHealthy) {
            setBypassAuth(true);
          }
        }
        await loadDatabaseState(true);
        setIsInitialized(true);
        if (!isOnboardingCompleted(userId)) {
          setShowOnboardingModal(true);
        }
      }
    }

    initApp();

    return () => {
      isMounted = false;
    };
  }, [db, userId, loadDatabaseState]);

  // Mantener el ref sincronizado con el estado de modales
  useEffect(() => {
    isFormOpenRef.current =
      showVoiceCaptureModal || showEntryFormModal || !!selectedEntryId;
  }, [showVoiceCaptureModal, showEntryFormModal, selectedEntryId]);

  useEffect(() => {
    if (!isInitialized) return;

    // En web: no hacemos auto-refresh por temporizador
    if (Platform.OS === "web") {
      return () => {};
    }

    // En móvil: AppState para detectar cuando vuelve al primer plano (sin polling repetitivo)
    const { AppState } = require("react-native");
    const subscription = AppState.addEventListener(
      "change",
      (state: string) => {
        if (state === "active") {
          loadDatabaseState();
        }
      },
    );

    return () => {
      subscription?.remove();
    };
  }, [isInitialized, loadDatabaseState]);

  const handleTabChange = (
    tab: "CALENDAR" | "PENDING_TASKS" | "EXPLORER" | "CONFLICTS" | "LLM_IMPORT",
  ) => {
    setActiveTab(tab);
    setCalendarFocusDateStr(null);
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
        <Text style={styles.loadingText}>Iniciando VoxDaily Hub...</Text>
      </View>
    );
  }

  // Si no hay sesión activa y no ha entrado en modo invitado, requerimos inicio de sesión o registro
  if (!authSession && !bypassAuth) {
    return (
      <AuthScreen
        baseUrl={getBackendUrl()}
        onSuccess={async (session) => {
          setAuthSession(session);
          if (session?.userId && session.userId !== "user-demo-123") {
            try {
              await db.runAsync(
                `UPDATE entries SET user_id = ? WHERE user_id = 'user-demo-123';`,
                [session.userId],
              );
              await db.runAsync(
                `UPDATE entry_tags SET user_id = ? WHERE user_id = 'user-demo-123';`,
                [session.userId],
              );
              await db.runAsync(
                `UPDATE categories SET user_id = ? WHERE user_id = 'user-demo-123';`,
                [session.userId],
              );
              await db.runAsync(
                `UPDATE tags SET user_id = ? WHERE user_id = 'user-demo-123';`,
                [session.userId],
              );
            } catch (_) {}
          }
          loadDatabaseState(true);
        }}
        onContinueOffline={() => setBypassAuth(true)}
      />
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
                onEntryCreated={async (createdId) => {
                  setShowVoiceCaptureModal(false);
                  isFormOpenRef.current = false;
                  await handleEntryCreatedNavigate(createdId);
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
                apiConfig={{ baseUrl: getBackendUrl(), token: userToken }}
                onSuccess={async (createdId) => {
                  setShowEntryFormModal(false);
                  isFormOpenRef.current = false;
                  await handleEntryCreatedNavigate(createdId);
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
                onClose={() => {
                  setSelectedEntryId(null);
                  isFormOpenRef.current = false;
                  loadDatabaseState(true);
                }}
                onUpdated={() => {
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
      <View style={styles.tabContentWrapper}>
        {/* Proactive Startup Permissions Banner (#77) */}
        <StartupPermissionsPrompt
          backendUrl={getBackendUrl()}
          token={authSession?.token}
        />

        {/* Floating Action Bar (Only on Desktop Web view) */}
        {!isMobileScreen && (
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
            key="voice-home"
            db={db}
            userId={userId}
            refreshSignal={lastSyncTime}
            onOpenManualForm={() => setShowEntryFormModal(true)}
            onOpenLlmImport={() => setActiveTab("LLM_IMPORT")}
            onEntryCreated={async (createdId) => {
              await handleEntryCreatedNavigate(createdId);
            }}
          />
        )}

        {/* Tab 1: CALENDAR */}
        {activeTab === "CALENDAR" && (
          <View style={styles.tabContainer} key="cal-container">
            <CalendarCategoryFilter
              key="cal-filter"
              db={db}
              userId={userId}
              refreshSignal={lastSyncTime}
              onFilterChange={setSelectedCategoryIds}
              onTagFilterChange={setSelectedTagIds}
            />
            <CalendarMonthView
              key="calendar-view"
              db={db}
              userId={userId}
              initialSelectedDateStr={calendarFocusDateStr || undefined}
              selectedCategoryIds={
                selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined
              }
              selectedTagIds={
                selectedTagIds.length > 0 ? selectedTagIds : undefined
              }
              refreshSignal={lastSyncTime}
              onSelectEntry={(entryId) => setSelectedEntryId(entryId)}
              onEntryUpdated={syncSilentlyInBackground}
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
              onTaskUpdated={syncSilentlyInBackground}
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
              onCatalogUpdated={syncSilentlyInBackground}
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

        {/* Modal de Autenticación Privada */}
        <AuthModal
          visible={showAuthModal}
          baseUrl={getBackendUrl()}
          onSuccess={(session) => {
            setAuthSession(session);
            setShowAuthModal(false);
            loadDatabaseState(true);
            if (!isOnboardingCompleted(session.userId)) {
              setShowOnboardingModal(true);
            }
          }}
          onClose={() => setShowAuthModal(false)}
          onContinueOffline={() => setShowAuthModal(false)}
        />

        {/* Modal de Onboarding y Bienvenida */}
        <OnboardingModal
          visible={showOnboardingModal}
          onClose={() => setShowOnboardingModal(false)}
          userId={userId}
        />
      </View>
    );
  };

  if (isMobileScreen) {
    return (
      <MobileMainLayout
        apiConfig={defaultApiConfig}
        activeTab={
          (activeTab === "CONFLICTS" ? "EXPLORER" : activeTab) as MobileTab
        }
        onTabChange={(t) => handleTabChange(t as any)}
        stats={{
          totalEntries: entries.length,
          pendingTasks: pendingTasksCount,
          totalCategories: categories.length,
        }}
        onSync={loadDatabaseState}
        isSyncing={isSyncing}
        currentUserEmail={authSession ? authSession.email : null}
        onOpenAuth={() => setShowAuthModal(true)}
        onOpenOnboarding={() => setShowOnboardingModal(true)}
        onLogout={() => {
          authStorage.clearSession();
          setAuthSession(null);
          loadDatabaseState(true);
        }}
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
      activeTab={activeTab === "VOICE_CAPTURE" ? "CALENDAR" : activeTab}
      onTabChange={handleTabChange}
      stats={{
        totalEntries: entries.length,
        pendingTasks: pendingTasksCount,
        totalCategories: categories.length,
      }}
      onSync={loadDatabaseState}
      isSyncing={isSyncing}
      currentUserEmail={authSession ? authSession.email : null}
      onOpenAuth={() => setShowAuthModal(true)}
      onOpenOnboarding={() => setShowOnboardingModal(true)}
      onLogout={() => {
        authStorage.clearSession();
        setAuthSession(null);
        loadDatabaseState(true);
      }}
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
  tabContentWrapper: {
    flex: 1,
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
    alignItems: "center",
  },
  mainScrollView: {
    flex: 1,
    width: "100%",
  },
  mainScrollContent: {
    paddingBottom: 40,
    flexGrow: 1,
    width: "100%",
    alignItems: "center",
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
    gap: 12,
    marginBottom: 20,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
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
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
    minWidth: 170,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.card,
  },
  voiceCaptureButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  addEntryButton: {
    backgroundColor: "rgba(59, 130, 246, 0.2)",
    borderWidth: 1.5,
    borderColor: "#3b82f6",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
    minWidth: 170,
    alignItems: "center",
    justifyContent: "center",
  },
  addEntryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  modalBanner: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    width: "100%",
    maxWidth: "100%",
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
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
  },
});
