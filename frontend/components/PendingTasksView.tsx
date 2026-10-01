import React, { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { DatabaseAdapter } from "../db/database";
import {
  listDatelessTasks as defaultListDatelessTasks,
  updateLocalEntry as defaultUpdateLocalEntry,
  UpdateEntryData,
} from "../db/entries";
import { theme } from "../styles/theme";
import { Entry, TaskStatus } from "../types/domain";

export interface PendingTasksViewProps {
  db: DatabaseAdapter;
  userId: string;
  onSelectEntry?: (entry: Entry) => void;
  fetchTasks?: (db: DatabaseAdapter, userId: string) => Promise<Entry[]>;
  updateEntry?: (
    db: DatabaseAdapter,
    userId: string,
    entryId: string,
    data: UpdateEntryData,
  ) => Promise<Entry>;
}

export function PendingTasksView(props: PendingTasksViewProps) {
  const {
    db,
    userId,
    onSelectEntry,
    fetchTasks = defaultListDatelessTasks,
    updateEntry = defaultUpdateLocalEntry,
  } = props;

  const [tasks, setTasks] = useState<Entry[]>([]);
  const [statusFilter, setStatusFilter] = useState<
    "PENDING" | "IN_PROGRESS" | "DONE" | "ALL"
  >("PENDING");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [exportedJson, setExportedJson] = useState<string | null>(null);

  const loadTasks = async () => {
    try {
      const data = await fetchTasks(db, userId);
      setTasks(data);
      setError(null);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Error al cargar las tareas.";
      setError(msg);
    }
  };

  useEffect(() => {
    let mounted = true;
    fetchTasks(db, userId)
      .then((data) => {
        if (mounted) {
          setTasks(data);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (mounted) {
          const msg =
            err && typeof err === "object" && "message" in err
              ? String((err as { message: unknown }).message)
              : "Error al cargar las tareas.";
          setError(msg);
        }
      });
    return () => {
      mounted = false;
    };
  }, [db, userId, fetchTasks]);

  const handleStatusChange = async (entry: Entry, newStatus: TaskStatus) => {
    try {
      await updateEntry(db, userId, entry.id, {
        task_status: newStatus,
        task_recurrence: entry.task_recurrence ?? "ONCE",
      });
      setTasks((prev) =>
        prev.map((t) =>
          t.id === entry.id ? { ...t, task_status: newStatus } : t,
        ),
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Error al actualizar la tarea.",
      );
    }
  };

  const handleExportJson = () => {
    const data = JSON.stringify(tasks, null, 2);
    setExportedJson(data);
  };

  const pendingCount = tasks.filter((t) => t.task_status === "PENDING").length;
  const inProgressCount = tasks.filter(
    (t) => t.task_status === "IN_PROGRESS",
  ).length;
  const doneCount = tasks.filter((t) => t.task_status === "DONE").length;
  const allCount = tasks.length;

  const filteredTasks = tasks
    .filter((t) => {
      if (statusFilter === "ALL") return true;
      if (statusFilter === "PENDING") return t.task_status === "PENDING";
      if (statusFilter === "IN_PROGRESS")
        return t.task_status === "IN_PROGRESS";
      if (statusFilter === "DONE") return t.task_status === "DONE";
      return true;
    })
    .filter((t) => t.content.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <View style={styles.container} testID="pending-tasks-view">
      {/* Header bar */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Tareas sin Fecha</Text>
          <Text style={styles.subtitle}>
            Organización ágil de tareas pendientes, en progreso y realizadas
          </Text>
        </View>
        <Pressable
          style={styles.exportButton}
          onPress={handleExportJson}
          testID="btn-export-json"
        >
          <Text style={styles.exportButtonText}>📥 Exportar JSON</Text>
        </Pressable>
      </View>

      {/* Task Status Filter Tabs */}
      <View style={styles.tabFilterRow}>
        <Pressable
          testID="tab-filter-pending"
          style={[
            styles.tabFilterBtn,
            statusFilter === "PENDING" && styles.tabFilterBtnActive,
          ]}
          onPress={() => setStatusFilter("PENDING")}
        >
          <Text
            style={[
              styles.tabFilterText,
              statusFilter === "PENDING" && styles.tabFilterTextActive,
            ]}
          >
            {`⏳ Pendientes (${pendingCount})`}
          </Text>
        </Pressable>

        <Pressable
          testID="tab-filter-inprogress"
          style={[
            styles.tabFilterBtn,
            statusFilter === "IN_PROGRESS" && styles.tabFilterBtnActive,
          ]}
          onPress={() => setStatusFilter("IN_PROGRESS")}
        >
          <Text
            style={[
              styles.tabFilterText,
              statusFilter === "IN_PROGRESS" && styles.tabFilterTextActive,
            ]}
          >
            {`⚡ En progreso (${inProgressCount})`}
          </Text>
        </Pressable>

        <Pressable
          testID="tab-filter-done"
          style={[
            styles.tabFilterBtn,
            statusFilter === "DONE" && styles.tabFilterBtnActive,
          ]}
          onPress={() => setStatusFilter("DONE")}
        >
          <Text
            style={[
              styles.tabFilterText,
              statusFilter === "DONE" && styles.tabFilterTextActive,
            ]}
          >
            {`✅ Realizadas (${doneCount})`}
          </Text>
        </Pressable>

        <Pressable
          testID="tab-filter-all"
          style={[
            styles.tabFilterBtn,
            statusFilter === "ALL" && styles.tabFilterBtnActive,
          ]}
          onPress={() => setStatusFilter("ALL")}
        >
          <Text
            style={[
              styles.tabFilterText,
              statusFilter === "ALL" && styles.tabFilterTextActive,
            ]}
          >
            {`📋 Todas (${allCount})`}
          </Text>
        </Pressable>
      </View>

      {/* Live Search Input Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Buscar tarea por contenido..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          testID="input-search-tasks"
        />
      </View>

      {/* JSON Export View Modal Banner */}
      {exportedJson && (
        <View style={styles.exportBanner} testID="export-json-banner">
          <Text style={styles.exportTitle}>Exportación de Datos (JSON):</Text>
          <Text style={styles.exportCode} numberOfLines={6}>
            {exportedJson}
          </Text>
          <Pressable
            style={styles.closeExportButton}
            onPress={() => setExportedJson(null)}
            testID="btn-close-export"
          >
            <Text style={styles.closeExportText}>Cerrar Vista previa</Text>
          </Pressable>
        </View>
      )}

      {error && (
        <View style={styles.centerContainer} testID="error-container">
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={loadTasks}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </Pressable>
        </View>
      )}

      {!error && filteredTasks.length === 0 && (
        <View style={styles.centerContainer} testID="empty-container">
          <Text style={styles.emptyText}>
            {searchQuery
              ? `No se encontraron tareas para "${searchQuery}"`
              : statusFilter === "DONE"
                ? "No hay tareas realizadas sin fecha"
                : statusFilter === "IN_PROGRESS"
                  ? "No hay tareas en progreso"
                  : "No hay tareas pendientes sin fecha"}
          </Text>
          {statusFilter !== "PENDING" && (
            <Pressable
              testID="btn-back-to-pending"
              style={styles.switchPendingBtn}
              onPress={() => setStatusFilter("PENDING")}
            >
              <Text style={styles.switchPendingBtnText}>
                👈 Volver a Tareas Pendientes
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {!error && filteredTasks.length > 0 && (
        <ScrollView style={styles.taskList}>
          {filteredTasks.map((item) => (
            <View key={item.id} style={styles.taskCard}>
              <Pressable
                style={styles.cardContent}
                onPress={() => onSelectEntry?.(item)}
                testID={`task-card-${item.id}`}
              >
                <Text style={styles.taskContent}>{item.content}</Text>
                <Text style={styles.taskMeta}>
                  Estado actual:{" "}
                  {item.task_status === "PENDING"
                    ? "Pendiente"
                    : item.task_status === "IN_PROGRESS"
                      ? "En progreso"
                      : "Realizada"}
                </Text>
              </Pressable>

              <View style={styles.statusButtonsRow}>
                <Pressable
                  style={[
                    styles.statusButton,
                    item.task_status === "PENDING" && styles.activeStatusButton,
                  ]}
                  onPress={() => handleStatusChange(item, "PENDING")}
                  testID={`status-pending-${item.id}`}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      item.task_status === "PENDING" &&
                        styles.activeStatusButtonText,
                    ]}
                  >
                    Pendiente
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.statusButton,
                    item.task_status === "IN_PROGRESS" &&
                      styles.activeStatusButton,
                  ]}
                  onPress={() => handleStatusChange(item, "IN_PROGRESS")}
                  testID={`status-inprogress-${item.id}`}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      item.task_status === "IN_PROGRESS" &&
                        styles.activeStatusButtonText,
                    ]}
                  >
                    En progreso
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.statusButton,
                    item.task_status === "DONE" && styles.activeStatusButton,
                  ]}
                  onPress={() => handleStatusChange(item, "DONE")}
                  testID={`status-done-${item.id}`}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      item.task_status === "DONE" &&
                        styles.activeStatusButtonText,
                    ]}
                  >
                    Realizada
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#0f172a",
    borderRadius: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 2,
  },
  exportButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.4)",
    borderRadius: 8,
  },
  exportButtonText: {
    color: "#60a5fa",
    fontSize: 13,
    fontWeight: "600",
  },
  tabFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  tabFilterBtn: {
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tabFilterBtnActive: {
    backgroundColor: "#38BDF8",
    borderColor: "#38BDF8",
  },
  tabFilterText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "600",
  },
  tabFilterTextActive: {
    color: "#0f172a",
    fontWeight: "bold",
  },
  switchPendingBtn: {
    marginTop: 14,
    backgroundColor: "#334155",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  switchPendingBtnText: {
    color: "#38BDF8",
    fontWeight: "bold",
    fontSize: 13,
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    color: "#ffffff",
    fontSize: 14,
  },
  exportBanner: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  exportTitle: {
    color: "#60a5fa",
    fontWeight: "700",
    fontSize: 13,
    marginBottom: 6,
  },
  exportCode: {
    fontFamily: "monospace",
    color: "#cbd5e1",
    fontSize: 11,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
  },
  closeExportButton: {
    alignSelf: "flex-end",
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#334155",
    borderRadius: 6,
  },
  closeExportText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  taskList: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: "#94a3b8",
    textAlign: "center",
  },
  errorText: {
    fontSize: 16,
    color: "#f87171",
    marginBottom: 12,
    textAlign: "center",
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  taskCard: {
    backgroundColor: "rgba(30, 41, 59, 0.85)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  cardContent: {
    marginBottom: 12,
  },
  taskContent: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f8fafc",
    marginBottom: 6,
    lineHeight: 22,
  },
  taskMeta: {
    fontSize: 13,
    color: "#94a3b8",
  },
  statusButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.5)",
  },
  activeStatusButton: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  statusButtonText: {
    fontSize: 12,
    color: "#cbd5e1",
  },
  activeStatusButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
