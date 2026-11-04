import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

export interface AccountModalProps {
  visible: boolean;
  onClose: () => void;
  isBackendConnected: boolean | null;
  currentUserEmail?: string | null;
  onOpenLegal: () => void;
  onLogout?: () => void;
  onExportBackup?: () => void | Promise<void>;
  onDeleteAccount?: () => void | Promise<void>;
}

export function AccountModal({
  visible,
  onClose,
  isBackendConnected,
  currentUserEmail,
  onOpenLegal,
  onLogout,
  onExportBackup,
  onDeleteAccount,
}: AccountModalProps) {
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [backupSuccessMessage, setBackupSuccessMessage] = useState<
    string | null
  >(null);
  const [confirmingDeleteAccount, setConfirmingDeleteAccount] = useState(false);

  const handleClose = () => {
    setConfirmingDeleteAccount(false);
    setBackupSuccessMessage(null);
    onClose();
  };

  const handleExport = async () => {
    setIsExportingBackup(true);
    try {
      await onExportBackup?.();
      setBackupSuccessMessage("✓ Copia de seguridad JSON descargada");
      setTimeout(() => setBackupSuccessMessage(null), 4000);
    } catch {
      setBackupSuccessMessage("Error al exportar copia de seguridad.");
    } finally {
      setIsExportingBackup(false);
    }
  };

  const handleConfirmDelete = async () => {
    handleClose();
    await onDeleteAccount?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      testID="modal-account-status"
    >
      <View style={styles.modalOverlay} testID="modal-account-overlay">
        <View style={styles.accountCard} testID="account-card">
          <View style={styles.accountCardHeader}>
            <Text style={styles.accountCardTitle}>Conexión y Cuenta</Text>
            <Pressable
              style={styles.closeCardBtn}
              onPress={handleClose}
              testID="btn-close-account-modal"
              accessibilityRole="button"
              accessibilityLabel="Cerrar modal de cuenta"
            >
              <Text style={styles.closeCardBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Connection status section */}
          <View style={styles.statusDetailRow}>
            <View
              style={[
                styles.statusDotLarge,
                isBackendConnected === true
                  ? styles.dotConnected
                  : styles.dotDisconnected,
              ]}
            />
            <View style={styles.statusDetailCol}>
              <Text style={styles.statusDetailTitle}>
                {isBackendConnected === true
                  ? "Conectado al servidor"
                  : isBackendConnected === false
                    ? "Operando en Modo Local"
                    : "Comprobando conexión..."}
              </Text>
              <Text style={styles.statusDetailSubtitle}>
                {isBackendConnected === true
                  ? "Sincronización en tiempo real activa"
                  : "Servidor no disponible. Tus datos se guardan en este dispositivo y se sincronizarán al reconectar."}
              </Text>
            </View>
          </View>

          {/* User section */}
          {currentUserEmail && (
            <View style={styles.userEmailRow}>
              <Text style={styles.userLabelText}>Sesión activa:</Text>
              <Text style={styles.userEmailText}>{currentUserEmail}</Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.accountActionsRow}>
            {/* Backup export button */}
            <Pressable
              style={styles.backupBtn}
              onPress={handleExport}
              testID="btn-export-backup"
              accessibilityRole="button"
            >
              <Text style={styles.backupBtnText}>
                {isExportingBackup
                  ? "Generando copia..."
                  : "📥 Exportar copia de seguridad (JSON)"}
              </Text>
            </Pressable>
            {backupSuccessMessage && (
              <Text
                style={styles.backupSuccessText}
                testID="backup-success-text"
              >
                {backupSuccessMessage}
              </Text>
            )}

            <Pressable
              style={styles.legalBtn}
              onPress={() => {
                handleClose();
                onOpenLegal();
              }}
              testID="btn-open-legal-from-account"
              accessibilityRole="button"
            >
              <Text style={styles.legalBtnText}>
                🛡️ Privacidad y Términos (RGPD)
              </Text>
            </Pressable>

            {currentUserEmail && (
              <Pressable
                style={styles.logoutBtn}
                onPress={() => {
                  handleClose();
                  onLogout?.();
                }}
                testID="btn-confirm-logout"
                accessibilityRole="button"
              >
                <Text style={styles.logoutBtnText}>🚪 Cerrar Sesión</Text>
              </Pressable>
            )}

            {/* Danger Zone: Account Deletion (RGPD Art. 17) */}
            {currentUserEmail && !confirmingDeleteAccount && (
              <Pressable
                style={styles.startDeleteBtn}
                onPress={() => setConfirmingDeleteAccount(true)}
                testID="btn-start-delete-account"
                accessibilityRole="button"
              >
                <Text style={styles.startDeleteBtnText}>
                  🗑️ Eliminar cuenta y datos personales
                </Text>
              </Pressable>
            )}

            {currentUserEmail && confirmingDeleteAccount && (
              <View
                style={styles.confirmDeleteCard}
                testID="confirm-delete-box"
              >
                <Text style={styles.confirmDeleteTitle}>
                  ⚠️ ¿Eliminar cuenta de forma definitiva?
                </Text>
                <Text style={styles.confirmDeleteText}>
                  Esta acción eliminará de forma irreversible tu cuenta y todos
                  tus datos personales en la nube según el RGPD. No se puede
                  deshacer.
                </Text>
                <View style={styles.confirmDeleteButtonsRow}>
                  <Pressable
                    style={styles.cancelDeleteBtn}
                    onPress={() => setConfirmingDeleteAccount(false)}
                    testID="btn-cancel-delete"
                    accessibilityRole="button"
                  >
                    <Text style={styles.cancelDeleteBtnText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={styles.confirmDeleteBtn}
                    onPress={handleConfirmDelete}
                    testID="btn-confirm-delete-account"
                    accessibilityRole="button"
                  >
                    <Text style={styles.confirmDeleteBtnText}>
                      Sí, eliminar definitivamente
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            <Pressable
              style={styles.closeModalBtn}
              onPress={handleClose}
              testID="btn-account-back"
              accessibilityRole="button"
            >
              <Text style={styles.closeModalBtnText}>Volver</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  accountCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#1e293b",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  accountCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  accountCardTitle: {
    color: "#f8fafc",
    fontSize: 17,
    fontWeight: "700",
  },
  closeCardBtn: {
    padding: 6,
  },
  closeCardBtnText: {
    color: "#94a3b8",
    fontSize: 16,
    fontWeight: "bold",
  },
  statusDetailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    marginBottom: 14,
  },
  statusDotLarge: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 3,
  },
  dotConnected: {
    backgroundColor: "#22c55e",
  },
  dotDisconnected: {
    backgroundColor: "#f59e0b",
  },
  statusDetailCol: {
    flex: 1,
  },
  statusDetailTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  statusDetailSubtitle: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 16,
  },
  userEmailRow: {
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  userLabelText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  userEmailText: {
    color: "#38bdf8",
    fontSize: 14,
    fontWeight: "600",
  },
  accountActionsRow: {
    flexDirection: "column",
    gap: 10,
    marginTop: 6,
  },
  backupBtn: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  backupBtnText: {
    color: "#34d399",
    fontSize: 13,
    fontWeight: "700",
  },
  backupSuccessText: {
    color: "#34d399",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginTop: -4,
    marginBottom: 4,
  },
  legalBtn: {
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  legalBtnText: {
    color: "#38bdf8",
    fontSize: 13,
    fontWeight: "700",
  },
  logoutBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutBtnText: {
    color: "#f87171",
    fontSize: 13,
    fontWeight: "700",
  },
  startDeleteBtn: {
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  startDeleteBtnText: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  confirmDeleteCard: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  confirmDeleteTitle: {
    color: "#fca5a5",
    fontSize: 13,
    fontWeight: "700",
  },
  confirmDeleteText: {
    color: "#cbd5e1",
    fontSize: 11,
    lineHeight: 15,
  },
  confirmDeleteButtonsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  cancelDeleteBtn: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelDeleteBtnText: {
    color: "#f1f5f9",
    fontSize: 12,
    fontWeight: "600",
  },
  confirmDeleteBtn: {
    flex: 1.5,
    backgroundColor: "#dc2626",
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  confirmDeleteBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  closeModalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  closeModalBtnText: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "600",
  },
});
