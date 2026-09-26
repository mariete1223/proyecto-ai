import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  createLocalTag,
  deleteLocalTag,
  getTagUsageCount,
  listTags,
  updateLocalTag,
} from "../db/tags";
import { DatabaseAdapter } from "../db/database";
import { Tag } from "../types/domain";

export interface TagManagerProps {
  db: DatabaseAdapter;
  userId: string;
  onTagChanged?: () => void;
}

interface TagWithUsage {
  tag: Tag;
  usageCount: number;
}

export function TagManager({ db, userId, onTagChanged }: TagManagerProps) {
  const [tagsWithUsage, setTagsWithUsage] = useState<TagWithUsage[]>([]);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [deletingTag, setDeletingTag] = useState<TagWithUsage | null>(null);

  const [name, setName] = useState<string>("");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const loadTags = async () => {
    try {
      const rawTags = await listTags(db, userId);
      const withUsage: TagWithUsage[] = await Promise.all(
        rawTags.map(async (tag) => {
          const usageCount = await getTagUsageCount(db, userId, tag.id);
          return { tag, usageCount };
        }),
      );
      setTagsWithUsage(withUsage);
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  };

  useEffect(() => {
    let mounted = true;
    async function fetchTags() {
      try {
        const rawTags = await listTags(db, userId);
        const withUsage: TagWithUsage[] = await Promise.all(
          rawTags.map(async (tag) => {
            const usageCount = await getTagUsageCount(db, userId, tag.id);
            return { tag, usageCount };
          }),
        );
        if (mounted) {
          setTagsWithUsage(withUsage);
        }
      } catch (err) {
        if (mounted) {
          setErrorMessage((err as Error).message);
        }
      }
    }
    fetchTags();
    return () => {
      mounted = false;
    };
  }, [db, userId]);

  const resetForm = () => {
    setEditingTag(null);
    setDeletingTag(null);
    setName("");
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const startEdit = (item: TagWithUsage) => {
    setEditingTag(item.tag);
    setDeletingTag(null);
    setName(item.tag.name);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const promptDelete = (item: TagWithUsage) => {
    setDeletingTag(item);
    setEditingTag(null);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const confirmDelete = async () => {
    if (!deletingTag) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      await deleteLocalTag(db, userId, deletingTag.tag.id);
      setSuccessMessage(`Etiqueta #${deletingTag.tag.name} eliminada.`);
      setDeletingTag(null);
      await loadTags();
      if (onTagChanged) {
        onTagChanged();
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!name.trim()) {
      setErrorMessage("El nombre de la etiqueta no puede estar vacío.");
      return;
    }

    setLoading(true);
    try {
      const wasEditing = Boolean(editingTag);
      if (editingTag) {
        await updateLocalTag(db, userId, editingTag.id, {
          name: name.trim(),
        });
      } else {
        await createLocalTag(db, userId, {
          name: name.trim(),
        });
      }

      resetForm();
      if (wasEditing) {
        setSuccessMessage("¡Etiqueta actualizada correctamente!");
      } else {
        setSuccessMessage("¡Etiqueta creada correctamente!");
      }

      await loadTags();
      if (onTagChanged) {
        onTagChanged();
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container} testID="tag-manager">
      <Text style={styles.headerTitle}>Gestión de Etiquetas</Text>

      {errorMessage && (
        <View style={styles.errorBox} testID="tag-manager-error">
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {successMessage && (
        <View style={styles.successBox} testID="tag-manager-success">
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      )}

      {/* Delete confirmation modal view */}
      {deletingTag && (
        <View style={styles.confirmBox} testID="tag-delete-confirm-box">
          <Text style={styles.confirmTitle}>
            {`¿Eliminar etiqueta #${deletingTag.tag.name}?`}
          </Text>
          {deletingTag.usageCount > 0 ? (
            <Text style={styles.confirmWarning}>
              {`Esta etiqueta se encuentra en uso en ${deletingTag.usageCount} entrada(s). Si la eliminas, se desvinculará de ellas.`}
            </Text>
          ) : (
            <Text style={styles.confirmText}>
              Esta etiqueta no está en uso actualmente.
            </Text>
          )}

          <View style={styles.buttonRow}>
            <Pressable
              testID="btn-cancel-delete-tag"
              style={styles.cancelButton}
              onPress={() => setDeletingTag(null)}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </Pressable>

            <Pressable
              testID="btn-confirm-delete-tag"
              style={styles.dangerButton}
              onPress={confirmDelete}
            >
              <Text style={styles.dangerButtonText}>Confirmar Eliminación</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Tag List */}
      <Text style={styles.sectionTitle}>Etiquetas Existentes</Text>
      <View style={styles.listContainer} testID="tag-list">
        {tagsWithUsage.length === 0 ? (
          <Text style={styles.emptyText}>No hay etiquetas creadas.</Text>
        ) : (
          tagsWithUsage.map(({ tag, usageCount }) => (
            <View
              key={tag.id}
              style={styles.tagCard}
              testID={`tag-item-${tag.id}`}
            >
              <View style={styles.tagHeader}>
                <Text style={styles.tagName}>{`#${tag.name}`}</Text>
                <Text style={styles.usageBadge}>
                  {usageCount > 0 ? `En uso: ${usageCount}` : "Sin uso"}
                </Text>
              </View>

              <View style={styles.tagActions}>
                <Pressable
                  testID={`btn-edit-tag-${tag.id}`}
                  style={styles.actionButton}
                  onPress={() => startEdit({ tag, usageCount })}
                >
                  <Text style={styles.actionButtonText}>Editar</Text>
                </Pressable>

                <Pressable
                  testID={`btn-delete-tag-${tag.id}`}
                  style={styles.deleteButton}
                  onPress={() => promptDelete({ tag, usageCount })}
                >
                  <Text style={styles.deleteButtonText}>Eliminar</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Tag Form */}
      <View style={styles.formContainer} testID="tag-form">
        <Text style={styles.formTitle}>
          {editingTag ? "Editar Etiqueta" : "Nueva Etiqueta"}
        </Text>

        <Text style={styles.label}>Nombre de la Etiqueta *</Text>
        <TextInput
          testID="input-tag-name"
          style={styles.input}
          placeholder="Ej. urgente, proyecto, salud"
          placeholderTextColor="#64748B"
          value={name}
          onChangeText={setName}
        />

        <View style={styles.buttonRow}>
          {editingTag && (
            <Pressable
              testID="btn-cancel-edit-tag"
              style={styles.cancelButton}
              onPress={resetForm}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </Pressable>
          )}

          <Pressable
            testID="btn-submit-tag"
            style={[styles.submitButton, loading && styles.buttonDisabled]}
            disabled={loading}
            onPress={handleSubmit}
          >
            <Text style={styles.submitButtonText}>
              {loading
                ? "Guardando..."
                : editingTag
                  ? "Actualizar Etiqueta"
                  : "Crear Etiqueta"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 600,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#F8FAFC",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#94A3B8",
    marginBottom: 10,
  },
  listContainer: {
    gap: 10,
    marginBottom: 20,
  },
  emptyText: {
    color: "#64748B",
    fontStyle: "italic",
  },
  tagCard: {
    backgroundColor: "#0F172A",
    borderRadius: 8,
    padding: 12,
    borderColor: "#334155",
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tagHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tagName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#38BDF8",
  },
  usageBadge: {
    fontSize: 11,
    color: "#94A3B8",
    backgroundColor: "#1E293B",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tagActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    backgroundColor: "#334155",
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  actionButtonText: {
    color: "#F8FAFC",
    fontSize: 12,
  },
  deleteButton: {
    backgroundColor: "#7F1D1D",
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  deleteButtonText: {
    color: "#FECACA",
    fontSize: 12,
  },
  formContainer: {
    backgroundColor: "#0F172A",
    borderRadius: 8,
    padding: 16,
    borderColor: "#334155",
    borderWidth: 1,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#F8FAFC",
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94A3B8",
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#1E293B",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 6,
    color: "#F8FAFC",
    padding: 10,
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    justifyContent: "flex-end",
  },
  cancelButton: {
    backgroundColor: "#334155",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cancelButtonText: {
    color: "#94A3B8",
    fontWeight: "600",
  },
  submitButton: {
    backgroundColor: "#38BDF8",
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#0F172A",
    fontWeight: "bold",
  },
  dangerButton: {
    backgroundColor: "#EF4444",
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dangerButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
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
  confirmBox: {
    backgroundColor: "#451A03",
    borderColor: "#F59E0B",
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FDE68A",
    marginBottom: 6,
  },
  confirmWarning: {
    fontSize: 13,
    color: "#FCD34D",
    marginBottom: 10,
  },
  confirmText: {
    fontSize: 13,
    color: "#FEF3C7",
    marginBottom: 10,
  },
});
