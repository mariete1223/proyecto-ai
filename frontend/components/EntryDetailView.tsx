import React, { useEffect, useRef, useState } from "react";
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
  formatDateTime,
  formatReminderSummary,
  ReminderRecurrence,
  Tag,
  TaskPriority,
  TaskRecurrence,
  TaskStatus,
} from "../types/domain";
import { DateTimePicker } from "./DateTimePicker";
import { LlmBatchProcessor } from "./LlmBatchProcessor";
import { ReminderConfigSection } from "./ReminderConfigSection";
import { notificationService } from "../services/notificationService";
import { parseVoiceEditCommand } from "../services/voiceEditParser";
import { VoiceRecognitionService } from "../services/voiceRecognition";

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
  const [showLlmProcessor, setShowLlmProcessor] = useState<boolean>(false);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      typeof window.scrollTo === "function"
    ) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const [categoryId, setCategoryId] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [occurredAt, setOccurredAt] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [taskStatus, setTaskStatus] = useState<TaskStatus>("PENDING");
  const [taskRecurrence, setTaskRecurrence] = useState<TaskRecurrence>("ONCE");
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("MEDIUM");

  // Recordatorios y Notificaciones
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(false);
  const [reminderTime, setReminderTime] = useState<string>("");
  const [reminderEndTime, setReminderEndTime] = useState<string>("");
  const [reminderOffsetMinutes, setReminderOffsetMinutes] = useState<number>(0);
  const [reminderRecurrence, setReminderRecurrence] =
    useState<ReminderRecurrence>("NONE");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Edición por Comandos de Voz (#68)
  const [showVoiceEditModal, setShowVoiceEditModal] = useState<boolean>(false);
  const [voiceEditTranscript, setVoiceEditTranscript] = useState<string>("");
  const [isListeningVoiceEdit, setIsListeningVoiceEdit] =
    useState<boolean>(false);
  const [voiceEditFeedback, setVoiceEditFeedback] = useState<string | null>(
    null,
  );
  const voiceServiceRef = useRef<VoiceRecognitionService | null>(null);

  const handleApplyVoiceEdit = async (commandText: string) => {
    if (!commandText.trim()) return;
    const result = parseVoiceEditCommand(commandText, entry);
    if (!result.hasChanges) {
      setVoiceEditFeedback(
        "No se detectaron cambios reconocibles. Prueba diciendo: 'cambiar hora a las 18:00', 'poner título...' o 'poner aviso...'",
      );
      return;
    }

    try {
      setLoading(true);
      const updatePayload: Record<string, any> = {};
      if (result.changes.title !== undefined) {
        updatePayload.title = result.changes.title;
        setTitle(result.changes.title);
      }
      if (result.changes.occurred_at !== undefined) {
        updatePayload.occurred_at = result.changes.occurred_at;
        setOccurredAt(result.changes.occurred_at);
      }
      if (result.changes.content !== undefined) {
        updatePayload.content = result.changes.content;
        setContent(result.changes.content);
      }
      if (result.changes.reminder_enabled !== undefined) {
        updatePayload.reminder_enabled = result.changes.reminder_enabled;
        setReminderEnabled(result.changes.reminder_enabled);
      }
      if (result.changes.reminder_time !== undefined) {
        updatePayload.reminder_time = result.changes.reminder_time;
        setReminderTime(result.changes.reminder_time);
      }
      if (result.changes.reminder_offset_minutes !== undefined) {
        updatePayload.reminder_offset_minutes =
          result.changes.reminder_offset_minutes;
        setReminderOffsetMinutes(result.changes.reminder_offset_minutes);
      }
      if (result.changes.reminder_offsets_minutes !== undefined) {
        updatePayload.reminder_offsets_minutes =
          result.changes.reminder_offsets_minutes;
      }
      if (result.changes.reminder_recurrence !== undefined) {
        updatePayload.reminder_recurrence = result.changes.reminder_recurrence;
        setReminderRecurrence(result.changes.reminder_recurrence);
      }

      const updated = await updateLocalEntry(
        db,
        userId,
        entryId,
        updatePayload,
      );
      if (updated.reminder_enabled) {
        notificationService.scheduleForEntry(updated);
      } else if (result.changes.reminder_enabled === false) {
        notificationService.cancelNotification(updated.id);
      }

      setEntry(updated);
      setSuccessMessage(
        `¡Edición por voz aplicada con éxito! ${result.actions.join(" · ")}`,
      );
      setShowVoiceEditModal(false);
      setVoiceEditTranscript("");
      setVoiceEditFeedback(null);
      if (onUpdated) {
        onUpdated(updated);
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVoiceListening = async () => {
    if (isListeningVoiceEdit) {
      voiceServiceRef.current?.stopListening();
      setIsListeningVoiceEdit(false);
      if (voiceEditTranscript.trim()) {
        handleApplyVoiceEdit(voiceEditTranscript);
      }
    } else {
      setVoiceEditFeedback(null);
      const service = new VoiceRecognitionService({
        onResult: (liveText) => {
          setVoiceEditTranscript(liveText);
        },
        onError: (err) => {
          setVoiceEditFeedback(`Error micrófono: ${err}`);
          setIsListeningVoiceEdit(false);
        },
        onStateChange: (st) => {
          if (st === "LISTENING") setIsListeningVoiceEdit(true);
          if (st === "IDLE" || st === "ERROR") setIsListeningVoiceEdit(false);
        },
      });
      voiceServiceRef.current = service;
      await service.startListening();
    }
  };

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
            setTitle(ent.title ?? "");
            setOccurredAt(ent.occurred_at ?? "");
            setContent(ent.content);
            setSelectedTagIds(ent.tag_ids);
            if (ent.task_status) setTaskStatus(ent.task_status);
            if (ent.task_recurrence) setTaskRecurrence(ent.task_recurrence);
            if (ent.task_priority) setTaskPriority(ent.task_priority);
            setReminderEnabled(!!ent.reminder_enabled);
            setReminderTime(ent.reminder_time ?? "");
            setReminderEndTime(ent.reminder_end_time ?? "");
            setReminderOffsetMinutes(ent.reminder_offset_minutes ?? 0);
            setReminderRecurrence(
              (ent.reminder_recurrence as ReminderRecurrence) || "NONE",
            );
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
        title: title.trim() ? title.trim() : null,
        content: content.trim(),
        occurred_at: occurredAt.trim() ? occurredAt.trim() : null,
        task_status: isTaskCategory ? taskStatus : null,
        task_recurrence: isTaskCategory ? taskRecurrence : null,
        task_priority: isTaskCategory ? taskPriority : null,
        reminder_enabled: reminderEnabled,
        reminder_time: reminderTime.trim() ? reminderTime.trim() : null,
        reminder_end_time: reminderEndTime.trim()
          ? reminderEndTime.trim()
          : null,
        reminder_recurrence: reminderRecurrence,
        reminder_offset_minutes: reminderOffsetMinutes,
        tag_ids: selectedTagIds,
      });

      // Programar o cancelar en el servicio de notificaciones
      if (reminderEnabled) {
        notificationService.scheduleForEntry(updated);
      } else {
        notificationService.cancelNotification(updated.id);
      }

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
        <Text style={styles.title}>📄 Detalle de Entrada</Text>
        {onClose && (
          <Pressable
            testID="btn-close-detail"
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>✕ Cerrar</Text>
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
          {/* Category, Task Status, and Priority Badges */}
          <View style={styles.metaRow}>
            <View
              style={[
                styles.categoryPill,
                {
                  backgroundColor: `${entryCategory?.color || "#38BDF8"}18`,
                  borderColor: `${entryCategory?.color || "#38BDF8"}55`,
                },
              ]}
            >
              <View
                style={[
                  styles.categoryDot,
                  { backgroundColor: entryCategory?.color || "#38BDF8" },
                ]}
              />
              <Text
                style={[
                  styles.categoryName,
                  { color: entryCategory?.color || "#38BDF8" },
                ]}
              >
                {entryCategory?.name || "Sin Categoría"}
              </Text>
            </View>

            {entry.task_status && (
              <View style={styles.taskBadge}>
                <Text style={styles.taskBadgeText}>{entry.task_status}</Text>
              </View>
            )}

            {entry.task_priority && (
              <View
                testID="detail-task-priority-badge"
                style={[
                  styles.priorityPill,
                  entry.task_priority === "HIGH" && styles.priorityBadgeHigh,
                  entry.task_priority === "MEDIUM" &&
                    styles.priorityBadgeMedium,
                  entry.task_priority === "LOW" && styles.priorityBadgeLow,
                ]}
              >
                <Text
                  style={[
                    styles.priorityText,
                    entry.task_priority === "HIGH" && { color: "#FCA5A5" },
                    entry.task_priority === "MEDIUM" && { color: "#FCD34D" },
                    entry.task_priority === "LOW" && { color: "#93C5FD" },
                  ]}
                >
                  {entry.task_priority === "HIGH"
                    ? "🔴 Prioridad Alta"
                    : entry.task_priority === "LOW"
                      ? "🔵 Prioridad Baja"
                      : "🟡 Prioridad Media"}
                </Text>
              </View>
            )}
          </View>

          {/* Title */}
          {entry.title ? (
            <Text style={styles.entryTitleText} testID="entry-title-text">
              📌 {entry.title}
            </Text>
          ) : null}

          {/* Content Card with Accent Border */}
          <View
            style={[
              styles.contentCard,
              { borderLeftColor: entryCategory?.color || "#38BDF8" },
            ]}
          >
            <Text style={styles.contentBody}>{entry.content}</Text>
          </View>

          {/* Metadata Cards Grid */}
          <View style={styles.metaGrid}>
            <View style={styles.metaItemCard}>
              <Text style={styles.metaCardLabel}>📅 Fecha Asignada</Text>
              {entry.occurred_at ? (
                <Text
                  style={styles.metaTextAssigned}
                  testID="entry-occurred-at"
                >
                  {formatDateTime(entry.occurred_at)}
                </Text>
              ) : (
                <Text style={styles.metaTextSubtle}>Sin fecha asignada</Text>
              )}
            </View>

            <View style={styles.metaItemCard}>
              <Text style={styles.metaCardLabel}>🕒 Fecha de Creación</Text>
              <Text style={styles.metaText} testID="entry-created-at">
                {formatDateTime(entry.created_at)}
              </Text>
            </View>
          </View>

          {/* Reminder Box if Enabled */}
          {entry.reminder_enabled ? (
            <View
              style={styles.reminderActiveBox}
              testID="entry-reminder-banner"
            >
              <Text style={styles.reminderActiveText}>
                🔔 Recordatorio activo: {formatReminderSummary(entry)}
              </Text>
            </View>
          ) : null}

          {/* Tags Section */}
          {entry.tag_ids.length > 0 && (
            <View style={styles.tagsSection}>
              <View style={styles.tagsRow}>
                {entry.tag_ids.map((tid) => {
                  const t = tagMap.get(tid);
                  if (!t) return null;
                  const tagColor = t.color || "#38BDF8";
                  return (
                    <View
                      key={tid}
                      style={[
                        styles.tagBadge,
                        {
                          backgroundColor: `${tagColor}20`,
                          borderColor: `${tagColor}66`,
                        },
                      ]}
                      testID={`detail-tag-badge-${tid}`}
                    >
                      <View
                        style={[
                          styles.tagDotSmall,
                          { backgroundColor: tagColor },
                        ]}
                      />
                      <Text style={[styles.tagBadgeText, { color: tagColor }]}>
                        {`#${t.name}`}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Voice Edit Help & Action Banner (#68) */}
          <View style={styles.voiceGuideCard} testID="voice-edit-guide-card">
            <View style={styles.voiceGuideHeader}>
              <Text style={styles.voiceGuideTitle}>
                🎙️ Edición Inteligente por Voz
              </Text>
              <Pressable
                testID="btn-voice-edit-entry"
                style={[
                  styles.voiceGuideActionBtn,
                  isListeningVoiceEdit && styles.voiceGuideActionBtnActive,
                ]}
                onPress={() => setShowVoiceEditModal((prev) => !prev)}
              >
                <Text style={styles.voiceGuideActionBtnText}>
                  {showVoiceEditModal
                    ? "✕ Cerrar Dictado"
                    : "🎤 Dictar Cambios"}
                </Text>
              </Pressable>
            </View>
            {successMessage ? (
              <View
                style={styles.voiceSuccessPill}
                testID="voice-edit-inline-success"
              >
                <Text style={styles.voiceSuccessText}>✅ {successMessage}</Text>
              </View>
            ) : null}
            <Text style={styles.voiceGuideDesc}>
              Modifica la hora, el título o el recordatorio de esta entrada con
              tu voz:
            </Text>
            <View style={styles.voiceGuideExamples}>
              <Text style={styles.voiceGuideExampleItem}>
                ⏰{" "}
                <Text style={styles.voiceGuideExampleBold}>Cambiar hora:</Text>{" "}
                "cambiar la hora a las 18:30" o "poner a las 5 de la tarde"
              </Text>
              <Text style={styles.voiceGuideExampleItem}>
                📌{" "}
                <Text style={styles.voiceGuideExampleBold}>Poner título:</Text>{" "}
                "poner título Comprar víveres" o "título: Reunión Urgente"
              </Text>
              <Text style={styles.voiceGuideExampleItem}>
                🔔 <Text style={styles.voiceGuideExampleBold}>Avisos:</Text>{" "}
                "poner aviso 15 minutos antes", "aviso cada 4 horas" o "quitar
                aviso"
              </Text>
            </View>

            {showVoiceEditModal && (
              <View
                style={styles.voiceEditModalPanel}
                testID="voice-edit-panel"
              >
                <Text style={styles.voiceEditModalLabel}>
                  {isListeningVoiceEdit
                    ? "🔴 Escuchando... Di tus cambios:"
                    : "Escribe o dicta tu comando de edición:"}
                </Text>
                <View style={styles.voiceEditInputRow}>
                  <TextInput
                    style={styles.voiceEditInput}
                    placeholder="Ej: poner título Revisión y cambiar la hora a las 17:00"
                    placeholderTextColor="#64748B"
                    value={voiceEditTranscript}
                    onChangeText={setVoiceEditTranscript}
                    testID="input-voice-edit-transcript"
                  />
                  <Pressable
                    style={[
                      styles.voiceMicBtn,
                      isListeningVoiceEdit && styles.voiceMicBtnActive,
                    ]}
                    onPress={handleToggleVoiceListening}
                    testID="btn-toggle-mic-edit"
                  >
                    <Text style={styles.voiceMicBtnText}>
                      {isListeningVoiceEdit ? "⏹️ Parar" : "🎙️ Hablar"}
                    </Text>
                  </Pressable>
                </View>
                {voiceEditFeedback ? (
                  <Text style={styles.voiceEditFeedbackText}>
                    {voiceEditFeedback}
                  </Text>
                ) : null}
                <View style={styles.voiceEditActionsRow}>
                  <Pressable
                    style={styles.voiceApplyBtn}
                    onPress={() => handleApplyVoiceEdit(voiceEditTranscript)}
                    testID="btn-apply-voice-edit"
                  >
                    <Text style={styles.voiceApplyBtnText}>
                      ⚡ Aplicar Cambio
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>

          {/* Action Buttons Row */}
          <View style={styles.buttonRow}>
            <Pressable
              testID="btn-start-edit-entry"
              style={styles.editButton}
              onPress={() => setIsEditing(true)}
            >
              <Text style={styles.editButtonText}>✏️ Editar Entrada</Text>
            </Pressable>

            <Pressable
              testID="btn-open-llm-from-detail"
              style={styles.aiButton}
              onPress={() => setShowLlmProcessor(!showLlmProcessor)}
            >
              <Text style={styles.aiButtonText}>
                {showLlmProcessor ? "✕ Cerrar IA" : "🤖 Estructurar con IA"}
              </Text>
            </Pressable>

            <Pressable
              testID="btn-prompt-delete-entry"
              style={styles.deleteButton}
              onPress={() => setIsDeleting(true)}
            >
              <Text style={styles.deleteButtonText}>🗑️ Eliminar</Text>
            </Pressable>
          </View>

          {showLlmProcessor && (
            <View style={{ marginTop: 14 }}>
              <LlmBatchProcessor
                db={db}
                userId={userId}
                initialText={entry.content}
                onClose={() => setShowLlmProcessor(false)}
                onImportCompleted={() => {
                  setShowLlmProcessor(false);
                  if (onUpdated) {
                    onUpdated(entry);
                  }
                }}
              />
            </View>
          )}
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

          <Text style={styles.label}>Título (Opcional)</Text>
          <TextInput
            testID="input-edit-title"
            style={styles.input}
            placeholder="Escribe un título..."
            placeholderTextColor="#64748B"
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.label}>Contenido</Text>
          <TextInput
            testID="input-edit-content"
            style={[styles.input, { minHeight: 80 }]}
            multiline
            value={content}
            onChangeText={setContent}
          />

          <DateTimePicker
            testID="input-edit-date"
            value={occurredAt}
            onChange={setOccurredAt}
            label="Fecha y Hora de la Entrada"
          />

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

              <Text style={styles.label}>Prioridad de Tarea</Text>
              <View style={styles.chipsContainer}>
                {(
                  [
                    {
                      id: "HIGH",
                      label: "🔴 Alta",
                      testId: "edit-priority-HIGH",
                    },
                    {
                      id: "MEDIUM",
                      label: "🟡 Media",
                      testId: "edit-priority-MEDIUM",
                    },
                    {
                      id: "LOW",
                      label: "🔵 Baja",
                      testId: "edit-priority-LOW",
                    },
                  ] as const
                ).map((p) => (
                  <Pressable
                    key={p.id}
                    testID={p.testId}
                    style={[
                      styles.chip,
                      taskPriority === p.id && styles.chipActive,
                    ]}
                    onPress={() => setTaskPriority(p.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        taskPriority === p.id && styles.chipTextActive,
                      ]}
                    >
                      {p.label}
                    </Text>
                  </Pressable>
                ))}
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
    backgroundColor: "transparent",
    borderRadius: 0,
    padding: 0,
    width: "100%",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#F8FAFC",
    letterSpacing: 0.3,
  },
  closeButton: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  closeButtonText: {
    color: "#F87171",
    fontSize: 12,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: "700",
  },
  taskBadge: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderColor: "rgba(56, 189, 248, 0.35)",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  taskBadgeText: {
    color: "#38BDF8",
    fontSize: 11,
    fontWeight: "800",
  },
  priorityPill: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: "700",
  },
  priorityBadgeHigh: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "#EF4444",
  },
  priorityBadgeMedium: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderColor: "#F59E0B",
  },
  priorityBadgeLow: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    borderColor: "#3B82F6",
  },
  entryTitleText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#38BDF8",
    marginTop: 4,
    marginBottom: 6,
  },
  contentCard: {
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    borderColor: "rgba(51, 65, 85, 0.7)",
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 10,
    padding: 16,
    marginVertical: 10,
  },
  contentBody: {
    fontSize: 15,
    color: "#F1F5F9",
    lineHeight: 24,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginVertical: 10,
  },
  metaItemCard: {
    flex: 1,
    minWidth: 130,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderColor: "rgba(51, 65, 85, 0.7)",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  metaCardLabel: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaText: {
    fontSize: 13,
    color: "#CBD5E1",
    fontWeight: "600",
  },
  metaTextAssigned: {
    fontSize: 13,
    fontWeight: "700",
    color: "#38BDF8",
  },
  metaTextSubtle: {
    fontSize: 13,
    color: "#64748B",
    fontStyle: "italic",
  },
  tagsSection: {
    marginTop: 6,
    marginBottom: 8,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tagBadgeText: {
    fontSize: 12,
    fontWeight: "700",
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
    flexWrap: "wrap",
    gap: 10,
    marginTop: 18,
    justifyContent: "flex-end",
  },
  editButton: {
    backgroundColor: "#38BDF8",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  editButtonText: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 13,
  },
  deleteButton: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "rgba(239, 68, 68, 0.4)",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  deleteButtonText: {
    color: "#FCA5A5",
    fontWeight: "700",
    fontSize: 13,
  },
  aiButton: {
    backgroundColor: "#6366F1",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  aiButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
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
  reminderActiveBox: {
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderColor: "rgba(56, 189, 248, 0.35)",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
  },
  reminderActiveText: {
    color: "#38bdf8",
    fontSize: 12,
    fontWeight: "600",
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
  voiceGuideCard: {
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
    borderRadius: 12,
    padding: 14,
    marginVertical: 12,
  },
  voiceGuideHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    flexWrap: "wrap",
    gap: 8,
  },
  voiceGuideTitle: {
    color: "#38BDF8",
    fontSize: 14,
    fontWeight: "700",
  },
  voiceGuideActionBtn: {
    backgroundColor: "rgba(56, 189, 248, 0.2)",
    borderWidth: 1,
    borderColor: "#38BDF8",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  voiceGuideActionBtnActive: {
    backgroundColor: "rgba(239, 68, 68, 0.3)",
    borderColor: "#EF4444",
  },
  voiceGuideActionBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  voiceSuccessPill: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderWidth: 1,
    borderColor: "#10B981",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  voiceSuccessText: {
    color: "#6EE7B7",
    fontSize: 12,
    fontWeight: "600",
  },
  voiceGuideDesc: {
    color: "#CBD5E1",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  voiceGuideExamples: {
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  voiceGuideExampleItem: {
    color: "#94A3B8",
    fontSize: 11,
    lineHeight: 16,
  },
  voiceGuideExampleBold: {
    color: "#F1F5F9",
    fontWeight: "700",
  },
  voiceEditModalPanel: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(56, 189, 248, 0.2)",
  },
  voiceEditModalLabel: {
    color: "#F8FAFC",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  voiceEditInputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  voiceEditInput: {
    flex: 1,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.4)",
    borderRadius: 8,
    color: "#F8FAFC",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  voiceMicBtn: {
    backgroundColor: "#0284C7",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  voiceMicBtnActive: {
    backgroundColor: "#DC2626",
  },
  voiceMicBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  voiceEditFeedbackText: {
    color: "#F87171",
    fontSize: 11,
    marginTop: 4,
  },
  voiceEditActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
  },
  voiceApplyBtn: {
    backgroundColor: "#10B981",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  voiceApplyBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
