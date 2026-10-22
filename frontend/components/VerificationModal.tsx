import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { resendVerification, verifyEmail } from "../services/authService";
import { theme } from "../styles/theme";

export interface VerificationModalProps {
  visible: boolean;
  email: string;
  baseUrl: string;
  initialMessage?: string | null;
  initialError?: string | null;
  onClose: () => void;
  onVerified: (email: string) => void;
  testIDPrefix?: "auth" | "modal";
}

export const VerificationModal: React.FC<VerificationModalProps> = ({
  visible,
  email,
  baseUrl,
  initialMessage,
  initialError,
  onClose,
  onVerified,
  testIDPrefix = "auth",
}) => {
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setToken("");
      setErrorMessage(initialError || null);
      setInfoMessage(initialMessage || null);
    }
  }, [visible, initialMessage, initialError]);

  const handleVerify = async () => {
    const cleanToken = token.trim();
    if (!cleanToken) {
      setErrorMessage("Por favor, introduce el token de verificación.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      const res = await verifyEmail(baseUrl, cleanToken);
      if (res.success) {
        setInfoMessage(
          res.message ||
            "¡Cuenta verificada con éxito! Ya puedes iniciar sesión.",
        );
        onVerified(email);
      } else {
        setErrorMessage(
          res.error || "El token de verificación es inválido o ha expirado.",
        );
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Error al verificar el correo.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMessage("Correo electrónico no válido para el reenvío.");
      return;
    }

    setIsResending(true);
    setErrorMessage(null);
    try {
      const res = await resendVerification(baseUrl, cleanEmail);
      if (res.success) {
        setInfoMessage(
          res.message ||
            `Hemos reenviado el correo de confirmación a ${cleanEmail}.`,
        );
      } else {
        setErrorMessage(
          res.error || "No se pudo reenviar el correo de confirmación.",
        );
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Error al conectar con el servidor.",
      );
    } finally {
      setIsResending(false);
    }
  };

  const inputTestID = `${testIDPrefix}-input-verify-token`;
  const submitTestID = `${testIDPrefix}-btn-verify-token`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card} testID="verification-modal-card">
          <View style={styles.headerRow}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>✉️</Text>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              testID="btn-close-verification"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>

          <Text style={styles.title}>Verifica tu cuenta</Text>
          <Text style={styles.subtitle}>
            Para poder utilizar tu cuenta personal, confirma tu dirección de
            correo electrónico.
          </Text>

          {email ? (
            <View style={styles.emailBadge}>
              <Text style={styles.emailBadgeLabel}>Enviado a:</Text>
              <Text style={styles.emailBadgeValue}>{email}</Text>
            </View>
          ) : null}

          {/* Feedback messages */}
          {errorMessage && (
            <View
              style={styles.errorContainer}
              testID={`${testIDPrefix}-error-banner`}
            >
              <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
            </View>
          )}

          {infoMessage && (
            <View
              style={styles.infoContainer}
              testID={`${testIDPrefix}-info-banner`}
            >
              <Text style={styles.infoText}>✉️ {infoMessage}</Text>
            </View>
          )}

          {/* Token input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Token o Código de Verificación</Text>
            <TextInput
              style={styles.input}
              placeholder="Pega aquí el código de tu correo"
              placeholderTextColor="#64748b"
              value={token}
              onChangeText={setToken}
              autoCapitalize="none"
              autoCorrect={false}
              testID={inputTestID}
              onSubmitEditing={handleVerify}
            />
          </View>

          {/* Verify submit button */}
          <Pressable
            style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={isLoading}
            testID={submitTestID}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>
                Confirmar Verificación
              </Text>
            )}
          </Pressable>

          {/* Resend button */}
          <Pressable
            style={styles.resendButton}
            onPress={handleResend}
            disabled={isResending}
            testID="btn-resend-verification"
          >
            {isResending ? (
              <ActivityIndicator size="small" color="#38BDF8" />
            ) : (
              <Text style={styles.resendButtonText}>
                📩 Reenviar correo de confirmación
              </Text>
            )}
          </Pressable>

          {/* Dismiss button */}
          <Pressable
            style={styles.dismissButton}
            onPress={onClose}
            testID="btn-dismiss-verification"
          >
            <Text style={styles.dismissButtonText}>
              Cerrar / Lo haré más tarde
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    borderColor: "#334155",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  iconText: {
    fontSize: 22,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#334155",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    color: "#94A3B8",
    fontSize: 16,
    fontWeight: "700",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#F8FAFC",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: "#94A3B8",
    lineHeight: 19,
    marginBottom: 14,
  },
  emailBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F172A",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 6,
  },
  emailBadgeLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  emailBadgeValue: {
    fontSize: 13,
    color: "#38BDF8",
    fontWeight: "700",
  },
  errorContainer: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: "#FCA5A5",
    fontSize: 13,
    lineHeight: 18,
  },
  infoContainer: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  infoText: {
    color: "#BAE6FD",
    fontSize: 13,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E2E8F0",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#F8FAFC",
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  resendButton: {
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  resendButtonText: {
    color: "#38BDF8",
    fontSize: 13,
    fontWeight: "600",
  },
  dismissButton: {
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  dismissButtonText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "500",
  },
});
