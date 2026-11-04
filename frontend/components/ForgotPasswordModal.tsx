import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { requestPasswordReset, resetPassword } from "../services/authService";

export interface ForgotPasswordModalProps {
  visible: boolean;
  baseUrl: string;
  initialEmail?: string;
  initialToken?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  visible,
  baseUrl,
  initialEmail = "",
  initialToken = "",
  onClose,
  onSuccess,
}) => {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 520;

  const [step, setStep] = useState<"request" | "reset">(() =>
    initialToken && initialToken.trim() ? "reset" : "request",
  );
  const [email, setEmail] = useState<string>(initialEmail);
  const [token, setToken] = useState<string>(initialToken);
  const [newPassword, setNewPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialToken && initialToken.trim()) {
      setToken(initialToken.trim());
      setStep("reset");
    }
  }, [initialToken]);

  useEffect(() => {
    if (initialEmail && initialEmail.trim()) {
      setEmail(initialEmail.trim());
    }
  }, [initialEmail]);

  const handleRequestReset = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMessage("Por favor, introduce una dirección de correo válida.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await requestPasswordReset(baseUrl, cleanEmail);
    setIsLoading(false);

    if (res.success) {
      setSuccessMessage(
        res.message ||
          "Si el correo está registrado, recibirás un mensaje con instrucciones para restablecer tu contraseña.",
      );
      setStep("reset");
    } else {
      setErrorMessage(
        res.error || "No se pudo procesar la solicitud. Inténtalo de nuevo.",
      );
    }
  };

  const handleResetPassword = async () => {
    const cleanToken = token.trim();
    if (!cleanToken) {
      setErrorMessage(
        "Por favor, introduce el código o token de restablecimiento.",
      );
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await resetPassword(baseUrl, cleanToken, newPassword);
    setIsLoading(false);

    if (res.success) {
      setSuccessMessage(
        res.message ||
          "Tu contraseña ha sido restablecida con éxito. Ya puedes iniciar sesión.",
      );
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } else {
      setErrorMessage(
        res.error || "El código es inválido o ha caducado. Solicita uno nuevo.",
      );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay} testID="forgot-password-modal">
        <View
          style={[
            styles.modalContainer,
            {
              maxWidth: isSmallScreen ? "100%" : 460,
              padding: isSmallScreen ? 20 : 28,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleCol}>
              <Text style={styles.modalTitle}>
                {step === "request"
                  ? "🔑 Recuperar Contraseña"
                  : "🔒 Nueva Contraseña"}
              </Text>
              <Text style={styles.modalSubtitle}>
                {step === "request"
                  ? "Te enviaremos un código de seguridad a tu correo"
                  : "Introduce el código recibido y tu nueva contraseña"}
              </Text>
            </View>
            <Pressable
              style={styles.closeBtn}
              onPress={onClose}
              testID="btn-close-forgot-modal"
              accessibilityLabel="Cerrar modal"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Feedback Messages */}
          {errorMessage && (
            <View style={styles.errorBox} testID="forgot-error-banner">
              <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
            </View>
          )}

          {successMessage && (
            <View style={styles.successBox} testID="forgot-success-banner">
              <Text style={styles.successText}>✉️ {successMessage}</Text>
            </View>
          )}

          {step === "request" ? (
            <View style={styles.formContainer}>
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
                  testID="forgot-input-email"
                  onSubmitEditing={handleRequestReset}
                />
              </View>

              <Pressable
                style={[
                  styles.primaryButton,
                  isLoading && styles.buttonDisabled,
                ]}
                onPress={handleRequestReset}
                disabled={isLoading}
                testID="btn-submit-forgot"
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    Enviar enlace de recuperación
                  </Text>
                )}
              </Pressable>

              <Pressable
                style={styles.secondaryLinkBtn}
                onPress={() => setStep("reset")}
                testID="btn-already-have-reset-token"
              >
                <Text style={styles.secondaryLinkText}>
                  ¿Ya tienes un código de restablecimiento? Haz clic aquí
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Código de Restablecimiento</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Introduce el token recibido"
                  placeholderTextColor="#64748b"
                  value={token}
                  onChangeText={setToken}
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="forgot-input-token"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Nueva Contraseña (mínimo 8 caracteres)
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Tu nueva contraseña segura"
                  placeholderTextColor="#64748b"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  testID="forgot-input-new-password"
                  onSubmitEditing={handleResetPassword}
                />
              </View>

              <Pressable
                style={[
                  styles.primaryButton,
                  isLoading && styles.buttonDisabled,
                ]}
                onPress={handleResetPassword}
                disabled={isLoading}
                testID="btn-submit-new-password"
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    Guardar nueva contraseña
                  </Text>
                )}
              </Pressable>

              <Pressable
                style={styles.secondaryLinkBtn}
                onPress={() => setStep("request")}
                testID="btn-back-to-request"
              >
                <Text style={styles.secondaryLinkText}>
                  ← Solicitar un nuevo código
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContainer: {
    width: "100%",
    backgroundColor: "#1e293b",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#334155",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  headerTitleCol: {
    flex: 1,
    paddingRight: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f8fafc",
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#334155",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnText: {
    color: "#cbd5e1",
    fontSize: 16,
    fontWeight: "bold",
  },
  errorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 13,
    lineHeight: 18,
  },
  successBox: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  successText: {
    color: "#6ee7b7",
    fontSize: 13,
    lineHeight: 18,
  },
  formContainer: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#cbd5e1",
  },
  input: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: "#f8fafc",
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: "#0284c7",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryLinkBtn: {
    alignItems: "center",
    paddingVertical: 6,
  },
  secondaryLinkText: {
    color: "#38bdf8",
    fontSize: 13,
    textAlign: "center",
  },
});
