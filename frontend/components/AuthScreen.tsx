import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
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
import { VerificationModal } from "./VerificationModal";

const appLogo = require("../assets/logo-small.png");

export interface AuthScreenProps {
  baseUrl: string;
  onSuccess: (session: AuthSession) => void;
  onContinueOffline?: () => void;
  isOffline?: boolean;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  baseUrl,
  onSuccess,
  onContinueOffline,
  isOffline,
}) => {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 480;
  const isTablet = width >= 480 && width < 900;

  const [mode, setMode] = useState<"login" | "register" | "verify">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isUnverified, setIsUnverified] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationInitialError, setVerificationInitialError] = useState<
    string | null
  >(null);
  const [verificationInitialMessage, setVerificationInitialMessage] = useState<
    string | null
  >(null);

  const [offlineDetected, setOfflineDetected] = useState<boolean>(() => {
    if (typeof isOffline === "boolean") return isOffline;
    if (
      Platform.OS === "web" &&
      typeof navigator !== "undefined" &&
      typeof navigator.onLine === "boolean"
    ) {
      return !navigator.onLine;
    }
    return false;
  });

  useEffect(() => {
    if (typeof isOffline === "boolean") {
      setOfflineDetected(isOffline);
    }
  }, [isOffline]);

  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const handleOnline = () => setOfflineDetected(false);
      const handleOffline = () => setOfflineDetected(true);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      try {
        const params = new URLSearchParams(window.location.search);
        const tokenParam = params.get("token");
        if (tokenParam && tokenParam.trim()) {
          const cleanToken = tokenParam.trim();
          setVerificationToken(cleanToken);
          setMode("verify");
          setIsLoading(true);
          verifyEmail(baseUrl, cleanToken)
            .then((res) => {
              if (res.success) {
                setInfoMessage(
                  res.message ||
                    "¡Correo verificado con éxito! Ya puedes iniciar sesión con tu cuenta.",
                );
                setMode("login");
              } else {
                setErrorMessage(
                  res.error ||
                    "El token de verificación es inválido o ha expirado.",
                );
              }
            })
            .catch((err) => {
              setErrorMessage(
                err instanceof Error
                  ? err.message
                  : "Error al verificar el correo.",
              );
            })
            .finally(() => {
              setIsLoading(false);
            });
        }
      } catch {
        // Ignore URL parsing errors
      }
    }
  }, [baseUrl]);

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
            setIsUnverified(true);
            const unverifiedMsg =
              res.error ||
              "Tu cuenta aún no está verificada. Por favor, introduce el token de verificación que te enviamos a tu correo para activarla y poder acceder.";
            setErrorMessage(unverifiedMsg);
            setVerificationInitialError(unverifiedMsg);
            setVerificationInitialMessage(null);
            setShowVerificationModal(true);
          } else {
            setErrorMessage(
              res.error ||
                "No se pudo iniciar sesión. Verifica tus credenciales.",
            );
          }
        }
      } else {
        const res = await registerUser(baseUrl, cleanEmail, password);
        if (res.success) {
          const successMsg =
            res.message ||
            "¡Cuenta creada! Hemos enviado un código a tu correo electrónico. Introdúcelo a continuación para activar tu cuenta.";
          setVerificationInitialMessage(successMsg);
          setVerificationInitialError(null);
          setShowVerificationModal(true);
          setMode("login");
          setPassword("");
        } else {
          setErrorMessage(
            res.error || "No se pudo crear la cuenta. Inténtalo de nuevo.",
          );
        }
      }
    } catch (err: unknown) {
      setOfflineDetected(true);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Error inesperado al conectar con el servidor.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
      testID="auth-screen"
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { padding: isSmallScreen ? 14 : 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.card,
            {
              padding: isSmallScreen ? 20 : isTablet ? 28 : 36,
              maxWidth: isSmallScreen ? "100%" : 460,
              borderRadius: isSmallScreen ? 16 : 22,
            },
          ]}
        >
          {/* Brand Header */}
          <View style={styles.brandContainer}>
            <View
              style={[
                styles.logoBadge,
                {
                  width: isSmallScreen ? 44 : 54,
                  height: isSmallScreen ? 44 : 54,
                  borderRadius: isSmallScreen ? 12 : 16,
                  overflow: "hidden",
                },
              ]}
            >
              <Image
                source={appLogo}
                style={{
                  width: isSmallScreen ? 44 : 54,
                  height: isSmallScreen ? 44 : 54,
                  borderRadius: isSmallScreen ? 12 : 16,
                }}
                resizeMode="cover"
                accessibilityLabel="VoxDaily Icon"
              />
            </View>
            <Text
              style={[styles.brandTitle, { fontSize: isSmallScreen ? 22 : 28 }]}
            >
              VoxDaily
            </Text>
            <Text
              style={[
                styles.brandSubtitle,
                { fontSize: isSmallScreen ? 13 : 15 },
              ]}
            >
              Voice Journal & Calendar
            </Text>
            <View style={styles.privacyPill}>
              <Text style={styles.privacyPillText}>
                🔒 Entorno Privado & Aislado
              </Text>
            </View>
          </View>

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
              testID="tab-auth-login"
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
              testID="tab-auth-register"
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
              testID="tab-auth-verify"
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

          <Text style={styles.modeDescription}>
            {mode === "login"
              ? "Introduce tus credenciales para acceder a tus notas, calendario y tareas privadas."
              : mode === "register"
                ? "Crea tu cuenta personal. Te enviaremos un email para confirmar tu dirección antes de iniciar sesión."
                : "Introduce el código o token recibido en tu correo electrónico para activar tu cuenta."}
          </Text>

          {/* Info / Success Feedback */}
          {infoMessage && !showVerificationModal && (
            <View style={styles.infoContainer} testID="auth-info-banner">
              <Text style={styles.infoText}>✉️ {infoMessage}</Text>
            </View>
          )}

          {/* Error Message & Unverified Account Actions */}
          {errorMessage && !showVerificationModal && (
            <View style={styles.errorContainer} testID="auth-error-banner">
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

          {/* Verification Code Form */}
          {mode === "verify" ? (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Token o Código de Verificación</Text>
              <TextInput
                style={styles.input}
                placeholder="Pega aquí el token de tu correo"
                placeholderTextColor="#64748b"
                value={verificationToken}
                onChangeText={setVerificationToken}
                autoCapitalize="none"
                autoCorrect={false}
                testID="auth-input-verify-token"
                onSubmitEditing={handleVerifyToken}
              />
              <Pressable
                style={[
                  styles.primaryButton,
                  isLoading && styles.buttonDisabled,
                ]}
                onPress={handleVerifyToken}
                disabled={isLoading}
                testID="auth-btn-verify-token"
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    Confirmar Verificación
                  </Text>
                )}
              </Pressable>
              <Pressable
                style={styles.guestButton}
                onPress={() => {
                  setMode("login");
                  setErrorMessage(null);
                }}
                testID="btn-dismiss-verify-mode"
              >
                <Text style={styles.guestButtonText}>
                  Cerrar / Lo haré más tarde
                </Text>
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
                  placeholderTextColor="#64748b"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="auth-input-email"
                  onSubmitEditing={handleSubmit}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Contraseña</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Mínimo 8 caracteres"
                  placeholderTextColor="#64748b"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  testID="auth-input-password"
                  onSubmitEditing={handleSubmit}
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
                testID="auth-btn-submit"
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

          {onContinueOffline && offlineDetected && (
            <Pressable
              style={styles.guestButton}
              onPress={onContinueOffline}
              testID="btn-continue-offline"
            >
              <Text style={styles.guestButtonText}>
                📡 Sin conexión: Continuar en modo offline
              </Text>
            </Pressable>
          )}

          {/* Footer Note */}
          <View style={styles.footerNote}>
            <Text style={styles.footerNoteText}>
              Cada usuario dispone de cifrado y aislamiento completo. Nadie más
              puede ver lo que guardas.
            </Text>
          </View>
        </View>
      </ScrollView>

      <VerificationModal
        visible={showVerificationModal}
        email={email}
        baseUrl={baseUrl}
        initialError={verificationInitialError}
        initialMessage={verificationInitialMessage}
        onClose={() => {
          setShowVerificationModal(false);
          setMode("login");
        }}
        onVerified={(verifiedEmail) => {
          setShowVerificationModal(false);
          setMode("login");
          setEmail(verifiedEmail);
          setInfoMessage(
            "¡Cuenta verificada exitosamente! Ya puedes iniciar sesión con tus credenciales.",
          );
        }}
        testIDPrefix="auth"
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1120",
    width: "100%",
    minHeight: "100%",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 20,
    padding: 32,
    width: "100%",
    maxWidth: 440,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#0284C7",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  brandContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  logoBadge: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: "#1e293b",
    borderWidth: 1.5,
    borderColor: "rgba(56, 189, 248, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    shadowColor: "#38bdf8",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#F8FAFC",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  brandSubtitle: {
    fontSize: 14,
    color: "#94A3B8",
    fontWeight: "500",
    marginBottom: 12,
  },
  privacyPill: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.35)",
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  privacyPillText: {
    color: "#34D399",
    fontSize: 12,
    fontWeight: "600",
  },
  tabsRow: {
    flexDirection: "row",
    backgroundColor: "#0F172A",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  tabButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  tabText: {
    color: "#94A3B8",
    fontWeight: "600",
    fontSize: 13,
  },
  tabTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  modeDescription: {
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: "#E2E8F0",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#FFFFFF",
    fontSize: 15,
  },
  infoContainer: {
    backgroundColor: "rgba(14, 165, 233, 0.15)",
    borderWidth: 1,
    borderColor: "#0284C7",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  infoText: {
    color: "#7DD3FC",
    fontSize: 13,
    lineHeight: 18,
  },
  errorContainer: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "#EF4444",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#FCA5A5",
    fontSize: 13,
    lineHeight: 18,
  },
  unverifiedActionRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    alignItems: "center",
  },
  resendButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  resendButtonText: {
    color: "#38BDF8",
    fontWeight: "600",
    fontSize: 13,
    textDecorationLine: "underline",
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    marginBottom: 16,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  guestButton: {
    marginTop: 4,
    marginBottom: 16,
    paddingVertical: 10,
    alignItems: "center",
  },
  guestButtonText: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "500",
    textDecorationLine: "underline",
  },
  footerNote: {
    borderTopWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingTop: 14,
    alignItems: "center",
  },
  footerNoteText: {
    color: "#64748B",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
});
