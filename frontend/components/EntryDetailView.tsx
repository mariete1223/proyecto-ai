import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { listCategories } from "../db/categories";
import { DatabaseAdapter } from "../db/database";
import {
  deleteLocalEntry,
  getEntryById,
  updateLocalEntry,
} from "../db/entries";
import { listTags } from "../db/tags";
import {
  Category,
  Entry,
  Tag,
  TaskRecurrence,
  TaskStatus,
} from "../types/domain";

export interface EntryDetailViewProps {
  db: DatabaseAdapter;
  userId: string;
  entryId: string;
  onDeleted?: () => void;
  onUpdated?: (updatedEntry: Entry) => void;
  onClose?: () => void;
}

export function EntryDetailView({
  db,
  userId,
  entryId,
  onDeleted,
  onUpdated,
  onClose,
}: EntryDetailViewProps) {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const [categoryId, setCategoryId] = useState<string>("");
  const [occurredAt, setOccurredAt] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [taskStatus, setTaskStatus] = useState<TaskStatus>("PENDING");
  const [taskRecurrence, setTaskRecurrence] = useState<TaskRecurrence>("ONCE");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    async function fetchEntryData() {
      try {
        const cats = await listCategories(db, userId);
        const tgs = await listTags(db, userId);
        const ent = await getEntryById(db, userId, entryId);

        if (mounted) {
          setCategories(cats);
          setTags(tgs);
          if (ent) {
            setEntry(ent);
            setCategoryId(ent.category_id);
            setOccurredAt(ent.occurred_at ?? "");
            setContent(ent.content);
            setSelectedTagIds(ent.tag_ids);
            if (ent.task_status) setTaskStatus(ent.task_status);
            if (ent.task_recurrence) setTaskRecurrence(ent.task_recurrence);
          } else {
            setErrorMessage("Entrada no encontrada.");
          }
        }
      } catch (err) {
        if (mounted) {
          setErrorMessage((err as Error).message);
        }
      }
    }
    fetchEntryData();
    return () => {
      mounted = false;
    };
  }, [db, userId, entryId]);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const isTaskCategory = selectedCategory?.kind === "TASK";

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  };

  const handleUpdate = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!content.trim()) {
      setErrorMessage("El contenido no puede estar vacío.");
      return;
    }

    setLoading(true);
    try {
      const updated = await updateLocalEntry(db, userId, entryId, {
        category_id: categoryId,
        content: content.trim(),
        occurred_at: occurredAt.trim() ? occurredAt.trim() : null,
        task_status: isTaskCategory ? taskStatus : null,
        task_recurrence: isTaskCategory ? taskRecurrence : null,
        tag_ids: selectedTagIds,
      });

      setEntry(updated);
      setSuccessMessage("¡Entrada actualizada correctamente!");
      setIsEditing(false);
      if (onUpdated) {
        onUpdated(updated);
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setErrorMessage(null);
    setLoading(true);
    try {
      await deleteLocalEntry(db, userId, entryId);
      if (onDeleted) {
        onDeleted();
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!entry) {
    return (
      <View style={styles.card} testID="entry-detail-view">
        <Text style={styles.errorText}>
          {errorMessage || "Cargando entrada..."}
        </Text>
      </View>
    );
  }

  const categoryMap = new Map<string, Category>();
  categories.forEach((c) => categoryMap.set(c.id, c));
  const entryCategory = categoryMap.get(entry.category_id);

  const tagMap = new Map<string, Tag>();
  tags.forEach((t) => tagMap.set(t.id, t));

  return (
    <View style={styles.card} testID="entry-detail-view">
      <View style={styles.headerRow}>
        <Text style={styles.title}>Detalle de Entrada</Text>
        {onClose && (
          <Pressable
            testID="btn-close-detail"
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>Cerrar</Text>
          </Pressable>
        )}
      </View>

      {errorMessage && (
        <View style={styles.errorBox} testID="entry-detail-error">
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {successMessage && (
        <View style={styles.successBox} testID="entry-detail-success">
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      )}

      {/* Delete Confirmation Box */}
      {isDeleting && (
        <View style={styles.confirmBox} testID="delete-confirm-panel">
          <Text style={styles.confirmTitle}>
            ¿Eliminar permanentemente esta entrada?
          </Text>
          <Text style={styles.confirmText}>
            Esta acción eliminará la entrada de la base de datos local y
            generará una marca de borrado para la sincronización.
          </Text>
          <View style={styles.buttonRow}>
            <Pressable
              testID="btn-cancel-delete-entry"
              style={styles.cancelButton}
              onPress={() => setIsDeleting(false)}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </Pressable>
            <Pressable
              testID="btn-confirm-delete-entry"
              style={styles.dangerButton}
              onPress={handleDelete}
            >
              <Text style={styles.dangerButtonText}>Confirmar Eliminación</Text>
            </Pressable>
          </View>
        </View>
      )}

      {!isEditing ? (
        /* Read Mode */
        <View testID="entry-read-mode">
          <View style={styles.metaRow}>
            <View
              style={[
                styles.colorBadge,
                { backgroundColor: entryCategory?.color || "#38BDF8" },
              ]}
            />
            <Text style={styles.categoryName}>
              {entryCategory?.name || "Sin Categoría"}
            </Text>
            {entry.task_status && (
              <Text style={styles.taskBadge}>{entry.task_status}</Text>
            )}
          </View>

          <Text style={styles.contentBody}>{entry.content}</Text>

          <Text style={styles.metaText}>
            {entry.occurred_at
              ? `Fecha: ${entry.occurred_at.substring(0, 10)}`
              : "Sin fecha asignada"}
          </Text>

          {entry.tag_ids.length > 0 && (
            <View style={styles.tagsRow}>
              {entry.tag_ids.map((tid) => {
                const t = tagMap.get(tid);
                return t ? (
                  <Text key={tid} style={styles.tagBadge}>
                    #{t.name}
                  </Text>
                ) : null;
              })}
            </View>
          )}

          <View style={styles.buttonRow}>
            <Pressable
              testID="btn-start-edit-entry"
              style={styles.editButton}
              onPress={() => setIsEditing(true)}
            >
              <Text style={styles.editButtonText}>Editar Entrada</Text>
            </Pressable>

            <Pressable
              testID="btn-prompt-delete-entry"
              style={styles.deleteButton}
              onPress={() => setIsDeleting(true)}
            >
              <Text style={styles.deleteButtonText}>Eliminar</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        /* Edit Mode */
        <View testID="entry-edit-mode">
          <Text style={styles.label}>Categoría</Text>
          <View style={styles.chipsContainer}>
            {categories.map((cat) => (
              <Pressable
                key={cat.id}
                testID={`edit-cat-${cat.id}`}
                style={[
                  styles.chip,
                  categoryId === cat.id && styles.chipActive,
                ]}
                onPress={() => setCategoryId(cat.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    categoryId === cat.id && styles.chipTextActive,
                  ]}
                >
                  {cat.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Contenido</Text>
          <TextInput
            testID="input-edit-content"
            style={[styles.input, { minHeight: 80 }]}
            multiline
            value={content}
            onChangeText={setContent}
          />

          <Text style={styles.label}>Fecha (ISO 8601)</Text>
          <TextInput
            testID="input-edit-date"
            style={styles.input}
            value={occurredAt}
            onChangeText={setOccurredAt}
          />

          {isTaskCategory && (
            <View style={styles.taskSection}>
              <Text style={styles.label}>Estado de Tarea</Text>
              <View style={styles.chipsContainer}>
                {(["PENDING", "IN_PROGRESS", "DONE"] as TaskStatus[]).map(
                  (st) => (
                    <Pressable
                      key={st}
                      testID={`edit-status-${st}`}
                      style={[
                        styles.chip,
                        taskStatus === st && styles.chipActive,
                      ]}
                      onPress={() => setTaskStatus(st)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          taskStatus === st && styles.chipTextActive,
                        ]}
                      >
                        {st}
                      </Text>
                    </Pressable>
                  ),
                )}
              </View>
            </View>
          )}

          <Text style={styles.label}>Etiquetas</Text>
          <View style={styles.chipsContainer}>
            {tags.map((t) => {
              const isSel = selectedTagIds.includes(t.id);
              return (
                <Pressable
                  key={t.id}
                  testID={`edit-tag-${t.id}`}
                  style={[styles.chip, isSel && styles.chipActive]}
                  onPress={() => toggleTag(t.id)}
                >
                  <Text
                    style={[styles.chipText, isSel && styles.chipTextActive]}
                  >
                    #{t.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.buttonRow}>
            <Pressable
              testID="btn-cancel-edit-entry"
              style={styles.cancelButton}
              onPress={() => setIsEditing(false)}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </Pressable>

            <Pressable
              testID="btn-save-edit-entry"
              style={[styles.confirmButton, loading && styles.buttonDisabled]}
              disabled={loading}
              onPress={handleUpdate}
            >
              <Text style={styles.confirmButtonText}>Guardar Cambios</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    maxWidth: 600,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#F8FAFC",
  },
  closeButton: {
    backgroundColor: "#334155",
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  closeButtonText: {
    color: "#94A3B8",
    fontSize: 12,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  colorBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#F8FAFC",
  },
  taskBadge: {
    backgroundColor: "#0F172A",
    color: "#38BDF8",
    fontSize: 11,
    fontWeight: "bold",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  contentBody: {
    fontSize: 16,
    color: "#F8FAFC",
    marginBottom: 12,
    lineHeight: 22,
  },
  metaText: {
    fontSize: 12,
    color: "#94A3B8",
    marginBottom: 10,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 14,
  },
  tagBadge: {
    color: "#38BDF8",
    fontSize: 12,
    backgroundColor: "#0F172A",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94A3B8",
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 6,
    color: "#F8FAFC",
    padding: 10,
    fontSize: 14,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipActive: {
    backgroundColor: "#38BDF8",
    borderColor: "#38BDF8",
  },
  chipText: {
    color: "#94A3B8",
    fontSize: 12,
  },
  chipTextActive: {
    color: "#0F172A",
    fontWeight: "bold",
  },
  taskSection: {
    marginTop: 6,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    justifyContent: "flex-end",
  },
  editButton: {
    backgroundColor: "#38BDF8",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  editButtonText: {
    color: "#0F172A",
    fontWeight: "bold",
  },
  deleteButton: {
    backgroundColor: "#7F1D1D",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  deleteButtonText: {
    color: "#FECACA",
    fontWeight: "bold",
  },
  cancelButton: {
    backgroundColor: "#334155",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  cancelButtonText: {
    color: "#94A3B8",
    fontWeight: "bold",
  },
  confirmButton: {
    backgroundColor: "#10B981",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  dangerButton: {
    backgroundColor: "#EF4444",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dangerButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  confirmBox: {
    backgroundColor: "#451A03",
    borderColor: "#F59E0B",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  confirmTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#FDE68A",
    marginBottom: 4,
  },
  confirmText: {
    fontSize: 12,
    color: "#FCD34D",
    marginBottom: 8,
  },
  errorBox: {
    backgroundColor: "#7F1D1D",
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: "#FECACA",
    fontSize: 14,
  },
  successBox: {
    backgroundColor: "#064E3B",
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
  },
  successText: {
    color: "#A7F3D0",
    fontSize: 14,
  },
});
