import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { EntryForm } from "./components/EntryForm";
import { PendingTasksView } from "./components/PendingTasksView";
import { VoiceCaptureFlow } from "./components/VoiceCaptureFlow";
import { WebMainLayout } from "./components/WebMainLayout";
import { createLocalCategory, listCategories } from "./db/categories";
import { MemoryDatabaseAdapter, runMigrations } from "./db/database";
import {
  createLocalEntry,
  listLocalEntries,
  listPendingDatelessTasks,
} from "./db/entries";
import { createLocalTag, listTags } from "./db/tags";
import { theme } from "./styles/theme";
import { Category, Entry, Tag } from "./types/domain";

const defaultApiConfig = {
  baseUrl: "http://localhost:8000",
  fetchFn: globalThis.fetch ? globalThis.fetch.bind(globalThis) : undefined,
};

export default function App() {
  const [db] = useState(() => new MemoryDatabaseAdapter());
  const [userId] = useState("user-demo-123");
  const [isInitialized, setIsInitialized] = useState(false);

  const [activeTab, setActiveTab] = useState<
    "CALENDAR" | "PENDING_TASKS" | "EXPLORER" | "CONFLICTS"
  >("CALENDAR");

  const [categories, setCategories] = useState<Category[]>([]);
  const [, setTags] = useState<Tag[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [pendingTasksCount, setPendingTasksCount] = useState(0);

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [showVoiceCaptureModal, setShowVoiceCaptureModal] = useState(false);
  const [showEntryFormModal, setShowEntryFormModal] = useState(false);

  const loadDatabaseState = useCallback(async () => {
    try {
      const cats = await listCategories(db, userId);
      const tgs = await listTags(db, userId);
      const allEntries = await listLocalEntries(db, userId);
      const datelessPending = await listPendingDatelessTasks(db, userId);

      setCategories(cats);
      setTags(tgs);
      setEntries(allEntries);
      setPendingTasksCount(datelessPending.length);
    } catch (err) {
      console.error("Error al cargar la base de datos:", err);
    }
  }, [db, userId]);

  useEffect(() => {
    let isMounted = true;

    async function initApp() {
      await runMigrations(db);

      const existingCats = await listCategories(db, userId);
      if (existingCats.length === 0) {
        const catNota = await createLocalCategory(db, userId, {
          name: "Notas",
          voice_command: "nota",
          kind: "STANDARD",
          color: theme.colors.primary,
          icon: "book",
        });

        const catTarea = await createLocalCategory(db, userId, {
          name: "Tareas",
          voice_command: "tarea",
          kind: "TASK",
          color: theme.colors.warning,
          icon: "check-square",
        });

        const catEvento = await createLocalCategory(db, userId, {
          name: "Eventos",
          voice_command: "evento",
          kind: "EVENT",
          color: theme.colors.success,
          icon: "calendar",
        });

        const tagUrgente = await createLocalTag(db, userId, {
          name: "Urgente",
        });

        const nowIso = new Date().toISOString();

        await createLocalEntry(db, userId, {
          category_id: catTarea.id,
          content: "Revisar la configuración del servidor backend y FastAPI",
          occurred_at: null,
          task_status: "PENDING",
          task_recurrence: "ONCE",
          tag_ids: [tagUrgente.id],
        });

        await createLocalEntry(db, userId, {
          category_id: catNota.id,
          content: "Completado el rediseño con tema Glassmorphism y panel Web",
          occurred_at: nowIso,
        });

        await createLocalEntry(db, userId, {
          category_id: catEvento.id,
          content: "Reunión de revisión de arquitectura del Proyecto AI",
          occurred_at: nowIso,
        });
      }

      if (isMounted) {
        await loadDatabaseState();
        setIsInitialized(true);
      }
    }

    initApp();

    return () => {
      isMounted = false;
    };
  }, [db, userId, loadDatabaseState]);

  if (!isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Iniciando Proyecto AI Hub...</Text>
      </View>
    );
  }

  return (
    <WebMainLayout
      apiConfig={defaultApiConfig}
      onTabChange={setActiveTab}
      stats={{
        totalEntries: entries.length,
        pendingTasks: pendingTasksCount,
        totalCategories: categories.length,
      }}
    >
      <StatusBar style="light" />

      {/* Floating Action Bar */}
      <View style={styles.topActionsBar}>
        <Pressable
          style={styles.voiceCaptureButton}
          onPress={() => setShowVoiceCaptureModal(true)}
          testID="btn-open-voice-modal"
        >
          <Text style={styles.voiceCaptureButtonText}>🎙️ Captura por Voz</Text>
        </Pressable>

        <Pressable
          style={styles.addEntryButton}
          onPress={() => setShowEntryFormModal(true)}
          testID="btn-open-entry-form"
        >
          <Text style={styles.addEntryButtonText}>➕ Nueva Entrada</Text>
        </Pressable>
      </View>

      {/* Voice Capture Modal Banner */}
      {showVoiceCaptureModal && (
        <View style={styles.modalBanner}>
          <View style={styles.modalBannerHeader}>
            <Text style={styles.modalBannerTitle}>
              Captura Interactiva por Voz
            </Text>
            <Pressable
              style={styles.closeModalButton}
              onPress={() => setShowVoiceCaptureModal(false)}
            >
              <Text style={styles.closeModalText}>✕ Cerrar</Text>
            </Pressable>
          </View>
          <VoiceCaptureFlow
            db={db}
            userId={userId}
            saveMode="PREVIEW_BEFORE_SAVE"
            onEntryCreated={() => {
              loadDatabaseState();
              setShowVoiceCaptureModal(false);
            }}
          />
        </View>
      )}

      {/* Entry Form Modal Banner */}
      {showEntryFormModal && (
        <View style={styles.modalBanner}>
          <View style={styles.modalBannerHeader}>
            <Text style={styles.modalBannerTitle}>Crear Entrada Manual</Text>
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
              loadDatabaseState();
              setShowEntryFormModal(false);
            }}
          />
        </View>
      )}

      {/* Tab 1: CALENDAR */}
      {activeTab === "CALENDAR" && (
        <ScrollView style={styles.tabContainer}>
          <CalendarCategoryFilter
            db={db}
            userId={userId}
            onFilterChange={setSelectedCategoryIds}
          />
          <CalendarMonthView
            db={db}
            userId={userId}
            selectedCategoryIds={
              selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined
            }
          />
        </ScrollView>
      )}

      {/* Tab 2: PENDING TASKS */}
      {activeTab === "PENDING_TASKS" && (
        <View style={styles.tabContainer}>
          <PendingTasksView
            db={db}
            userId={userId}
            onSelectEntry={() => {
              loadDatabaseState();
            }}
          />
        </View>
      )}

      {/* Tab 3: EXPLORER (Categories & Tags) */}
      {activeTab === "EXPLORER" && (
        <ScrollView style={styles.tabContainer}>
          <ClassificationExplorer db={db} userId={userId} />
        </ScrollView>
      )}

      {/* Tab 4: CONFLICTS */}
      {activeTab === "CONFLICTS" && (
        <View style={styles.tabContainer}>
          <ConflictResolver
            db={db}
            userId={userId}
            onResolved={loadDatabaseState}
          />
        </View>
      )}
    </WebMainLayout>
  );
}

const styles = StyleSheet.create({
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
    gap: 12,
    marginBottom: 20,
    justifyContent: "flex-end",
  },
  voiceCaptureButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    ...theme.shadows.card,
  },
  voiceCaptureButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14,
  },
  addEntryButton: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addEntryButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: "600",
    fontSize: 14,
  },
  modalBanner: {
    backgroundColor: theme.colors.bgCardGlass,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    ...theme.shadows.card,
  },
  modalBannerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  modalBannerTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  closeModalButton: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  closeModalText: {
    color: "#f87171",
    fontWeight: "600",
    fontSize: 13,
  },
  tabContainer: {
    flex: 1,
  },
});
