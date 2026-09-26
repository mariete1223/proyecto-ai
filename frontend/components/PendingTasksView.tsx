import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { DatabaseAdapter } from "../db/database";
import {
  listPendingDatelessTasks as defaultListPendingDatelessTasks,
  updateLocalEntry as defaultUpdateLocalEntry,
  UpdateEntryData,
} from "../db/entries";
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
  const { db, userId, onSelectEntry } = props;
  const fetchTasksFn = props.fetchTasks ?? defaultListPendingDatelessTasks;
  const updateEntryFn = props.updateEntry ?? defaultUpdateLocalEntry;

  const [tasks, setTasks] = useState<Entry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = async () => {
    try {
      const data = await fetchTasksFn(db, userId);
      setTasks(data);
      setError(null);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Error al cargar las tareas.",
      );
    }
  };

  useEffect(() => {
    let mounted = true;
    fetchTasksFn(db, userId)
      .then((data) => {
        if (mounted) {
          setTasks(data);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Error al cargar las tareas.",
          );
        }
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, userId]);

  const handleStatusChange = async (entry: Entry, newStatus: TaskStatus) => {
    try {
      await updateEntryFn(db, userId, entry.id, {
        task_status: newStatus,
        task_recurrence: entry.task_recurrence ?? "ONCE",
      });
      if (newStatus === "DONE") {
        setTasks((prev) => prev.filter((t) => t.id !== entry.id));
      } else {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === entry.id ? { ...t, task_status: newStatus } : t,
          ),
        );
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Error al actualizar la tarea.",
      );
    }
  };

  return (
    <View style={styles.container} testID="pending-tasks-view">
      <Text style={styles.title}>Tareas Pendientes (Sin Fecha)</Text>

      {error && (
        <View style={styles.centerContainer} testID="error-container">
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={loadTasks}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </Pressable>
        </View>
      )}

      {!error && tasks.length === 0 && (
        <View style={styles.centerContainer} testID="empty-container">
          <Text style={styles.emptyText}>
            No hay tareas pendientes sin fecha
          </Text>
        </View>
      )}

      {!error && tasks.length > 0 && (
        <ScrollView style={styles.taskList}>
          {tasks.map((item) => (
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
    padding: 16,
    backgroundColor: "#f9f9f9",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#333",
  },
  taskList: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: "#777",
    textAlign: "center",
  },
  errorText: {
    fontSize: 16,
    color: "#d9534f",
    marginBottom: 12,
    textAlign: "center",
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: "#0066cc",
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  taskCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardContent: {
    marginBottom: 10,
  },
  taskContent: {
    fontSize: 16,
    fontWeight: "600",
    color: "#222",
    marginBottom: 4,
  },
  taskMeta: {
    fontSize: 13,
    color: "#666",
  },
  statusButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ccc",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  activeStatusButton: {
    backgroundColor: "#0066cc",
    borderColor: "#0066cc",
  },
  statusButtonText: {
    fontSize: 12,
    color: "#333",
  },
  activeStatusButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
