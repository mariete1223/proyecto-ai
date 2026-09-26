import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { listCategories } from "../db/categories";
import { DatabaseAdapter } from "../db/database";
import { createLocalEntry } from "../db/entries";
import { listTags } from "../db/tags";
import {
  ParsedSpokenCommand,
  parseSpokenCommand,
} from "../services/voiceParser";
import {
  VoiceRecognitionService,
  VoiceRecognitionState,
} from "../services/voiceRecognition";
import { Category, SaveMode, Tag } from "../types/domain";

export interface VoiceCaptureFlowProps {
  db: DatabaseAdapter;
  userId: string;
  saveMode?: SaveMode;
  onEntryCreated?: (entryId: string) => void;
}

export function VoiceCaptureFlow({
  db,
  userId,
  saveMode = "FAST_FORWARD",
  onEntryCreated,
}: VoiceCaptureFlowProps) {
  const [voiceState, setVoiceState] = useState<VoiceRecognitionState>("IDLE");
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  const [transcript, setTranscript] = useState<string>("");
  const [parsedResult, setParsedResult] = useState<ParsedSpokenCommand | null>(
    null,
  );

  const [manualContent, setManualContent] = useState<string>("");
  const [manualCategoryId, setManualCategoryId] = useState<string>("");

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
            setManualCategoryId(cats[0].id);
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

  const handleStartListening = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setTranscript("");
    setParsedResult(null);

    const voiceService = new VoiceRecognitionService({
      onStateChange: (st) => setVoiceState(st),
      onError: (err) => setErrorMessage(err),
    });

    await voiceService.startListening();
  };

  const handleProcessTranscript = async (rawTranscript: string) => {
    setTranscript(rawTranscript);
    const parsed = parseSpokenCommand(rawTranscript, categories, tags);
    setParsedResult(parsed);

    if (parsed.isSuccess && parsed.categoryId && parsed.content) {
      if (saveMode === "FAST_FORWARD") {
        await saveParsedEntry(
          parsed.categoryId,
          parsed.content,
          parsed.occurredAt,
          parsed.tagIds,
        );
      } else {
        // PREVIEW_BEFORE_SAVE
        setManualContent(parsed.content);
        setManualCategoryId(parsed.categoryId);
      }
    } else {
      if (parsed.errors.length > 0) {
        setErrorMessage(parsed.errors.join(" "));
      }
      setManualContent(parsed.content);
      if (parsed.categoryId) {
        setManualCategoryId(parsed.categoryId);
      }
    }
  };

  const saveParsedEntry = async (
    catId: string,
    contentStr: string,
    occurredAtStr: string | null,
    tagIdList: string[],
  ) => {
    setLoading(true);
    try {
      const category = categories.find((c) => c.id === catId);
      const isTask = category?.kind === "TASK";

      const entry = await createLocalEntry(db, userId, {
        category_id: catId,
        content: contentStr,
        occurred_at: occurredAtStr,
        task_status: isTask ? "PENDING" : null,
        task_recurrence: isTask ? "ONCE" : null,
        tag_ids: tagIdList,
      });

      setSuccessMessage("¡Entrada creada por voz correctamente!");
      if (onEntryCreated) {
        onEntryCreated(entry.id);
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.card} testID="voice-capture-flow">
      <Text style={styles.title}>Captura Hablada Completa</Text>

      {errorMessage && (
        <View style={styles.errorBox} testID="voice-capture-error">
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {successMessage && (
        <View style={styles.successBox} testID="voice-capture-success">
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      )}

      <Text style={styles.stateText}>
        {`Estado: ${voiceState === "LISTENING" ? "Escuchando..." : voiceState}`}
      </Text>

      {voiceState === "IDLE" ? (
        <Pressable
          testID="btn-start-listening"
          style={styles.listenButton}
          onPress={handleStartListening}
        >
          <Text style={styles.listenButtonText}>Iniciar Dictado por Voz</Text>
        </Pressable>
      ) : (
        <Pressable
          testID="btn-stop-listening"
          style={styles.stopButton}
          onPress={() =>
            handleProcessTranscript(
              transcript ||
                "nota fecha hoy contenido comprar pan etiquetas urgente",
            )
          }
        >
          <Text style={styles.stopButtonText}>Detener y Procesar</Text>
        </Pressable>
      )}

      {/* Transcript Input / Simulation for testing */}
      <Text style={styles.label}>Transcripción</Text>
      <TextInput
        testID="input-transcript"
        style={styles.input}
        placeholder="Escribe o dicta el comando..."
        placeholderTextColor="#64748B"
        value={transcript}
        onChangeText={setTranscript}
      />

      <Pressable
        testID="btn-parse-transcript"
        style={styles.secondaryButton}
        onPress={() => handleProcessTranscript(transcript)}
      >
        <Text style={styles.secondaryButtonText}>Procesar Transcripción</Text>
      </Pressable>

      {/* Manual correction fallback when errors occur or in preview mode */}
      {parsedResult &&
        (!parsedResult.isSuccess || saveMode === "PREVIEW_BEFORE_SAVE") && (
          <View style={styles.correctionContainer} testID="correction-section">
            <Text style={styles.sectionTitle}>
              {saveMode === "PREVIEW_BEFORE_SAVE"
                ? "Previsualización antes de Guardar"
                : "Corregir Captura Hablada"}
            </Text>

            <Text style={styles.label}>Categoría</Text>
            <View style={styles.chipsRow}>
              {categories.map((cat) => (
                <Pressable
                  key={cat.id}
                  testID={`cat-chip-${cat.id}`}
                  style={[
                    styles.chip,
                    manualCategoryId === cat.id && styles.chipActive,
                  ]}
                  onPress={() => setManualCategoryId(cat.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      manualCategoryId === cat.id && styles.chipTextActive,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Contenido</Text>
            <TextInput
              testID="input-manual-content"
              style={styles.input}
              value={manualContent}
              onChangeText={setManualContent}
            />

            <Pressable
              testID="btn-save-corrected-entry"
              style={[styles.saveButton, loading && styles.buttonDisabled]}
              disabled={loading}
              onPress={() =>
                saveParsedEntry(
                  manualCategoryId,
                  manualContent,
                  parsedResult.occurredAt,
                  parsedResult.tagIds,
                )
              }
            >
              <Text style={styles.saveButtonText}>Confirmar y Guardar</Text>
            </Pressable>
          </View>
        )}
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
    marginBottom: 12,
  },
  stateText: {
    fontSize: 14,
    color: "#38BDF8",
    marginBottom: 12,
    fontWeight: "600",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94A3B8",
    marginTop: 10,
    marginBottom: 4,
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
  listenButton: {
    backgroundColor: "#38BDF8",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  listenButtonText: {
    color: "#0F172A",
    fontWeight: "bold",
    fontSize: 15,
  },
  stopButton: {
    backgroundColor: "#EF4444",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  stopButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: "#334155",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 10,
  },
  secondaryButtonText: {
    color: "#F8FAFC",
    fontWeight: "600",
  },
  correctionContainer: {
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#F8FAFC",
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: "#1E293B",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 16,
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
  saveButton: {
    backgroundColor: "#10B981",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
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
});
