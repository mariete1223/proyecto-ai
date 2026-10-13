import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AuthSession, loginUser, registerUser } from "../services/authService";
import { theme } from "../styles/theme";

export interface AuthScreenProps {
  baseUrl: string;
  onSuccess: (session: AuthSession) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ baseUrl, onSuccess }) => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    setErrorMessage(null);
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
      const res =
        mode === "login"
          ? await loginUser(baseUrl, cleanEmail, password)
          : await registerUser(baseUrl, cleanEmail, password);

      if (res.success && res.session) {
        onSuccess(res.session);
      } else {
        setErrorMessage(res.error || "No se pudo iniciar sesión. Verifica tus credenciales.");
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Error inesperado al conectar con el servidor.",
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
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          {/* Brand Header */}
          <View style={styles.brandContainer}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoBadgeText}>AI</Text>
            </View>
            <Text style={styles.brandTitle}>Proyecto AI</Text>
            <Text style={styles.brandSubtitle}>Personal Knowledge Hub</Text>
            <View style={styles.privacyPill}>
              <Text style={styles.privacyPillText}>🔒 Entorno Privado & Aislado</Text>
            </View>
          </View>

          {/* Mode Switcher */}
          <View style={styles.tabsRow}>
            <Pressable
              style={[styles.tabButton, mode === "login" && styles.tabButtonActive]}
              onPress={() => {
                setMode("login");
                setErrorMessage(null);
              }}
              testID="tab-auth-login"
            >
              <Text style={[styles.tabText, mode === "login" && styles.tabTextActive]}>
                Iniciar Sesión
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tabButton, mode === "register" && styles.tabButtonActive]}
              onPress={() => {
                setMode("register");
                setErrorMessage(null);
              }}
              testID="tab-auth-register"
            >
              <Text style={[styles.tabText, mode === "register" && styles.tabTextActive]}>
                Registrarse
              </Text>
            </Pressable>
          </View>

          <Text style={styles.modeDescription}>
            {mode === "login"
              ? "Introduce tus credenciales para acceder a tus notas, calendario y tareas privadas."
              : "Crea tu cuenta personal. Tus datos estarán totalmente aislados de otros usuarios."}
          </Text>

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

          {/* Error Message */}
          {errorMessage && (
            <View style={styles.errorContainer} testID="auth-error-banner">
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Submit Button */}
          <Pressable
            style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
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

          {/* Footer Note */}
          <View style={styles.footerNote}>
            <Text style={styles.footerNoteText}>
              Cada usuario dispone de cifrado y aislamiento completo. Nadie más puede ver lo que guardas.
            </Text>
          </View>
        </View>
      </ScrollView>
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
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  logoBadgeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 22,
    letterSpacing: 1,
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
    fontSize: 14,
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
