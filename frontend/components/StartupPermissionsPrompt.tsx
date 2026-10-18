import React, { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { notificationService } from "../services/notificationService";

export const STARTUP_PERMS_STORAGE_KEY = "voxdaily_startup_perms_dismissed";

export interface StartupPermissionsPromptProps {
  backendUrl?: string;
  token?: string | null;
  onComplete?: () => void;
  /** For testing: force display even if already granted or dismissed */
  forceVisible?: boolean;
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallbackValue: T,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) =>
      setTimeout(() => resolve(fallbackValue), timeoutMs),
    ),
  ]);
}

export function StartupPermissionsPrompt({
  backendUrl,
  token,
  onComplete,
  forceVisible = false,
}: StartupPermissionsPromptProps) {
  const [visible, setVisible] = useState<boolean>(false);
  const [isRequesting, setIsRequesting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (forceVisible) {
      setVisible(true);
      return;
    }

    if (typeof window !== "undefined") {
      const alreadyGranted =
        notificationService.getPermissionStatus() === "granted";
      let dismissed = false;
      if (window.localStorage) {
        try {
          dismissed =
            window.localStorage.getItem(STARTUP_PERMS_STORAGE_KEY) === "true";
        } catch {
          // ignore
        }
      }

      if (!alreadyGranted && !dismissed) {
        setVisible(true);
      }
    }
  }, [forceVisible]);

  if (!visible) return null;

  const saveDismissed = () => {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem(STARTUP_PERMS_STORAGE_KEY, "true");
      } catch {
        // ignore
      }
    }
  };

  const handleGrantPermissions = async () => {
    setIsRequesting(true);
    try {
      // 1. Solicitar notificaciones del navegador con timeout de seguridad (3.5s)
      let notifStatus: "granted" | "denied" | "default" | "unsupported" =
        "default";
      try {
        notifStatus = await withTimeout(
          notificationService.requestPermissions(),
          3500,
          "default",
        );
      } catch {
        // ignore
      }

      // 2. Solicitar permiso de micrófono (getUserMedia) con timeout de seguridad (3.5s)
      if (
        Platform.OS === "web" &&
        typeof navigator !== "undefined" &&
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === "function"
      ) {
        try {
          const stream = await withTimeout(
            navigator.mediaDevices.getUserMedia({ audio: true }),
            3500,
            null,
          );
          if (stream) {
            stream.getTracks().forEach((track) => track.stop());
          }
        } catch {
          // Si el usuario deniega micrófono individualmente, continuamos
        }
      }

      // 3. Suscribir a Web Push si hay token y backend configurados
      if (notifStatus === "granted" && backendUrl && token) {
        notificationService
          .subscribeToWebPush(backendUrl, token)
          .catch(() => {});
      }

      saveDismissed();

      setSuccessMessage("✅ ¡Permisos activados para avisos y voz!");
      setTimeout(() => {
        setIsRequesting(false);
        setVisible(false);
        onComplete?.();
      }, 1000);
    } catch {
      saveDismissed();
      setIsRequesting(false);
      setVisible(false);
      onComplete?.();
    }
  };

  const handleDismiss = () => {
    saveDismissed();
    setIsRequesting(false);
    setVisible(false);
    onComplete?.();
  };

  return (
    <View
      style={styles.floatingBanner}
      testID="startup-permissions-prompt-container"
    >
      <View style={styles.contentCol}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.iconHeading}>🔔 🎙️</Text>
            <Text style={styles.titleText}>
              Activa las Notificaciones y el Dictado por Voz
            </Text>
          </View>
          <Pressable
            testID="btn-close-startup-permissions"
            style={styles.closeIconButton}
            onPress={handleDismiss}
            accessibilityLabel="Cerrar aviso"
          >
            <Text style={styles.closeIconText}>✕</Text>
          </Pressable>
        </View>

        {successMessage ? (
          <View style={styles.successPill}>
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        ) : (
          <Text style={styles.descriptionText}>
            Para que suenen tus alertas a la hora exacta y puedas dictar
            entradas rápidamente, permite los avisos y el acceso al micrófono.
          </Text>
        )}

        {!successMessage && (
          <View style={styles.actionsRow}>
            <Pressable
              testID="btn-grant-startup-permissions"
              style={[
                styles.grantButton,
                isRequesting && styles.buttonDisabled,
              ]}
              disabled={isRequesting}
              onPress={handleGrantPermissions}
            >
              <Text style={styles.grantButtonText}>
                {isRequesting
                  ? "Configurando..."
                  : "🚀 Activar Notificaciones y Voz"}
              </Text>
            </Pressable>

            <Pressable
              testID="btn-dismiss-startup-permissions"
              style={styles.dismissButton}
              onPress={handleDismiss}
            >
              <Text style={styles.dismissButtonText}>Ahora no</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingBanner: {
    backgroundColor: "#0B132B",
    borderColor: "#38BDF8",
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    width: "100%",
    shadowColor: "#38BDF8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  contentCol: {
    width: "100%",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    paddingRight: 8,
  },
  iconHeading: {
    fontSize: 20,
  },
  titleText: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
  },
  closeIconButton: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  closeIconText: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 14,
  },
  descriptionText: {
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  grantButton: {
    flex: 2,
    minWidth: 180,
    backgroundColor: "#38BDF8",
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  grantButtonText: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "800",
  },
  dismissButton: {
    flex: 1,
    minWidth: 90,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dismissButtonText: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  successPill: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "#10B981",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  successText: {
    color: "#34D399",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
});
