import { Entry, ReminderRecurrence } from "../types/domain";

export interface VoiceEditChanges {
  title?: string;
  occurred_at?: string;
  reminder_enabled?: boolean;
  reminder_time?: string;
  reminder_offset_minutes?: number;
  reminder_offsets_minutes?: number[];
  reminder_recurrence?: ReminderRecurrence;
  content?: string;
}

export interface VoiceEditResult {
  hasChanges: boolean;
  changes: VoiceEditChanges;
  actions: string[];
  rawTranscript: string;
}

function padZero(n: number): string {
  return String(n).padStart(2, "0");
}

export function parseVoiceEditCommand(
  rawTranscript: string,
  baseEntry?: Entry | null,
  refDate: Date = new Date(),
): VoiceEditResult {
  const text = (rawTranscript || "").trim();
  const lower = text.toLowerCase();
  const changes: VoiceEditChanges = {};
  const actions: string[] = [];

  if (!text) {
    return {
      hasChanges: false,
      changes: {},
      actions: [],
      rawTranscript: "",
    };
  }

  // 1. Detección de Título ("poner título X", "cambiar título a X", "título: X")
  const titleRegexes = [
    /(?:cambiar|poner|modificar|asignar|definir)\s+(?:el\s+)?t[ií]tulo(?:\s+(?:a|por)|\s*:)?\s+(.+?)(?=(?:\s+y\s+(?:cambiar|poner|la\s+hora|aviso|recordatorio))|$)/i,
    /(?:t[ií]tulo(?:\s*:|\s+es))\s+(.+?)(?=(?:\s+y\s+(?:cambiar|poner|la\s+hora|aviso|recordatorio))|$)/i,
  ];

  for (const reg of titleRegexes) {
    const match = text.match(reg);
    if (match && match[1]) {
      const cleanTitle = match[1].trim().replace(/[.,;]$/, "");
      if (cleanTitle) {
        changes.title = cleanTitle;
        actions.push(`Título: "${cleanTitle}"`);
        break;
      }
    }
  }

  // 2. Detección de Desactivación de Recordatorios
  if (
    /(?:quitar|desactivar|borrar|eliminar|sin)\s+(?:el\s+)?(?:aviso|recordatorio|notificaci[oó]n)/i.test(
      lower,
    )
  ) {
    changes.reminder_enabled = false;
    actions.push("Aviso desactivado");
  } else {
    // 3. Detección de Activación y Configuración de Recordatorios (múltiples antelaciones)
    const detectedOffsets: number[] = [];
    const detectedLabels: string[] = [];

    // 3.a) 1 día antes / un día antes (1440 min)
    if (/(?:1|un|uno)\s*d[ií]as?\s*antes/i.test(lower)) {
      if (!detectedOffsets.includes(1440)) {
        detectedOffsets.push(1440);
        detectedLabels.push("1 día antes");
      }
    }

    // 3.b) 3 horas antes / tres horas antes (180 min)
    if (/(?:3|tres)\s*horas?\s*antes/i.test(lower)) {
      if (!detectedOffsets.includes(180)) {
        detectedOffsets.push(180);
        detectedLabels.push("3 horas antes");
      }
    }

    // 3.c) 2 horas antes / dos horas antes (120 min)
    if (/(?:2|dos)\s*horas?\s*antes/i.test(lower)) {
      if (!detectedOffsets.includes(120)) {
        detectedOffsets.push(120);
        detectedLabels.push("2 horas antes");
      }
    }

    // 3.d) 1 hora antes / una hora antes (60 min)
    if (/(?:1|una|un)\s*horas?\s*antes/i.test(lower)) {
      if (!detectedOffsets.includes(60)) {
        detectedOffsets.push(60);
        detectedLabels.push("1 hora antes");
      }
    }

    // 3.e) Minutos antes (ej. 15 minutos antes, 30 min antes)
    const minMatches = lower.matchAll(/(\d+)\s*(?:minutos?|min)\s*antes/gi);
    for (const m of minMatches) {
      const mins = parseInt(m[1], 10);
      if (!isNaN(mins) && !detectedOffsets.includes(mins)) {
        detectedOffsets.push(mins);
        detectedLabels.push(`${mins} min antes`);
      }
    }

    // 3.f) A la hora exacta
    if (
      /(?:a\s+la\s+hora(?:\s+exacta)?)/i.test(lower) &&
      !/(?:1|una|dos|tres|\d+)\s*horas?\s*antes/i.test(lower)
    ) {
      if (!detectedOffsets.includes(0)) {
        detectedOffsets.push(0);
        detectedLabels.push("a la hora exacta");
      }
    }

    if (detectedOffsets.length > 0) {
      changes.reminder_enabled = true;
      changes.reminder_offsets_minutes = detectedOffsets;
      changes.reminder_offset_minutes = detectedOffsets[0];
      actions.push(`Aviso: ${detectedLabels.join(", ")}`);
    }

    // 3.g) Recurrencia por voz: "aviso cada X horas", "repetir cada X horas"
    const recHourlyMatch = lower.match(
      /(?:aviso|recordatorio|repetir)?\s*(?:peri[oó]dico\s+)?cada\s+(\d+)\s*horas?/i,
    );
    if (recHourlyMatch && recHourlyMatch[1]) {
      const hrs = parseInt(recHourlyMatch[1], 10);
      changes.reminder_enabled = true;
      changes.reminder_recurrence = `EVERY_${hrs}_HOURS`;
      actions.push(`Frecuencia: cada ${hrs} horas`);
    } else if (
      /diario|todos los d[ií]as/i.test(lower) &&
      /aviso|recordatorio/i.test(lower)
    ) {
      changes.reminder_enabled = true;
      changes.reminder_recurrence = "DAILY";
      actions.push("Frecuencia: diario");
    }
  }

  // 4. Detección de Cambio de Hora / Fecha
  let targetDate: Date | null = null;
  let targetHour: number | null = null;
  let targetMinute: number | null = null;

  // Fecha base existente o refDate
  if (baseEntry?.occurred_at) {
    const existingDate = new Date(baseEntry.occurred_at);
    if (!isNaN(existingDate.getTime())) {
      targetDate = new Date(existingDate.getTime());
    }
  }
  if (!targetDate) {
    targetDate = new Date(refDate.getTime());
  }

  // Modificadores de día
  let dayModified = false;
  if (/pasado\s+ma[ñn]ana/i.test(lower)) {
    targetDate = new Date(refDate.getTime());
    targetDate.setDate(targetDate.getDate() + 2);
    dayModified = true;
  } else if (/ma[ñn]ana/i.test(lower)) {
    targetDate = new Date(refDate.getTime());
    targetDate.setDate(targetDate.getDate() + 1);
    dayModified = true;
  } else if (/\bhoy\b/i.test(lower)) {
    targetDate = new Date(refDate.getTime());
    dayModified = true;
  }

  // Extracción de Hora (e.g. "cambiar la hora a las 18:30", "poner a las 5 de la tarde", "a las 11 am")
  const timeRegexes = [
    /(?:cambiar|poner|modificar|mover)?\s*(?:la\s+)?hora\s+(?:a|para)?\s*(?:las?)?\s*(\d{1,2})(?::(\d{2}))?\s*(de la tarde|de la noche|de la ma[ñn]ana|pm|am)?/i,
    /(?:a\s+las?|para\s+las?)\s*(\d{1,2})(?::(\d{2}))?\s*(de la tarde|de la noche|de la ma[ñn]ana|pm|am)/i,
    /(?:a\s+las?|para\s+las?)\s*(\d{1,2}):(\d{2})/i,
    /(?:a\s+las?)\s*(\d{1,2})\b(?!\s*minutos|\s*min|\s*horas)/i,
  ];

  for (const reg of timeRegexes) {
    const m = text.match(reg);
    if (m) {
      let h = parseInt(m[1], 10);
      const min = m[2] ? parseInt(m[2], 10) : 0;
      const period = m[3] ? m[3].toLowerCase() : "";

      if (
        (period.includes("tarde") ||
          period.includes("noche") ||
          period === "pm") &&
        h < 12
      ) {
        h += 12;
      } else if (
        (period.includes("mañana") ||
          period.includes("manana") ||
          period === "am") &&
        h === 12
      ) {
        h = 0;
      }

      if (h >= 0 && h <= 23 && min >= 0 && min <= 59) {
        targetHour = h;
        targetMinute = min;
        break;
      }
    }
  }

  if (targetHour !== null && targetMinute !== null) {
    targetDate.setHours(targetHour, targetMinute, 0, 0);
    changes.occurred_at = targetDate.toISOString();
    actions.push(`Hora: ${padZero(targetHour)}:${padZero(targetMinute)}`);
  } else if (dayModified) {
    changes.occurred_at = targetDate.toISOString();
    actions.push(`Fecha: ${targetDate.toLocaleDateString("es-ES")}`);
  }

  // 5. Detección de Descripción / Contenido
  const contentMatch = text.match(
    /(?:cambiar|poner|modificar)\s+(?:la\s+)?descripci[oó]n(?:\s+(?:a|por)|\s*:)?\s+(.+)$/i,
  );
  if (contentMatch && contentMatch[1]) {
    const cleanContent = contentMatch[1].trim();
    if (cleanContent) {
      changes.content = cleanContent;
      actions.push("Descripción actualizada");
    }
  }

  const hasChanges = Object.keys(changes).length > 0;

  return {
    hasChanges,
    changes,
    actions,
    rawTranscript: text,
  };
}
