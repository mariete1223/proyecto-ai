import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
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
import { notificationService } from "../services/notificationService";

export const MOBILE_NOTIF_BANNER_DISMISSED_KEY =
  "voxdaily_notif_banner_dismissed";

function getStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
    if (
      typeof globalThis !== "undefined" &&
      (globalThis as unknown as { localStorage?: Storage }).localStorage
    ) {
      return (globalThis as unknown as { localStorage: Storage }).localStorage;
    }
  } catch {
    // ignore
  }
  return null;
}

function isNotifBannerDismissedInStorage(): boolean {
  const storage = getStorage();
  if (storage) {
    try {
      return storage.getItem(MOBILE_NOTIF_BANNER_DISMISSED_KEY) === "true";
    } catch {
      // ignore
    }
  }
  return false;
}

export interface MobileHomeVoiceViewProps {
  db: DatabaseAdapter;
  userId: string;
  onOpenManualForm: () => void;
  onOpenLlmImport: () => void;
  onEntryCreated?: (entryId?: string) => void | Promise<void>;
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
  const [notifStatus, setNotifStatus] = useState<string>(() =>
    notificationService.getPermissionStatus(),
  );
  const [isActivatingNotif, setIsActivatingNotif] = useState<boolean>(false);
  const [showUnsupportedGuidance, setShowUnsupportedGuidance] =
    useState<boolean>(false);
  const [isNotifBannerDismissed, setIsNotifBannerDismissed] = useState<boolean>(
    () => isNotifBannerDismissedInStorage(),
  );

  const handleDismissNotifBanner = () => {
    setIsNotifBannerDismissed(true);
    const storage = getStorage();
    if (storage) {
      try {
        storage.setItem(MOBILE_NOTIF_BANNER_DISMISSED_KEY, "true");
      } catch {
        // ignore
      }
    }
  };

  const handleActivateNotifications = async () => {
    setIsActivatingNotif(true);
    let timerId: ReturnType<typeof setTimeout> | null = null;
    try {
      const fallbackStatus = notificationService.getPermissionStatus();
      const status = await Promise.race([
        notificationService.requestPermissions(),
        new Promise<string>((resolve) => {
          timerId = setTimeout(() => resolve(fallbackStatus), 3500);
        }),
      ]);
      setNotifStatus(status);
      if (status === "granted") {
        setShowUnsupportedGuidance(false);
        notificationService.subscribeToWebPush().catch(() => {});
      } else if (status === "unsupported") {
        setShowUnsupportedGuidance(true);
      }
    } catch {
      const fallbackStatus = notificationService.getPermissionStatus();
      setNotifStatus(fallbackStatus);
      if (fallbackStatus === "unsupported") {
        setShowUnsupportedGuidance(true);
      }
    } finally {
      if (timerId !== null) {
        clearTimeout(timerId);
      }
      setIsActivatingNotif(false);
    }
  };

  useEffect(() => {
    const latestStatus = notificationService.getPermissionStatus();
    setNotifStatus(latestStatus);
    if (latestStatus === "granted") {
      setShowUnsupportedGuidance(false);
    }
    setIsNotifBannerDismissed(isNotifBannerDismissedInStorage());
  }, [refreshSignal]);

  useEffect(() => {
    if (typeof notificationService.onPermissionChange !== "function") {
      return;
    }
    const unsubscribe = notificationService.onPermissionChange((newStatus) => {
      setNotifStatus(newStatus);
      if (newStatus === "granted") {
        setShowUnsupportedGuidance(false);
      }
    });
    return unsubscribe;
  }, []);

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

  const webContainerStyle =
    Platform.OS === "web"
      ? ({
          height: "100%",
          maxHeight: "100%",
          minHeight: 0,
          overflow: "hidden",
        } as any)
      : undefined;

  const webMainLayoutWrapperStyle =
    Platform.OS === "web"
      ? ({
          height: "100%",
          maxHeight: "100%",
          minHeight: 0,
          overflow: "hidden",
        } as any)
      : undefined;

  const webScrollAreaStyle =
    Platform.OS === "web"
      ? ({
          flex: "1 1 0%",
          minHeight: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        } as any)
      : undefined;

  return (
    <View
      style={[styles.container, webContainerStyle]}
      testID="mobile-home-voice-view"
    >
      {!activeVoiceModal ? (
        <View style={[styles.mainLayoutWrapper, webMainLayoutWrapperStyle]}>
          {/* Upper Reading Zone: Scrollable Title & Commands Cheatsheet */}
          <ScrollView
            style={[styles.scrollArea, webScrollAreaStyle]}
            contentContainerStyle={styles.scrollContentContainer}
            testID="mobile-home-scroll-area"
            showsVerticalScrollIndicator={true}
          >
            <View style={styles.titleCard}>
              <Text style={styles.heroTitle}>Dictado y Captura de Voz</Text>
              <Text style={styles.heroSubtitle}>
                Presiona el micrófono en grande para grabar tu voz. Recuerda que
                puedes crear todas las categorías y etiquetas que necesites para
                organizarte a tu medida.
              </Text>
            </View>

            {/* Persistent Android / Mobile Web Notifications Status Banner (#148, #152) */}
            {!isNotifBannerDismissed && notifStatus !== "granted" && (
              <View
                style={styles.notifBanner}
                testID="mobile-notif-status-banner"
              >
                <View style={styles.notifBannerContent}>
                  <View style={styles.notifBannerHeaderRow}>
                    <Text
                      style={styles.notifBannerTitle}
                      testID="mobile-notif-banner-title"
                    >
                      {notifStatus === "denied"
                        ? "🚫 Notificaciones bloqueadas"
                        : showUnsupportedGuidance
                          ? "📲 Añade la web a Inicio en iPhone/iPad"
                          : "🔔 Notificaciones inactivas"}
                    </Text>
                    {(notifStatus === "denied" || showUnsupportedGuidance) && (
                      <Pressable
                        testID="btn-close-notif-banner"
                        style={styles.notifBannerCloseBtn}
                        onPress={handleDismissNotifBanner}
                        accessibilityLabel="Cerrar aviso de notificaciones"
                      >
                        <Text style={styles.notifBannerCloseText}>✕</Text>
                      </Pressable>
                    )}
                  </View>
                  <Text
                    style={styles.notifBannerDesc}
                    testID="mobile-notif-banner-desc"
                  >
                    {notifStatus === "denied"
                      ? "Para recibir avisos con la pantalla apagada en Android, pulsa el icono 🔒 en la barra de Chrome y activa 'Permitir notificaciones'."
                      : showUnsupportedGuidance
                        ? "En Safari para iPhone/iPad, pulsa Compartir (⬆️) y selecciona «Añadir a pantalla de inicio» para activar las notificaciones Web Push."
                        : "Actívalas para que tus avisos y alertas te despierten incluso con la pantalla apagada."}
                  </Text>
                </View>
                {notifStatus === "denied" || showUnsupportedGuidance ? (
                  <Pressable
                    testID="btn-dismiss-notif-banner"
                    style={styles.notifBannerDismissButton}
                    onPress={handleDismissNotifBanner}
                    accessibilityLabel="Entendido, ocultar aviso de notificaciones"
                  >
                    <Text style={styles.notifBannerDismissButtonText}>
                      Entendido
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    testID="btn-activate-notif-banner"
                    style={[
                      styles.notifBannerButton,
                      isActivatingNotif && styles.buttonDisabled,
                    ]}
                    disabled={isActivatingNotif}
                    onPress={handleActivateNotifications}
                    accessibilityLabel="Activar notificaciones"
                  >
                    <Text style={styles.notifBannerButtonText}>
                      {isActivatingNotif ? "Activando..." : "Activar 🔔"}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* Cheatsheet section in reading area */}
            <View style={styles.cheatsheetCard}>
              <View style={styles.cheatsheetHeader}>
                <Text style={styles.cheatsheetTitle}>💡 Comandos por Voz</Text>
                <Pressable
                  style={styles.toggleCheatsheetButton}
                  onPress={() => setShowCheatsheet(!showCheatsheet)}
                  accessibilityLabel="Alternar guía de comandos"
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
                    <Text style={styles.fullPhraseTitle}>
                      Ejemplo de frase:
                    </Text>
                    <Text style={styles.fullPhraseCode}>
                      "nota reunión de equipo mañana a las diez #urgente"
                    </Text>
                  </View>

                  <View style={styles.cheatsheetHintBox}>
                    <Text style={styles.cheatsheetHintText}>
                      ✨ Puedes crear las categorías y etiquetas que necesites
                      desde la pestaña "Explorador".
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Lower Thumb Zone: Pinned Action Dock (Big Mic & Quick Actions) */}
          <View
            style={styles.pinnedDockContainer}
            testID="mobile-pinned-dock-container"
          >
            {/* Dock separator boundary that distinguishes the pinned dock from the scrollable feed above */}
            <View style={styles.dockSurfaceSeparator} />

            <View style={styles.thumbZoneCard} testID="mobile-thumb-zone-card">
              <View style={styles.thumbZoneHeaderRow}>
                <View style={styles.thumbZoneGlowDot} />
                <Text style={styles.thumbZoneTitle}>Acción Rápida</Text>
              </View>

              {/* Big Mic Button in Thumb Reach */}
              <Pressable
                testID="btn-big-mic-start"
                style={styles.bigMicButton}
                onPress={() => setActiveVoiceModal(true)}
                accessibilityLabel="Iniciar grabación de voz"
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
                  accessibilityLabel="Escritura libre o manual"
                >
                  <Text style={styles.quickActionText}>✍️ Escritura Libre</Text>
                </Pressable>

                <Pressable
                  testID="btn-mobile-llm-import"
                  style={styles.quickActionAiButton}
                  onPress={onOpenLlmImport}
                  accessibilityLabel="Estructurar con inteligencia artificial"
                >
                  <Text style={styles.quickActionAiText}>
                    🤖 Estructurar con IA
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      ) : (
        /* Voice Capture Component Overlay Container (Pinned action buttons in thumb reach) */
        <View
          style={styles.voiceModalContainer}
          testID="mobile-voice-capture-panel"
        >
          <View style={styles.voiceModalCard}>
            <View style={styles.voiceModalHeader}>
              <Text style={styles.voiceModalTitle}>
                🎙️ Captura de Voz Activa
              </Text>

              <Pressable
                testID="btn-close-mobile-voice"
                style={styles.closeModalButton}
                onPress={() => setActiveVoiceModal(false)}
              >
                <Text style={styles.closeModalText}>✕ Cerrar</Text>
              </Pressable>
            </View>

            <View style={styles.voiceModalFlowWrapper}>
              <VoiceCaptureFlow
                db={db}
                userId={userId}
                saveMode="PREVIEW_BEFORE_SAVE"
                onEntryCreated={(createdId) => {
                  setActiveVoiceModal(false);
                  onEntryCreated?.(createdId);
                }}
                onClose={() => setActiveVoiceModal(false)}
              />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
    minHeight: 0,
    overflow: "hidden",
  },
  contentContainer: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  mainLayoutWrapper: {
    flex: 1,
    height: "100%",
    minHeight: 0,
    overflow: "hidden",
    justifyContent: "space-between",
    width: "100%",
  },
  scrollArea: {
    flex: 1,
    minHeight: 0,
    width: "100%",
  },
  scrollContentContainer: {
    paddingBottom: 24,
  },
  voiceModalScrollView: {
    flex: 1,
    width: "100%",
  },
  voiceModalContentContainer: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  readingSection: {
    width: "100%",
  },
  titleCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#334155",
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
    marginBottom: 6,
    textAlign: "center",
  },
  heroSubtitle: {
    color: "#94a3b8",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  pinnedDockContainer: {
    width: "100%",
    flexShrink: 0,
    backgroundColor: "rgba(15, 23, 42, 0.96)",
    paddingTop: 8,
    paddingBottom: Platform.OS === "web" ? 16 : 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(56, 189, 248, 0.2)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  dockSurfaceSeparator: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    marginBottom: 6,
    width: "100%",
  },
  thumbZoneCard: {
    backgroundColor: "#1e293b",
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 4,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#334155",
    shadowColor: "#0284c7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
    flexShrink: 0,
    width: "100%",
  },
  thumbZoneHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  thumbZoneGlowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#38bdf8",
  },
  thumbZoneTitle: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  bigMicButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#38bdf8",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
    marginBottom: 10,
  },
  bigMicInnerRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
  },
  bigMicIcon: {
    fontSize: 38,
  },
  bigMicLabel: {
    color: "#38bdf8",
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 16,
  },
  quickActionsRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    justifyContent: "center",
  },
  quickActionButton: {
    backgroundColor: "#334155",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  quickActionText: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "600",
  },
  quickActionAiButton: {
    backgroundColor: "#4f46e5",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  quickActionAiText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold",
  },
  voiceModalContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
    minHeight: 0,
    overflow: "hidden",
    paddingBottom: Platform.OS === "web" ? 16 : 14,
  },
  voiceModalCard: {
    backgroundColor: "#1e293b",
    borderColor: "#38bdf8",
    borderWidth: 1.5,
    borderRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 10,
    flex: 1,
    width: "100%",
    minHeight: 0,
    overflow: "hidden",
  },
  voiceModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    flexShrink: 0,
  },
  voiceModalFlowWrapper: {
    flex: 1,
    width: "100%",
    minHeight: 0,
    overflow: "hidden",
  },
  voiceModalTitle: {
    color: "#38bdf8",
    fontSize: 16,
    fontWeight: "bold",
  },
  closeModalButton: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderWidth: 1.5,
    borderColor: "#EF4444",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  closeModalText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "bold",
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
  cheatsheetHintBox: {
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    borderColor: "rgba(56, 189, 248, 0.25)",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  cheatsheetHintText: {
    color: "#38bdf8",
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    fontWeight: "500",
  },
  notifBanner: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderColor: "#F59E0B",
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  notifBannerContent: {
    flex: 1,
    minWidth: 180,
  },
  notifBannerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  notifBannerTitle: {
    color: "#FDE68A",
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  notifBannerCloseBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  notifBannerCloseText: {
    color: "#FDE68A",
    fontSize: 12,
    fontWeight: "700",
  },
  notifBannerDesc: {
    color: "#FDE047",
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.9,
  },
  notifBannerButton: {
    backgroundColor: "#F59E0B",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  notifBannerButtonText: {
    color: "#0F172A",
    fontSize: 12,
    fontWeight: "800",
  },
  notifBannerDismissButton: {
    backgroundColor: "rgba(245, 158, 11, 0.25)",
    borderWidth: 1,
    borderColor: "#F59E0B",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  notifBannerDismissButtonText: {
    color: "#FDE68A",
    fontSize: 12,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
