export type CategoryKind = "STANDARD" | "TASK" | "EVENT" | "CAPTURE";

export type TaskStatus = "PENDING" | "IN_PROGRESS" | "DONE";

export type TaskRecurrence = "ONCE" | "RECURRING";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

export type SaveMode = "FAST_FORWARD" | "PREVIEW_BEFORE_SAVE";

export type SyncStatus = "SYNCED" | "PENDING_PUSH";

export interface Category {
  id: string;
  user_id: string;
  kind: CategoryKind;
  name: string;
  name_normalized: string;
  voice_command: string;
  voice_command_normalized: string;
  description: string;
  color: string;
  icon: string;
  created_at: string;
  updated_at: string;
  version: number;
  sync_status: SyncStatus;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  name_normalized: string;
  color?: string;
  created_at: string;
  updated_at: string;
  version: number;
  sync_status: SyncStatus;
}

export type ReminderRecurrence =
  | "NONE"
  | "DAILY"
  | "WEEKLY"
  | "MONTHLY"
  | "YEARLY"
  | "EVERY_1_HOUR"
  | "EVERY_2_HOURS"
  | "EVERY_4_HOURS"
  | "EVERY_6_HOURS"
  | "EVERY_8_HOURS"
  | "EVERY_12_HOURS"
  | string;

export interface Entry {
  id: string;
  user_id: string;
  category_id: string;
  title?: string | null;
  occurred_at: string | null;
  content: string;
  task_status: TaskStatus | null;
  task_recurrence: TaskRecurrence | null;
  task_priority?: TaskPriority | null;
  capture_session_id: string | null;
  reminder_enabled?: boolean | null;
  reminder_time?: string | null;
  reminder_end_time?: string | null;
  reminder_recurrence?: ReminderRecurrence | null;
  reminder_offset_minutes?: number | null;
  reminder_offsets_minutes?: number[] | null;
  created_at: string;
  updated_at: string;
  version: number;
  sync_status: SyncStatus;
  tag_ids: string[];
}

export function getEntryDisplayTitle(
  entry: Entry,
  maxChars: number = 60,
): string {
  if (entry.title && entry.title.trim().length > 0) {
    return entry.title.trim();
  }
  const clean = entry.content.trim();
  if (clean.length <= maxChars) {
    return clean;
  }
  return clean.substring(0, maxChars) + "...";
}

export function normalizeUtcIso(
  isoString: string | null | undefined,
): string | null {
  if (!isoString) return null;
  let clean = isoString.trim();
  if (!clean) return null;
  if (clean.includes(" ") && !clean.includes("T")) {
    clean = clean.replace(" ", "T");
  }
  if (
    clean.includes("T") &&
    !clean.endsWith("Z") &&
    !/[+-]\d{2}(:\d{2})?$/.test(clean)
  ) {
    clean = clean + "Z";
  }
  return clean;
}

export function toLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return "";
  try {
    const norm = normalizeUtcIso(isoString) || isoString;
    const d = new Date(norm);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export function normalizeTextKey(text: string): string {
  return text.trim().toLowerCase();
}

export function normalizeTagName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[_\-\s]+/g, " ");
}

export function formatOffsetLabel(offsetMinutes: number): string {
  if (offsetMinutes === 1440) return "1 día antes";
  if (offsetMinutes === 180) return "3 horas antes";
  if (offsetMinutes === 120) return "2 horas antes";
  if (offsetMinutes === 60) return "1 hora antes";
  if (offsetMinutes === 30) return "30 min antes";
  if (offsetMinutes === 15) return "15 min antes";
  if (offsetMinutes === 0) return "a la hora del evento";
  return `${offsetMinutes} min antes`;
}

export function formatReminderSummary(entry: {
  reminder_enabled?: boolean | null;
  reminder_time?: string | null;
  reminder_end_time?: string | null;
  reminder_recurrence?: string | null;
  reminder_offset_minutes?: number | null;
  reminder_offsets_minutes?: number[] | null;
  occurred_at?: string | null;
}): string {
  if (!entry.reminder_enabled) return "";

  const rec = entry.reminder_recurrence;
  const endDesc = entry.reminder_end_time
    ? ` hasta ${formatDateTime(entry.reminder_end_time)}`
    : "";

  let recSuffix = "";
  const hourMatch = rec ? rec.match(/^EVERY_(\d+)_HOURS?$/) : null;
  if (hourMatch) {
    recSuffix = ` (Cada ${hourMatch[1]}h${endDesc})`;
  } else if (rec === "DAILY") {
    recSuffix = ` (Diario${endDesc})`;
  } else if (rec === "WEEKLY") {
    recSuffix = ` (Semanal${endDesc})`;
  } else if (rec === "MONTHLY") {
    recSuffix = ` (Mensual${endDesc})`;
  } else if (rec === "YEARLY") {
    recSuffix = ` (Anual${endDesc})`;
  }

  // Multi-offset display
  if (
    entry.reminder_offsets_minutes &&
    entry.reminder_offsets_minutes.length > 1
  ) {
    const labels = entry.reminder_offsets_minutes.map(formatOffsetLabel);
    return `Avisos: ${labels.join(", ")}${recSuffix}`;
  }

  const offset = entry.reminder_offset_minutes || 0;
  const baseIso = entry.occurred_at || entry.reminder_time;

  let timeDesc = "";

  if (baseIso && offset > 0) {
    const norm = normalizeUtcIso(baseIso) || baseIso;
    const baseDate = new Date(norm);
    if (!isNaN(baseDate.getTime())) {
      const triggerDate = new Date(baseDate.getTime() - offset * 60 * 1000);
      const hours = String(triggerDate.getHours()).padStart(2, "0");
      const minutes = String(triggerDate.getMinutes()).padStart(2, "0");
      const triggerTimeStr = `${hours}:${minutes}`;

      const isSameDay =
        baseDate.getFullYear() === triggerDate.getFullYear() &&
        baseDate.getMonth() === triggerDate.getMonth() &&
        baseDate.getDate() === triggerDate.getDate();

      const timeDisplay = isSameDay
        ? triggerTimeStr
        : `${triggerDate.getDate()} ${triggerDate.toLocaleString("es-ES", { month: "short" })}, ${triggerTimeStr}`;

      if (offset === 1440) {
        timeDesc = `${timeDisplay} (1 día antes)`;
      } else if (offset === 180) {
        timeDesc = `${timeDisplay} (3h antes)`;
      } else if (offset === 60) {
        timeDesc = `${timeDisplay} (1h antes)`;
      } else {
        timeDesc = `${timeDisplay} (${offset} min antes)`;
      }
    } else {
      timeDesc = formatOffsetLabel(offset);
    }
  } else if (entry.occurred_at && offset === 0) {
    const norm = normalizeUtcIso(entry.occurred_at) || entry.occurred_at;
    const baseDate = new Date(norm);
    if (!isNaN(baseDate.getTime())) {
      const hours = String(baseDate.getHours()).padStart(2, "0");
      const minutes = String(baseDate.getMinutes()).padStart(2, "0");
      timeDesc = `${hours}:${minutes} (A la hora del evento)`;
    } else {
      timeDesc = `A la hora del evento (${formatDateTime(entry.occurred_at)})`;
    }
  } else if (entry.reminder_time) {
    timeDesc = formatDateTime(entry.reminder_time);
  } else if (entry.occurred_at) {
    timeDesc = formatDateTime(entry.occurred_at);
  } else {
    timeDesc = "Hora programada";
  }

  return `${timeDesc}${recSuffix}`;
}
