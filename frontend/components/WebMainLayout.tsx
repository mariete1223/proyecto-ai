import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { checkBackendHealth, WebApiConfig } from "../services/webApi";

export interface WebMainLayoutProps {
  apiConfig: WebApiConfig;
  onTabChange?: (
    tab: "CALENDAR" | "PENDING_TASKS" | "EXPLORER" | "CONFLICTS",
  ) => void;
  children?: React.ReactNode;
}

export function WebMainLayout({
  apiConfig,
  onTabChange,
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Proyecto AI - Web Desktop View</Text>
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

      {/* Nav Tabs */}
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
            Calendario
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
            Tareas Pendientes
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
            Categorías y Etiquetas
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
            Conflictos Sync
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
    backgroundColor: "#f0f2f5",
    width: "100%",
    minHeight: "100%",
  },
  header: {
    height: 60,
    backgroundColor: "#1e293b",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotConnected: {
    backgroundColor: "#10b981",
  },
  dotDisconnected: {
    backgroundColor: "#ef4444",
  },
  dotPending: {
    backgroundColor: "#f59e0b",
  },
  statusText: {
    color: "#94a3b8",
    fontSize: 13,
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
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 24,
  },
  navButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeNavButton: {
    borderBottomColor: "#2563eb",
  },
  navButtonText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
  activeNavButtonText: {
    color: "#2563eb",
    fontWeight: "600",
  },
  contentArea: {
    flex: 1,
    padding: 24,
    maxWidth: 1200,
    alignSelf: "center",
    width: "100%",
  },
});
