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

  // 3. Date extraction (handles "fecha, hoy.", "fecha: hoy", "para hoy", or standalone "hoy.", "mañana.", "ayer." at start)
  const explicitDateMatch =
    workingText.match(
      /(?:\s|^|[,.:;])(?:fecha|para|día|dia)[,.:;]?\s*(hoy|mañana|manana|ayer|\d{4}-\d{2}-\d{2})(?:[.,;:!?\s]|$)/i,
    ) ??
    workingText.match(
      /^(?:[,.:;\s]*)(hoy|mañana|manana|ayer|\d{4}-\d{2}-\d{2})(?:[.,;:!?\s]|$)/i,
    );

  if (explicitDateMatch && explicitDateMatch[1]) {
    const dateStr = explicitDateMatch[1].toLowerCase();

    // Replace the matched date pattern (leaving subsequent sentence intact)
    workingText = workingText.replace(explicitDateMatch[0], " ").trim();

    const baseDate = new Date(refDate);
    let labelDate = dateStr;
    if (dateStr === "hoy") {
      occurredAt = baseDate.toISOString();
      labelDate = "Hoy";
    } else if (dateStr === "mañana" || dateStr === "manana") {
      baseDate.setDate(baseDate.getDate() + 1);
      occurredAt = baseDate.toISOString();
      labelDate = "Mañana";
    } else if (dateStr === "ayer") {
      baseDate.setDate(baseDate.getDate() - 1);
      occurredAt = baseDate.toISOString();
      labelDate = "Ayer";
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const parsed = new Date(`${dateStr}T00:00:00Z`);
      if (!isNaN(parsed.getTime())) {
        occurredAt = parsed.toISOString();
      }
    }

    tokens.push({
      text: explicitDateMatch[0].trim(),
      type: "DATE",
      label: `Fecha: ${labelDate}`,
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
