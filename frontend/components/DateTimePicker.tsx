import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { theme } from "../styles/theme";
import { normalizeUtcIso } from "../types/domain";

export interface DateTimePickerProps {
  value: string; // ISO string, YYYY-MM-DD, YYYY-MM-DDTHH:MM, or empty string
  onChange: (isoValue: string) => void;
  label?: string;
  testID?: string;
}

function parseValue(val: string) {
  if (!val) return { date: "", time: "12:00" };
  try {
    const norm = normalizeUtcIso(val);
    if (norm) {
      const d = new Date(norm);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const hours = String(d.getHours()).padStart(2, "0");
        const minutes = String(d.getMinutes()).padStart(2, "0");
        return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` };
      }
    }
    if (val.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return { date: val, time: "12:00" };
    }
  } catch {
    // ignore
  }
  return { date: "", time: "12:00" };
}

type PresetType = "NOW" | "TODAY_18" | "TOMORROW_9" | "NONE" | null;

export function DateTimePicker({
  value,
  onChange,
  label = "Fecha y Hora de la Entrada",
  testID = "input-date",
}: DateTimePickerProps) {
  const { date: dateStr, time: timeStr } = parseValue(value);
  const [activePreset, setActivePreset] = React.useState<PresetType>(() => {
    if (!value) return "NONE";
    return null;
  });

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const todayDateStr = `${year}-${month}-${day}`;

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomYear = tomorrow.getFullYear();
  const tomMonth = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const tomDay = String(tomorrow.getDate()).padStart(2, "0");
  const tomorrowDateStr = `${tomYear}-${tomMonth}-${tomDay}`;

  const isNone = !dateStr;
  const isNow = !isNone && activePreset === "NOW" && dateStr === todayDateStr;
  const isToday18 =
    !isNone &&
    !isNow &&
    (activePreset === "TODAY_18" ||
      (dateStr === todayDateStr && timeStr === "18:00"));
  const isTomorrow9 =
    !isNone &&
    !isNow &&
    (activePreset === "TOMORROW_9" ||
      (dateStr === tomorrowDateStr && timeStr === "09:00"));

  const emitChange = (
    newDate: string,
    newTime: string,
    presetOrigin?: PresetType,
  ) => {
    setActivePreset(presetOrigin !== undefined ? presetOrigin : null);
    if (!newDate) {
      onChange("");
    } else {
      const timeToUse = newTime || "00:00";
      const [y, m, d] = newDate.split("-").map(Number);
      const [hh, mm] = timeToUse.split(":").map(Number);
      // Crear Date en la zona horaria local del usuario
      const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0);
      onChange(dt.toISOString());
    }
  };

  const handleSetNow = () => {
    const curNow = new Date();
    const curYear = curNow.getFullYear();
    const curMonth = String(curNow.getMonth() + 1).padStart(2, "0");
    const curDay = String(curNow.getDate()).padStart(2, "0");
    const hours = String(curNow.getHours()).padStart(2, "0");
    const minutes = String(curNow.getMinutes()).padStart(2, "0");
    emitChange(
      `${curYear}-${curMonth}-${curDay}`,
      `${hours}:${minutes}`,
      "NOW",
    );
  };

  const handleSetToday18 = () => {
    const curNow = new Date();
    const curYear = curNow.getFullYear();
    const curMonth = String(curNow.getMonth() + 1).padStart(2, "0");
    const curDay = String(curNow.getDate()).padStart(2, "0");
    emitChange(`${curYear}-${curMonth}-${curDay}`, "18:00", "TODAY_18");
  };

  const handleSetTomorrow9 = () => {
    const curNow = new Date();
    curNow.setDate(curNow.getDate() + 1);
    const curYear = curNow.getFullYear();
    const curMonth = String(curNow.getMonth() + 1).padStart(2, "0");
    const curDay = String(curNow.getDate()).padStart(2, "0");
    emitChange(`${curYear}-${curMonth}-${curDay}`, "09:00", "TOMORROW_9");
  };

  const handleClear = () => {
    emitChange("", "", "NONE");
  };

  const getFormattedLabel = () => {
    if (!dateStr) return "Sin fecha asignada";
    try {
      const [y, m, d] = dateStr.split("-").map(Number);
      const [hh, mm] = (timeStr || "12:00").split(":").map(Number);
      const dt = new Date(y, m - 1, d, hh || 0, mm || 0);
      return dt.toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return `${dateStr} ${timeStr}`;
    }
  };

  const webInputStyle: React.CSSProperties = {
    backgroundColor: "#0f172a",
    color: "#ffffff",
    border: "1px solid rgba(56, 189, 248, 0.35)",
    borderRadius: "8px",
    padding: "0 10px",
    fontSize: "14px",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    fontWeight: "600",
    colorScheme: "dark",
    outline: "none",
    width: "100%",
    minWidth: 0,
    maxWidth: "100%",
    height: "44px",
    minHeight: "44px",
    maxHeight: "44px",
    lineHeight: "44px",
    boxSizing: "border-box",
    cursor: "pointer",
    textAlign: "center",
    WebkitAppearance: "none",
  };

  return (
    <View style={styles.container} testID={testID}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      {/* Quick Presets */}
      <View style={styles.presetRow} testID="date-presets">
        <Pressable
          style={[styles.presetChip, isNow && styles.presetChipActive]}
          onPress={handleSetNow}
          testID="preset-now"
        >
          <Text
            style={[
              styles.presetChipText,
              isNow && styles.presetChipTextActive,
            ]}
          >
            ⚡ Ahora
          </Text>
        </Pressable>

        <Pressable
          style={[styles.presetChip, isToday18 && styles.presetChipActive]}
          onPress={handleSetToday18}
          testID="preset-today-18"
        >
          <Text
            style={[
              styles.presetChipText,
              isToday18 && styles.presetChipTextActive,
            ]}
          >
            📅 Hoy 18:00
          </Text>
        </Pressable>

        <Pressable
          style={[styles.presetChip, isTomorrow9 && styles.presetChipActive]}
          onPress={handleSetTomorrow9}
          testID="preset-tomorrow-9"
        >
          <Text
            style={[
              styles.presetChipText,
              isTomorrow9 && styles.presetChipTextActive,
            ]}
          >
            🌅 Mañana 09:00
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.presetChip,
            isNone && styles.presetChipActive,
            isNone && styles.presetChipActiveDanger,
          ]}
          onPress={handleClear}
          testID="preset-none"
        >
          <Text
            style={[
              styles.presetChipText,
              isNone && styles.presetChipTextActiveDanger,
            ]}
          >
            ❌ Sin Fecha
          </Text>
        </Pressable>
      </View>

      {/* Pickers: Web native <input type="date"> and <input type="time"> */}
      {Platform.OS === "web" ? (
        <View style={styles.pickersRowWeb}>
          <View style={styles.pickerField}>
            <Text style={styles.pickerSubLabel}>📅 Fecha (Calendario):</Text>
            <View style={{ position: "relative", width: "100%" }}>
              {React.createElement("input", {
                type: "date",
                value: dateStr,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                  emitChange(e.target.value, timeStr),
                style: webInputStyle,
              })}
              {!dateStr && (
                <Text style={styles.webDatePlaceholder} pointerEvents="none">
                  Seleccionar fecha...
                </Text>
              )}
            </View>
          </View>

          <View style={styles.pickerField}>
            <Text style={styles.pickerSubLabel}>⏰ Hora (Reloj):</Text>
            {React.createElement("input", {
              type: "time",
              value: timeStr,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                emitChange(dateStr, e.target.value),
              style: webInputStyle,
            })}
          </View>
        </View>
      ) : (
        <View style={styles.pickersRowWeb}>
          <View style={styles.pickerField}>
            <Text style={styles.pickerSubLabel}>Fecha (AAAA-MM-DD):</Text>
            <TextInput
              style={styles.inputFallback}
              placeholder="AAAA-MM-DD"
              placeholderTextColor="#64748B"
              value={dateStr}
              onChangeText={(val) => emitChange(val, timeStr)}
            />
          </View>
          <View style={styles.pickerField}>
            <Text style={styles.pickerSubLabel}>Hora (HH:MM):</Text>
            <TextInput
              style={styles.inputFallback}
              placeholder="HH:MM"
              placeholderTextColor="#64748B"
              value={timeStr}
              onChangeText={(val) => emitChange(dateStr, val)}
            />
          </View>
        </View>
      )}

      {/* Hidden / Fallback TextInput for test compatibility */}
      <TextInput
        testID={testID}
        style={{ display: "none" }}
        value={value}
        onChangeText={(val) => {
          if (!val) {
            emitChange("", "");
          } else {
            const parsed = parseValue(val);
            emitChange(parsed.date || val, parsed.time);
          }
        }}
      />

      {/* Spanish Live Preview */}
      {dateStr ? (
        <View style={styles.confirmationBox}>
          <Text style={styles.confirmationText}>✨ {getFormattedLabel()}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  presetChip: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  presetChipActive: {
    borderColor: "#38BDF8",
    backgroundColor: "rgba(56, 189, 248, 0.2)",
  },
  presetChipActiveDanger: {
    borderColor: theme.colors.danger,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  presetChipText: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  presetChipTextActive: {
    color: "#38BDF8",
    fontWeight: "700",
  },
  presetChipTextActiveDanger: {
    color: theme.colors.danger,
    fontWeight: "700",
  },
  pickersRowWeb: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
    width: "100%",
  },
  pickerField: {
    flex: 1,
    flexBasis: 130,
    minWidth: 0,
    maxWidth: "100%",
  },
  pickerSubLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 4,
  },
  inputFallback: {
    backgroundColor: theme.colors.bgSurface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.textPrimary,
    fontSize: 14,
  },
  confirmationBox: {
    marginTop: 6,
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    borderColor: "rgba(59, 130, 246, 0.3)",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  confirmationText: {
    color: "#60a5fa",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  webDatePlaceholder: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    textAlign: "center",
    lineHeight: 44,
    color: "#64748B",
    fontSize: 13,
    fontWeight: "500",
  },
});
