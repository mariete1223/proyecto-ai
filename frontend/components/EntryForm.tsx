import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { CANONICAL_CATEGORIES, listCategories } from "../db/categories";
import { DatabaseAdapter } from "../db/database";
import { createLocalEntry } from "../db/entries";
import { listTags } from "../db/tags";
import {
  Category,
  ReminderRecurrence,
  Tag,
  TaskPriority,
  TaskRecurrence,
  TaskStatus,
} from "../types/domain";
import { DateTimePicker } from "./DateTimePicker";
import { ReminderConfigSection } from "./ReminderConfigSection";
import { notificationService } from "../services/notificationService";
import { performSync } from "../services/syncEngine";

export function isCategoryAlert(cat?: Category | null): boolean {
  if (!cat) return false;
  return (
    cat.id === CANONICAL_CATEGORIES.ALERTA.id ||
    cat.name_normalized === "alerta" ||
    cat.voice_command_normalized === "alerta" ||
    cat.name.toLowerCase() === "alerta"
  );
}

export interface EntryFormProps {
  db: DatabaseAdapter;
  userId: string;
  onSuccess?: (entryId: string) => void | Promise<void>;
  apiConfig?: { baseUrl: string; token?: string };
}

export function EntryForm({
  db,
  userId,
  onSuccess,
  apiConfig,
}: EntryFormProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [occurredAt, setOccurredAt] = useState<string>("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [taskStatus, setTaskStatus] = useState<TaskStatus>("PENDING");
  const [taskRecurrence, setTaskRecurrence] = useState<TaskRecurrence>("ONCE");
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("MEDIUM");

  // Recordatorios y notificaciones
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(false);
  const [reminderTime, setReminderTime] = useState<string>("");
  const [reminderEndTime, setReminderEndTime] = useState<string>("");
  const [reminderOffsetMinutes, setReminderOffsetMinutes] = useState<number>(0);
  const [reminderRecurrence, setReminderRecurrence] =
    useState<ReminderRecurrence>("NONE");

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      typeof window.scrollTo === "function"
    ) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

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
            setSelectedCategoryId((prev) => {
              const nextId = prev ? prev : cats[0].id;
              const cat = cats.find((c) => c.id === nextId);
              if (isCategoryAlert(cat)) {
                setReminderEnabled(true);
                setReminderOffsetMinutes(0);
                setOccurredAt((cur) => (cur ? cur : new Date().toISOString()));
              }
              return nextId;
            });
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
  const isAlertCategory = isCategoryAlert(selectedCategory);
  const isTaskCategory = selectedCategory?.kind === "TASK" && !isAlertCategory;

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    setContentError(null);
    setSuccessMessage(null);

    if (!selectedCategoryId) {
      setErrorMessage("Selecciona una categoría.");
      return;
    }

    if (!content.trim()) {
      const msg = "El contenido no puede estar vacío.";
      setErrorMessage(msg);
      setContentError(msg);
      return;
    }

    let finalOccurredAt = occurredAt.trim() ? occurredAt.trim() : null;
    if (isAlertCategory && !finalOccurredAt) {
      finalOccurredAt = new Date().toISOString();
      setOccurredAt(finalOccurredAt);
    }

    const effectiveReminderEnabled = isAlertCategory ? true : reminderEnabled;
    const effectiveOffset = isAlertCategory ? 0 : reminderOffsetMinutes;
    const effectiveReminderTime = isAlertCategory
      ? finalOccurredAt || new Date().toISOString()
      : reminderTime.trim()
        ? reminderTime.trim()
        : null;

    setLoading(true);
    try {
      const entry = await createLocalEntry(db, userId, {
        category_id: selectedCategoryId,
        title: title.trim() ? title.trim() : null,
        content,
        occurred_at: finalOccurredAt,
        task_status: isTaskCategory ? taskStatus : null,
        task_recurrence: isTaskCategory ? taskRecurrence : null,
        task_priority: isTaskCategory ? taskPriority : null,
        reminder_enabled: effectiveReminderEnabled,
        reminder_time: effectiveReminderTime,
        reminder_end_time: reminderEndTime.trim()
          ? reminderEndTime.trim()
          : null,
        reminder_recurrence: reminderRecurrence,
        reminder_offset_minutes: effectiveOffset,
        reminder_offsets_minutes: effectiveReminderEnabled
          ? [effectiveOffset]
          : null,
        tag_ids: selectedTagIds,
      });

      // Programar la notificación en el servicio
      if (effectiveReminderEnabled) {
        notificationService.scheduleForEntry(entry);
      }

      // Sincronización garantizada e inmediata antes de cerrar
      if (apiConfig?.baseUrl) {
        try {
          await performSync(db, {
            apiBaseUrl: apiConfig.baseUrl,
            token: apiConfig.token || "",
            userId,
          });
        } catch (syncErr) {
          console.warn(
            "[EntryForm] Error en sincronización inmediata pre-cierre:",
            syncErr,
          );
        }
      }

      setSuccessMessage("¡Entrada guardada correctamente!");
      setTitle("");
      setContent("");
      setOccurredAt("");
      setReminderEnabled(false);
      setReminderTime("");
      setReminderEndTime("");
      setReminderOffsetMinutes(0);
      setReminderRecurrence("NONE");
      setSelectedTagIds([]);
      if (onSuccess) {
        await onSuccess(entry.id);
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.card} testID="entry-form-container">
      <Text style={styles.title}>Nueva Entrada Manual</Text>

      {errorMessage && (
        <View style={styles.errorBox} testID="entry-form-error">
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {successMessage && (
        <View style={styles.successBox} testID="entry-form-success">
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      )}

      {/* Category Selection */}
      <Text style={styles.label}>Categoría</Text>
      <View style={styles.chipsContainer} testID="category-selector">
        {categories.length === 0 ? (
          <Text style={styles.subtext}>No hay categorías disponibles</Text>
        ) : (
          categories.map((cat) => (
            <Pressable
              key={cat.id}
              testID={`cat-chip-${cat.id}`}
              style={[
                styles.chip,
                selectedCategoryId === cat.id && styles.chipActive,
              ]}
              onPress={() => {
                setSelectedCategoryId(cat.id);
                const isAlert = isCategoryAlert(cat);
                if (isAlert) {
                  setReminderEnabled(true);
                  setReminderOffsetMinutes(0);
                  if (!occurredAt) {
                    setOccurredAt(new Date().toISOString());
                  }
                } else {
                  setReminderOffsetMinutes(1440);
                }
              }}
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
          ))
        )}
      </View>

      {/* Task specific options */}
      {isTaskCategory && (
        <View style={styles.taskSection} testID="task-options">
          <Text style={styles.label}>Estado de Tarea</Text>
          <View style={styles.row}>
            {(["PENDING", "IN_PROGRESS", "DONE"] as TaskStatus[]).map(
              (status) => (
                <Pressable
                  key={status}
                  testID={`status-${status}`}
                  style={[
                    styles.smallChip,
                    taskStatus === status && styles.smallChipActive,
                  ]}
                  onPress={() => setTaskStatus(status)}
                >
                  <Text
                    style={[
                      styles.smallChipText,
                      taskStatus === status && styles.smallChipTextActive,
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
          <View style={styles.row}>
            {(["ONCE", "RECURRING"] as TaskRecurrence[]).map((rec) => (
              <Pressable
                key={rec}
                testID={`rec-${rec}`}
                style={[
                  styles.smallChip,
                  taskRecurrence === rec && styles.smallChipActive,
                ]}
                onPress={() => setTaskRecurrence(rec)}
              >
                <Text
                  style={[
                    styles.smallChipText,
                    taskRecurrence === rec && styles.smallChipTextActive,
                  ]}
                >
                  {rec === "ONCE" ? "Única" : "Recurrente"}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Prioridad</Text>
          <View style={styles.row}>
            {(
              [
                { id: "HIGH", label: "🔴 Alta", testId: "priority-HIGH" },
                { id: "MEDIUM", label: "🟡 Media", testId: "priority-MEDIUM" },
                { id: "LOW", label: "🔵 Baja", testId: "priority-LOW" },
              ] as const
            ).map((p) => (
              <Pressable
                key={p.id}
                testID={p.testId}
                style={[
                  styles.smallChip,
                  taskPriority === p.id && styles.smallChipActive,
                ]}
                onPress={() => setTaskPriority(p.id)}
              >
                <Text
                  style={[
                    styles.smallChipText,
                    taskPriority === p.id && styles.smallChipTextActive,
                  ]}
                >
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Title */}
      <Text style={styles.label}>Título (Opcional)</Text>
      <TextInput
        testID="input-title"
        style={styles.input}
        placeholder="Ej. Renovar demanda de empleo en el SERV"
        placeholderTextColor="#64748B"
        value={title}
        onChangeText={setTitle}
      />

      {/* Content */}
      <Text style={styles.label}>Contenido</Text>
      <TextInput
        testID="input-content"
        style={[styles.inputArea, contentError ? styles.inputError : null]}
        placeholder="Escribe el contenido..."
        placeholderTextColor="#64748B"
        multiline
        value={content}
        onChangeText={(val) => {
          setContent(val);
          if (contentError) setContentError(null);
          if (errorMessage) setErrorMessage(null);
        }}
      />
      {contentError ? (
        <Text style={styles.fieldErrorText} testID="content-error-text">
          ⚠️ {contentError}
        </Text>
      ) : null}

      {/* Occurred At Date Selection */}
      <DateTimePicker
        testID="input-date"
        value={occurredAt}
        onChange={(val) => {
          setOccurredAt(val);
        }}
        label={
          isAlertCategory
            ? "Hora y Fecha de la Alerta"
            : "Fecha y Hora de la Entrada"
        }
      />

      {/* Recordatorios y Notificaciones: Alerta tiene aviso automático sin casilla; resto con casilla manual */}
      {isAlertCategory ? (
        <View style={styles.alertNoticeBox} testID="alert-auto-reminder-notice">
          <Text style={styles.alertNoticeTitle}>
            🔔 Alarma automática a la hora exacta
          </Text>
          <Text style={styles.alertNoticeSubtext}>
            Esta alerta sonará y enviará una notificación a tu dispositivo a la
            hora indicada, sin necesidad de activar ninguna casilla.
          </Text>
        </View>
      ) : (
        <ReminderConfigSection
          enabled={reminderEnabled}
          onEnabledChange={setReminderEnabled}
          reminderTime={reminderTime}
          onReminderTimeChange={setReminderTime}
          reminderEndTime={reminderEndTime}
          onReminderEndTimeChange={setReminderEndTime}
          offsetMinutes={reminderOffsetMinutes}
          onOffsetMinutesChange={setReminderOffsetMinutes}
          recurrence={reminderRecurrence}
          onRecurrenceChange={setReminderRecurrence}
          occurredAt={occurredAt}
        />
      )}

      {/* Tags Selection */}
      <Text style={styles.label}>Etiquetas (Opcional)</Text>
      <View style={styles.chipsContainer} testID="tag-selector">
        {tags.length === 0 ? (
          <Text style={styles.subtext}>No hay etiquetas creadas</Text>
        ) : (
          tags.map((tag) => {
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
          })
        )}
      </View>

      {/* Submit Button */}
      {errorMessage ? (
        <View style={styles.submitErrorBanner} testID="submit-error-banner">
          <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
        </View>
      ) : null}
      <Pressable
        testID="btn-submit-entry"
        style={[styles.button, loading && styles.buttonDisabled]}
        disabled={loading}
        onPress={handleSubmit}
      >
        <Text style={styles.buttonText}>
          {loading ? "Guardando..." : "Guardar Entrada"}
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
    maxWidth: 500,
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
  subtext: {
    fontSize: 12,
    color: "#64748B",
    fontStyle: "italic",
  },
  input: {
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 8,
    color: "#F8FAFC",
    padding: 12,
    fontSize: 15,
  },
  inputArea: {
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 8,
    color: "#F8FAFC",
    padding: 12,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: "top",
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
    borderRadius: 20,
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
    fontWeight: "500",
  },
  chipTextActive: {
    color: "#0F172A",
    fontWeight: "700",
  },
  taskSection: {
    marginTop: 4,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  smallChip: {
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  smallChipActive: {
    backgroundColor: "#818CF8",
    borderColor: "#818CF8",
  },
  smallChipText: {
    color: "#94A3B8",
    fontSize: 12,
  },
  smallChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  button: {
    backgroundColor: "#38BDF8",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#0F172A",
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
  datePresetsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  presetChip: {
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  presetChipActive: {
    borderColor: "#38BDF8",
    backgroundColor: "rgba(56, 189, 248, 0.15)",
  },
  presetChipText: {
    color: "#F8FAFC",
    fontSize: 12,
    fontWeight: "600",
  },
  datePreviewText: {
    color: "#38BDF8",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "500",
  },
  inputError: {
    borderColor: "#EF4444",
    borderWidth: 1.5,
  },
  fieldErrorText: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "600",
    marginTop: -8,
    marginBottom: 12,
  },
  submitErrorBanner: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "#EF4444",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  alertNoticeBox: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.35)",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginVertical: 12,
    gap: 4,
  },
  alertNoticeTitle: {
    color: "#F87171",
    fontSize: 13,
    fontWeight: "700",
  },
  alertNoticeSubtext: {
    color: "#CBD5E1",
    fontSize: 12,
    lineHeight: 16,
  },
});
