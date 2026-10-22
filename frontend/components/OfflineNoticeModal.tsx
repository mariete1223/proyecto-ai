import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

export interface OfflineNoticeModalProps {
  visible: boolean;
  onClose: () => void;
}

export const OfflineNoticeModal: React.FC<OfflineNoticeModalProps> = ({
  visible,
  onClose,
}) => {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 500;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID="offline-notice-modal"
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            isSmallScreen ? styles.cardSmall : styles.cardLarge,
          ]}
          testID="offline-notice-card"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>📡 MODO SIN CONEXIÓN</Text>
            </View>
            <Pressable
              onPress={onClose}
              testID="btn-close-offline-notice"
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Cerrar aviso de modo offline"
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>

          {/* Icon Circle */}
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>📡</Text>
          </View>

          {/* Body */}
          <View style={styles.body}>
            <Text style={styles.title} testID="offline-notice-title">
              Estás en Modo Offline
            </Text>
            <Text style={styles.description} testID="offline-notice-desc">
              Actualmente estás utilizando la aplicación sin conexión al
              servidor. Puedes seguir creando, editando y consultando tus notas,
              tareas y eventos con total normalidad en este dispositivo.
            </Text>

            <View style={styles.syncBox} testID="offline-notice-sync-box">
              <Text style={styles.syncBoxTitle}>
                🔄 Sincronización automática con tu cuenta
              </Text>
              <Text style={styles.syncBoxText}>
                Todos los datos que guardes ahora se almacenan de forma segura
                en este dispositivo y se sincronizarán e integrarán
                automáticamente en tu cuenta online en cuanto inicies sesión y
                se restablezca la conexión.
              </Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable
              onPress={onClose}
              testID="btn-dismiss-offline-notice"
              style={styles.confirmButton}
              accessibilityRole="button"
            >
              <Text style={styles.confirmButtonText}>
                Entendido, continuar 🚀
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  cardSmall: {
    width: "100%",
    maxWidth: "100%",
  },
  cardLarge: {
    width: "100%",
    maxWidth: 460,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  badge: {
    borderWidth: 1,
    borderColor: "#F59E0B",
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  badgeText: {
    color: "#F59E0B",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    color: "#94A3B8",
    fontSize: 18,
    fontWeight: "600",
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginVertical: 10,
  },
  iconText: {
    fontSize: 32,
  },
  body: {
    alignItems: "center",
    marginVertical: 8,
  },
  title: {
    color: "#F8FAFC",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  description: {
    color: "#CBD5E1",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 14,
  },
  syncBox: {
    width: "100%",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    padding: 14,
    marginTop: 4,
  },
  syncBoxTitle: {
    color: "#38BDF8",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
  },
  syncBoxText: {
    color: "#E2E8F0",
    fontSize: 12,
    lineHeight: 18,
  },
  footer: {
    marginTop: 18,
  },
  confirmButton: {
    backgroundColor: "#F59E0B",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmButtonText: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
  },
});
