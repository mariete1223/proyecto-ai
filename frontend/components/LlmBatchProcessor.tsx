import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { listCategories } from "../db/categories";
import { DatabaseAdapter } from "../db/database";
import { createLocalEntry } from "../db/entries";
import { listTags } from "../db/tags";
import {
  Category,
  Entry,
  normalizeTextKey,
  Tag,
  TaskStatus,
} from "../types/domain";

export interface LlmRawImportItem {
  category_name?: string;
  category?: string;
  title?: string | null;
  content: string;
  occurred_at?: string | null;
  task_status?: TaskStatus | "COMPLETED" | null;
  tags?: string[];
}

export interface PreparedImportItem {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  isTask: boolean;
  title: string | null;
  content: string;
  occurredAt: string | null;
  taskStatus: TaskStatus | null;
  tagIds: string[];
  tagNames: string[];
}

export interface LlmBatchProcessorProps {
  db: DatabaseAdapter;
  userId: string;
  initialText?: string;
  onImportCompleted?: (entries: Entry[]) => void;
  onClose?: () => void;
}

export function LlmBatchProcessor({
  db,
  userId,
  initialText = "",
  onImportCompleted,
  onClose,
}: LlmBatchProcessorProps) {
  const [activeTab, setActiveTab] = useState<"PROMPT" | "IMPORT">("PROMPT");
  const [rawNoteText, setRawNoteText] = useState<string>(initialText);
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);

  const [jsonInput, setJsonInput] = useState<string>("");
  const [parsedItems, setParsedItems] = useState<PreparedImportItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const buildLlmPrompt = async (): Promise<string> => {
    const categories = await listCategories(db, userId);
    const tags = await listTags(db, userId);

    const catListStr = categories
      .map(
        (c) =>
          `- ${c.name} (${c.kind === "TASK" ? "Tarea/Pendiente" : "Estándar"}, comando: "${c.voice_command}")`,
      )
      .join("\n");

    const tagListStr =
      tags.length > 0 ? tags.map((t) => t.name).join(", ") : "Ninguna aún";

    const refDateStr = new Date().toISOString().split("T")[0];

    return `Actúa como un asistente experto en estructuración de información personal para la aplicación VoxFlow.

Tu tarea es analizar el siguiente texto de escritura libre / diario del día y extraer TODAS las ideas, tareas, recuerdos o notas individuales en un array de objetos en formato JSON estricto.

### CATEGORÍAS DISPONIBLES EN MI APP:
${catListStr}

### ETIQUETAS HABITUALES:
${tagListStr}

### FECHA DE REFERENCIA DE HOY:
${refDateStr}

### FORMATO DE SALIDA REQUERIDO (Solo responde con el código JSON sin texto adicional ni introducciones):
[
  {
    "category_name": "Nombre de Categoría",
    "title": "Título corto y descriptivo (opcional)",
    "content": "Contenido detallado y limpio de la entrada",
    "occurred_at": null,
    "task_status": "PENDING" (si es tarea) o null,
    "tags": ["Etiqueta1", "Etiqueta2"]
  }
]

### REGLAS IMPORTANTES:
1. NOTAS DESESTRUCTURADAS: Para notas desestructuradas o notas generales ("Notas"), NO debes extraer una fecha como tal en "occurred_at" (debe ser null). Las notas desestructuradas pueden contener múltiples fechas o referencias temporales variadas; conserva intactas todas las fechas y horas dentro del texto en "content".
2. TAREAS Y EVENTOS: Solo incluye fecha en "occurred_at" (formato ISO 8601 UTC o YYYY-MM-DD) si la entrada es un evento puntual con fecha concreta o una tarea con fecha límite única. En cualquier otro caso, usa null.

### MI TEXTO LIBRE PARA ESTRUCTURAR:
"""
${rawNoteText.trim() || "[Pega o escribe aquí tu nota libre del día]"}
"""`;
  };

  const handleCopyPrompt = async () => {
    try {
      const prompt = await buildLlmPrompt();
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(prompt);
      }
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 4000);
    } catch (err) {
      setErrorMessage("Error al copiar el prompt al portapapeles.");
    }
  };

  const parseJsonInput = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setParsedItems([]);

    if (!jsonInput.trim()) {
      setErrorMessage("Pega la respuesta JSON recibida del LLM para analizar.");
      return;
    }

    try {
      // Clean up markdown code block wrappers ```json ... ``` if present
      let cleanJson = jsonInput.trim();
      if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson
          .replace(/^```(?:json)?/i, "")
          .replace(/```$/, "")
          .trim();
      }

      const rawItems = JSON.parse(cleanJson);
      if (!Array.isArray(rawItems)) {
        setErrorMessage(
          "El JSON introducido debe ser una lista/array [...] de objetos.",
        );
        return;
      }

      const categories = await listCategories(db, userId);
      const tags = await listTags(db, userId);

      const prepared: PreparedImportItem[] = [];

      for (const item of rawItems as LlmRawImportItem[]) {
        if (!item.content || !item.content.trim()) continue;

        const catQuery = normalizeTextKey(
          item.category_name || item.category || "",
        );

        let matchedCat = categories.find(
          (c) =>
            normalizeTextKey(c.name) === catQuery ||
            normalizeTextKey(c.voice_command) === catQuery,
        );

        if (!matchedCat) {
          // Fallback to first TASK category if task_status is present, else first STANDARD category
          if (item.task_status) {
            matchedCat =
              categories.find((c) => c.kind === "TASK") || categories[0];
          } else {
            matchedCat =
              categories.find((c) => c.kind === "STANDARD") || categories[0];
          }
        }

        const isTask = matchedCat?.kind === "TASK";
        const isEvent = matchedCat?.kind === "EVENT";
        const rawStatus =
          item.task_status === "COMPLETED" ? "DONE" : item.task_status;
        const finalStatus: TaskStatus | null = isTask
          ? rawStatus || "PENDING"
          : null;

        // Para notas desestructuradas (o categorías estándar/notas generales),
        // no se debe leer la fecha como tal (se mantiene null) para no romper notas con múltiples fechas.
        const resolvedOccurredAt =
          isTask || isEvent ? item.occurred_at || null : null;

        // Match tags
        const matchedTagIds: string[] = [];
        const matchedTagNames: string[] = [];

        if (Array.isArray(item.tags)) {
          for (const rawTag of item.tags) {
            const normTag = normalizeTextKey(rawTag);
            const foundTag = tags.find(
              (t) => normalizeTextKey(t.name) === normTag,
            );
            if (foundTag && !matchedTagIds.includes(foundTag.id)) {
              matchedTagIds.push(foundTag.id);
              matchedTagNames.push(foundTag.name);
            }
          }
        }

        prepared.push({
          categoryId: matchedCat ? matchedCat.id : categories[0]?.id || "",
          categoryName: matchedCat ? matchedCat.name : "Nota",
          categoryColor: matchedCat ? matchedCat.color : "#38BDF8",
          isTask,
          title: item.title && item.title.trim() ? item.title.trim() : null,
          content: item.content.trim(),
          occurredAt: resolvedOccurredAt,
          taskStatus: finalStatus,
          tagIds: matchedTagIds,
          tagNames: matchedTagNames,
        });
      }

      if (prepared.length === 0) {
        setErrorMessage("No se encontraron entradas válidas en el JSON.");
        return;
      }

      setParsedItems(prepared);
      setSuccessMessage(
        `¡Se analizaron ${prepared.length} entradas correctamente! Revisa la vista previa y confirma el guardado.`,
      );
    } catch (err) {
      setErrorMessage(
        `Error al procesar el JSON: ${(err as Error).message}. Asegúrate de pegar el código JSON válido.`,
      );
    }
  };

  const handleImportAll = async () => {
    if (parsedItems.length === 0) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const createdEntries: Entry[] = [];

      for (const item of parsedItems) {
        const entry = await createLocalEntry(db, userId, {
          category_id: item.categoryId,
          title: item.title,
          content: item.content,
          occurred_at: item.occurredAt,
          task_status: item.taskStatus,
          task_recurrence: item.isTask ? "ONCE" : null,
          tag_ids: item.tagIds,
        });
        createdEntries.push(entry);
      }

      setSuccessMessage(
        `¡Se guardaron exitosamente ${createdEntries.length} entradas en la aplicación!`,
      );
      setParsedItems([]);
      setJsonInput("");

      if (onImportCompleted) {
        onImportCompleted(createdEntries);
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.card} testID="llm-batch-processor">
      <View style={styles.headerRow}>
        <Text style={styles.title}>🤖 Estructurar Nota Libre con IA (LLM)</Text>
        {onClose && (
          <Pressable
            testID="btn-close-llm-processor"
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>✕ Cerrar</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.subText}>
        Convierte una nota larga, diario o volcado libre del día en múltiples
        entradas estructuradas utilizando ChatGPT, Claude o Gemini.
      </Text>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <Pressable
          testID="btn-tab-llm-prompt"
          style={[
            styles.tabButton,
            activeTab === "PROMPT" && styles.activeTabButton,
          ]}
          onPress={() => setActiveTab("PROMPT")}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "PROMPT" && styles.activeTabButtonText,
            ]}
          >
            1️⃣ Copiar Prompt para IA
          </Text>
        </Pressable>
        <Pressable
          testID="btn-tab-llm-import"
          style={[
            styles.tabButton,
            activeTab === "IMPORT" && styles.activeTabButton,
          ]}
          onPress={() => setActiveTab("IMPORT")}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "IMPORT" && styles.activeTabButtonText,
            ]}
          >
            2️⃣ Importar JSON de la IA
          </Text>
        </Pressable>
      </View>

      {errorMessage && (
        <View style={styles.errorBox} testID="llm-processor-error">
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {successMessage && (
        <View style={styles.successBox} testID="llm-processor-success">
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      )}

      {activeTab === "PROMPT" ? (
        <View style={styles.tabContent}>
          <Text style={styles.label}>
            Paso 1: Escribe o pega la nota libre a estructurar:
          </Text>
          <TextInput
            testID="input-llm-raw-note"
            style={styles.textArea}
            multiline
            numberOfLines={6}
            value={rawNoteText}
            onChangeText={setRawNoteText}
            placeholder="Pega aquí el diario o notas desestructuradas de tu día..."
            placeholderTextColor="#64748b"
          />

          <Pressable
            testID="btn-copy-llm-prompt"
            style={[
              styles.primaryButton,
              copiedSuccess && styles.successButton,
            ]}
            onPress={handleCopyPrompt}
          >
            <Text style={styles.primaryButtonText}>
              {copiedSuccess
                ? "✓ ¡Prompt copiado al portapapeles!"
                : "📋 Copiar Prompt Completo para el LLM"}
            </Text>
          </Pressable>

          <Text style={styles.helpFootnote}>
            💡 **Siguiente paso:** Pega el prompt copiado en ChatGPT / Claude.
            Copia el JSON que te responda y pulsa la pestaña **"2️⃣ Importar JSON
            de la IA"**.
          </Text>
        </View>
      ) : (
        <View style={styles.tabContent}>
          <Text style={styles.label}>
            Paso 2: Pega el JSON generado por la IA:
          </Text>
          <TextInput
            testID="input-llm-json-response"
            style={styles.textArea}
            multiline
            numberOfLines={6}
            value={jsonInput}
            onChangeText={setJsonInput}
            placeholder="Pega aquí el bloque JSON devuelto por el LLM [...]"
            placeholderTextColor="#64748b"
          />

          <View style={styles.actionRow}>
            <Pressable
              testID="btn-parse-llm-json"
              style={styles.secondaryButton}
              onPress={parseJsonInput}
            >
              <Text style={styles.secondaryButtonText}>
                🔍 Analizar y Previsualizar
              </Text>
            </Pressable>

            {parsedItems.length > 0 && (
              <Pressable
                testID="btn-save-all-llm-entries"
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                disabled={loading}
                onPress={handleImportAll}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    💾 Guardar {parsedItems.length} Entradas
                  </Text>
                )}
              </Pressable>
            )}
          </View>

          {/* Preview cards */}
          {parsedItems.length > 0 && (
            <View style={styles.previewContainer}>
              <Text style={styles.previewTitle}>
                Vista previa de entradas detectadas ({parsedItems.length}):
              </Text>
              <ScrollView style={styles.previewScroll}>
                {parsedItems.map((item, idx) => (
                  <View
                    key={idx}
                    style={styles.previewCard}
                    testID={`preview-item-${idx}`}
                  >
                    <View style={styles.previewCardHeader}>
                      <View
                        style={[
                          styles.categoryBadge,
                          { backgroundColor: item.categoryColor },
                        ]}
                      >
                        <Text style={styles.categoryBadgeText}>
                          {item.categoryName}
                        </Text>
                      </View>

                      {item.isTask && (
                        <Text style={styles.taskBadge}>
                          {item.taskStatus || "PENDING"}
                        </Text>
                      )}

                      {item.occurredAt && (
                        <Text style={styles.dateBadge}>
                          📅 {item.occurredAt.split("T")[0]}
                        </Text>
                      )}
                    </View>

                    {item.title ? (
                      <Text style={styles.itemTitle}>{item.title}</Text>
                    ) : null}
                    <Text style={styles.itemContent}>{item.content}</Text>

                    {item.tagNames.length > 0 && (
                      <View style={styles.tagsRow}>
                        {item.tagNames.map((tag, tIdx) => (
                          <View key={tIdx} style={styles.tagChip}>
                            <Text style={styles.tagChipText}>#{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 14,
    padding: 18,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: "#334155",
    width: "100%",
    maxWidth: 1000,
    alignSelf: "center",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#f8fafc",
  },
  subText: {
    fontSize: 13,
    color: "#94a3b8",
    marginBottom: 14,
  },
  closeButton: {
    backgroundColor: "#334155",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  closeButtonText: {
    color: "#cbd5e1",
    fontSize: 12,
  },
  tabContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#0f172a",
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  activeTabButton: {
    backgroundColor: "#2563eb",
    borderColor: "#3b82f6",
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94a3b8",
  },
  activeTabButtonText: {
    color: "#ffffff",
  },
  tabContent: {
    marginTop: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#e2e8f0",
    marginBottom: 8,
  },
  textArea: {
    backgroundColor: "#0f172a",
    borderColor: "#475569",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    color: "#f8fafc",
    fontSize: 14,
    textAlignVertical: "top",
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 4,
  },
  successButton: {
    backgroundColor: "#16a34a",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "bold",
  },
  secondaryButton: {
    backgroundColor: "#334155",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  helpFootnote: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 12,
    lineHeight: 18,
  },
  errorBox: {
    backgroundColor: "#7f1d1d",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 13,
  },
  successBox: {
    backgroundColor: "#14532d",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  successText: {
    color: "#86efac",
    fontSize: 13,
  },
  previewContainer: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#334155",
    paddingTop: 12,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#38bdf8",
    marginBottom: 10,
  },
  previewScroll: {
    maxHeight: 280,
  },
  previewCard: {
    backgroundColor: "#0f172a",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  previewCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  categoryBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "bold",
  },
  taskBadge: {
    backgroundColor: "#312e81",
    color: "#a5b4fc",
    fontSize: 10,
    fontWeight: "bold",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dateBadge: {
    color: "#94a3b8",
    fontSize: 11,
  },
  itemTitle: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
  },
  itemContent: {
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 18,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  tagChip: {
    backgroundColor: "#1e293b",
    borderColor: "#475569",
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagChipText: {
    color: "#38bdf8",
    fontSize: 11,
  },
});
