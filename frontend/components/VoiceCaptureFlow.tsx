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
  onClose?: () => void;
}

export function VoiceCaptureFlow({
  db,
  userId,
  saveMode = "FAST_FORWARD",
  onEntryCreated,
  onClose,
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
  const [voiceService, setVoiceService] =
    useState<VoiceRecognitionService | null>(null);

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

    const service = new VoiceRecognitionService({
      onStateChange: (st) => setVoiceState(st),
      onResult: (liveText) => {
        if (liveText) {
          setTranscript(liveText);
        }
      },
      onError: (err) => setErrorMessage(err),
    });

    setVoiceService(service);
    await service.startListening();
  };

  const handleStopListening = () => {
    if (voiceService) {
      voiceService.stopListening();
    } else {
      setVoiceState("IDLE");
    }

    if (transcript.trim()) {
      handleProcessTranscript(transcript);
    } else {
      setErrorMessage(
        "No se detectó voz del micrófono. Puedes escribir el comando o frase manualmente en la casilla inferior y pulsar Procesar.",
      );
    }
  };

  const handleProcessTranscript = async (rawTranscript: string) => {
    if (!rawTranscript.trim()) {
      setErrorMessage("La transcripción no puede estar vacía.");
      return;
    }

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
    if (!catId || !contentStr.trim()) {
      setErrorMessage("Selecciona una categoría y escribe el contenido.");
      return;
    }

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
      <Text style={styles.title}>Captura Hablada por Voz</Text>

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

      {/* Recording Status Header Banner */}
      <View
        style={[
          styles.statusBanner,
          voiceState === "LISTENING" && styles.statusBannerActive,
        ]}
      >
        <View
          style={[
            styles.statusDot,
            voiceState === "LISTENING" && styles.statusDotActive,
          ]}
        />
        <Text style={styles.stateText}>
          {voiceState === "LISTENING"
            ? "🔴 GRABANDO VOZ... Habla tu comando o nota"
            : voiceState === "PROCESSING"
              ? "⚡ Procesando voz..."
              : "Micrófono listo para dictado"}
        </Text>
      </View>

      {/* Voice Wave Visualizer indicator */}
      {voiceState === "LISTENING" && (
        <View style={styles.waveVisualizer} testID="voice-wave-visualizer">
          <View style={[styles.waveBar, { height: 18 }]} />
          <View style={[styles.waveBar, { height: 36 }]} />
          <View style={[styles.waveBar, { height: 24 }]} />
          <View style={[styles.waveBar, { height: 42 }]} />
          <View style={[styles.waveBar, { height: 30 }]} />
          <View style={[styles.waveBar, { height: 20 }]} />
        </View>
      )}

      {voiceState === "IDLE" || voiceState === "ERROR" ? (
        <Pressable
          testID="btn-start-listening"
          style={styles.listenButton}
          onPress={handleStartListening}
        >
          <Text style={styles.listenButtonText}>
            🎙️ Iniciar Grabación por Voz
          </Text>
        </Pressable>
      ) : (
        <Pressable
          testID="btn-stop-listening"
          style={styles.stopButton}
          onPress={handleStopListening}
        >
          <Text style={styles.stopButtonText}>⏹️ Detener Grabación</Text>
        </Pressable>
      )}

      {/* Transcript Input / Testing */}
      <Text style={styles.label}>Transcripción de Voz</Text>
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
        <Text style={styles.secondaryButtonText}>
          🔍 Procesar Transcripción
        </Text>
      </Pressable>

      {/* Manual preview / correction */}
      {parsedResult &&
        (!parsedResult.isSuccess || saveMode === "PREVIEW_BEFORE_SAVE") && (
          <View style={styles.correctionContainer} testID="correction-section">
            <Text style={styles.sectionTitle}>
              {saveMode === "PREVIEW_BEFORE_SAVE"
                ? "Previsualización antes de Guardar"
                : "Corregir Captura Hablada"}
            </Text>

            <Text style={styles.label}>Categoría Asignada</Text>
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

            <Text style={styles.label}>Contenido de la Entrada</Text>
            <TextInput
              testID="input-manual-content"
              style={styles.inputArea}
              multiline
              value={manualContent}
              onChangeText={setManualContent}
            />

            <View style={styles.actionsRow}>
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
                <Text style={styles.saveButtonText}>
                  💾 Confirmar y Guardar Entrada
                </Text>
              </Pressable>

              {onClose && (
                <Pressable style={styles.cancelButton} onPress={onClose}>
                  <Text style={styles.cancelButtonText}>
                    ❌ Cancelar / Salir
                  </Text>
                </Pressable>
              )}
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
    padding: 20,
    width: "100%",
    maxWidth: 650,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#F8FAFC",
    marginBottom: 12,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  statusBannerActive: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "#EF4444",
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#94A3B8",
  },
  statusDotActive: {
    backgroundColor: "#EF4444",
  },
  stateText: {
    fontSize: 14,
    color: "#F8FAFC",
    fontWeight: "600",
  },
  waveVisualizer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    backgroundColor: "#0F172A",
    borderRadius: 8,
    marginBottom: 14,
  },
  waveBar: {
    width: 6,
    backgroundColor: "#EF4444",
    borderRadius: 3,
  },
  listenButton: {
    backgroundColor: "#38BDF8",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  listenButtonText: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "bold",
  },
  stopButton: {
    backgroundColor: "#EF4444",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  stopButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94A3B8",
    marginBottom: 6,
    marginTop: 10,
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
    minHeight: 90,
    textAlignVertical: "top",
  },
  secondaryButton: {
    backgroundColor: "#334155",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  secondaryButtonText: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "600",
  },
  correctionContainer: {
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#F8FAFC",
    marginBottom: 12,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    backgroundColor: "#1E293B",
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
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#10B981",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  cancelButton: {
    backgroundColor: "#334155",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
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
