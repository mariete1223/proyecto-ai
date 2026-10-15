import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { listCategories } from "../db/categories";
import { DatabaseAdapter } from "../db/database";
import { listTags } from "../db/tags";
import { VoiceCaptureFlow } from "./VoiceCaptureFlow";
import { Category, Tag } from "../types/domain";

export interface MobileHomeVoiceViewProps {
  db: DatabaseAdapter;
  userId: string;
  onOpenManualForm: () => void;
  onOpenLlmImport: () => void;
  onEntryCreated?: () => void;
  refreshSignal?: number;
}

export function MobileHomeVoiceView({
  db,
  userId,
  onOpenManualForm,
  onOpenLlmImport,
  onEntryCreated,
  refreshSignal,
}: MobileHomeVoiceViewProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [showCheatsheet, setShowCheatsheet] = useState<boolean>(true);
  const [activeVoiceModal, setActiveVoiceModal] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    async function loadCatalog() {
      try {
        const cats = await listCategories(db, userId);
        const tgs = await listTags(db, userId);
        if (mounted) {
          setCategories(cats);
          setTags(tgs);
        }
      } catch (err) {
        console.error(
          "Error al cargar categorías en MobileHomeVoiceView:",
          err,
        );
      }
    }
    loadCatalog();
    return () => {
      mounted = false;
    };
  }, [db, userId, refreshSignal]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      testID="mobile-home-voice-view"
    >
      {!activeVoiceModal ? (
        /* Big Mic Hero Section */
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Dictado y Captura de Voz</Text>
          <Text style={styles.heroSubtitle}>
            Presiona el micrófono en grande para grabar tu voz o usa la chuleta
            de comandos abajo.
          </Text>

          {/* Big Mic Button */}
          <Pressable
            testID="btn-big-mic-start"
            style={styles.bigMicButton}
            onPress={() => setActiveVoiceModal(true)}
          >
            <View style={styles.bigMicInnerRing}>
              <Text style={styles.bigMicIcon}>🎙️</Text>
            </View>
          </Pressable>
          <Text style={styles.bigMicLabel}>Toca para Grabar por Voz</Text>

          {/* Quick Action Row */}
          <View style={styles.quickActionsRow}>
            <Pressable
              testID="btn-mobile-manual-entry"
              style={styles.quickActionButton}
              onPress={onOpenManualForm}
            >
              <Text style={styles.quickActionText}>✍️ Escritura Libre</Text>
            </Pressable>

            <Pressable
              testID="btn-mobile-llm-import"
              style={styles.quickActionAiButton}
              onPress={onOpenLlmImport}
            >
              <Text style={styles.quickActionAiText}>
                🤖 Estructurar con IA
              </Text>
            </Pressable>
          </View>

          {/* Cheatsheet section filling the available space */}
          <View style={styles.cheatsheetCard}>
            <View style={styles.cheatsheetHeader}>
              <Text style={styles.cheatsheetTitle}>💡 Comandos por Voz</Text>
              <Pressable
                style={styles.toggleCheatsheetButton}
                onPress={() => setShowCheatsheet(!showCheatsheet)}
              >
                <Text style={styles.toggleCheatsheetText}>
                  {showCheatsheet ? "Ocultar ▲" : "Ver ▼"}
                </Text>
              </Pressable>
            </View>

            {showCheatsheet && (
              <View style={styles.cheatsheetBody}>
                <Text style={styles.sectionHeader}>Categorías activas:</Text>
                <View style={styles.chipsRow}>
                  {categories.map((c) => (
                    <View
                      key={c.id}
                      style={[
                        styles.categoryChip,
                        { borderColor: c.color || "#38bdf8" },
                      ]}
                    >
                      <Text style={styles.categoryChipTitle}>{c.name}</Text>
                      <Text style={styles.categoryChipCommand}>
                        "{c.voice_command}"
                      </Text>
                    </View>
                  ))}
                </View>

                {tags.length > 0 && (
                  <>
                    <Text style={styles.sectionHeader}>
                      Etiquetas disponibles:
                    </Text>
                    <View style={styles.tagsRow}>
                      {tags.map((t) => (
                        <View
                          key={t.id}
                          style={[
                            styles.tagChip,
                            t.color ? { borderColor: t.color } : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.tagChipText,
                              t.color ? { color: t.color } : null,
                            ]}
                          >
                            #{t.name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                <View style={styles.fullPhraseBox}>
                  <Text style={styles.fullPhraseTitle}>Ejemplo de frase:</Text>
                  <Text style={styles.fullPhraseCode}>
                    "nota reunión de equipo mañana a las diez #urgente"
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      ) : (
        /* Voice Capture Component Overlay Modal / Container */
        <View style={styles.voiceModalCard} testID="mobile-voice-capture-panel">
          <View style={styles.voiceModalHeader}>
            <Text style={styles.voiceModalTitle}>🎙️ Captura de Voz Activa</Text>

            <Pressable
              testID="btn-close-mobile-voice"
              style={styles.closeModalButton}
              onPress={() => setActiveVoiceModal(false)}
            >
              <Text style={styles.closeModalText}>✕ Cerrar</Text>
            </Pressable>
          </View>

          <VoiceCaptureFlow
            db={db}
            userId={userId}
            saveMode="PREVIEW_BEFORE_SAVE"
            onEntryCreated={() => {
              setActiveVoiceModal(false);
              onEntryCreated?.();
            }}
            onClose={() => setActiveVoiceModal(false)}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
  },
  contentContainer: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  heroSection: {
    backgroundColor: "#1e293b",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#334155",
    flex: 1,
    width: "100%",
  },
  heroTitle: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 4,
    textAlign: "center",
  },
  heroSubtitle: {
    color: "#94a3b8",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18,
  },
  bigMicButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
    marginBottom: 12,
  },
  bigMicInnerRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
  },
  bigMicIcon: {
    fontSize: 40,
  },
  bigMicLabel: {
    color: "#38bdf8",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 18,
  },
  quickActionsRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    justifyContent: "center",
  },
  quickActionButton: {
    backgroundColor: "#334155",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    flex: 1,
    alignItems: "center",
  },
  quickActionText: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "600",
  },
  quickActionAiButton: {
    backgroundColor: "#4f46e5",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    flex: 1,
    alignItems: "center",
  },
  quickActionAiText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold",
  },
  voiceModalCard: {
    backgroundColor: "#1e293b",
    borderColor: "#38bdf8",
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    flex: 1,
    width: "100%",
    minHeight: "100%",
  },
  voiceModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  voiceModalTitle: {
    color: "#38bdf8",
    fontSize: 16,
    fontWeight: "bold",
  },
  closeModalButton: {
    backgroundColor: "#334155",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  closeModalText: {
    color: "#94a3b8",
    fontSize: 12,
  },
  cheatsheetCard: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
    width: "100%",
    marginTop: 18,
  },
  cheatsheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cheatsheetTitle: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "bold",
  },
  toggleCheatsheetButton: {
    backgroundColor: "#0f172a",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  toggleCheatsheetText: {
    color: "#38bdf8",
    fontSize: 12,
  },
  cheatsheetBody: {
    marginTop: 14,
  },
  sectionHeader: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 10,
    marginBottom: 6,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  categoryChipTitle: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "bold",
  },
  categoryChipCommand: {
    color: "#94a3b8",
    fontSize: 10,
  },
  exampleBox: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  exampleText: {
    color: "#94a3b8",
    fontSize: 12,
  },
  boldText: {
    color: "#f8fafc",
    fontWeight: "bold",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tagChip: {
    backgroundColor: "#0f172a",
    borderColor: "#475569",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagChipText: {
    color: "#38bdf8",
    fontSize: 11,
  },
  fullPhraseBox: {
    backgroundColor: "#0f172a",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  fullPhraseTitle: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 4,
  },
  fullPhraseCode: {
    color: "#38bdf8",
    fontSize: 12,
    fontStyle: "italic",
    lineHeight: 18,
  },
});
