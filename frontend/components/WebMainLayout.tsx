import React, { useEffect, useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { checkBackendHealth, WebApiConfig } from "../services/webApi";
import { theme } from "../styles/theme";

const appLogo = require("../assets/logo-small.png");

export interface WebMainLayoutProps {
  apiConfig: WebApiConfig;
  activeTab?:
    "CALENDAR" | "PENDING_TASKS" | "EXPLORER" | "CONFLICTS" | "LLM_IMPORT";
  onTabChange?: (
    tab: "CALENDAR" | "PENDING_TASKS" | "EXPLORER" | "CONFLICTS" | "LLM_IMPORT",
  ) => void;
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
  children?: React.ReactNode;
}

export function WebMainLayout({
  apiConfig,
  activeTab: activeTabProp,
  onTabChange,
  stats,
  onSync,
  isSyncing,
  currentUserEmail,
  onOpenAuth,
  onLogout,
  onOpenOnboarding,
  children,
}: WebMainLayoutProps) {
  const { width } = useWindowDimensions();
  const isCompact = width < 900;
  const isNarrow = width < 600;

  const [activeTab, setActiveTab] = useState<
    "CALENDAR" | "PENDING_TASKS" | "EXPLORER" | "CONFLICTS" | "LLM_IMPORT"
  >(activeTabProp || "CALENDAR");

  useEffect(() => {
    if (activeTabProp) {
      setActiveTab(activeTabProp);
    }
  }, [activeTabProp]);
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

  const handleTabSelect = (
    tab: "CALENDAR" | "PENDING_TASKS" | "EXPLORER" | "CONFLICTS" | "LLM_IMPORT",
  ) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  return (
    <View style={styles.container} testID="web-main-layout">
      {/* Top Header */}
      <View style={styles.header}>
        <View
          style={[
            styles.headerInner,
            {
              paddingHorizontal: isNarrow ? 12 : isCompact ? 18 : 28,
              gap: isNarrow ? 8 : 12,
            },
          ]}
        >
          <View style={styles.brandContainer}>
            <View style={styles.logoBadge}>
              <Image
                source={appLogo}
                style={styles.logoImage}
                resizeMode="cover"
                accessibilityLabel="VoxDaily Icon"
              />
            </View>
            <View>
              <Text style={styles.headerTitle}>VoxDaily</Text>
              <Text style={styles.headerSubtitle}>
                Voice Journal & Calendar
              </Text>
            </View>
          </View>

          {/* Quick Stats Bar */}
          <View style={styles.statsBar} testID="web-quick-stats">
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats?.totalEntries ?? 0}</Text>
              <Text style={styles.statLabel}>Entradas</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.colors.warning }]}>
                {stats?.pendingTasks ?? 0}
              </Text>
              <Text style={styles.statLabel}>Pendientes</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.colors.purple }]}>
                {stats?.totalCategories ?? 0}
              </Text>
              <Text style={styles.statLabel}>Categorías</Text>
            </View>
          </View>

          {/* Guía Tutorial Button */}
          <Pressable
            style={({ pressed }) => [
              styles.authBadge,
              {
                borderColor: "rgba(56, 189, 248, 0.4)",
                backgroundColor: "rgba(56, 189, 248, 0.12)",
              },
              pressed && { opacity: 0.7 },
            ]}
            onPress={onOpenOnboarding}
            testID="btn-open-onboarding"
            accessibilityRole="button"
            accessibilityLabel="Abrir tutorial de bienvenida"
          >
            <Text style={[styles.authBadgeText, { color: "#38BDF8" }]}>
              💡 Guía
            </Text>
          </Pressable>

          {/* User Account / Auth Button */}
          <Pressable
            style={({ pressed }) => [
              styles.authBadge,
              pressed && { opacity: 0.7 },
            ]}
            onPress={currentUserEmail ? onLogout : onOpenAuth}
            testID="btn-user-auth"
          >
            <Text style={styles.authBadgeText}>
              {currentUserEmail
                ? `👤 ${currentUserEmail} (Salir)`
                : "👤 Iniciar Sesión"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Backend Unreachable Banner */}
      {isBackendConnected === false && (
        <View style={styles.unreachableBanner} testID="web-backend-unreachable">
          <Text style={styles.unreachableText}>
            Servidor backend no disponible. La aplicación está operando en Modo
            Local en este dispositivo. Tus cambios se guardan localmente y se
            sincronizarán automáticamente cuando el servidor vuelva a estar en
            línea.
          </Text>
          {Platform.OS === "web" && typeof window !== "undefined" && (
            <Pressable
              style={{
                marginTop: 6,
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: 6,
                alignSelf: "flex-start",
              }}
              onPress={() => {
                const current =
                  window.localStorage?.getItem("custom_backend_url") ||
                  apiConfig.baseUrl;
                const newUrl = window.prompt(
                  "Introduce la URL de tu backend (ej. túnel Cloudflare o Render):",
                  current,
                );
                if (newUrl && newUrl.trim() && newUrl.trim() !== current) {
                  window.localStorage?.setItem(
                    "custom_backend_url",
                    newUrl.trim().replace(/\/+$/, ""),
                  );
                  window.location.reload();
                }
              }}
              testID="btn-configure-backend-url"
            >
              <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "600" }}>
                ⚙️ Cambiar URL del Backend
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Glassmorphic Navigation Bar */}
      <View style={styles.navBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.navBarScroll,
            { justifyContent: isCompact ? "flex-start" : "center" },
          ]}
        >
          <Pressable
            style={[
              styles.navButton,
              activeTab === "CALENDAR" && styles.activeNavButton,
            ]}
            onPress={() => handleTabSelect("CALENDAR")}
            testID="nav-calendar"
          >
            <Text
              style={[
                styles.navButtonText,
                activeTab === "CALENDAR" && styles.activeNavButtonText,
              ]}
            >
              📅 Calendario
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.navButton,
              activeTab === "PENDING_TASKS" && styles.activeNavButton,
            ]}
            onPress={() => handleTabSelect("PENDING_TASKS")}
            testID="nav-pending-tasks"
          >
            <Text
              style={[
                styles.navButtonText,
                activeTab === "PENDING_TASKS" && styles.activeNavButtonText,
              ]}
            >
              ☑️ Tareas Pendientes
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.navButton,
              activeTab === "EXPLORER" && styles.activeNavButton,
            ]}
            onPress={() => handleTabSelect("EXPLORER")}
            testID="nav-explorer"
          >
            <Text
              style={[
                styles.navButtonText,
                activeTab === "EXPLORER" && styles.activeNavButtonText,
              ]}
            >
              🏷️ Categorías y Etiquetas
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.navButton,
              activeTab === "CONFLICTS" && styles.activeNavButton,
            ]}
            onPress={() => handleTabSelect("CONFLICTS")}
            testID="nav-conflicts"
          >
            <Text
              style={[
                styles.navButtonText,
                activeTab === "CONFLICTS" && styles.activeNavButtonText,
              ]}
            >
              ⚡ Conflictos Sync
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.navButton,
              activeTab === "LLM_IMPORT" && styles.activeNavButton,
            ]}
            onPress={() => handleTabSelect("LLM_IMPORT")}
            testID="nav-llm-import"
          >
            <Text
              style={[
                styles.navButtonText,
                activeTab === "LLM_IMPORT" && styles.activeNavButtonText,
              ]}
            >
              🤖 Estructurar con IA
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Main Content Area */}
      <View
        style={[
          styles.contentArea,
          {
            padding: isNarrow ? 12 : isCompact ? 16 : 24,
          },
        ]}
        testID="web-content-area"
      >
        {children}
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
    alignItems: "center",
  },
  header: {
    width: "100%",
    backgroundColor: "#1e293b",
    borderBottomWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
  },
  headerInner: {
    width: "100%",
    maxWidth: 1280,
    paddingTop:
      Platform.OS === "web" ? 14 : (StatusBar.currentHeight || 44) + 8,
    paddingBottom: 14,
    paddingHorizontal: Platform.OS === "web" ? 28 : 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  brandContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
    shadowColor: "#38bdf8",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  logoImage: {
    width: 36,
    height: 36,
    borderRadius: 9,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "500",
  },
  statsBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  statItem: {
    alignItems: "center",
    paddingHorizontal: 10,
  },
  statValue: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  statLabel: {
    color: "#94a3b8",
    fontSize: 10,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  statDivider: {
    width: 1,
    height: 22,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
    fontSize: 13,
    fontWeight: "500",
  },
  unreachableBanner: {
    backgroundColor: "#fee2e2",
    borderBottomWidth: 1,
    borderColor: "#fca5a5",
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  unreachableText: {
    color: "#991b1b",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  navBar: {
    backgroundColor: "#1e293b",
    borderBottomWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    width: "100%",
    alignItems: "center",
  },
  navBarScroll: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    maxWidth: 1280,
    width: "100%",
    alignSelf: "center",
    justifyContent: Platform.OS === "web" ? "center" : "flex-start",
  },
  navButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  activeNavButton: {
    borderBottomColor: theme.colors.primary,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
  },
  navButtonText: {
    fontSize: 14,
    color: "#94a3b8",
    fontWeight: "500",
  },
  activeNavButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  contentArea: {
    flex: 1,
    padding: Platform.OS === "web" ? 24 : 12,
    maxWidth: 1200,
    alignSelf: "center",
    alignItems: "center",
    width: "100%",
  },
  authBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  authBadgeText: {
    color: "#93C5FD",
    fontSize: 12,
    fontWeight: "600",
  },
});
