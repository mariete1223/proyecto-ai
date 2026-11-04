import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { theme } from "../styles/theme";

export interface LegalNoticeModalProps {
  visible: boolean;
  onClose: () => void;
  initialTab?: "privacy" | "terms";
}

export const LegalNoticeModal: React.FC<LegalNoticeModalProps> = ({
  visible,
  onClose,
  initialTab = "privacy",
}) => {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 520;
  const [activeTab, setActiveTab] = useState<"privacy" | "terms">(initialTab);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay} testID="legal-notice-modal">
        <View
          style={[
            styles.modalContainer,
            {
              maxWidth: isSmallScreen ? "100%" : 560,
              padding: isSmallScreen ? 18 : 26,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleCol}>
              <Text style={styles.modalTitle}>
                {activeTab === "privacy"
                  ? "🛡️ Política de Privacidad"
                  : "📜 Términos del Servicio"}
              </Text>
              <Text style={styles.modalSubtitle}>
                VoxDaily · Tu diario y calendario por voz
              </Text>
            </View>
            <Pressable
              style={styles.closeBtn}
              onPress={onClose}
              testID="btn-close-legal-modal"
              accessibilityLabel="Cerrar modal"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Tab Selector */}
          <View style={styles.tabSelectorRow}>
            <Pressable
              style={[
                styles.tabBtn,
                activeTab === "privacy" && styles.tabBtnActive,
              ]}
              onPress={() => setActiveTab("privacy")}
              testID="tab-legal-privacy"
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "privacy" && styles.tabTextActive,
                ]}
              >
                Privacidad (RGPD)
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.tabBtn,
                activeTab === "terms" && styles.tabBtnActive,
              ]}
              onPress={() => setActiveTab("terms")}
              testID="tab-legal-terms"
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "terms" && styles.tabTextActive,
                ]}
              >
                Términos de Uso
              </Text>
            </Pressable>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            testID="legal-content-scroll"
          >
            {activeTab === "privacy" ? (
              <View style={styles.textContent}>
                <Text style={styles.sectionHeader}>
                  1. Compromiso de Privacidad y Aislamiento de Datos
                </Text>
                <Text style={styles.paragraph}>
                  En VoxDaily respetamos tu intimidad y la confidencialidad de
                  tus notas, pensamientos personales, eventos y tareas. Toda la
                  información dictada o introducida por ti pertenece
                  exclusivamente a tu cuenta y está estrictamente aislada de
                  otros usuarios mediante identificadores únicos criptográficos.
                </Text>

                <Text style={styles.sectionHeader}>
                  2. Datos Tratados y Finalidad (RGPD / LOPD)
                </Text>
                <Text style={styles.paragraph}>
                  •{" "}
                  <Text style={styles.boldText}>
                    Dirección de correo electrónico:
                  </Text>{" "}
                  Utilizada exclusivamente para autenticación segura,
                  recuperación de acceso y envío de confirmaciones.
                </Text>
                <Text style={styles.paragraph}>
                  • <Text style={styles.boldText}>Contraseñas:</Text> Nunca se
                  almacenan en texto claro. Se procesan de forma irreversible
                  mediante el algoritmo{" "}
                  <Text style={styles.codeText}>scrypt</Text> con salt
                  criptográfico individual de 16 bytes.
                </Text>
                <Text style={styles.paragraph}>
                  • <Text style={styles.boldText}>Notas, tareas y voz:</Text> Se
                  almacenan en la base de datos de forma privada para permitirte
                  consultar, filtrar y sincronizar tu agenda entre tus
                  dispositivos. No vendemos, transferimos ni compartimos tus
                  datos con terceros.
                </Text>

                <Text style={styles.sectionHeader}>
                  3. Almacenamiento Local y Ausencia de Cookies Publicitarias
                </Text>
                <Text style={styles.paragraph}>
                  VoxDaily utiliza almacenamiento técnico local (IndexedDB /
                  SQLite / localStorage) exclusivamente para posibilitar el
                  funcionamiento sin conexión (Offline-First) y mantener tu
                  sesión activa. No utilizamos cookies de terceros, píxeles de
                  rastreo ni redes publicitarias.
                </Text>

                <Text style={styles.sectionHeader}>
                  4. Tus Derechos de Protección de Datos
                </Text>
                <Text style={styles.paragraph}>
                  De acuerdo con el Reglamento General de Protección de Datos
                  (RGPD - UE 2016/679), tienes derecho de acceso, rectificación,
                  portabilidad (pudiendo exportar todas tus tareas en formato
                  JSON desde la aplicación) y supresión de tus datos.
                </Text>
              </View>
            ) : (
              <View style={styles.textContent}>
                <Text style={styles.sectionHeader}>
                  1. Aceptación de los Términos
                </Text>
                <Text style={styles.paragraph}>
                  Al registrarte y utilizar VoxDaily, aceptas estos términos del
                  servicio. La aplicación se ofrece como una herramienta
                  personal de organización, agenda inteligente y diario por voz.
                </Text>

                <Text style={styles.sectionHeader}>
                  2. Uso del Servicio y Custodia de Credenciales
                </Text>
                <Text style={styles.paragraph}>
                  Eres responsable de mantener la confidencialidad de tu
                  contraseña y de cualquier actividad realizada bajo tu cuenta.
                  Te comprometes a utilizar el servicio de forma lícita y
                  personal.
                </Text>

                <Text style={styles.sectionHeader}>
                  3. Disponibilidad y Modo Offline
                </Text>
                <Text style={styles.paragraph}>
                  VoxDaily está diseñada para funcionar tanto conectado a la
                  nube como sin conexión a internet. Los cambios realizados sin
                  conexión se sincronizan automáticamente una vez restaurada la
                  comunicación con el servidor.
                </Text>

                <Text style={styles.sectionHeader}>
                  4. Modificaciones del Servicio
                </Text>
                <Text style={styles.paragraph}>
                  Nos reservamos el derecho de actualizar y mejorar las
                  funcionalidades de la aplicación para ofrecer una experiencia
                  cada vez más rápida, intuitiva y segura.
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footerRow}>
            <Pressable
              style={styles.primaryBtn}
              onPress={onClose}
              testID="btn-accept-legal-modal"
            >
              <Text style={styles.primaryBtnText}>Entendido y Cerrar</Text>
            </Pressable>
          </View>
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
    maxHeight: "85%",
    display: "flex",
    flexDirection: "column",
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
    marginTop: 2,
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
  tabSelectorRow: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: "#38bdf8",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94a3b8",
  },
  tabTextActive: {
    color: "#0f172a",
  },
  scrollArea: {
    flex: 1,
    marginBottom: 16,
  },
  scrollContent: {
    paddingRight: 6,
    paddingBottom: 10,
  },
  textContent: {
    gap: 10,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: "#38bdf8",
    marginTop: 8,
    marginBottom: 2,
  },
  paragraph: {
    fontSize: 13,
    lineHeight: 20,
    color: "#cbd5e1",
  },
  boldText: {
    fontWeight: "700",
    color: "#f8fafc",
  },
  codeText: {
    fontFamily: Platform.OS === "web" ? "monospace" : undefined,
    color: "#38bdf8",
    backgroundColor: "#0f172a",
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  footerRow: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
  primaryBtn: {
    backgroundColor: "#0284c7",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
});
