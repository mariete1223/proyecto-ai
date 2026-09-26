import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { listCategories } from "../db/categories";
import { DatabaseAdapter } from "../db/database";
import { createLocalEntry } from "../db/entries";
import { listTags } from "../db/tags";
import {
  VoiceRecognitionService,
  VoiceRecognitionState,
} from "../services/voiceRecognition";
import {
  Category,
  Entry,
  Tag,
  TaskRecurrence,
  TaskStatus,
} from "../types/domain";

export interface MixedCaptureFlowProps {
  db: DatabaseAdapter;
  userId: string;
  onSuccess?: (entry: Entry) => void;
}

export function MixedCaptureFlow({
  db,
  userId,
  onSuccess,
}: MixedCaptureFlowProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [occurredAt, setOccurredAt] = useState<string>("");
  const [dictatedContent, setDictatedContent] = useState<string>("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [taskStatus, setTaskStatus] = useState<TaskStatus>("PENDING");
  const [taskRecurrence, setTaskRecurrence] = useState<TaskRecurrence>("ONCE");

  const [voiceState, setVoiceState] = useState<VoiceRecognitionState>("IDLE");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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
          if (cats.length > 0) {
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
  }, [db, userId]);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const isTaskCategory = selectedCategory?.kind === "TASK";

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  };

  const handleStartDictation = async () => {
    setErrorMessage(null);
    const service = new VoiceRecognitionService({
      onStateChange: (st) => setVoiceState(st),
      onError: (err) => setErrorMessage(err),
    });
    await service.startListening();
  };

  const handleStopDictation = (dictatedText?: string) => {
    setVoiceState("IDLE");
    if (dictatedText) {
      setDictatedContent(dictatedText.trim());
    }
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!selectedCategoryId) {
      setErrorMessage("Selecciona una categoría.");
      return;
    }

    if (!dictatedContent.trim()) {
      setErrorMessage("El contenido dictado no puede estar vacío.");
      return;
    }

    setLoading(true);
    try {
      const entry = await createLocalEntry(db, userId, {
        category_id: selectedCategoryId,
        content: dictatedContent.trim(),
        occurred_at: occurredAt.trim() ? occurredAt.trim() : null,
        task_status: isTaskCategory ? taskStatus : null,
        task_recurrence: isTaskCategory ? taskRecurrence : null,
        tag_ids: selectedTagIds,
      });

      setSuccessMessage("¡Entrada mixta guardada correctamente!");
      setDictatedContent("");
      setOccurredAt("");
      setSelectedTagIds([]);
      if (onSuccess) {
        onSuccess(entry);
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.card} testID="mixed-capture-flow">
      <Text style={styles.title}>Captura Mixta (Manual + Voz)</Text>

      {errorMessage && (
        <View style={styles.errorBox} testID="mixed-capture-error">
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {successMessage && (
        <View style={styles.successBox} testID="mixed-capture-success">
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      )}

      {/* Manual Category Selection */}
      <Text style={styles.label}>1. Selección Manual de Categoría</Text>
      <View style={styles.chipsContainer} testID="mixed-cat-selector">
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

      {/* Task specific options */}
      {isTaskCategory && (
        <View style={styles.taskSection} testID="mixed-task-options">
          <Text style={styles.label}>Estado de Tarea</Text>
          <View style={styles.chipsContainer}>
            {(["PENDING", "IN_PROGRESS", "DONE"] as TaskStatus[]).map(
              (status) => (
                <Pressable
                  key={status}
                  testID={`status-${status}`}
                  style={[
                    styles.chip,
                    taskStatus === status && styles.chipActive,
                  ]}
                  onPress={() => setTaskStatus(status)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      taskStatus === status && styles.chipTextActive,
                    ]}
                  >
                    {status === "PENDING"
                      ? "Pendiente"
                      : status === "IN_PROGRESS"
                        ? "En progreso"
                        : "Realizada"}
                  </Text>
                </Pressable>
              ),
            )}
          </View>

          <Text style={styles.label}>Recurrencia</Text>
          <View style={styles.chipsContainer}>
            {(["ONCE", "RECURRING"] as TaskRecurrence[]).map((rec) => (
              <Pressable
                key={rec}
                testID={`rec-${rec}`}
                style={[
                  styles.chip,
                  taskRecurrence === rec && styles.chipActive,
                ]}
                onPress={() => setTaskRecurrence(rec)}
              >
                <Text
                  style={[
                    styles.chipText,
                    taskRecurrence === rec && styles.chipTextActive,
                  ]}
                >
                  {rec === "ONCE" ? "Única" : "Recurrente"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Manual Date Selection */}
      <Text style={styles.label}>2. Fecha Opcional (ISO 8601)</Text>
      <TextInput
        testID="input-mixed-date"
        style={styles.input}
        placeholder="YYYY-MM-DDTHH:MM:SSZ"
        placeholderTextColor="#64748B"
        value={occurredAt}
        onChangeText={setOccurredAt}
      />

      {/* Dictated Content */}
      <Text style={styles.label}>3. Contenido Dictado</Text>
      <View style={styles.dictateRow}>
        <TextInput
          testID="input-dictated-content"
          style={[styles.input, { flex: 1, minHeight: 80 }]}
          placeholder="Dicta o escribe el contenido..."
          placeholderTextColor="#64748B"
          multiline
          value={dictatedContent}
          onChangeText={setDictatedContent}
        />
        {voiceState === "IDLE" ? (
          <Pressable
            testID="btn-dictate-voice"
            style={styles.voiceButton}
            onPress={handleStartDictation}
          >
            <Text style={styles.voiceButtonText}>Dictar</Text>
          </Pressable>
        ) : (
          <Pressable
            testID="btn-stop-dictate"
            style={styles.stopButton}
            onPress={() =>
              handleStopDictation("Reunión con el equipo de diseño a las 10am")
            }
          >
            <Text style={styles.stopButtonText}>Parar</Text>
          </Pressable>
        )}
      </View>

      {/* Manual Tags Selection */}
      <Text style={styles.label}>4. Selección Manual de Etiquetas</Text>
      <View style={styles.chipsContainer} testID="mixed-tag-selector">
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

      {/* Submit Button */}
      <Pressable
        testID="btn-submit-mixed"
        style={[styles.submitButton, loading && styles.buttonDisabled]}
        disabled={loading}
        onPress={handleSubmit}
      >
        <Text style={styles.submitButtonText}>
          {loading ? "Guardando..." : "Guardar Entrada Mixta"}
        </Text>
      </Pressable>
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
  dictateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  voiceButton: {
    backgroundColor: "#38BDF8",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  voiceButtonText: {
    color: "#0F172A",
    fontWeight: "bold",
  },
  stopButton: {
    backgroundColor: "#EF4444",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  stopButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  taskSection: {
    marginTop: 4,
    marginBottom: 4,
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
  submitButton: {
    backgroundColor: "#10B981",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
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
});
