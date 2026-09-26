import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { checkBackendHealth, WebApiConfig } from "../services/webApi";
import { theme } from "../styles/theme";

export interface WebMainLayoutProps {
  apiConfig: WebApiConfig;
  onTabChange?: (
    tab: "CALENDAR" | "PENDING_TASKS" | "EXPLORER" | "CONFLICTS",
  ) => void;
  stats?: {
    totalEntries?: number;
    pendingTasks?: number;
    totalCategories?: number;
  };
  children?: React.ReactNode;
}

export function WebMainLayout({
  apiConfig,
  onTabChange,
  stats,
  children,
}: WebMainLayoutProps) {
  const [activeTab, setActiveTab] = useState<
    "CALENDAR" | "PENDING_TASKS" | "EXPLORER" | "CONFLICTS"
  >("CALENDAR");
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
    tab: "CALENDAR" | "PENDING_TASKS" | "EXPLORER" | "CONFLICTS",
  ) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  return (
    <View style={styles.container} testID="web-main-layout">
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>AI</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Proyecto AI</Text>
            <Text style={styles.headerSubtitle}>Personal Knowledge Hub</Text>
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

        {/* Backend Status Indicator */}
        <View style={styles.statusIndicator}>
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
          <Text style={styles.statusText}>
            {isBackendConnected === true
              ? "Backend Conectado"
              : isBackendConnected === false
                ? "Backend Desconectado"
                : "Comprobando..."}
          </Text>
        </View>
      </View>

      {/* Backend Unreachable Banner */}
      {isBackendConnected === false && (
        <View style={styles.unreachableBanner} testID="web-backend-unreachable">
          <Text style={styles.unreachableText}>
            Servidor backend privado no disponible. En la versión web, las
            operaciones requieren conexión directa al backend FastAPI.
          </Text>
        </View>
      )}

      {/* Glassmorphic Navigation Bar */}
      <View style={styles.navBar}>
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
      </View>

      {/* Main Content Area */}
      <View style={styles.contentArea} testID="web-content-area">
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
  },
  header: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    backgroundColor: "#1e293b",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    flexWrap: "wrap",
    gap: 16,
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
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  logoBadgeText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 16,
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
    flexDirection: "row",
    backgroundColor: "#1e293b",
    borderBottomWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 24,
    gap: 8,
  },
  navButton: {
    paddingVertical: 14,
    paddingHorizontal: 18,
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
    padding: 24,
    maxWidth: 1280,
    alignSelf: "center",
    width: "100%",
  },
});
