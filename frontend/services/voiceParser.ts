import {
  Category,
  normalizeTagName,
  normalizeTextKey,
  Tag,
  TaskPriority,
} from "../types/domain";

export interface RecognizedToken {
  text: string;
  type: "CATEGORY" | "DATE" | "TAG" | "KEYWORD" | "CONTENT";
  label: string;
}

export interface ParsedSpokenCommand {
  categoryId: string | null;
  categoryName: string | null;
  occurredAt: string | null;
  title?: string | null;
  content: string;
  tagIds: string[];
  tagNames: string[];
  taskPriority?: TaskPriority | null;
  reminderEnabled?: boolean;
  reminderOffsetMinutes?: number;
  reminderOffsetsMinutes?: number[];
  errors: string[];
  isSuccess: boolean;
  tokens?: RecognizedToken[];
}

const hourWordsMap: { [key: string]: number } = {
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
};

const minuteWordsMap: { [key: string]: number } = {
  media: 30,
  cuarto: 15,
  treinta: 30,
  quince: 15,
  "cuarenta y cinco": 45,
  cuarentaycinco: 45,
  veinte: 20,
  diez: 10,
  cinco: 5,
};

const spanishMonthsMap: { [key: string]: number } = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
  "01": 1,
  "1": 1,
  "02": 2,
  "2": 2,
  "03": 3,
  "3": 3,
  "04": 4,
  "4": 4,
  "05": 5,
  "5": 5,
  "06": 6,
  "6": 6,
  "07": 7,
  "7": 7,
  "08": 8,
  "8": 8,
  "09": 9,
  "9": 9,
  "10": 10,
  "11": 11,
  "12": 12,
};

const spanishDaysMap: { [key: string]: number } = {
  primero: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  dieciséis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintidos: 22,
  veintidós: 22,
  veintitres: 23,
  veintitrés: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintiséis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
  treinta: 30,
  "treinta y uno": 31,
};

export function parseSpokenCommand(
  transcript: string,
  categories: Category[],
  tags: Tag[],
  refDate: Date = new Date(),
): ParsedSpokenCommand {
  const errors: string[] = [];
  const tokens: RecognizedToken[] = [];

  if (!transcript || !transcript.trim()) {
    return {
      categoryId: null,
      categoryName: null,
      occurredAt: null,
      content: "",
      tagIds: [],
      tagNames: [],
      errors: ["La transcripción está vacía."],
      isSuccess: false,
      tokens: [],
    };
  }

  // Punctuation normalization: suppress question/exclamation marks inserted by Speech-to-Text and fix missing spaces after dots/commas
  const rawText = transcript
    .replace(/[¿?¡!]/g, " ")
    .replace(/\.([a-zA-ZáéíóúñÁÉÍÓÚÑ0-9])/g, ". $1")
    .replace(/,([a-zA-ZáéíóúñÁÉÍÓÚÑ0-9])/g, ", $1")
    .replace(/\s+/g, " ")
    .trim();

  let workingText = rawText;
  let categoryId: string | null = null;
  let categoryName: string | null = null;
  let occurredAt: string | null = null;
  const tagIds: string[] = [];
  const tagNames: string[] = [];

  // 1. Category extraction (ignores filler words before the first recognized category command)
  let matchedCategory: Category | null = null;
  let matchedCategoryIndex = -1;
  let matchedCategoryLength = 0;
  let matchedCategoryStr = "";

  // Check explicit prefix "(categoría|categoria) <name>" anywhere in rawText
  const categoryPrefixMatch = rawText.match(
    /(?:categoría|categoria)\s+([a-záéíóúñ0-9_\-\s]+?)(?:\s+(?:fecha|para|día|dia|contenido|que dice|dice|etiqueta|etiquetas|tag|tags|hoy|mañana|ayer)|[.,;:!?\s]|$)/i,
  );

  if (categoryPrefixMatch && categoryPrefixMatch[1]) {
    const catSearch = normalizeTextKey(categoryPrefixMatch[1]);
    const foundCat = categories.find(
      (c) =>
        normalizeTextKey(c.voice_command) === catSearch ||
        normalizeTextKey(c.name) === catSearch,
    );
    if (foundCat) {
      matchedCategory = foundCat;
      matchedCategoryIndex = categoryPrefixMatch.index ?? 0;
      matchedCategoryLength = categoryPrefixMatch[0].length;
      matchedCategoryStr = categoryPrefixMatch[0].trim();
    }
  }

  // If not matched by explicit prefix, search for the earliest occurrence of any category voice_command or name
  if (!matchedCategory) {
    const normalizedRaw = normalizeTextKey(rawText);
    let earliestIndex = Infinity;

    for (const cat of categories) {
      const vcNorm = normalizeTextKey(cat.voice_command);
      const nameNorm = normalizeTextKey(cat.name);

      const checkMatch = (term: string) => {
        if (!term) return;
        const idx = normalizedRaw.indexOf(term);
        if (idx !== -1 && idx < earliestIndex) {
          const charBefore = idx > 0 ? normalizedRaw[idx - 1] : " ";
          const charAfter =
            idx + term.length < normalizedRaw.length
              ? normalizedRaw[idx + term.length]
              : " ";
          if (/[\s.,;:!?]/.test(charBefore) && /[\s.,;:!?]/.test(charAfter)) {
            earliestIndex = idx;
            matchedCategory = cat;
            matchedCategoryIndex = idx;
            matchedCategoryLength = term.length;
            matchedCategoryStr = rawText.substring(idx, idx + term.length);
          }
        }
      };

      checkMatch(vcNorm);
      checkMatch(nameNorm);
    }
  }

  if (matchedCategory) {
    categoryId = matchedCategory.id;
    categoryName = matchedCategory.name;
    tokens.push({
      text: matchedCategoryStr,
      type: "CATEGORY",
      label: `Categoría: ${matchedCategory.name}`,
    });

    const beforeCategory = rawText.substring(0, matchedCategoryIndex).trim();
    const afterCategory = rawText
      .substring(matchedCategoryIndex + matchedCategoryLength)
      .trim();

    // Check if text before category contains date/tag keywords or patterns
    const hasInfoBefore =
      /(?:fecha|para|día|dia|hoy|mañana|manana|ayer|semana|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo|\d{1,2}\s*(?:del?|de|\/|-)\s*\d{1,2}|etiquetas?|tags?)/i.test(
        beforeCategory,
      );

    if (hasInfoBefore) {
      workingText = `${beforeCategory} ${afterCategory}`
        .replace(/^[,.:;\-\s]+/, "")
        .trim();
    } else {
      workingText = afterCategory.replace(/^[,.:;\-\s]+/, "").trim();
    }
  } else {
    const firstWord = rawText.split(/[\s,.:;]+/)[0];
    errors.push(`Categoría no reconocida: "${firstWord}"`);
  }

  // 2. Date & Time extraction (runs BEFORE Tag extraction)
  let targetDate: Date | null = null;
  let labelDate = "";
  let matchedDateText = "";

  // 2a. Spanish numeric/verbal date match (e.g. "Para. La fecha de 5 del 10 de 2026", "Sin fecha. Para el 6 del 10", "5 de octubre de 2026", "5/10/2026")
  const spanishDateMatch = workingText.match(
    /(?:\s|^|[,.:;])(?:(?:sin|con)[,.:;\s]*fecha[,.:;\s]*)?(?:(?:para|con|a|en|de)[,.:;\s]*(?:la|el)?[,.:;\s]*(?:fecha|día|dia)[,.:;\s]*(?:de)?|fecha[,.:;\s]*(?:de)?|para\s+el|para\s+la|para|día|dia|el\s+día|el\s+dia)?[,.:;\s]*(?:el\s+días?\s+|el\s+)?(\d{1,2}|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|dieciséis|diecisiete|dieciocho|diecinueve|veinte|veintiuno|veintidos|veintidós|veintitres|veintitrés|veinticuatro|veinticinco|veintiseis|veintiséis|veintisiete|veintiocho|veintinueve|treinta|treinta\s+y\s+uno)\s*(?:del?|de|\/|-)\s*(\d{1,2}|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s*(?:del?|de|\/|-)\s*(?:año\s+)?(\d{2,4}))?(?:[.,;:!?\s]|$)/i,
  );

  if (spanishDateMatch && spanishDateMatch[1] && spanishDateMatch[2]) {
    const rawDay = spanishDateMatch[1].toLowerCase().trim();
    const rawMonth = spanishDateMatch[2].toLowerCase().trim();
    const rawYear = spanishDateMatch[3] ? spanishDateMatch[3].trim() : null;

    const day = spanishDaysMap[rawDay] ?? parseInt(rawDay, 10);
    const month = spanishMonthsMap[rawMonth] ?? parseInt(rawMonth, 10);
    let year = refDate.getFullYear();

    if (rawYear) {
      const parsedYear = parseInt(rawYear, 10);
      if (!isNaN(parsedYear)) {
        year = rawYear.length === 2 ? 2000 + parsedYear : parsedYear;
      }
    }

    if (
      !isNaN(day) &&
      !isNaN(month) &&
      day >= 1 &&
      day <= 31 &&
      month >= 1 &&
      month <= 12
    ) {
      const parsedDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      if (!isNaN(parsedDate.getTime())) {
        targetDate = parsedDate;
        labelDate = `${day}/${month}/${year}`;
        matchedDateText = spanishDateMatch[0].trim();

        // Index-based substring removal guarantees match is cleanly removed from workingText regardless of regex boundary spaces
        const matchIdx = spanishDateMatch.index ?? 0;
        const matchLen = spanishDateMatch[0].length;
        workingText = (
          workingText.substring(0, matchIdx) +
          " " +
          workingText.substring(matchIdx + matchLen)
        ).trim();
      }
    }
  }

  // 2b. Fallback for relative dates ("hoy", "mañana", "pasado mañana", "ayer", "2026-10-05", "lunes de la semana que viene", "semana siguiente")
  if (!targetDate) {
    const nextWeekUnambiguousPattern =
      "(?:(?:el\\s+)?(?:lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\\s+(?:de\\s+la\\s+|de\\s+)?(?:semana\\s+que\\s+viene|próxima\\s+semana|proxima\\s+semana|semana\\s+siguiente))|" +
      "(?:(?:el\\s+)?(?:lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\\s+que\\s+viene)|" +
      "(?:(?:la\\s+|el\\s+)?(?:semana\\s+que\\s+viene|semana\\s+siguiente|próxima\\s+semana|proxima\\s+semana))";

    const relativeDatePatternStr =
      `${nextWeekUnambiguousPattern}|` +
      "(?:pasado\\s+mañana|pasado\\s+manana|hoy|mañana|manana|ayer)|" +
      "(?:este\\s+[a-záéíóúñ]+|el\\s+próximo\\s+[a-záéíóúñ]+|el\\s+proximo\\s+[a-záéíóúñ]+|próximo\\s+[a-záéíóúñ]+|proximo\\s+[a-záéíóúñ]+)|" +
      "(?:\\d{4}-\\d{2}-\\d{2})";

    const explicitDateMatch =
      workingText.match(
        new RegExp(
          `(?:\\s|^|[,.:;])(?:(?:sin|con)[,.:;\\s]*fecha[,.:;\\s]*)?(?:(?:para|con|a|en|de)[,.:;\\s]*(?:la|el)?[,.:;\\s]*(?:fecha|día|dia)[,.:;\\s]*(?:de)?|como\\s+fecha|fecha[,.:;\\s]*(?:de)?|para\\s+el|para\\s+la|para|día|dia|el\\s+día|el\\s+dia|a\\s+la\\s+fecha\\s*de|a\\s+fecha\\s*de)[,.:;]?\\s*(${relativeDatePatternStr}|(?:el\\s+)?(?:domingo|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado))(?:[.,;:!?\\s]|$)`,
          "i",
        ),
      ) ??
      workingText.match(
        new RegExp(
          `^(?:[,.:;\\s]*)(${relativeDatePatternStr})(?:[.,;:!?\\s]|$)`,
          "i",
        ),
      ) ??
      workingText.match(
        new RegExp(
          `(?:\\s|^|[,.:;])(${nextWeekUnambiguousPattern})(?:[.,;:!?\\s]|$)`,
          "i",
        ),
      );

    if (explicitDateMatch && explicitDateMatch[1]) {
      const dateStr = explicitDateMatch[1].toLowerCase().trim();
      const baseDate = new Date(refDate);

      const daysMap: { [k: string]: number } = {
        domingo: 0,
        lunes: 1,
        martes: 2,
        miercoles: 3,
        miércoles: 3,
        jueves: 4,
        viernes: 5,
        sabado: 6,
        sábado: 6,
      };

      const isoDaysMap: { [k: string]: number } = {
        lunes: 1,
        martes: 2,
        miercoles: 3,
        miércoles: 3,
        jueves: 4,
        viernes: 5,
        sabado: 6,
        sábado: 6,
        domingo: 7,
      };

      const isNextWeek =
        /(?:semana\s+que\s+viene|semana\s+siguiente|próxima\s+semana|proxima\s+semana|\bque\s+viene\b)/i.test(
          dateStr,
        );
      const dayMatch = dateStr.match(
        /\b(domingo|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado)\b/i,
      );

      if (isNextWeek && dayMatch) {
        const dayName = dayMatch[1].toLowerCase();
        const targetIsoDay = isoDaysMap[dayName];
        const currentDay = baseDate.getDay();
        const currentIsoDay = currentDay === 0 ? 7 : currentDay;

        // Monday of next week:
        const nextMonday = new Date(baseDate);
        nextMonday.setDate(baseDate.getDate() - (currentIsoDay - 1) + 7);

        // Day of next week:
        nextMonday.setDate(nextMonday.getDate() + (targetIsoDay - 1));
        targetDate = nextMonday;

        const capDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
        labelDate = `El ${capDay} de la próxima semana`;
      } else if (isNextWeek && !dayMatch) {
        const currentDay = baseDate.getDay();
        const currentIsoDay = currentDay === 0 ? 7 : currentDay;

        // Defaults to Monday of next week:
        const nextMonday = new Date(baseDate);
        nextMonday.setDate(baseDate.getDate() - (currentIsoDay - 1) + 7);
        targetDate = nextMonday;
        labelDate = "Próxima semana";
      } else if (dateStr === "hoy") {
        targetDate = baseDate;
        labelDate = "Hoy";
      } else if (dateStr === "mañana" || dateStr === "manana") {
        baseDate.setDate(baseDate.getDate() + 1);
        targetDate = baseDate;
        labelDate = "Mañana";
      } else if (dateStr === "pasado mañana" || dateStr === "pasado manana") {
        baseDate.setDate(baseDate.getDate() + 2);
        targetDate = baseDate;
        labelDate = "Pasado Mañana";
      } else if (dateStr === "ayer") {
        baseDate.setDate(baseDate.getDate() - 1);
        targetDate = baseDate;
        labelDate = "Ayer";
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const parsed = new Date(`${dateStr}T00:00:00Z`);
        if (!isNaN(parsed.getTime())) {
          targetDate = parsed;
          labelDate = dateStr;
        }
      } else {
        const cleanNorm = dateStr
          .replace(/^(?:este|el|próximo|proximo)\s+/, "")
          .trim();
        if (daysMap[cleanNorm] !== undefined) {
          const targetDay = daysMap[cleanNorm];
          const currentDay = baseDate.getDay();
          let diff = targetDay - currentDay;
          if (diff <= 0) diff += 7;
          baseDate.setDate(baseDate.getDate() + diff);
          targetDate = baseDate;
          labelDate = `El ${cleanNorm.charAt(0).toUpperCase() + cleanNorm.slice(1)}`;
        }
      }

      matchedDateText = explicitDateMatch[0].replace(/^[,.:;\s]+/, "").trim();
      const matchIdx = explicitDateMatch.index ?? 0;
      const matchLen = explicitDateMatch[0].length;
      workingText = (
        workingText.substring(0, matchIdx) +
        " " +
        workingText.substring(matchIdx + matchLen)
      ).trim();
      workingText = workingText
        .replace(/^(?:como\s+fecha|de\s+fecha)[,.:;\s]*/i, "")
        .trim();
    }
  }

  // 2c. Time extraction ("a las 1600", "a las 16:00", "a las 4 de la tarde", "a las cuatro", "a las 5", "a las 9 y media")
  const timeMatch = workingText.match(
    /(?:\s|^|[,.:;])(?:a\s+las?|a\s+la)\s+(\d{1,2}:\d{2}|\d{4}|\d{1,2}|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)(?:\s+y\s+(media|cuarto|treinta|quince|veinte|diez|cinco|\d{1,2}))?(?:\s*(de\s+la\s+(?:tarde|noche|mañana|manana)|por\s+la\s+(?:tarde|noche|mañana|manana)|am|pm|hs|horas))?(?:[.,;:!?\s]|$)/i,
  );

  let labelTime = "";
  if (timeMatch && timeMatch[1]) {
    const rawVal = timeMatch[1].toLowerCase().trim();
    const modifier = timeMatch[2] ? timeMatch[2].toLowerCase().trim() : null;
    const ampm = timeMatch[3] ? timeMatch[3].toLowerCase().trim() : null;

    let hours = -1;
    let minutes = 0;
    let isExplicit24h = false;

    if (rawVal.includes(":")) {
      const parts = rawVal.split(":");
      hours = parseInt(parts[0], 10);
      minutes = parseInt(parts[1], 10);
      if (parts[0].length === 2 && parts[0].startsWith("0")) {
        isExplicit24h = true;
      }
      if (hours >= 13) {
        isExplicit24h = true;
      }
    } else if (rawVal.length === 4 && /^\d{4}$/.test(rawVal)) {
      hours = parseInt(rawVal.substring(0, 2), 10);
      minutes = parseInt(rawVal.substring(2, 4), 10);
      isExplicit24h = true;
    } else if (hourWordsMap[rawVal] !== undefined) {
      hours = hourWordsMap[rawVal];
    } else if (!isNaN(parseInt(rawVal, 10))) {
      hours = parseInt(rawVal, 10);
    }

    if (modifier) {
      if (minuteWordsMap[modifier] !== undefined) {
        minutes = minuteWordsMap[modifier];
      } else if (!isNaN(parseInt(modifier, 10))) {
        minutes = parseInt(modifier, 10);
      }
    }

    if (hours >= 0 && hours <= 23) {
      if (ampm) {
        if (
          (ampm.includes("tarde") ||
            ampm.includes("noche") ||
            ampm.includes("pm")) &&
          hours < 12
        ) {
          hours += 12;
        } else if (
          (ampm.includes("mañana") ||
            ampm.includes("manana") ||
            ampm.includes("am")) &&
          hours === 12
        ) {
          hours = 0;
        }
      } else if (!isExplicit24h && hours >= 1 && hours <= 11) {
        // Unspecified hour (e.g. "a las 4", "a las cinco") defaults to PM (16:00, 17:00)
        hours += 12;
      }

      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        if (!targetDate) {
          targetDate = new Date(refDate);
          labelDate = "Hoy";
        }
        targetDate.setHours(hours, minutes, 0, 0);
        const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
        labelTime = ` a las ${pad(hours)}:${pad(minutes)}`;

        const matchIdx = timeMatch.index ?? 0;
        const matchLen = timeMatch[0].length;
        workingText = (
          workingText.substring(0, matchIdx) +
          " " +
          workingText.substring(matchIdx + matchLen)
        ).trim();
      }
    }
  }


  if (targetDate) {
    occurredAt = targetDate.toISOString();
    tokens.push({
      text: `${matchedDateText} ${labelTime}`.trim(),
      type: "DATE",
      label: `Fecha: ${labelDate}${labelTime}`,
    });
  } else if (matchedCategory && matchedCategory.kind === "TASK") {
    targetDate = new Date(refDate);
    occurredAt = targetDate.toISOString();
    tokens.push({
      text: "hoy",
      type: "DATE",
      label: "Fecha: Hoy",
    });
  }

  // 3. Tag extraction: matches "etiquetas ..." stopping before keywords, periods, or sentence ends
  const tagRegex =
    /(?:\s|^|[,.:;])(?:con\s+)?(?:etiquetas?|tags?)\s+([^.,;:!?]+?)(?=\s*(?:fecha|para|día|dia|contenido|que dice|dice)|[.,;:!?]|$)/i;
  const tagMatch = workingText.match(tagRegex);
  if (tagMatch && tagMatch[1]) {
    const tagText = tagMatch[1].trim();
    const matchIdx = tagMatch.index ?? 0;
    const matchLen = tagMatch[0].length;
    workingText = (
      workingText.substring(0, matchIdx) +
      " " +
      workingText.substring(matchIdx + matchLen)
    ).trim();

    const potentialTagTokens = tagText
      .split(/,|\sy\s|\s+/i)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    for (const token of potentialTagTokens) {
      const normToken = normalizeTagName(token);
      const matchedTag = tags.find((t) => t.name_normalized === normToken);
      if (matchedTag && !tagIds.includes(matchedTag.id)) {
        tagIds.push(matchedTag.id);
        tagNames.push(matchedTag.name);
      }
    }

    tokens.push({
      text: tagMatch[0].trim(),
      type: "TAG",
      label: `Etiquetas: ${tagNames.length > 0 ? tagNames.join(", ") : tagText}`,
    });
  }

  // 4. Priority extraction (ONLY for categories of kind TASK)
  let taskPriority: TaskPriority | null = null;
  if (matchedCategory && matchedCategory.kind === "TASK") {
    const priorityRegex =
      /(?:\s|^|[,.:;])(?:(?:con|de)\s+)?prioridad(?:\s*:)?\s+(alta|urgente|media|normal|baja)(?=[.,;:!?\s]|$)/i;
    const prioMatch = workingText.match(priorityRegex);
    if (prioMatch && prioMatch[1]) {
      const rawPrio = prioMatch[1].toLowerCase();
      let prioValue: TaskPriority = "MEDIUM";
      let prioLabel = "Media";

      if (rawPrio === "alta" || rawPrio === "urgente") {
        prioValue = "HIGH";
        prioLabel = "Alta";
      } else if (rawPrio === "baja") {
        prioValue = "LOW";
        prioLabel = "Baja";
      } else {
        prioValue = "MEDIUM";
        prioLabel = "Media";
      }

      taskPriority = prioValue;

      const matchIdx = prioMatch.index ?? 0;
      const matchLen = prioMatch[0].length;
      workingText = (
        workingText.substring(0, matchIdx) +
        " " +
        workingText.substring(matchIdx + matchLen)
      ).trim();

      tokens.push({
        text: prioMatch[0].trim(),
        type: "KEYWORD",
        label: `Prioridad: ${prioLabel}`,
      });
    } else {
      taskPriority = "MEDIUM";
    }
  }

  // 5. Title extraction (e.g. "con título X", "título X", "titulo X")
  let title: string | null = null;
  const titleRegex =
    /(?:\s|^|[,.:;])(?:(?:con|de)\s+)?(?:título|titulo)(?:\s*:)?\s+([^,.:;\n]+?)(?=(?:\s+(?:con\s+prioridad|prioridad|etiqueta|etiquetas|tags?|contenido|que\s+dice|dice|fecha|día|dia)\b|[,.;]|$))/i;
  const titleMatch = workingText.match(titleRegex);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].trim();
    const matchIdx = titleMatch.index ?? 0;
    const matchLen = titleMatch[0].length;
    workingText = (
      workingText.substring(0, matchIdx) +
      " " +
      workingText.substring(matchIdx + matchLen)
    ).trim();

    tokens.push({
      text: titleMatch[0].trim(),
      type: "KEYWORD",
      label: `Título: ${title}`,
    });
  }

  // 5b. Reminder & Notification extraction
  let reminderEnabled: boolean | undefined = undefined;
  let reminderOffsetMinutes: number | undefined = undefined;
  let reminderOffsetsMinutes: number[] | undefined = undefined;

  const reminderRegex =
    /(?:\s|^|[,.:;])(?:(?:con|de|y)?\s*(?:avisos?|recordatorios?|notificaci[oó]n|notificaciones|notificar(?:me)?)(?:\s*:)?\s+([^.;\n]+?)|(?:sin\s+(?:aviso|recordatorio|notificaci[oó]n)))(?=(?:\s+(?:con\s+prioridad|prioridad|etiqueta|etiquetas|tags?|contenido|que\s+dice|dice|título|titulo)\b|[.;]|$))/i;

  const remMatch = workingText.match(reminderRegex);
  if (remMatch) {
    const fullRemMatch = remMatch[0].trim();
    const remDetails = remMatch[1] ? remMatch[1].toLowerCase().trim() : "";

    if (/sin\s+(?:aviso|recordatorio|notificaci[oó]n)/i.test(fullRemMatch)) {
      reminderEnabled = false;
      reminderOffsetsMinutes = [];
      tokens.push({
        text: fullRemMatch,
        type: "KEYWORD",
        label: "Aviso: Desactivado",
      });
    } else if (remDetails) {
      const detectedOffsets: number[] = [];
      const detectedLabels: string[] = [];

      if (/(?:1|un|uno)\s*d[ií]as?\s*antes/i.test(remDetails)) {
        if (!detectedOffsets.includes(1440)) {
          detectedOffsets.push(1440);
          detectedLabels.push("1 día antes");
        }
      }
      if (/(?:3|tres)\s*horas?\s*antes/i.test(remDetails)) {
        if (!detectedOffsets.includes(180)) {
          detectedOffsets.push(180);
          detectedLabels.push("3 horas antes");
        }
      }
      if (/(?:2|dos)\s*horas?\s*antes/i.test(remDetails)) {
        if (!detectedOffsets.includes(120)) {
          detectedOffsets.push(120);
          detectedLabels.push("2 horas antes");
        }
      }
      if (/(?:1|una|un)\s*horas?\s*antes/i.test(remDetails)) {
        if (!detectedOffsets.includes(60)) {
          detectedOffsets.push(60);
          detectedLabels.push("1 hora antes");
        }
      }
      const minMatches = remDetails.matchAll(/(\d+)\s*(?:minutos?|min)\s*antes/gi);
      for (const m of minMatches) {
        const mins = parseInt(m[1], 10);
        if (!isNaN(mins) && !detectedOffsets.includes(mins)) {
          detectedOffsets.push(mins);
          detectedLabels.push(`${mins} min antes`);
        }
      }
      if (/(?:a\s+la\s+hora(?:\s+exacta)?)/i.test(remDetails)) {
        if (!detectedOffsets.includes(0)) {
          detectedOffsets.push(0);
          detectedLabels.push("a la hora exacta");
        }
      }

      if (detectedOffsets.length > 0) {
        reminderEnabled = true;
        reminderOffsetsMinutes = detectedOffsets;
        reminderOffsetMinutes = detectedOffsets[0];
        tokens.push({
          text: fullRemMatch,
          type: "KEYWORD",
          label: `Aviso: ${detectedLabels.join(", ")}`,
        });
      }
    }

    const matchIdx = remMatch.index ?? 0;
    const matchLen = remMatch[0].length;
    workingText = (
      workingText.substring(0, matchIdx) +
      " " +
      workingText.substring(matchIdx + matchLen)
    ).trim();
  }

  const isAlertCategory =
    matchedCategory &&
    (matchedCategory.name_normalized === "alerta" ||
      matchedCategory.voice_command_normalized === "alerta" ||
      matchedCategory.id === "c3d4e5f6-a7b8-4901-c2d3-e4f5a6b7c8d9");

  if (isAlertCategory) {
    if (reminderEnabled === undefined) {
      reminderEnabled = true;
      reminderOffsetMinutes = 0;
      reminderOffsetsMinutes = [0];
      tokens.push({
        text: "alerta",
        type: "KEYWORD",
        label: "Aviso: a la hora establecida (automático)",
      });
    }
  } else if (occurredAt) {
    if (reminderEnabled === undefined) {
      reminderEnabled = true;
      reminderOffsetMinutes = 1440;
      reminderOffsetsMinutes = [1440];
      tokens.push({
        text: "aviso automático",
        type: "KEYWORD",
        label: "Aviso: 1 día antes (automático)",
      });
    }
  }

  // 6. Content extraction
  const contentKeywordMatch = workingText.match(
    /^(?:contenido|que dice|dice)\s+/i,
  );
  if (contentKeywordMatch) {
    tokens.push({
      text: contentKeywordMatch[0].trim(),
      type: "KEYWORD",
      label: "Comando Contenido",
    });
    workingText = workingText.replace(contentKeywordMatch[0], "").trim();
  }

  let content = workingText
    .replace(
      /^(?:(?:para|con|a|en|de)[,.:;\s]*(?:la|el)?[,.:;\s]*(?:fecha|día|dia)[,.:;\s]*(?:de)?(?:[.,:\s]*hoy)?|para|fecha|etiquetas?|tags?|[a-z0-9_]*\s*de\s+la\s+(?:noche|tarde|mañana|manana)|de\s+la\s+(?:noche|tarde|mañana|manana))[,.:;\s]*/i,
      "",
    )
    .replace(/^[,.:;\-\s?¿!¡]+|[,.:;\-\s?¿!¡]+$/g, "")
    .trim();

  if (content) {
    tokens.push({
      text: content,
      type: "CONTENT",
      label: "Contenido Entrada",
    });
  } else {
    errors.push("No se pudo extraer el contenido de la transcripción.");
  }

  return {
    categoryId,
    categoryName,
    occurredAt,
    title,
    content,
    tagIds,
    tagNames,
    taskPriority,
    reminderEnabled,
    reminderOffsetMinutes,
    reminderOffsetsMinutes,
    errors,
    isSuccess: errors.length === 0 && categoryId !== null && content.length > 0,
    tokens,
  };
}
