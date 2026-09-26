import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { listCategories } from "../db/categories";
import { DatabaseAdapter } from "../db/database";
import { createLocalEntry } from "../db/entries";
import { listTags } from "../db/tags";
import {
  ParsedSpokenCommand,
  parseSpokenCommand,
} from "../services/voiceParser";
import { Entry } from "../types/domain";

export interface FastForwardCaptureProps {
  db: DatabaseAdapter;
  userId: string;
  onEntryCreated?: (entry: Entry) => void;
  onOpenEdit?: (entryId: string) => void;
}

export function FastForwardCapture({
  db,
  userId,
  onEntryCreated,
  onOpenEdit,
}: FastForwardCaptureProps) {
  const [createdEntry, setCreatedEntry] = useState<Entry | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const processAndSaveFastForward = async (rawTranscript: string) => {
    setErrorMessage(null);
    setCreatedEntry(null);
    setLoading(true);

    try {
      const categories = await listCategories(db, userId);
      const tags = await listTags(db, userId);

      const parsed: ParsedSpokenCommand = parseSpokenCommand(
        rawTranscript,
        categories,
        tags,
      );

      if (!parsed.isSuccess || !parsed.categoryId || !parsed.content) {
        setErrorMessage(
          parsed.errors.length > 0
            ? parsed.errors.join(" ")
            : "No se pudo interpretar el contenido de la voz.",
        );
        return;
      }

      const category = categories.find((c) => c.id === parsed.categoryId);
      const isTask = category?.kind === "TASK";

      const entry = await createLocalEntry(db, userId, {
        category_id: parsed.categoryId,
        content: parsed.content,
        occurred_at: parsed.occurredAt,
        task_status: isTask ? "PENDING" : null,
        task_recurrence: isTask ? "ONCE" : null,
        tag_ids: parsed.tagIds,
      });

      setCreatedEntry(entry);
      if (onEntryCreated) {
        onEntryCreated(entry);
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container} testID="fast-forward-capture">
      <Text style={styles.title}>Modo Fast Forward</Text>

      {errorMessage && (
        <View style={styles.errorBox} testID="fast-forward-error">
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {createdEntry && (
        <View style={styles.toastBox} testID="fast-forward-toast">
          <Text style={styles.toastTitle}>
            ¡Entrada guardada inmediatamente!
          </Text>
          <Text style={styles.toastContent}>{`"${createdEntry.content}"`}</Text>
          <Pressable
            testID={`btn-edit-ff-${createdEntry.id}`}
            style={styles.editLinkButton}
            onPress={() => onOpenEdit && onOpenEdit(createdEntry.id)}
          >
            <Text style={styles.editLinkText}>Ver / Editar Entrada</Text>
          </Pressable>
        </View>
      )}

      <Pressable
        testID="btn-sim-ff-voice"
        style={[styles.quickButton, loading && styles.buttonDisabled]}
        disabled={loading}
        onPress={() =>
          processAndSaveFastForward(
            "nota fecha hoy contenido comprar insumos de oficina etiquetas urgente",
          )
        }
      >
        <Text style={styles.quickButtonText}>
          {loading ? "Guardando..." : "Simular Captura Rápida por Voz"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
  quickButton: {
    backgroundColor: "#38BDF8",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  quickButtonText: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "bold",
  },
  toastBox: {
    backgroundColor: "#064E3B",
    borderColor: "#10B981",
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  toastTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#A7F3D0",
  },
  toastContent: {
    fontSize: 14,
    color: "#D1FAE5",
    marginTop: 4,
    marginBottom: 10,
    fontStyle: "italic",
  },
  editLinkButton: {
    backgroundColor: "#047857",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  editLinkText: {
    color: "#FFFFFF",
    fontSize: 13,
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
});
