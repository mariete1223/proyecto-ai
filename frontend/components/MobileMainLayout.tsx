import React, { useEffect, useState } from "react";
import {
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

export type MobileTab =
  | "VOICE_CAPTURE"
  | "CALENDAR"
  | "PENDING_TASKS"
  | "EXPLORER"
  | "LLM_IMPORT";

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
  children,
}: MobileMainLayoutProps) {
  const [isBackendConnected, setIsBackendConnected] = useState<boolean | null>(
    null,
  );

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

  return (
    <View style={styles.container} testID="mobile-main-layout">
      <StatusBar style="light" />

      {/* Mobile Top Bar */}
      <View style={styles.topHeader}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>AI</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Proyecto AI</Text>
            <Text style={styles.headerSubtitle}>Hub Personal</Text>
          </View>
        </View>

        {/* Connection Dot & Stats */}
        <View style={styles.headerRight}>
          <Pressable
            style={({ pressed }) => [
              styles.statusChip,
              pressed && { opacity: 0.7 },
            ]}
            onPress={handleManualSync}
            testID="btn-mobile-sync"
          >
            <View
              style={[
                styles.statusDot,
                isSyncing
                  ? styles.dotPending
                  : isBackendConnected === true
                    ? styles.dotConnected
                    : isBackendConnected === false
                      ? styles.dotDisconnected
                      : styles.dotPending,
              ]}
            />
            <Text style={styles.statusText}>
              {isSyncing
                ? "Sincronizando..."
                : isBackendConnected === true
                  ? "Conectado 🔄"
                  : isBackendConnected === false
                    ? "Offline ⚠️"
                    : "..."}
            </Text>
          </Pressable>

          <Pressable
            style={styles.authChip}
            onPress={currentUserEmail ? onLogout : onOpenAuth}
            testID="btn-mobile-auth"
          >
            <Text style={styles.authChipText}>
              {currentUserEmail ? "👤 Salir" : "👤 Entrar"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Main Content Scroll Area */}
      <View style={styles.contentArea} testID="mobile-content-area">
        {children}
      </View>

      {/* Fixed Bottom Navigation Bar (Standard Mobile Bottom Tabs) */}
      <View style={styles.bottomTabBar} testID="mobile-bottom-tab-bar">
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    width: "100%",
    minHeight: "100%",
  },
  topHeader: {
    paddingTop:
      Platform.OS === "web" ? 12 : (RNStatusBar.currentHeight || 44) + 6,
    paddingBottom: 10,
    paddingHorizontal: 16,
    backgroundColor: "#1e293b",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  logoBadgeText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 14,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  headerSubtitle: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "500",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
    fontSize: 11,
    fontWeight: "500",
  },
  contentArea: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 76, // Space for fixed bottom tab bar
    width: "100%",
  },
  bottomTabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    backgroundColor: "#1e293b",
    borderTopWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: Platform.OS === "ios" ? 10 : 0,
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
    paddingVertical: 6,
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
});
