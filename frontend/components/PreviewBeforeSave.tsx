import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { listCategories } from "../db/categories";
import { createLocalCorrection } from "../db/corrections";
import { DatabaseAdapter } from "../db/database";
import { createLocalEntry } from "../db/entries";
import { listTags } from "../db/tags";
import { ParsedSpokenCommand } from "../services/voiceParser";
import { Category, Entry, Tag } from "../types/domain";

export interface PreviewBeforeSaveProps {
  db: DatabaseAdapter;
  userId: string;
  captureSessionId: string;
  interpretedCommand: ParsedSpokenCommand;
  onSaved?: (entry: Entry) => void;
  onCancelled?: () => void;
}

export function PreviewBeforeSave({
  db,
  userId,
  captureSessionId,
  interpretedCommand,
  onSaved,
  onCancelled,
}: PreviewBeforeSaveProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    interpretedCommand.categoryId ?? "",
  );
  const [occurredAt, setOccurredAt] = useState<string>(
    interpretedCommand.occurredAt ?? "",
  );
  const [content, setContent] = useState<string>(
    interpretedCommand.content ?? "",
  );
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    interpretedCommand.tagIds ?? [],
  );

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    async function loadCatalogs() {
      try {
        const cats = await listCategories(db, userId);
        const tgs = await listTags(db, userId);
        if (mounted) {
          setCategories(cats);
          setTags(tgs);
          if (!selectedCategoryId && cats.length > 0) {
            setSelectedCategoryId(cats[0].id);
          }
        }
      } catch (err) {
        if (mounted) {
          setErrorMessage((err as Error).message);
        }
      }
    }
    loadCatalogs();
    return () => {
      mounted = false;
    };
  }, [db, userId, selectedCategoryId]);

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  };

  const handleCancel = () => {
    // Cancel without leaving any residual entry or correction records
    if (onCancelled) {
      onCancelled();
    }
  };

  const handleConfirm = async () => {
    setErrorMessage(null);

    if (!selectedCategoryId) {
      setErrorMessage("Selecciona una categoría.");
      return;
    }

    if (!content.trim()) {
      setErrorMessage("El contenido no puede estar vacío.");
      return;
    }

    setLoading(true);
    try {
      const category = categories.find((c) => c.id === selectedCategoryId);
      const isTask = category?.kind === "TASK";

      const entry = await createLocalEntry(db, userId, {
        category_id: selectedCategoryId,
        content: content.trim(),
        occurred_at: occurredAt.trim() ? occurredAt.trim() : null,
        task_status: isTask ? "PENDING" : null,
        task_recurrence: isTask ? "ONCE" : null,
        capture_session_id: captureSessionId,
        tag_ids: selectedTagIds,
      });

      // Record interpretation corrections if user edited interpreted fields
      if (selectedCategoryId !== (interpretedCommand.categoryId ?? "")) {
        await createLocalCorrection(db, userId, {
          entry_id: entry.id,
          capture_session_id: captureSessionId,
          field: "category_id",
          interpreted_value: interpretedCommand.categoryId,
          accepted_value: selectedCategoryId,
        });
      }

      const finalOccurred = occurredAt.trim() ? occurredAt.trim() : null;
      if (finalOccurred !== (interpretedCommand.occurredAt ?? null)) {
        await createLocalCorrection(db, userId, {
          entry_id: entry.id,
          capture_session_id: captureSessionId,
          field: "occurred_at",
          interpreted_value: interpretedCommand.occurredAt,
          accepted_value: finalOccurred,
        });
      }

      if (content.trim() !== (interpretedCommand.content ?? "").trim()) {
        await createLocalCorrection(db, userId, {
          entry_id: entry.id,
          capture_session_id: captureSessionId,
          field: "content",
          interpreted_value: interpretedCommand.content,
          accepted_value: content.trim(),
        });
      }

      const origTags = (interpretedCommand.tagIds ?? [])
        .slice()
        .sort()
        .join(",");
      const newTags = selectedTagIds.slice().sort().join(",");
      if (origTags !== newTags) {
        await createLocalCorrection(db, userId, {
          entry_id: entry.id,
          capture_session_id: captureSessionId,
          field: "tags",
          interpreted_value: origTags,
          accepted_value: newTags,
        });
      }

      if (onSaved) {
        onSaved(entry);
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.card} testID="preview-before-save">
      <Text style={styles.title}>Previsualización y Revisión</Text>

      {errorMessage && (
        <View style={styles.errorBox} testID="preview-error">
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {/* Category */}
      <Text style={styles.label}>Categoría Interpretada</Text>
      <View style={styles.chipsContainer} testID="preview-cat-selector">
        {categories.map((cat) => (
          <Pressable
            key={cat.id}
            testID={`cat-chip-${cat.id}`}
            style={[
              styles.chip,
              selectedCategoryId === cat.id && styles.chipActive,
            ]}
            onPress={() => setSelectedCategoryId(cat.id)}
          >
            <Text
              style={[
                styles.chipText,
                selectedCategoryId === cat.id && styles.chipTextActive,
              ]}
            >
              {cat.name}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Date */}
      <Text style={styles.label}>Fecha Interpretada (ISO 8601)</Text>
      <TextInput
        testID="input-preview-date"
        style={styles.input}
        placeholder="YYYY-MM-DDTHH:MM:SSZ"
        placeholderTextColor="#64748B"
        value={occurredAt}
        onChangeText={setOccurredAt}
      />

      {/* Content */}
      <Text style={styles.label}>Contenido Interpretado</Text>
      <TextInput
        testID="input-preview-content"
        style={[styles.input, { minHeight: 90 }]}
        placeholder="Escribe el contenido..."
        placeholderTextColor="#64748B"
        multiline
        value={content}
        onChangeText={setContent}
      />

      {/* Tags */}
      <Text style={styles.label}>Etiquetas Interpretadas</Text>
      <View style={styles.chipsContainer} testID="preview-tag-selector">
        {tags.map((tag) => {
          const isSelected = selectedTagIds.includes(tag.id);
          return (
            <Pressable
              key={tag.id}
              testID={`tag-chip-${tag.id}`}
              style={[styles.chip, isSelected && styles.chipActive]}
              onPress={() => toggleTag(tag.id)}
            >
              <Text
                style={[styles.chipText, isSelected && styles.chipTextActive]}
              >
                #{tag.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Buttons */}
      <View style={styles.buttonRow}>
        <Pressable
          testID="btn-cancel-preview"
          style={styles.cancelButton}
          onPress={handleCancel}
        >
          <Text style={styles.cancelButtonText}>Cancelar Captura</Text>
        </Pressable>

        <Pressable
          testID="btn-confirm-preview"
          style={[styles.confirmButton, loading && styles.buttonDisabled]}
          disabled={loading}
          onPress={handleConfirm}
        >
          <Text style={styles.confirmButtonText}>
            {loading ? "Guardando..." : "Confirmar y Guardar"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 550,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#F8FAFC",
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94A3B8",
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 8,
    color: "#F8FAFC",
    padding: 10,
    fontSize: 14,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: "#38BDF8",
    borderColor: "#38BDF8",
  },
  chipText: {
    color: "#94A3B8",
    fontSize: 13,
  },
  chipTextActive: {
    color: "#0F172A",
    fontWeight: "bold",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
    justifyContent: "flex-end",
  },
  cancelButton: {
    backgroundColor: "#334155",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: "#94A3B8",
    fontWeight: "bold",
  },
  confirmButton: {
    backgroundColor: "#10B981",
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
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
});
