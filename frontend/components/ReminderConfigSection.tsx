import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  notificationService,
  ReminderRecurrence,
} from "../services/notificationService";
import { theme } from "../styles/theme";
import { formatDateTime } from "../types/domain";
import { DateTimePicker } from "./DateTimePicker";

export interface ReminderConfigSectionProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  reminderTime: string;
  onReminderTimeChange: (time: string) => void;
  reminderEndTime?: string;
  onReminderEndTimeChange?: (time: string) => void;
  offsetMinutes: number;
  onOffsetMinutesChange: (offset: number) => void;
  recurrence: ReminderRecurrence;
  onRecurrenceChange: (recurrence: ReminderRecurrence) => void;
  occurredAt?: string;
}

export function ReminderConfigSection({
  enabled,
  onEnabledChange,
  reminderTime,
  onReminderTimeChange,
  reminderEndTime,
  onReminderEndTimeChange,
  offsetMinutes,
  onOffsetMinutesChange,
  recurrence,
  onRecurrenceChange,
  occurredAt,
}: ReminderConfigSectionProps) {
  const [permissionStatus, setPermissionStatus] = useState<string>("default");
  const [isRequesting, setIsRequesting] = useState<boolean>(false);
  const [hasAttemptedRequest, setHasAttemptedRequest] =
    useState<boolean>(false);
  const [showCustomPicker, setShowCustomPicker] = useState<boolean>(false);
  const [testSentMessage, setTestSentMessage] = useState<string | null>(null);

  useEffect(() => {
    setPermissionStatus(notificationService.getPermissionStatus());
  }, []);

  const getSmartDefaultIso = (): string => {
    if (occurredAt && occurredAt.includes("T")) {
      return occurredAt;
    }
    const now = new Date();
    const target = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      12,
      0,
      0,
    );
    return target.toISOString();
  };

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    try {
      const status = await notificationService.requestPermissions();
      setPermissionStatus(status);
      setHasAttemptedRequest(true);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleSendTestNotification = () => {
    const success = notificationService.sendNotification(
      "🔔 Recordatorio de Prueba - VoxDaily",
      "¡El sistema de notificaciones está configurado y funcionando perfectamente en tu navegador!",
    );
    if (success) {
      setTestSentMessage("¡Notificación de prueba enviada a tu pantalla!");
    } else {
      setTestSentMessage(
        "No se pudo enviar. Comprueba los permisos de tu navegador.",
      );
    }
    setTimeout(() => setTestSentMessage(null), 4000);
  };

  const offsetOptions = [
    { label: "A la hora exacta", value: 0 },
    { label: "5 min antes", value: 5 },
    { label: "15 min antes", value: 15 },
    { label: "1 hora antes", value: 60 },
    { label: "1 día antes", value: 1440 },
  ];

  const recurrenceOptions: {
    label: string;
    value: ReminderRecurrence;
    description: string;
  }[] = [
    {
      label: "Una vez",
      value: "NONE",
      description:
        "Aviso único puntual. Sonará una sola vez en la fecha y hora seleccionada.",
    },
    {
      label: "Cada 2 horas",
      value: "EVERY_2_HOURS",
      description:
        "Aviso periódico cada 2 horas entre la fecha de inicio y la fecha final.",
    },
    {
      label: "Cada 4 horas",
      value: "EVERY_4_HOURS",
      description:
        "Aviso periódico cada 4 horas entre la fecha de inicio y la fecha final.",
    },
    {
      label: "Cada 6 horas",
      value: "EVERY_6_HOURS",
      description:
        "Aviso periódico cada 6 horas entre la fecha de inicio y la fecha final.",
    },
    {
      label: "Cada 8 horas",
      value: "EVERY_8_HOURS",
      description:
        "Aviso periódico cada 8 horas entre la fecha de inicio y la fecha final.",
    },
    {
      label: "Cada 12 horas",
      value: "EVERY_12_HOURS",
      description:
        "Aviso periódico cada 12 horas entre la fecha de inicio y la fecha final.",
    },
    {
      label: "Diario",
      value: "DAILY",
      description:
        "Aviso continuo todos los días. Sonará diariamente a la hora fijada desde la fecha de inicio hasta la fecha final.",
    },
    {
      label: "Semanal",
      value: "WEEKLY",
      description:
        "Aviso semanal. Sonará cada semana el mismo día de la semana a la hora fijada hasta la fecha final.",
    },
    {
      label: "Mensual",
      value: "MONTHLY",
      description:
        "Aviso mensual. Sonará cada mes el mismo día a la hora fijada hasta la fecha final.",
    },
  ];

  const standardRecurrenceValues = [
    "NONE",
    "EVERY_2_HOURS",
    "EVERY_4_HOURS",
    "EVERY_6_HOURS",
    "EVERY_8_HOURS",
    "EVERY_12_HOURS",
    "DAILY",
    "WEEKLY",
    "MONTHLY",
  ];

  const initialHourMatch = recurrence
    ? recurrence.match(/^EVERY_(\d+)_HOURS?$/)
    : null;
  const isCustomHourActive = Boolean(
    initialHourMatch &&
    ![
      "EVERY_2_HOURS",
      "EVERY_4_HOURS",
      "EVERY_6_HOURS",
      "EVERY_8_HOURS",
      "EVERY_12_HOURS",
    ].includes(recurrence),
  );

  const [showCustomHoursInput, setShowCustomHoursInput] =
    useState<boolean>(isCustomHourActive);
  const [customHoursValue, setCustomHoursValue] = useState<string>(
    initialHourMatch ? initialHourMatch[1] : "3",
  );

  // Cálculo de fecha/hora de inicio de disparo efectiva para el resumen en vivo
  const getEffectiveTriggerDate = (): Date | null => {
    if (reminderTime) {
      const d = new Date(reminderTime);
      if (!isNaN(d.getTime())) return d;
    }
    if (occurredAt) {
      const base = new Date(occurredAt);
      if (!isNaN(base.getTime())) {
        return new Date(base.getTime() - (offsetMinutes || 0) * 60000);
      }
    }
    return null;
  };

  // Cálculo de fecha final efectiva (por defecto la fecha del evento)
  const getEffectiveEndDate = (): Date | null => {
    const endStr = reminderEndTime || occurredAt;
    if (endStr) {
      const d = new Date(endStr);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  };

  const effectiveTrigger = getEffectiveTriggerDate();
  const effectiveEnd = getEffectiveEndDate();

  const hourMatch = recurrence
    ? recurrence.match(/^EVERY_(\d+)_HOURS?$/)
    : null;
  const currentRecurrenceDescription = hourMatch
    ? `Aviso periódico flexible cada ${hourMatch[1]} horas entre la fecha de inicio y la fecha final.`
    : recurrenceOptions.find((r) => r.value === recurrence)?.description ||
      recurrenceOptions[0].description;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>
            🔔 Recordatorios y Notificaciones
          </Text>
          <Text style={styles.headerSubtitle}>
            Planifica un aviso sonoro y emergente en tu dispositivo
          </Text>
        </View>
        <Pressable
          testID="reminder-toggle-btn"
          style={[
            styles.toggleBtn,
            enabled ? styles.toggleBtnActive : styles.toggleBtnInactive,
          ]}
          onPress={() => {
            const next = !enabled;
            onEnabledChange(next);
            if (next) {
              if (!reminderTime) {
                onReminderTimeChange(getSmartDefaultIso());
              }
              if (!reminderEndTime && occurredAt) {
                onReminderEndTimeChange?.(occurredAt);
              }
              if (permissionStatus === "default") {
                handleRequestPermission();
              }
            }
          }}
        >
          <Text style={styles.toggleBtnText}>
            {enabled ? "ACTIVADO" : "DESACTIVADO"}
          </Text>
        </Pressable>
      </View>

      {enabled && (
        <View style={styles.expandedContent}>
          {/* 1. Gestión de Permisos del Navegador */}
          {permissionStatus === "granted" ? (
            <View style={styles.permissionGrantedBox}>
              <View style={styles.permissionGrantedLeft}>
                <Text style={styles.permissionGrantedText}>
                  ✅ Notificaciones permitidas en este navegador.
                </Text>
              </View>
              <Pressable
                style={styles.testNotificationBtn}
                onPress={handleSendTestNotification}
              >
                <Text style={styles.testNotificationBtnText}>
                  Probar Notificación
                </Text>
              </Pressable>
            </View>
          ) : permissionStatus === "denied" ? (
            <View style={styles.permissionDeniedBox}>
              <Text style={styles.permissionDeniedTitle}>
                🚫 Notificaciones bloqueadas en tu navegador
              </Text>
              <Text style={styles.permissionDeniedDesc}>
                Tu navegador tiene bloqueadas las notificaciones para este
                sitio. Para habilitarlas:{"\n"}
                1. Haz clic en el icono del candado 🔒 o ajustes (a la izquierda
                de la URL en tu navegador).{"\n"}
                2. En la opción "Notificaciones", selecciona "Permitir".{"\n"}
                3. Pulsa el botón de abajo para verificar.
              </Text>
              <Pressable
                style={styles.permissionRetryBtn}
                onPress={handleRequestPermission}
                disabled={isRequesting}
              >
                <Text style={styles.permissionRetryBtnText}>
                  {isRequesting
                    ? "Comprobando..."
                    : "🔄 Comprobar Permisos Nuevamente"}
                </Text>
              </Pressable>
            </View>
          ) : permissionStatus === "unsupported" ? (
            <View style={styles.permissionWarningBox}>
              <Text style={styles.permissionWarningText}>
                ℹ️ Notificaciones de escritorio no disponibles en este entorno
                (requiere HTTPS o navegador compatible). Recibirás avisos
                visuales en la aplicación.
              </Text>
            </View>
          ) : hasAttemptedRequest ? (
            <View style={styles.permissionPromptFallbackBox}>
              <Text style={styles.permissionPromptFallbackTitle}>
                🔔 El navegador no abrió la ventana de permisos automáticamente
              </Text>
              <Text style={styles.permissionPromptFallbackDesc}>
                En navegadores como Chrome, Edge o Brave, la ventana emergente
                puede estar silenciada. Para activarlas en 2 pasos:{"\n"}
                1. Haz clic en el icono del candado 🔒 o ajustes a la izquierda
                de la dirección web (URL).{"\n"}
                2. En "Notificaciones", cambia a "Permitir".{"\n"}
                3. Pulsa el botón inferior para confirmar.
              </Text>
              <View style={styles.permissionFallbackActions}>
                <Pressable
                  style={styles.permissionRetryBtn}
                  onPress={handleRequestPermission}
                  disabled={isRequesting}
                >
                  <Text style={styles.permissionRetryBtnText}>
                    {isRequesting
                      ? "Verificando..."
                      : "🔄 Comprobar Si Ya Fueron Permitidas"}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.permissionTryAgainBtn}
                  onPress={handleRequestPermission}
                  disabled={isRequesting}
                >
                  <Text style={styles.permissionTryAgainBtnText}>
                    {isRequesting ? "Reintentando..." : "Reintentar Solicitud"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.permissionWarningBox}>
              <Text style={styles.permissionWarningText}>
                ⚠️ Para recibir avisos en tu pantalla, autoriza los permisos en
                tu navegador:
              </Text>
              <Pressable
                style={[
                  styles.permissionGrantBtn,
                  isRequesting && styles.permissionGrantBtnDisabled,
                ]}
                onPress={handleRequestPermission}
                disabled={isRequesting}
              >
                <Text style={styles.permissionGrantBtnText}>
                  {isRequesting
                    ? "⏳ Solicitando..."
                    : "Activar Permisos Ahora"}
                </Text>
              </Pressable>
            </View>
          )}

          {testSentMessage ? (
            <Text style={styles.testFeedbackText}>{testSentMessage}</Text>
          ) : null}

          {/* 2. Momento del Aviso rápido si hay evento */}
          {occurredAt ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.subLabel}>
                ¿Cuándo deseas recibir el primer aviso respecto al evento?
              </Text>
              <View style={styles.optionsWrap}>
                {offsetOptions.map((opt) => {
                  const isSelected =
                    offsetMinutes === opt.value && !showCustomPicker;
                  return (
                    <Pressable
                      key={opt.value}
                      style={[styles.chip, isSelected && styles.chipActive]}
                      onPress={() => {
                        setShowCustomPicker(false);
                        onOffsetMinutesChange(opt.value);
                        onReminderTimeChange("");
                      }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  style={[styles.chip, showCustomPicker && styles.chipActive]}
                  onPress={() => {
                    setShowCustomPicker(true);
                    if (!reminderTime) {
                      onReminderTimeChange(getSmartDefaultIso());
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      showCustomPicker && styles.chipTextActive,
                    ]}
                  >
                    🕒 Fecha y hora personalizada
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {/* 3. Selector de Fecha de Inicio */}
          {(!occurredAt || showCustomPicker) && (
            <View style={styles.sectionBlock}>
              <DateTimePicker
                value={reminderTime || getSmartDefaultIso()}
                onChange={(iso) =>
                  onReminderTimeChange(iso || getSmartDefaultIso())
                }
                label="📅 Fecha y hora de inicio del aviso:"
                testID="input-reminder-start-date"
              />
            </View>
          )}

          {/* 4. Selector de Fecha Final (Predeterminada la del evento) */}
          <View style={styles.sectionBlock}>
            <DateTimePicker
              value={
                reminderEndTime ||
                occurredAt ||
                reminderTime ||
                getSmartDefaultIso()
              }
              onChange={(iso) => onReminderEndTimeChange?.(iso)}
              label="🏁 Fecha y hora final del aviso (Predeterminada: fecha del evento):"
              testID="input-reminder-end-date"
            />
            {occurredAt ? (
              <View style={styles.eventDateHelperRow}>
                <Text style={styles.eventDateHelperText}>
                  🎯 Fecha del evento:{" "}
                  <Text style={styles.eventDateHelperHighlight}>
                    {formatDateTime(occurredAt)}
                  </Text>
                </Text>
                {reminderEndTime && reminderEndTime !== occurredAt ? (
                  <Pressable
                    style={styles.resetToEventDateBtn}
                    onPress={() => onReminderEndTimeChange?.(occurredAt)}
                  >
                    <Text style={styles.resetToEventDateBtnText}>
                      🔄 Restablecer a fecha del evento
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>

          {/* 5. Frecuencia de Repetición con Explicación Intuitiva */}
          <View style={styles.sectionBlock}>
            <Text style={styles.subLabel}>
              Frecuencia de repetición del aviso:
            </Text>
            <View style={styles.optionsWrap}>
              {recurrenceOptions.map((opt) => {
                const isSelected = recurrence === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={[styles.chip, isSelected && styles.chipActive]}
                    onPress={() => {
                      setShowCustomHoursInput(false);
                      onRecurrenceChange(opt.value);
                    }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isSelected && styles.chipTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}

              {/* Botón chip para intervalo personalizado de horas */}
              <Pressable
                style={[
                  styles.chip,
                  (showCustomHoursInput || isCustomHourActive) &&
                    styles.chipActive,
                ]}
                onPress={() => {
                  setShowCustomHoursInput(true);
                  const parsed = parseInt(customHoursValue, 10);
                  const validHours = !isNaN(parsed) && parsed > 0 ? parsed : 3;
                  onRecurrenceChange(`EVERY_${validHours}_HOURS`);
                }}
                testID="chip-recurrence-interval-hours"
              >
                <Text
                  style={[
                    styles.chipText,
                    (showCustomHoursInput || isCustomHourActive) &&
                      styles.chipTextActive,
                  ]}
                >
                  ⚙️ Cada X horas...
                </Text>
              </Pressable>
            </View>

            {/* Input para intervalo personalizado en horas */}
            {showCustomHoursInput && (
              <View
                style={styles.customHoursRow}
                testID="custom-hours-container"
              >
                <Text style={styles.customHoursLabel}>
                  Horas entre cada aviso:
                </Text>
                <TextInput
                  style={styles.customHoursInput}
                  value={customHoursValue}
                  onChangeText={(txt) => {
                    const clean = txt.replace(/[^0-9]/g, "");
                    setCustomHoursValue(clean);
                    const num = parseInt(clean, 10);
                    if (!isNaN(num) && num > 0) {
                      onRecurrenceChange(`EVERY_${num}_HOURS`);
                    }
                  }}
                  keyboardType="numeric"
                  placeholder="ej. 3"
                  placeholderTextColor="#64748B"
                  testID="input-recurrence-custom-hours"
                />
                <Text style={styles.customHoursSuffix}>horas</Text>
              </View>
            )}

            {/* Texto explicativo dinámico de la frecuencia */}
            <View style={styles.recurrenceHelpBox}>
              <Text style={styles.recurrenceHelpText}>
                💡 {currentRecurrenceDescription}
              </Text>
            </View>
          </View>

          {/* 6. Tarjeta de Resumen y Verificación Inmediata */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>
              📋 Planificación Confirmada del Aviso
            </Text>
            {effectiveTrigger ? (
              <View style={styles.summaryDetails}>
                <Text style={styles.summaryItemText}>
                  🔔{" "}
                  <Text style={styles.summaryItemBold}>
                    Primer aviso (Inicio):
                  </Text>{" "}
                  {effectiveTrigger.toLocaleDateString("es-ES", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
                {effectiveEnd ? (
                  <Text style={styles.summaryItemText}>
                    🏁{" "}
                    <Text style={styles.summaryItemBold}>
                      Fecha límite (Fin):
                    </Text>{" "}
                    {effectiveEnd.toLocaleDateString("es-ES", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    {occurredAt &&
                    (reminderEndTime === occurredAt || !reminderEndTime)
                      ? "(Fecha del evento)"
                      : ""}
                  </Text>
                ) : null}
                <Text style={styles.summaryItemText}>
                  🔁 <Text style={styles.summaryItemBold}>Frecuencia:</Text>{" "}
                  {recurrence === "NONE"
                    ? "Una sola vez (no se repetirá)"
                    : hourMatch
                      ? `Sonará de forma periódica cada ${hourMatch[1]} horas`
                      : recurrence === "DAILY"
                        ? `Sonará todos los días a las ${effectiveTrigger.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                        : recurrence === "WEEKLY"
                          ? `Sonará cada semana los ${effectiveTrigger.toLocaleDateString("es-ES", { weekday: "long" })} a las ${effectiveTrigger.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                          : `Sonará el día ${effectiveTrigger.getDate()} de cada mes a las ${effectiveTrigger.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                </Text>
                <Text style={styles.summaryItemText}>
                  ⏳ <Text style={styles.summaryItemBold}>Período:</Text>{" "}
                  {recurrence === "NONE"
                    ? "Aviso puntual (se dispara una única vez en la fecha de inicio)"
                    : effectiveEnd
                      ? `Desde el ${effectiveTrigger.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} hasta el ${effectiveEnd.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} (cesará tras la fecha final)`
                      : `Desde el ${effectiveTrigger.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })} de forma continua`}
                </Text>
              </View>
            ) : (
              <Text style={styles.summaryWarningText}>
                ⚠️ Selecciona una fecha u hora válida arriba para programar el
                aviso.
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
    padding: 16,
    marginVertical: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  headerLeft: {
    flex: 1,
    minWidth: 140,
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  toggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
  },
  toggleBtnActive: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderColor: theme.colors.success,
  },
  toggleBtnInactive: {
    backgroundColor: "rgba(100, 116, 139, 0.2)",
    borderColor: "rgba(148, 163, 184, 0.3)",
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.textPrimary,
  },
  expandedContent: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
  },
  permissionGrantedBox: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.35)",
    borderWidth: 1,
    borderRadius: theme.borderRadius.sm,
    padding: 10,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  permissionGrantedLeft: {
    flex: 1,
    minWidth: 120,
  },
  permissionGrantedText: {
    color: "#34d399",
    fontSize: 12,
    fontWeight: "600",
  },
  testNotificationBtn: {
    backgroundColor: "rgba(16, 185, 129, 0.25)",
    borderColor: "#34d399",
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  testNotificationBtnText: {
    color: "#34d399",
    fontSize: 11,
    fontWeight: "700",
  },
  permissionDeniedBox: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "rgba(239, 68, 68, 0.4)",
    borderWidth: 1,
    borderRadius: theme.borderRadius.sm,
    padding: 12,
    marginBottom: 14,
    gap: 6,
  },
  permissionDeniedTitle: {
    color: "#f87171",
    fontSize: 13,
    fontWeight: "700",
  },
  permissionDeniedDesc: {
    color: "#fca5a5",
    fontSize: 11,
    lineHeight: 16,
  },
  permissionRetryBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.25)",
    borderColor: "#f87171",
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  permissionRetryBtnText: {
    color: "#fecaca",
    fontSize: 12,
    fontWeight: "700",
  },
  permissionWarningBox: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderColor: "rgba(245, 158, 11, 0.4)",
    borderWidth: 1,
    borderRadius: theme.borderRadius.sm,
    padding: 12,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  permissionWarningText: {
    color: "#fbbf24",
    fontSize: 12,
    flex: 1,
    minWidth: 120,
  },
  permissionGrantBtn: {
    backgroundColor: theme.colors.warning,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.sm,
  },
  permissionGrantBtnDisabled: {
    opacity: 0.6,
  },
  permissionPromptFallbackBox: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderColor: "rgba(245, 158, 11, 0.45)",
    borderWidth: 1,
    borderRadius: theme.borderRadius.sm,
    padding: 12,
    marginBottom: 14,
    gap: 8,
  },
  permissionPromptFallbackTitle: {
    color: "#FBBF24",
    fontSize: 13,
    fontWeight: "700",
  },
  permissionPromptFallbackDesc: {
    color: "#FDE68A",
    fontSize: 11,
    lineHeight: 17,
  },
  permissionFallbackActions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 4,
  },
  permissionTryAgainBtn: {
    backgroundColor: "rgba(100, 116, 139, 0.3)",
    borderColor: "#94A3B8",
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  permissionTryAgainBtnText: {
    color: "#F1F5F9",
    fontSize: 12,
    fontWeight: "600",
  },
  permissionGrantBtnText: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "700",
  },
  testFeedbackText: {
    color: "#38bdf8",
    fontSize: 12,
    fontStyle: "italic",
    marginBottom: 10,
  },
  sectionBlock: {
    marginBottom: 12,
  },
  subLabel: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  optionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  chipActive: {
    backgroundColor: "rgba(59, 130, 246, 0.25)",
    borderColor: theme.colors.primary,
  },
  chipText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "500",
  },
  chipTextActive: {
    color: "#60a5fa",
    fontWeight: "700",
  },
  recurrenceHelpBox: {
    backgroundColor: "rgba(30, 41, 59, 0.5)",
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#38BDF8",
  },
  recurrenceHelpText: {
    color: "#94A3B8",
    fontSize: 12,
    lineHeight: 16,
  },
  summaryCard: {
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderColor: "rgba(245, 158, 11, 0.35)",
    borderWidth: 1,
    borderRadius: theme.borderRadius.sm,
    padding: 12,
    marginTop: 10,
    gap: 6,
  },
  summaryTitle: {
    color: "#F59E0B",
    fontSize: 13,
    fontWeight: "700",
  },
  summaryDetails: {
    gap: 4,
  },
  summaryItemText: {
    color: "#FDE68A",
    fontSize: 12,
  },
  summaryItemBold: {
    fontWeight: "700",
    color: "#FFFBEB",
  },
  summaryWarningText: {
    color: "#FBBF24",
    fontSize: 12,
    fontStyle: "italic",
  },
  eventDateHelperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    borderColor: "rgba(56, 189, 248, 0.25)",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6,
    marginBottom: 6,
    flexWrap: "wrap",
    gap: 6,
  },
  eventDateHelperText: {
    color: "#94A3B8",
    fontSize: 11,
  },
  eventDateHelperHighlight: {
    color: "#38BDF8",
    fontWeight: "700",
  },
  resetToEventDateBtn: {
    backgroundColor: "rgba(56, 189, 248, 0.2)",
    borderColor: "#38BDF8",
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  resetToEventDateBtnText: {
    color: "#38BDF8",
    fontSize: 11,
    fontWeight: "700",
  },
  customHoursRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
  },
  customHoursLabel: {
    color: "#CBD5E1",
    fontSize: 13,
    fontWeight: "600",
  },
  customHoursInput: {
    backgroundColor: "#0F172A",
    color: "#F8FAFC",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.5)",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 14,
    fontWeight: "700",
    width: 60,
    textAlign: "center",
  },
  customHoursSuffix: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "600",
  },
});
