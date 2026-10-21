import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  AuthSession,
  loginUser,
  registerUser,
  resendVerification,
  verifyEmail,
} from "../services/authService";
import { theme } from "../styles/theme";

interface AuthModalProps {
  visible: boolean;
  baseUrl: string;
  onSuccess: (session: AuthSession) => void;
  onClose: () => void;
  onContinueOffline?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  visible,
  baseUrl,
  onSuccess,
  onClose,
  onContinueOffline,
}) => {
  const [mode, setMode] = useState<"login" | "register" | "verify">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isUnverified, setIsUnverified] = useState(false);

  const handleResend = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMessage(
        "Introduce tu correo electrónico para reenviar la confirmación.",
      );
      return;
    }
    setIsResending(true);
    setErrorMessage(null);
    try {
      const res = await resendVerification(baseUrl, cleanEmail);
      if (res.success) {
        setInfoMessage(
          res.message ||
            `Hemos reenviado el correo de confirmación a ${cleanEmail}. Revisa tu bandeja de entrada.`,
        );
        setIsUnverified(false);
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

  const handleVerifyToken = async () => {
    setErrorMessage(null);
    setInfoMessage(null);
    const cleanToken = verificationToken.trim();
    if (!cleanToken) {
      setErrorMessage(
        "Por favor, introduce el token de verificación recibido.",
      );
      return;
    }
    setIsLoading(true);
    try {
      const res = await verifyEmail(baseUrl, cleanToken);
      if (res.success) {
        setInfoMessage(
          res.message ||
            "¡Cuenta verificada exitosamente! Ya puedes iniciar sesión con tus credenciales.",
        );
        setMode("login");
        setVerificationToken("");
      } else {
        setErrorMessage(
          res.error || "Token de verificación inválido o expirado.",
        );
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Error al procesar la verificación.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    setInfoMessage(null);
    setIsUnverified(false);

    if (mode === "verify") {
      await handleVerifyToken();
      return;
    }

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMessage("Por favor, introduce un correo electrónico válido.");
      return;
    }
    if (password.length < 8) {
      setErrorMessage("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setIsLoading(true);
    try {
      if (mode === "login") {
        const res = await loginUser(baseUrl, cleanEmail, password);
        if (res.success && res.session) {
          onSuccess(res.session);
        } else {
          if (res.isUnverified) {
            setMode("verify");
            setIsUnverified(true);
            setErrorMessage(
              res.error ||
                "Tu cuenta aún no está verificada. Por favor, introduce el token de verificación que te enviamos a tu correo para activarla y poder acceder.",
            );
          } else {
            setErrorMessage(res.error || "Error al procesar la solicitud.");
          }
        }
      } else {
        const res = await registerUser(baseUrl, cleanEmail, password);
        if (res.success) {
          setInfoMessage(
            res.message ||
              "¡Cuenta creada! Hemos enviado un código a tu correo electrónico. Introdúcelo a continuación para activar tu cuenta.",
          );
          setMode("verify");
          setPassword("");
        } else {
          setErrorMessage(res.error || "Error al crear la cuenta.");
        }
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Error inesperado al conectar.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>
            {mode === "login"
              ? "Iniciar Sesión"
              : mode === "register"
                ? "Crear Cuenta"
                : "Verificar Cuenta"}
          </Text>
          <Text style={styles.subtitle}>
            Tus recuerdos y tareas se guardan de forma 100% privada y aislada en
            tu cuenta personal.
          </Text>

          {/* Mode Switcher */}
          <View style={styles.tabsRow}>
            <Pressable
              style={[
                styles.tabButton,
                mode === "login" && styles.tabButtonActive,
              ]}
              onPress={() => {
                setMode("login");
                setErrorMessage(null);
              }}
              testID="modal-tab-login"
            >
              <Text
                style={[
                  styles.tabText,
                  mode === "login" && styles.tabTextActive,
                ]}
              >
                Iniciar Sesión
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.tabButton,
                mode === "register" && styles.tabButtonActive,
              ]}
              onPress={() => {
                setMode("register");
                setErrorMessage(null);
              }}
              testID="modal-tab-register"
            >
              <Text
                style={[
                  styles.tabText,
                  mode === "register" && styles.tabTextActive,
                ]}
              >
                Registrarse
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.tabButton,
                mode === "verify" && styles.tabButtonActive,
              ]}
              onPress={() => {
                setMode("verify");
                setErrorMessage(null);
              }}
              testID="modal-tab-verify"
            >
              <Text
                style={[
                  styles.tabText,
                  mode === "verify" && styles.tabTextActive,
                ]}
              >
                Verificar
              </Text>
            </Pressable>
          </View>

          {/* Info Banner */}
          {infoMessage && (
            <View style={styles.infoContainer} testID="modal-info-banner">
              <Text style={styles.infoText}>✉️ {infoMessage}</Text>
            </View>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <View style={styles.errorContainer} testID="modal-error-banner">
              <Text style={styles.errorText}>{errorMessage}</Text>
              {isUnverified && (
                <View style={styles.unverifiedActionRow}>
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
                </View>
              )}
            </View>
          )}

          {mode === "verify" ? (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Token de Verificación</Text>
              <TextInput
                style={styles.input}
                placeholder="Pega el token recibido por email"
                placeholderTextColor="#94A3B8"
                value={verificationToken}
                onChangeText={setVerificationToken}
                autoCapitalize="none"
                autoCorrect={false}
                testID="modal-input-verify-token"
              />
              <Pressable
                style={[
                  styles.primaryButton,
                  isLoading && styles.buttonDisabled,
                ]}
                onPress={handleVerifyToken}
                disabled={isLoading}
                testID="modal-btn-verify-token"
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    Confirmar Verificación
                  </Text>
                )}
              </Pressable>
            </View>
          ) : (
            <>
              {/* Inputs */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Correo Electrónico</Text>
                <TextInput
                  style={styles.input}
                  placeholder="tu@email.com"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="modal-input-email"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Contraseña</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Mínimo 8 caracteres"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  testID="modal-input-password"
                />
              </View>

              {/* Submit Button */}
              <Pressable
                style={[
                  styles.primaryButton,
                  isLoading && styles.buttonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={isLoading}
                testID="modal-btn-submit"
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {mode === "login" ? "Acceder" : "Crear Cuenta"}
                  </Text>
                )}
              </Pressable>
            </>
          )}

          {/* Offline / Guest Mode */}
          {onContinueOffline && (
            <Pressable
              style={styles.guestButton}
              onPress={onContinueOffline}
              testID="modal-btn-continue-offline"
            >
              <Text style={styles.guestButtonText}>
                Continuar en modo offline / invitado
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    borderColor: "#334155",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#F8FAFC",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  tabsRow: {
    flexDirection: "row",
    backgroundColor: "#0F172A",
    borderRadius: 8,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
  },
  tabButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  tabText: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#F8FAFC",
    fontSize: 14,
  },
  infoContainer: {
    backgroundColor: "rgba(14, 165, 233, 0.15)",
    borderColor: "#0284C7",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  infoText: {
    color: "#7DD3FC",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
  errorContainer: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "#EF4444",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    color: "#FCA5A5",
    fontSize: 12,
    textAlign: "center",
  },
  unverifiedActionRow: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    alignItems: "center",
  },
  resendButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  resendButtonText: {
    color: "#38BDF8",
    fontWeight: "600",
    fontSize: 12,
    textDecorationLine: "underline",
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  guestButton: {
    marginTop: 14,
    paddingVertical: 8,
    alignItems: "center",
  },
  guestButtonText: {
    color: "#94A3B8",
    fontSize: 12,
    textDecorationLine: "underline",
  },
});
