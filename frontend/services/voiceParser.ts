import {
  Category,
  normalizeTagName,
  normalizeTextKey,
  Tag,
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
  content: string;
  tagIds: string[];
  tagNames: string[];
  errors: string[];
  isSuccess: boolean;
  tokens?: RecognizedToken[];
}

export function parseSpokenCommand(
  transcript: string,
  categories: Category[],
  tags: Tag[],
  refDate: Date = new Date(),
): ParsedSpokenCommand {
  const errors: string[] = [];
  const tokens: RecognizedToken[] = [];
  const rawText = transcript.trim();

  if (!rawText) {
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

  let workingText = rawText;
  let categoryId: string | null = null;
  let categoryName: string | null = null;
  let occurredAt: string | null = null;
  const tagIds: string[] = [];
  const tagNames: string[] = [];

  // 1. Category extraction
  let matchedCategory: Category | null = null;

  // Clean initial leading punctuation for raw comparison
  const cleanRawText = rawText.replace(/^[,.:;\-\s]+/, "");
  const normalizedRaw = normalizeTextKey(cleanRawText);

  // Check explicit prefix "categoría " or "categoria "
  const categoryPrefixMatch = cleanRawText.match(
    /^(?:categoría|categoria)\s+([a-záéíóúñ0-9_\-\s]+?)(?:\s+(?:fecha|contenido|etiqueta|etiquetas|tag|tags|hoy|mañana|ayer)|[.,;:!?\s]|$)/i,
  );
  if (categoryPrefixMatch && categoryPrefixMatch[1]) {
    const catSearch = normalizeTextKey(categoryPrefixMatch[1]);
    matchedCategory =
      categories.find(
        (c) =>
          normalizeTextKey(c.voice_command) === catSearch ||
          normalizeTextKey(c.name) === catSearch,
      ) ?? null;
    if (matchedCategory) {
      tokens.push({
        text: categoryPrefixMatch[0].trim(),
        type: "CATEGORY",
        label: `Categoría: ${matchedCategory.name}`,
      });
      workingText = rawText.replace(categoryPrefixMatch[0], "").trim();
    }
  }

  // If not matched by prefix, try matching category voice_command or name at beginning of cleanRawText
  if (!matchedCategory) {
    for (const cat of categories) {
      const vcNorm = normalizeTextKey(cat.voice_command);
      const nameNorm = normalizeTextKey(cat.name);

      if (
        normalizedRaw.startsWith(vcNorm) ||
        normalizedRaw.startsWith(nameNorm)
      ) {
        matchedCategory = cat;
        const matchLen = normalizedRaw.startsWith(vcNorm)
          ? vcNorm.length
          : nameNorm.length;
        const matchedStr = cleanRawText.substring(0, matchLen);
        tokens.push({
          text: matchedStr,
          type: "CATEGORY",
          label: `Categoría: ${cat.name}`,
        });

        // Strip matched category plus any immediately following punctuation (like commas or dots)
        const restOfText = cleanRawText.substring(matchLen);
        workingText = restOfText.replace(/^[,.:;\-\s]+/, "").trim();
        break;
      }
    }
  }

  if (matchedCategory) {
    categoryId = matchedCategory.id;
    categoryName = matchedCategory.name;
  } else {
    const firstWord = rawText.split(/[\s,.:;]+/)[0];
    errors.push(`Categoría no reconocida: "${firstWord}"`);
  }

  // 2. Tag extraction
  const tagRegex = /(?:\s|^|[,.:;])(?:con\s+)?(?:etiquetas?|tags?)\s+(.+)$/i;
  const tagMatch = workingText.match(tagRegex);
  if (tagMatch && tagMatch[1]) {
    const tagText = tagMatch[1].trim();
    workingText = workingText.replace(tagRegex, "").trim();

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

  // 3. Date & Time extraction (handles "fecha, hoy a las 1600", "pasado mañana a las 4 de la tarde", "mañana a las 9 y media", "para 2026-10-15")
  let targetDate: Date | null = null;
  let labelDate = "";
  let matchedDateText = "";

  const explicitDateMatch =
    workingText.match(
      /(?:\s|^|[,.:;])(?:fecha|para|día|dia)[,.:;]?\s*(pasado\s+mañana|pasado\s+manana|hoy|mañana|manana|ayer|este\s+[a-záéíóúñ]+|el\s+próximo\s+[a-záéíóúñ]+|el\s+proximo\s+[a-záéíóúñ]+|\d{4}-\d{2}-\d{2})(?:[.,;:!?\s]|$)/i,
    ) ??
    workingText.match(
      /^(?:[,.:;\s]*)(pasado\s+mañana|pasado\s+manana|hoy|mañana|manana|ayer|\d{4}-\d{2}-\d{2})(?:[.,;:!?\s]|$)/i,
    );

  if (explicitDateMatch && explicitDateMatch[1]) {
    matchedDateText = explicitDateMatch[0];
    const dateStr = explicitDateMatch[1].toLowerCase().trim();
    const baseDate = new Date(refDate);

    if (dateStr === "hoy") {
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

    // Strip date pattern from workingText
    workingText = workingText.replace(matchedDateText, " ").trim();
  }

  // Time extraction ("a las 1600", "a las 16:00", "a las 4 de la tarde", "a las 9 y media")
  const timeMatch = workingText.match(
    /(?:\s|^|[,.:;])(?:a\s+las?|a\s+la)\s+(\d{1,2}:\d{2}|\d{4}|\d{1,2})(?:\s+y\s+(media|cuarto|\d{1,2}))?(?:\s*(de\s+la\s+(?:tarde|noche|mañana|manana)|am|pm|hs|horas))?(?:[.,;:!?\s]|$)/i,
  );

  let labelTime = "";
  if (timeMatch && timeMatch[1]) {
    const matchedTimeText = timeMatch[0];
    const rawNum = timeMatch[1];
    const modifier = timeMatch[2] ? timeMatch[2].toLowerCase() : null;
    const ampm = timeMatch[3] ? timeMatch[3].toLowerCase() : null;

    let hours = 0;
    let minutes = 0;

    if (rawNum.includes(":")) {
      const parts = rawNum.split(":");
      hours = parseInt(parts[0], 10);
      minutes = parseInt(parts[1], 10);
    } else if (rawNum.length === 4) {
      hours = parseInt(rawNum.substring(0, 2), 10);
      minutes = parseInt(rawNum.substring(2, 4), 10);
    } else {
      hours = parseInt(rawNum, 10);
      if (modifier === "media") {
        minutes = 30;
      } else if (modifier === "cuarto") {
        minutes = 15;
      } else if (modifier && !isNaN(parseInt(modifier, 10))) {
        minutes = parseInt(modifier, 10);
      }
    }

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
    }

    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      if (!targetDate) {
        targetDate = new Date(refDate);
        labelDate = "Hoy";
      }
      targetDate.setHours(hours, minutes, 0, 0);
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      labelTime = ` a las ${pad(hours)}:${pad(minutes)}`;
      workingText = workingText.replace(matchedTimeText, " ").trim();
    }
  }

  if (targetDate) {
    occurredAt = targetDate.toISOString();
    tokens.push({
      text: `${matchedDateText} ${labelTime}`.trim(),
      type: "DATE",
      label: `Fecha: ${labelDate}${labelTime}`,
    });
  }

  // 4. Content extraction
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

  let content = workingText.replace(/^[,.:;\-\s]+|[,.:;\-\s]+$/g, "").trim();

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
    content,
    tagIds,
    tagNames,
    errors,
    isSuccess: errors.length === 0 && categoryId !== null && content.length > 0,
    tokens,
  };
}
