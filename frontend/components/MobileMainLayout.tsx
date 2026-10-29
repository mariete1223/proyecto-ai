import React, { useEffect, useMemo, useState } from "react";
import {
  GestureResponderEvent,
  Image,
  Modal,
  PanResponder,
  PanResponderGestureState,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { checkBackendHealth, WebApiConfig } from "../services/webApi";
import { theme } from "../styles/theme";

const appLogo = require("../assets/logo-small.png");

export type MobileTab =
  "VOICE_CAPTURE" | "CALENDAR" | "PENDING_TASKS" | "EXPLORER" | "LLM_IMPORT";

export const ORDERED_MOBILE_TABS: MobileTab[] = [
  "VOICE_CAPTURE",
  "CALENDAR",
  "PENDING_TASKS",
  "EXPLORER",
  "LLM_IMPORT",
];

export function getSwipePanResponderConfig(
  activeTab: MobileTab,
  onTabChange: (tab: MobileTab) => void,
) {
  const isHorizontalSwipe = (dx: number, dy: number) => {
    return Math.abs(dx) >= 20 && Math.abs(dx) > Math.abs(dy) * 1.5;
  };

  return {
    onStartShouldSetPanResponder: () => false,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: (
      _evt: GestureResponderEvent,
      gestureState: PanResponderGestureState,
    ) => {
      return isHorizontalSwipe(gestureState.dx, gestureState.dy);
    },
    onMoveShouldSetPanResponderCapture: (
      _evt: GestureResponderEvent,
      gestureState: PanResponderGestureState,
    ) => {
      return isHorizontalSwipe(gestureState.dx, gestureState.dy);
    },
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (
      _evt: GestureResponderEvent,
      gestureState: PanResponderGestureState,
    ) => {
      const { dx, dy } = gestureState;
      const isHorizontalDominant = Math.abs(dx) > Math.abs(dy) * 1.5;
      const minSwipeDistance = 40;

      if (!isHorizontalDominant || Math.abs(dx) < minSwipeDistance) {
        return;
      }

      const currentIdx = ORDERED_MOBILE_TABS.indexOf(activeTab);
      if (currentIdx === -1) return;

      if (dx <= -minSwipeDistance) {
        // Swipe Left -> Next tab
        if (currentIdx < ORDERED_MOBILE_TABS.length - 1) {
          const nextTab = ORDERED_MOBILE_TABS[currentIdx + 1];
          onTabChange(nextTab);
        }
      } else if (dx >= minSwipeDistance) {
        // Swipe Right -> Previous tab
        if (currentIdx > 0) {
          const prevTab = ORDERED_MOBILE_TABS[currentIdx - 1];
          onTabChange(prevTab);
        }
      }
    },
  };
}

export interface MobileMainLayoutProps {
  apiConfig: WebApiConfig;
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  stats?: {
    totalEntries?: number;
    pendingTasks?: number;
    totalCategories?: number;
  };
  onSync?: () => void;
  isSyncing?: boolean;
  currentUserEmail?: string | null;
  onOpenAuth?: () => void;
  onLogout?: () => void;
  onOpenOnboarding?: () => void;
  onOpenOfflineNotice?: () => void;
  children: React.ReactNode;
}

export function MobileMainLayout({
  apiConfig,
  activeTab,
  onTabChange,
  stats,
  onSync,
  isSyncing,
  currentUserEmail,
  onOpenAuth,
  onLogout,
  onOpenOnboarding,
  onOpenOfflineNotice,
  children,
}: MobileMainLayoutProps) {
  const [isBackendConnected, setIsBackendConnected] = useState<boolean | null>(
    null,
  );
  const [showAccountModal, setShowAccountModal] = useState(false);

  useEffect(() => {
    let mounted = true;
    checkBackendHealth(apiConfig).then((healthy) => {
      if (mounted) {
        setIsBackendConnected(healthy);
      }
    });
    return () => {
      mounted = false;
    };
  }, [apiConfig]);

  const handleManualSync = () => {
    checkBackendHealth(apiConfig).then((healthy) => {
      setIsBackendConnected(healthy);
    });
    onSync?.();
  };

  const webContainerStyle =
    Platform.OS === "web"
      ? ({ minHeight: "100%", height: "100%" } as any)
      : undefined;

  const webTopHeaderStyle =
    Platform.OS === "web"
      ? ({
          paddingTop: "max(8px, env(safe-area-inset-top, 0px))",
          paddingBottom: "8px",
        } as any)
      : undefined;

  const webContentAreaStyle =
    Platform.OS === "web"
      ? ({
          paddingBottom:
            "calc(max(8px, env(safe-area-inset-bottom, 0px)) + 54px)",
        } as any)
      : undefined;

  const webBottomTabBarStyle =
    Platform.OS === "web"
      ? ({
          paddingBottom: "max(8px, env(safe-area-inset-bottom, 0px))",
        } as any)
      : undefined;

  const panResponder = useMemo(
    () =>
      PanResponder.create(getSwipePanResponderConfig(activeTab, onTabChange)),
    [activeTab, onTabChange],
  );

  return (
    <View
      style={[styles.container, webContainerStyle]}
      testID="mobile-main-layout"
    >
      <StatusBar style="light" />

      {/* Mobile Top Bar */}
      <View
        style={[styles.topHeader, webTopHeaderStyle]}
        nativeID="vox-mobile-header"
        {...({ id: "vox-mobile-header" } as any)}
      >
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Image
              source={appLogo}
              style={styles.logoImage}
              resizeMode="cover"
              accessibilityLabel="VoxDaily Icon"
            />
          </View>
          <View style={styles.titleColumn}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              VoxDaily
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              Voice Journal
            </Text>
          </View>
        </View>

        {/* Right Action Chips */}
        <View style={styles.headerRight}>
          <Pressable
            style={[
              styles.authChip,
              {
                borderColor: "rgba(56, 189, 248, 0.4)",
                backgroundColor: "rgba(56, 189, 248, 0.12)",
              },
            ]}
            onPress={onOpenOnboarding}
            testID="btn-open-onboarding"
            accessibilityRole="button"
            accessibilityLabel="Abrir tutorial de bienvenida"
          >
            <Text style={[styles.authChipText, { color: "#38BDF8" }]}>
              💡 Guía
            </Text>
          </Pressable>

          {currentUserEmail ? (
            <Pressable
              style={[
                styles.statusChip,
                isBackendConnected === true
                  ? styles.statusChipConnected
                  : isBackendConnected === false
                    ? styles.statusChipOffline
                    : undefined,
              ]}
              onPress={() => setShowAccountModal(true)}
              testID="btn-connection-status"
              accessibilityRole="button"
              accessibilityLabel="Estado de conexión y cuenta"
            >
              <View
                style={[
                  styles.statusDot,
                  isBackendConnected === true
                    ? styles.dotConnected
                    : isBackendConnected === false
                      ? styles.dotDisconnected
                      : styles.dotPending,
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  isBackendConnected === false && styles.statusTextOffline,
                ]}
              >
                {isBackendConnected === true
                  ? "Online"
                  : isBackendConnected === false
                    ? "Offline"
                    : "..."}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.statusChip, styles.statusChipOffline]}
              onPress={onOpenOfflineNotice}
              testID="btn-mobile-offline-mode"
              accessibilityRole="button"
              accessibilityLabel="Modo offline sin conexión"
            >
              <View style={[styles.statusDot, styles.dotDisconnected]} />
              <Text style={[styles.statusText, styles.statusTextOffline]}>
                Offline
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Main Content Scroll Area with Horizontal Swipe PanResponder */}
      <View
        style={[styles.contentArea, webContentAreaStyle]}
        nativeID="vox-mobile-content-area"
        testID="mobile-content-area"
        {...({ id: "vox-mobile-content-area" } as any)}
      >
        <View
          style={[
            styles.swipeContainer,
            Platform.OS === "web"
              ? ({ touchAction: "pan-y" } as any)
              : undefined,
          ]}
          testID="mobile-swipe-container"
          {...panResponder.panHandlers}
        >
          {children}
        </View>
      </View>

      {/* Fixed Bottom Navigation Bar (Standard Mobile Bottom Tabs) */}
      <View
        style={[styles.bottomTabBar, webBottomTabBarStyle]}
        nativeID="vox-mobile-bottom-bar"
        testID="mobile-bottom-tab-bar"
        {...({ id: "vox-mobile-bottom-bar" } as any)}
      >
        <Pressable
          style={[
            styles.tabItem,
            activeTab === "VOICE_CAPTURE" && styles.activeTabItem,
          ]}
          onPress={() => onTabChange("VOICE_CAPTURE")}
          testID="mobile-tab-voice"
        >
          <Text style={styles.tabIcon}>🎙️</Text>
          <Text
            style={[
              styles.tabLabel,
              activeTab === "VOICE_CAPTURE" && styles.activeTabLabel,
            ]}
          >
            Captura
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.tabItem,
            activeTab === "CALENDAR" && styles.activeTabItem,
          ]}
          onPress={() => onTabChange("CALENDAR")}
          testID="mobile-tab-calendar"
        >
          <Text style={styles.tabIcon}>📅</Text>
          <Text
            style={[
              styles.tabLabel,
              activeTab === "CALENDAR" && styles.activeTabLabel,
            ]}
          >
            Calendario
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.tabItem,
            activeTab === "PENDING_TASKS" && styles.activeTabItem,
          ]}
          onPress={() => onTabChange("PENDING_TASKS")}
          testID="mobile-tab-tasks"
        >
          <Text style={styles.tabIcon}>☑️</Text>
          <Text
            style={[
              styles.tabLabel,
              activeTab === "PENDING_TASKS" && styles.activeTabLabel,
            ]}
          >
            Tareas
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.tabItem,
            activeTab === "EXPLORER" && styles.activeTabItem,
          ]}
          onPress={() => onTabChange("EXPLORER")}
          testID="mobile-tab-explorer"
        >
          <Text style={styles.tabIcon}>🏷️</Text>
          <Text
            style={[
              styles.tabLabel,
              activeTab === "EXPLORER" && styles.activeTabLabel,
            ]}
          >
            Categorías
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.tabItem,
            activeTab === "LLM_IMPORT" && styles.activeTabItem,
          ]}
          onPress={() => onTabChange("LLM_IMPORT")}
          testID="mobile-tab-llm"
        >
          <Text style={styles.tabIcon}>🤖</Text>
          <Text
            style={[
              styles.tabLabel,
              activeTab === "LLM_IMPORT" && styles.activeTabLabel,
            ]}
          >
            IA LLM
          </Text>
        </Pressable>
      </View>

      {/* Account & Connection Modal */}
      <Modal
        visible={showAccountModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAccountModal(false)}
        testID="modal-account-status"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.accountCard}>
            <View style={styles.accountCardHeader}>
              <Text style={styles.accountCardTitle}>Conexión y Cuenta</Text>
              <Pressable
                style={styles.closeCardBtn}
                onPress={() => setShowAccountModal(false)}
                testID="btn-close-account-modal"
              >
                <Text style={styles.closeCardBtnText}>✕</Text>
              </Pressable>
            </View>

            {/* Connection status section */}
            <View style={styles.statusDetailRow}>
              <View
                style={[
                  styles.statusDotLarge,
                  isBackendConnected === true
                    ? styles.dotConnected
                    : styles.dotDisconnected,
                ]}
              />
              <View style={styles.statusDetailCol}>
                <Text style={styles.statusDetailTitle}>
                  {isBackendConnected === true
                    ? "Conectado al servidor"
                    : isBackendConnected === false
                      ? "Operando en Modo Local"
                      : "Comprobando conexión..."}
                </Text>
                <Text style={styles.statusDetailSubtitle}>
                  {isBackendConnected === true
                    ? "Sincronización en tiempo real activa"
                    : "Servidor no disponible. Tus datos se guardan en este dispositivo y se sincronizarán al reconectar."}
                </Text>
              </View>
            </View>

            {/* User section */}
            {currentUserEmail && (
              <View style={styles.userEmailRow}>
                <Text style={styles.userLabelText}>Sesión activa:</Text>
                <Text style={styles.userEmailText}>{currentUserEmail}</Text>
              </View>
            )}

            {/* Actions */}
            <View style={styles.accountActionsRow}>
              {currentUserEmail && (
                <Pressable
                  style={styles.logoutBtn}
                  onPress={() => {
                    setShowAccountModal(false);
                    onLogout?.();
                  }}
                  testID="btn-confirm-logout"
                >
                  <Text style={styles.logoutBtnText}>🚪 Cerrar Sesión</Text>
                </Pressable>
              )}
              <Pressable
                style={styles.closeModalBtn}
                onPress={() => setShowAccountModal(false)}
              >
                <Text style={styles.closeModalBtnText}>Volver</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export const isIosDevice =
  Platform.OS === "web"
    ? typeof navigator !== "undefined" &&
      (/iPhone|iPad|iPod/i.test(navigator?.userAgent || "") ||
        (navigator?.platform === "MacIntel" &&
          (navigator?.maxTouchPoints || 0) > 1))
    : Platform.OS === "ios";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    width: "100%",
    maxWidth: "100%",
    minHeight: "100%",
    overflow: "hidden",
  },
  topHeader: {
    paddingTop:
      Platform.OS === "web" ? 8 : (RNStatusBar.currentHeight || 20) + 4,
    paddingBottom: 8,
    paddingHorizontal: 12,
    backgroundColor: "#1e293b",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexShrink: 1,
    minWidth: 0,
  },
  titleColumn: {
    flexShrink: 1,
    minWidth: 0,
  },
  logoBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
  },
  logoImage: {
    width: 28,
    height: 28,
    borderRadius: 7,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    color: "#94a3b8",
    fontSize: 9,
    fontWeight: "500",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 0,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  dotConnected: {
    backgroundColor: theme.colors.success,
  },
  dotDisconnected: {
    backgroundColor: theme.colors.danger,
  },
  dotPending: {
    backgroundColor: theme.colors.warning,
  },
  statusText: {
    color: "#cbd5e1",
    fontSize: 10,
    fontWeight: "600",
  },
  statusTextOffline: {
    color: "#F87171",
  },
  contentArea: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 54, // Intrinsic clearance for bottom tab bar
    width: "100%",
  },
  swipeContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  bottomTabBar: {
    position: (Platform.OS === "web" ? "fixed" : "absolute") as any,
    bottom: 0,
    left: 0,
    right: 0,
    minHeight: 50,
    backgroundColor: "#1e293b",
    borderTopWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 2,
    zIndex: 100,
    elevation: 8,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 3,
  },
  activeTabItem: {
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    borderRadius: 8,
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "500",
  },
  activeTabLabel: {
    color: "#38bdf8",
    fontWeight: "700",
  },
  authChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  authChipText: {
    color: "#93C5FD",
    fontSize: 10,
    fontWeight: "600",
  },
  statusChipConnected: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  statusChipOffline: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  statusDotLarge: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  accountCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#1e293b",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  accountCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  accountCardTitle: {
    color: "#f8fafc",
    fontSize: 17,
    fontWeight: "700",
  },
  closeCardBtn: {
    padding: 6,
  },
  closeCardBtnText: {
    color: "#94a3b8",
    fontSize: 16,
    fontWeight: "bold",
  },
  statusDetailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    marginBottom: 14,
  },
  statusDetailCol: {
    flex: 1,
  },
  statusDetailTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  statusDetailSubtitle: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 16,
  },
  userEmailRow: {
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  userLabelText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  userEmailText: {
    color: "#38bdf8",
    fontSize: 14,
    fontWeight: "600",
  },
  accountActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  logoutBtn: {
    flex: 1,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutBtnText: {
    color: "#f87171",
    fontSize: 13,
    fontWeight: "700",
  },
  closeModalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  closeModalBtnText: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "600",
  },
});
