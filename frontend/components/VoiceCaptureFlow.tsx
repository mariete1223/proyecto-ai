import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CANONICAL_CATEGORIES, listCategories } from "../db/categories";
import { DatabaseAdapter } from "../db/database";
import { createLocalEntry } from "../db/entries";
import { listTags } from "../db/tags";
import {
  ParsedSpokenCommand,
  parseSpokenCommand,
} from "../services/voiceParser";
import { notificationService } from "../services/notificationService";
import {
  VoiceRecognitionService,
  VoiceRecognitionState,
} from "../services/voiceRecognition";
import {
  Category,
  normalizeTagName,
  normalizeUtcIso,
  SaveMode,
  Tag,
  TaskPriority,
  toLocalDateString,
} from "../types/domain";

function isCategoryAlert(cat?: Category | null): boolean {
  if (!cat) return false;
  return (
    cat.id === CANONICAL_CATEGORIES.ALERTA.id ||
    cat.name_normalized === "alerta" ||
    cat.voice_command_normalized === "alerta" ||
    cat.name?.toLowerCase() === "alerta"
  );
}

export interface VoiceCaptureFlowProps {
  db: DatabaseAdapter;
  userId: string;
  defaultDate?: Date;
  saveMode?: SaveMode;
  onEntryCreated?: (entryId: string) => void | Promise<void>;
  onClose?: () => void;
}

export function VoiceCaptureFlow({
  db,
  userId,
  defaultDate,
  saveMode = "FAST_FORWARD",
  onEntryCreated,
  onClose,
}: VoiceCaptureFlowProps) {
  const [voiceState, setVoiceState] = useState<VoiceRecognitionState>("IDLE");
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  const [currentStep, setCurrentStep] = useState<"DICTATE" | "RESULT">(
    "DICTATE",
  );
  const [transcript, setTranscript] = useState<string>("");
  const transcriptRef = useRef<string>("");
  const [parsedResult, setParsedResult] = useState<ParsedSpokenCommand | null>(
    null,
  );

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      typeof window.scrollTo === "function"
    ) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const [manualTitle, setManualTitle] = useState<string>("");
  const [manualContent, setManualContent] = useState<string>("");
  const [manualCategoryId, setManualCategoryId] = useState<string>("");
  const [manualDateStr, setManualDateStr] = useState<string>(
    defaultDate ? toLocalDateString(defaultDate) : "",
  );
  const [manualTimeStr, setManualTimeStr] = useState<string>("12:00");
  const [manualPriority, setManualPriority] = useState<TaskPriority>("MEDIUM");

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

  const uniqueTags = useMemo(() => {
    const seen = new Set<string>();
    return tags.filter((t) => {
      const norm = t.name_normalized || normalizeTagName(t.name);
      if (seen.has(norm)) return false;
      seen.add(norm);
      return true;
    });
  }, [tags]);

  useEffect(() => {
    return () => {
      if (voiceService) {
        voiceService.cancel();
      }
    };
  }, [voiceService]);

  const liveParsed = useMemo(() => {
    if (!transcript || !transcript.trim()) return null;
    try {
      return parseSpokenCommand(transcript, categories, tags, defaultDate);
    } catch {
      return null;
    }
  }, [transcript, categories, tags, defaultDate]);

  const setQuickDate = (daysFromToday: number | null) => {
    if (daysFromToday === null) {
      setManualDateStr("");
      return;
    }
    const d = new Date();
    d.setDate(d.getDate() + daysFromToday);
    setManualDateStr(toLocalDateString(d));
  };

  const handleSelectCategory = (catId: string) => {
    setManualCategoryId(catId);
    const cat = categories.find((c) => c.id === catId);
    if (isCategoryAlert(cat) && !manualDateStr) {
      setManualDateStr(toLocalDateString());
    }
  };

  const webPickerInputStyle: React.CSSProperties = {
    backgroundColor: "#0f172a",
    color: "#ffffff",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    borderRadius: "8px",
    padding: "0 10px",
    fontSize: "14px",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    fontWeight: "600",
    colorScheme: "dark",
    outline: "none",
    width: "100%",
    minWidth: 0,
    maxWidth: "100%",
    height: "44px",
    minHeight: "44px",
    maxHeight: "44px",
    lineHeight: "44px",
    boxSizing: "border-box",
    cursor: "pointer",
    textAlign: "center",
    WebkitAppearance: "none",
  };

  const buildOccurredAtIso = (): string | null => {
    if (!manualDateStr.trim()) return null;
    try {
      const timeParts = manualTimeStr.trim().split(":");
      const h = parseInt(timeParts[0], 10) || 0;
      const m = parseInt(timeParts[1], 10) || 0;
      const cleanDate = manualDateStr.trim();
      let y: number, mon: number, day: number;
      if (cleanDate.includes("-")) {
        const dateParts = cleanDate.split("-");
        y = parseInt(dateParts[0], 10);
        mon = parseInt(dateParts[1], 10);
        day = parseInt(dateParts[2], 10);
      } else if (cleanDate.includes("/")) {
        const dateParts = cleanDate.split("/");
        if (dateParts[0].length === 4) {
          y = parseInt(dateParts[0], 10);
          mon = parseInt(dateParts[1], 10);
          day = parseInt(dateParts[2], 10);
        } else {
          day = parseInt(dateParts[0], 10);
          mon = parseInt(dateParts[1], 10);
          y = parseInt(dateParts[2], 10);
        }
      } else {
        return null;
      }
      if (isNaN(y) || isNaN(mon) || isNaN(day)) return null;
      const d = new Date(y, mon - 1, day, h, m, 0, 0);
      if (isNaN(d.getTime())) return null;
      return d.toISOString();
    } catch {
      return null;
    }
  };

  const handleStartListening = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setTranscript("");
    transcriptRef.current = "";
    setParsedResult(null);
    setCurrentStep("DICTATE");

    const service = new VoiceRecognitionService({
      onStateChange: (st) => setVoiceState(st),
      onResult: (liveText) => {
        if (liveText) {
          transcriptRef.current = liveText;
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

    const currentTranscript = transcriptRef.current || transcript;
    if (currentTranscript.trim()) {
      handleProcessTranscript(currentTranscript);
    } else {
      setErrorMessage(
        "No se detectó voz del micrófono. Pulsa para dictar o escribe en la casilla y pulsa Detener y Procesar.",
      );
    }
  };

  const handleProcessTranscript = async (rawTranscript: string) => {
    if (!rawTranscript.trim()) {
      setErrorMessage("La transcripción no puede estar vacía.");
      return;
    }

    setTranscript(rawTranscript);
    transcriptRef.current = rawTranscript;
    const parsed = parseSpokenCommand(
      rawTranscript,
      categories,
      tags,
      defaultDate,
    );

    if (!parsed.occurredAt && defaultDate) {
      const d = new Date(defaultDate);
      parsed.occurredAt = d.toISOString();
    }
    setParsedResult(parsed);

    const isAlertParsed =
      parsed.categoryId &&
      categories.some((c) => c.id === parsed.categoryId && isCategoryAlert(c));

    if (parsed.occurredAt) {
      const norm = normalizeUtcIso(parsed.occurredAt) || parsed.occurredAt;
      const d = new Date(norm);
      setManualDateStr(toLocalDateString(d));
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      setManualTimeStr(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
    } else if (isAlertParsed) {
      setManualDateStr(toLocalDateString(new Date()));
      setManualTimeStr("12:00");
    } else {
      setManualDateStr(defaultDate ? toLocalDateString(defaultDate) : "");
      setManualTimeStr("12:00");
    }

    if (parsed.taskPriority) {
      setManualPriority(parsed.taskPriority);
    }

    if (parsed.title) {
      setManualTitle(parsed.title);
    } else {
      setManualTitle("");
    }

    if (parsed.content) {
      setManualContent(parsed.content);
    }

    if (parsed.categoryId) {
      setManualCategoryId(parsed.categoryId);
    } else {
      setManualCategoryId("");
    }

    if (parsed.isSuccess && parsed.categoryId && parsed.content) {
      if (saveMode === "FAST_FORWARD") {
        await saveParsedEntry(
          parsed.categoryId,
          parsed.content,
          parsed.occurredAt,
          parsed.tagIds,
          parsed.taskPriority,
          parsed.title,
          parsed.reminderEnabled,
          parsed.reminderOffsetMinutes,
          parsed.reminderOffsetsMinutes,
        );
      }
    } else {
      if (parsed.errors.length > 0) {
        setErrorMessage(parsed.errors.join(" "));
      }
    }

    setCurrentStep("RESULT");
    if (
      typeof window !== "undefined" &&
      typeof window.scrollTo === "function"
    ) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const saveParsedEntry = async (
    catId: string,
    contentStr: string,
    occurredAtStr: string | null,
    tagIdList: string[],
    priority?: TaskPriority | null,
    titleStr?: string | null,
    remEnabled?: boolean | null,
    remOffsetMins?: number | null,
    remOffsetsMins?: number[] | null,
  ) => {
    if (!catId || !contentStr.trim()) {
      setErrorMessage("Selecciona una categoría y escribe el contenido.");
      return;
    }

    setLoading(true);
    try {
      const category = categories.find((c) => c.id === catId);
      const isAlert = isCategoryAlert(category);
      const isTask = category?.kind === "TASK" && !isAlert;
      const finalTitle =
        titleStr !== undefined
          ? titleStr && titleStr.trim()
            ? titleStr.trim()
            : null
          : manualTitle.trim()
            ? manualTitle.trim()
            : null;

      let finalOccurredAt = occurredAtStr;
      if (isAlert && !finalOccurredAt) {
        const [h, m] = (manualTimeStr || "12:00")
          .split(":")
          .map((v) => parseInt(v, 10) || 0);
        const now = new Date();
        now.setHours(h, m, 0, 0);
        finalOccurredAt = now.toISOString();
      }

      const finalRemEnabled = isAlert ? true : (remEnabled ?? null);
      const finalRemOffsetMins = isAlert ? 0 : (remOffsetMins ?? null);
      const finalRemOffsetsMins = isAlert ? [0] : (remOffsetsMins ?? null);

      const entry = await createLocalEntry(db, userId, {
        category_id: catId,
        title: finalTitle,
        content: contentStr,
        occurred_at: finalOccurredAt,
        task_status: isTask ? "PENDING" : null,
        task_recurrence: isTask ? "ONCE" : null,
        task_priority: isTask ? (priority ?? manualPriority ?? "MEDIUM") : null,
        reminder_enabled: finalRemEnabled,
        reminder_offset_minutes: finalRemOffsetMins,
        reminder_offsets_minutes: finalRemOffsetsMins,
        tag_ids: tagIdList,
      });

      if (entry.reminder_enabled) {
        notificationService.scheduleForEntry(entry);
      }

      setSuccessMessage("¡Entrada creada por voz correctamente!");
      if (onEntryCreated) {
        await onEntryCreated(entry.id);
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const isQuickSaveDisabled =
    loading || !parsedResult?.isSuccess || !parsedResult?.categoryId;

  const isManualSaveDisabled =
    loading || !manualCategoryId || !manualContent.trim();

  const showLiveDictation =
    voiceState === "LISTENING" ||
    voiceState === "PROCESSING" ||
    Boolean(transcript.trim());

  const handleResetVoiceCapture = () => {
    if (voiceService) {
      voiceService.cancel();
    }
    setVoiceState("IDLE");
    setTranscript("");
    transcriptRef.current = "";
    setParsedResult(null);
    setManualCategoryId("");
    setManualTitle("");
    setManualContent("");
    setManualDateStr("");
    setManualTimeStr("12:00");
    setErrorMessage(null);
    setSuccessMessage(null);
    setCurrentStep("DICTATE");
    if (
      typeof window !== "undefined" &&
      typeof window.scrollTo === "function"
    ) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <View style={styles.card} testID="voice-capture-flow">
      {/* Top Header with title and step indicator badge (#85) */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          {currentStep === "RESULT" && (
            <Text style={styles.title}>Resultado del Dictado</Text>
          )}
          <View
            style={[
              styles.stepBadge,
              currentStep === "RESULT" && styles.stepBadgeResult,
            ]}
          >
            <Text
              style={[
                styles.stepBadgeText,
                currentStep === "RESULT" && styles.stepBadgeTextResult,
              ]}
            >
              {currentStep === "DICTATE"
                ? "Paso 1 de 2: Dictado"
                : "Paso 2 de 2: Revisión"}
            </Text>
          </View>
        </View>
      </View>

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

      {currentStep === "DICTATE" ? (
        /* SCREEN 1: DICTATE SCREEN */
        <View style={styles.screenContainer}>
          {/* Hero Voice Dictation Button - Rendered first (#89) */}
          <View style={styles.heroButtonContainer}>
            {voiceState === "LISTENING" || Boolean(transcript.trim()) ? (
              <Pressable
                testID="btn-stop-listening"
                style={styles.heroStopButton}
                onPress={handleStopListening}
              >
                <View style={styles.heroButtonContent}>
                  <Text style={styles.heroButtonIcon}>⏹️</Text>
                  <View style={styles.heroButtonTextCol}>
                    <Text style={styles.heroStopButtonTitle}>
                      Detener y Procesar
                    </Text>
                    <Text style={styles.heroStopButtonSubtitle}>
                      Toca para finalizar la grabación y ver el resultado
                    </Text>
                  </View>
                </View>
              </Pressable>
            ) : (
              <Pressable
                testID="btn-start-listening"
                style={styles.heroListenButton}
                onPress={handleStartListening}
              >
                <View style={styles.heroButtonContent}>
                  <Text style={styles.heroButtonIcon}>🎙️</Text>
                  <View style={styles.heroButtonTextCol}>
                    <Text style={styles.heroButtonTitle}>Toca para Dictar</Text>
                    <Text style={styles.heroButtonSubtitle}>
                      Presiona aquí y habla con comandos o texto libre
                    </Text>
                  </View>
                </View>
              </Pressable>
            )}
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

          {/* Live Dictation Display Box - Simplified and Real-Time (#85, #89) */}
          {showLiveDictation ? (
            <View style={styles.liveDictationBox} testID="live-dictation-box">
              <View style={styles.liveDictationHeaderRow}>
                {voiceState === "LISTENING" ? (
                  <View style={styles.liveListeningBadge}>
                    <View style={styles.pulsingDot} />
                    <Text style={styles.liveListeningBadgeText}>
                      EN DIRECTO
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.liveDictationSubtleLabel}>
                    Transcripción en directo
                  </Text>
                )}

                {/* Real-time detected entity breakdown (#85, #95) */}
                {liveParsed &&
                  (liveParsed.categoryName ||
                    liveParsed.occurredAt ||
                    (liveParsed.tagNames &&
                      liveParsed.tagNames.length > 0)) && (
                    <View
                      style={styles.liveParsedEntitiesRow}
                      testID="live-parsed-entities"
                    >
                      {liveParsed.categoryName && (
                        <View style={styles.liveEntityBadge}>
                          <Text style={styles.liveEntityBadgeText}>
                            📁 {liveParsed.categoryName}
                          </Text>
                        </View>
                      )}
                      {liveParsed.occurredAt && (
                        <View style={styles.liveEntityBadge}>
                          <Text style={styles.liveEntityBadgeText}>
                            📅 {liveParsed.occurredAt.split("T")[0]}
                          </Text>
                        </View>
                      )}
                      {liveParsed.tagNames &&
                        liveParsed.tagNames.map((tag) => (
                          <View key={tag} style={styles.liveEntityTagBadge}>
                            <Text style={styles.liveEntityTagBadgeText}>
                              #{tag}
                            </Text>
                          </View>
                        ))}
                    </View>
                  )}
              </View>

              <View style={styles.manualTranscriptRow}>
                <TextInput
                  testID="input-transcript"
                  style={styles.transcriptInput}
                  placeholder="Escribe o edita el texto aquí..."
                  placeholderTextColor="#64748B"
                  value={transcript}
                  multiline={true}
                  numberOfLines={3}
                  scrollEnabled={true}
                  selection={
                    voiceState === "LISTENING"
                      ? { start: transcript.length, end: transcript.length }
                      : undefined
                  }
                  onChangeText={(text) => {
                    transcriptRef.current = text;
                    setTranscript(text);
                  }}
                />
              </View>
            </View>
          ) : (
            <TextInput
              testID="input-transcript"
              style={{ width: 0, height: 0, opacity: 0, position: "absolute" }}
              value={transcript}
              onChangeText={(text) => {
                transcriptRef.current = text;
                setTranscript(text);
              }}
            />
          )}

          {/* Mobile Keyboard Dictation Notice if WebSpeech is unsupported in Expo Go */}
          {typeof window !== "undefined" &&
            !(
              "SpeechRecognition" in window ||
              "webkitSpeechRecognition" in window
            ) && (
              <View
                style={styles.mobileDictationHintBox}
                testID="mobile-dictation-hint"
              >
                <Text style={styles.mobileDictationHintText}>
                  💡{" "}
                  <Text style={{ fontWeight: "700" }}>Dictado por Móvil:</Text>{" "}
                  En Expo Go (iOS), toca la casilla superior de texto y presiona
                  el ícono de micrófono 🎙️ en la barra espaciadora de tu teclado
                  nativo para dictar con tu voz.
                </Text>
              </View>
            )}

          {/* Visual Voice Commands Guide (Dynamic) */}
          <View style={styles.guideContainer} testID="voice-commands-guide">
            <View style={styles.guideHeaderRow}>
              <Text style={styles.guideHeader}>
                💡 Comandos de Voz Disponibles:
              </Text>
            </View>

            <View style={styles.guideGrid}>
              {/* Dynamic Categories */}
              <View style={styles.guideRowColumn}>
                <View style={styles.guideRowHeader}>
                  <Text style={styles.guideBadgeCat}>
                    📁 Categorías ({categories.length})
                  </Text>
                  <Text style={styles.guideSubtext}>
                    Comienza diciendo el comando de la categoría:
                  </Text>
                </View>
                <View
                  style={styles.catCommandsWrap}
                  testID="help-category-commands"
                >
                  {categories.map((cat) => (
                    <View
                      key={cat.id}
                      style={[
                        styles.catCommandChip,
                        { borderColor: cat.color || "#38BDF8" },
                      ]}
                    >
                      <View
                        style={[
                          styles.catDot,
                          { backgroundColor: cat.color || "#38BDF8" },
                        ]}
                      />
                      <Text style={styles.catCommandText}>
                        {`"${cat.voice_command || cat.name.toLowerCase()}"`}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Dates & Times */}
              <View style={styles.guideRow}>
                <Text style={styles.guideBadgeDate}>📅 Fechas & Horas</Text>
                <Text style={styles.guideText}>
                  Di <Text style={styles.boldCode}>{'"fecha hoy"'}</Text>,{" "}
                  <Text style={styles.boldCode}>{'"para el 6 del 10"'}</Text>,{" "}
                  <Text style={styles.boldCode}>{'"pasado mañana"'}</Text> o{" "}
                  <Text style={styles.boldCode}>{'"a las 16:00"'}</Text>
                </Text>
              </View>

              {/* Task priority */}
              <View style={styles.guideRow} testID="help-priority-command">
                <Text style={styles.guideBadgeDate}>Prioridad de tareas</Text>
                <Text style={styles.guideText}>
                  Solo para tareas, di{" "}
                  <Text style={styles.boldCode}>{'"prioridad alta"'}</Text>,{" "}
                  <Text style={styles.boldCode}>{'"prioridad media"'}</Text> o{" "}
                  <Text style={styles.boldCode}>{'"prioridad baja"'}</Text>.
                </Text>
              </View>

              {/* Dynamic Tags */}
              <View style={styles.guideRowColumn}>
                <View style={styles.guideRowHeader}>
                  <Text style={styles.guideBadgeTag}>
                    🏷️ Etiquetas ({uniqueTags.length})
                  </Text>
                  <Text style={styles.guideSubtext}>
                    Di <Text style={styles.boldCode}>{'"etiquetas"'}</Text>{" "}
                    seguido de:
                  </Text>
                </View>
                <View style={styles.catCommandsWrap} testID="help-tag-commands">
                  {uniqueTags.length === 0 ? (
                    <Text style={styles.guideText}>
                      Di{" "}
                      <Text style={styles.boldCode}>
                        {'"etiquetas urgente"'}
                      </Text>
                    </Text>
                  ) : (
                    uniqueTags.map((tag) => (
                      <View key={tag.id} style={styles.tagCommandChip}>
                        <Text
                          style={styles.tagCommandText}
                        >{`#${tag.name}`}</Text>
                      </View>
                    ))
                  )}
                </View>
              </View>
            </View>
          </View>
        </View>
      ) : (
        /* SCREEN 2: RESULT SCREEN (PANTALLA APARTE TRAS DICTAR) */
        <View style={styles.screenContainer}>
          {/* Spoken Quote Box */}
          {transcript ? (
            <View style={styles.transcriptQuoteBox}>
              <Text style={styles.transcriptQuoteLabel}>🗣️ Frase dictada:</Text>
              <Text style={styles.transcriptQuoteText}>"{transcript}"</Text>
            </View>
          ) : null}

          {/* Recognized Command Tokens Highlights */}
          {parsedResult &&
            parsedResult.tokens &&
            parsedResult.tokens.length > 0 && (
              <View
                style={styles.tokensContainer}
                testID="recognized-tokens-section"
              >
                <Text style={styles.tokensHeader}>
                  ✨ Comandos Reconocidos en la Voz:
                </Text>
                <View style={styles.tokensRow}>
                  {parsedResult.tokens.map((tok, index) => (
                    <View
                      key={index}
                      style={[
                        styles.tokenBadge,
                        tok.type === "CATEGORY" && styles.tokenCategory,
                        tok.type === "DATE" && styles.tokenDate,
                        tok.type === "TAG" && styles.tokenTag,
                        tok.type === "KEYWORD" && styles.tokenKeyword,
                        tok.type === "CONTENT" && styles.tokenContent,
                      ]}
                    >
                      <Text style={styles.tokenLabel}>{tok.label}</Text>
                      <Text style={styles.tokenText}>{`"${tok.text}"`}</Text>
                    </View>
                  ))}
                </View>

                {/* Quick Action Bar below tokens: Regrabar + Guardar en paralelo (#88) */}
                <View
                  style={styles.quickSaveTokensRow}
                  testID="quick-save-tokens-row"
                >
                  <Pressable
                    testID="btn-quick-rerecord"
                    accessibilityLabel="Regrabar"
                    style={styles.quickRerecordBtn}
                    onPress={handleResetVoiceCapture}
                  >
                    <Text style={styles.quickRerecordBtnText} numberOfLines={1}>
                      🎙️ Regrabar
                    </Text>
                  </Pressable>

                  <Pressable
                    testID="btn-quick-save-tokens"
                    accessibilityLabel="Guardar Entrada"
                    style={[
                      styles.quickSaveBtn,
                      isQuickSaveDisabled && styles.buttonDisabled,
                    ]}
                    disabled={isQuickSaveDisabled}
                    onPress={() =>
                      saveParsedEntry(
                        manualCategoryId,
                        manualContent,
                        buildOccurredAtIso() ?? parsedResult.occurredAt,
                        parsedResult.tagIds || [],
                        parsedResult.taskPriority ?? manualPriority,
                      )
                    }
                  >
                    <Text style={styles.quickSaveBtnText} numberOfLines={1}>
                      💾 Guardar Entrada
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

          {/* Manual preview / correction form */}
          <View style={styles.correctionContainer} testID="correction-section">
            <Text style={styles.sectionTitle}>
              {saveMode === "PREVIEW_BEFORE_SAVE"
                ? "Previsualización antes de Guardar"
                : "Corregir Captura Hablada"}
            </Text>

            {parsedResult?.occurredAt && (
              <View style={styles.detectedDateBox} testID="detected-date-box">
                <Text style={styles.detectedDateText}>
                  📅 Fecha & Hora Detectada:{" "}
                  {new Date(parsedResult.occurredAt).toLocaleString("es-ES", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            )}

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
                  onPress={() => handleSelectCategory(cat.id)}
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

            {isCategoryAlert(
              categories.find((c) => c.id === manualCategoryId),
            ) && (
              <View
                style={styles.alertNoticeBox}
                testID="voice-alert-reminder-notice"
              >
                <Text style={styles.alertNoticeText}>
                  🔔 Alarma automática a la hora exacta configurada (sin
                  antelación)
                </Text>
              </View>
            )}

            {categories.find((c) => c.id === manualCategoryId)?.kind ===
              "TASK" &&
              !isCategoryAlert(
                categories.find((c) => c.id === manualCategoryId),
              ) && (
                <>
                  <Text style={styles.label}>⚡ Prioridad de la Tarea</Text>
                  <View style={styles.chipsRow}>
                    {(
                      [
                        {
                          id: "HIGH",
                          label: "🔴 Alta",
                          testId: "voice-prio-high",
                        },
                        {
                          id: "MEDIUM",
                          label: "🟡 Media",
                          testId: "voice-prio-med",
                        },
                        {
                          id: "LOW",
                          label: "🔵 Baja",
                          testId: "voice-prio-low",
                        },
                      ] as const
                    ).map((p) => (
                      <Pressable
                        key={p.id}
                        testID={p.testId}
                        style={[
                          styles.chip,
                          manualPriority === p.id && styles.chipActive,
                        ]}
                        onPress={() => setManualPriority(p.id)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            manualPriority === p.id && styles.chipTextActive,
                          ]}
                        >
                          {p.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

            <Text style={styles.label}>📅 Ajuste de Fecha y Hora</Text>
            <View style={styles.datePresetRow}>
              <Pressable
                testID="btn-preset-date-today"
                style={[
                  styles.datePresetChip,
                  manualDateStr === toLocalDateString() &&
                    styles.datePresetChipActive,
                ]}
                onPress={() => setQuickDate(0)}
              >
                <Text
                  style={[
                    styles.datePresetChipText,
                    manualDateStr === toLocalDateString() &&
                      styles.datePresetChipTextActive,
                  ]}
                >
                  Hoy
                </Text>
              </Pressable>

              <Pressable
                testID="btn-preset-date-tomorrow"
                style={styles.datePresetChip}
                onPress={() => setQuickDate(1)}
              >
                <Text style={styles.datePresetChipText}>Mañana</Text>
              </Pressable>

              <Pressable
                testID="btn-preset-date-after-tomorrow"
                style={styles.datePresetChip}
                onPress={() => setQuickDate(2)}
              >
                <Text style={styles.datePresetChipText}>Pasado Mañana</Text>
              </Pressable>

              <Pressable
                testID="btn-preset-date-clear"
                style={styles.datePresetChip}
                onPress={() => setQuickDate(null)}
              >
                <Text style={styles.datePresetChipText}>Sin Fecha</Text>
              </Pressable>
            </View>

            {Platform.OS === "web" ? (
              <View style={styles.dateTimeInputsRow}>
                <View style={styles.pickerField}>
                  <Text style={styles.subInputLabel}>
                    📅 Fecha (Calendario):
                  </Text>
                  <View style={{ position: "relative", width: "100%" }}>
                    {React.createElement("input", {
                      type: "date",
                      value: manualDateStr,
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                        setManualDateStr(e.target.value),
                      style: webPickerInputStyle,
                    })}
                    {!manualDateStr && (
                      <Text
                        style={styles.webDatePlaceholder}
                        pointerEvents="none"
                      >
                        Seleccionar fecha...
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.pickerField}>
                  <Text style={styles.subInputLabel}>⏰ Hora (Reloj):</Text>
                  {React.createElement("input", {
                    type: "time",
                    value: manualTimeStr,
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                      setManualTimeStr(e.target.value),
                    style: webPickerInputStyle,
                  })}
                </View>

                <TextInput
                  testID="input-manual-date"
                  style={{ display: "none" }}
                  value={manualDateStr}
                  onChangeText={setManualDateStr}
                />
                <TextInput
                  testID="input-manual-time"
                  style={{ display: "none" }}
                  value={manualTimeStr}
                  onChangeText={setManualTimeStr}
                />
              </View>
            ) : (
              <View style={styles.dateTimeInputsRow}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.subInputLabel}>Fecha (AAAA-MM-DD)</Text>
                  <TextInput
                    testID="input-manual-date"
                    style={styles.input}
                    value={manualDateStr}
                    onChangeText={setManualDateStr}
                    placeholder="AAAA-MM-DD"
                    placeholderTextColor="#64748B"
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.subInputLabel}>Hora (HH:MM)</Text>
                  <TextInput
                    testID="input-manual-time"
                    style={styles.input}
                    value={manualTimeStr}
                    onChangeText={setManualTimeStr}
                    placeholder="16:00"
                    placeholderTextColor="#64748B"
                  />
                </View>
              </View>
            )}

            <Text style={styles.label}>Título (Opcional)</Text>
            <TextInput
              testID="input-manual-title"
              style={styles.input}
              value={manualTitle}
              onChangeText={setManualTitle}
              placeholder="Título de la entrada o tarea..."
              placeholderTextColor="#64748B"
            />

            <Text style={styles.label}>Contenido de la Entrada</Text>
            <TextInput
              testID="input-manual-content"
              style={styles.inputArea}
              multiline
              value={manualContent}
              onChangeText={setManualContent}
              placeholder="Escribe aquí el contenido..."
              placeholderTextColor="#64748B"
            />

            {/* Bottom Actions Row: Regrabar + Confirmar y Guardar en paralelo (#88) */}
            <View style={styles.actionsRow}>
              <Pressable
                testID="btn-reset-voice-capture"
                accessibilityLabel="Regrabar"
                style={styles.reRecordBtn}
                onPress={handleResetVoiceCapture}
              >
                <Text style={styles.reRecordBtnText} numberOfLines={1}>
                  🎙️ Regrabar
                </Text>
              </Pressable>

              <Pressable
                testID="btn-save-corrected-entry"
                accessibilityLabel="Confirmar y Guardar"
                style={[
                  styles.saveButton,
                  isManualSaveDisabled && styles.buttonDisabled,
                ]}
                disabled={isManualSaveDisabled}
                onPress={() =>
                  saveParsedEntry(
                    manualCategoryId,
                    manualContent,
                    buildOccurredAtIso() ??
                      (parsedResult ? parsedResult.occurredAt : null),
                    parsedResult ? parsedResult.tagIds : [],
                    parsedResult?.taskPriority ?? manualPriority,
                  )
                }
              >
                <Text style={styles.saveButtonText} numberOfLines={1}>
                  💾 Confirmar y Guardar
                </Text>
              </Pressable>
            </View>
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
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#F8FAFC",
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
  heroButtonContainer: {
    width: "100%",
    marginBottom: 10,
  },
  heroListenButton: {
    width: "100%",
    backgroundColor: "#38BDF8",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
    shadowColor: "#38BDF8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  heroStopButton: {
    width: "100%",
    backgroundColor: "#EF4444",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 5,
  },
  heroButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  heroButtonIcon: {
    fontSize: 28,
  },
  heroButtonTextCol: {
    alignItems: "flex-start",
    flexShrink: 1,
  },
  heroButtonTitle: {
    color: "#0F172A",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  heroButtonSubtitle: {
    color: "#0F172A",
    fontSize: 11,
    fontWeight: "600",
    opacity: 0.85,
    marginTop: 1,
  },
  heroStopButtonTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  heroStopButtonSubtitle: {
    color: "#FEE2E2",
    fontSize: 11,
    fontWeight: "600",
    opacity: 0.9,
    marginTop: 1,
  },
  controlsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
    alignItems: "center",
    flexWrap: "wrap",
  },
  listenButton: {
    backgroundColor: "#38BDF8",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  listenButtonText: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "center",
  },
  stopButton: {
    backgroundColor: "#EF4444",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  stopButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "center",
  },
  mobileDictationHintBox: {
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    borderColor: "#38BDF8",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  mobileDictationHintText: {
    color: "#E2E8F0",
    fontSize: 12,
    lineHeight: 18,
  },
  guideContainer: {
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  guideHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  guideHeader: {
    color: "#38BDF8",
    fontSize: 13,
    fontWeight: "700",
  },
  toggleHelpText: {
    color: "#38BDF8",
    fontSize: 12,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  guideGrid: {
    gap: 10,
  },
  guideRowColumn: {
    gap: 4,
  },
  guideRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  guideSubtext: {
    color: "#94A3B8",
    fontSize: 12,
  },
  catCommandsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  catCommandChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  catDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  catCommandText: {
    color: "#F8FAFC",
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  tagCommandChip: {
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    borderColor: "#A855F7",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagCommandText: {
    color: "#C084FC",
    fontSize: 12,
    fontWeight: "600",
  },
  guideRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  guideBadgeCat: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    color: "#38BDF8",
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  guideBadgeDate: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    color: "#10B981",
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  guideBadgeTag: {
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    color: "#A855F7",
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  guideText: {
    color: "#94A3B8",
    fontSize: 12,
  },
  boldCode: {
    color: "#F8FAFC",
    fontWeight: "700",
    fontFamily: "monospace",
  },
  tokensContainer: {
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    marginBottom: 12,
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
  },
  tokensHeader: {
    color: "#F8FAFC",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  detectedDateBox: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "#10B981",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  detectedDateText: {
    color: "#10B981",
    fontSize: 13,
    fontWeight: "700",
  },
  tokensRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    width: "100%",
    maxWidth: "100%",
  },
  tokenBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 2,
    maxWidth: "100%",
    flexShrink: 1,
  },
  tokenCategory: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderColor: "#38BDF8",
  },
  tokenDate: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "#10B981",
  },
  tokenTag: {
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    borderColor: "#A855F7",
  },
  tokenKeyword: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderColor: "#F59E0B",
  },
  tokenContent: {
    backgroundColor: "rgba(148, 163, 184, 0.15)",
    borderColor: "#64748B",
  },
  tokenLabel: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  tokenText: {
    color: "#F8FAFC",
    fontSize: 13,
    fontWeight: "600",
    flexWrap: "wrap",
    maxWidth: "100%",
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
  datePresetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  datePresetChip: {
    backgroundColor: "#1E293B",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  datePresetChipActive: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  datePresetChipText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  datePresetChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  dateTimeInputsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
    width: "100%",
    alignItems: "flex-start",
  },
  pickerField: {
    flex: 1,
    minWidth: 0,
    maxWidth: "100%",
  },
  webDatePlaceholder: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    textAlign: "center",
    lineHeight: 44,
    color: "#64748B",
    fontSize: 13,
    fontWeight: "500",
  },
  alertNoticeBox: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderColor: "rgba(245, 158, 11, 0.35)",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  alertNoticeText: {
    color: "#fbbf24",
    fontSize: 12,
    fontWeight: "600",
  },
  subInputLabel: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
  },
  quickSaveTokensRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    width: "100%",
  },
  quickRerecordBtn: {
    flex: 1,
    backgroundColor: "#0284C7",
    borderColor: "#0284C7",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  quickRerecordBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "center",
  },
  quickSaveBtn: {
    flex: 1,
    backgroundColor: "#10B981",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  quickSaveBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "center",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    width: "100%",
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#10B981",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "center",
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    flex: 1,
  },
  headerCloseButton: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderColor: "#EF4444",
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  headerCloseButtonText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "bold",
  },
  stepBadge: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderColor: "#38BDF8",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stepBadgeText: {
    color: "#38BDF8",
    fontSize: 11,
    fontWeight: "700",
  },
  stepBadgeResult: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "#10B981",
  },
  stepBadgeTextResult: {
    color: "#10B981",
  },
  screenContainer: {
    width: "100%",
  },
  liveDictationBox: {
    backgroundColor: "#0B132B",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  liveDictationHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  liveDictationHeaderTitle: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  liveDictationSubtleLabel: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
  },
  liveParsedEntitiesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  liveEntityBadge: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.4)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveEntityBadgeText: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "600",
  },
  liveEntityTagBadge: {
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.4)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveEntityTagBadgeText: {
    color: "#c084fc",
    fontSize: 11,
    fontWeight: "600",
  },
  liveListeningBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderColor: "#EF4444",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  liveListeningBadgeText: {
    color: "#F87171",
    fontSize: 10,
    fontWeight: "800",
  },
  liveDictationContent: {
    minHeight: 48,
    justifyContent: "center",
  },
  liveDictationText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 24,
  },
  liveDictationPlaceholder: {
    color: "#64748B",
    fontSize: 13,
    fontStyle: "italic",
    lineHeight: 18,
  },
  liveDictationPlaceholderActive: {
    color: "#38BDF8",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  manualTranscriptRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "stretch",
    marginTop: 4,
    width: "100%",
  },
  transcriptInput: {
    flex: 1,
    minWidth: 150,
    maxWidth: "100%",
    minHeight: 52,
    maxHeight: 120,
    textAlignVertical: "top",
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 8,
    color: "#F8FAFC",
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    lineHeight: 20,
  },
  transcriptQuoteBox: {
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#38BDF8",
  },
  transcriptQuoteLabel: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  transcriptQuoteText: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "600",
    fontStyle: "italic",
  },
  reRecordBtn: {
    flex: 1,
    backgroundColor: "#0284C7",
    borderColor: "#0284C7",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  reRecordBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "center",
  },
});
