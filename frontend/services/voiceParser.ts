import {
  Category,
  normalizeTagName,
  normalizeTextKey,
  Tag,
} from "../types/domain";

export interface ParsedSpokenCommand {
  categoryId: string | null;
  categoryName: string | null;
  occurredAt: string | null;
  content: string;
  tagIds: string[];
  tagNames: string[];
  errors: string[];
  isSuccess: boolean;
}

export function parseSpokenCommand(
  transcript: string,
  categories: Category[],
  tags: Tag[],
  refDate: Date = new Date(),
): ParsedSpokenCommand {
  const errors: string[] = [];
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
    };
  }

  let workingText = rawText;
  let categoryId: string | null = null;
  let categoryName: string | null = null;
  let occurredAt: string | null = null;
  const tagIds: string[] = [];
  const tagNames: string[] = [];

  // 1. Category extraction
  // Check for explicit "categoría <name>" or match voice_command / name at the start of transcript
  let matchedCategory: Category | null = null;

  const normalizedRaw = normalizeTextKey(rawText);

  // Check explicit prefix "categoría " or "categoria "
  const categoryPrefixMatch = rawText.match(
    /^(?:categoría|categoria)\s+([a-záéíóúñ0-9_\-\s]+?)(?:\s+(?:fecha|contenido|etiqueta|etiquetas|tag|tags|hoy|mañana|ayer)|$)/i,
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
      workingText = workingText.replace(categoryPrefixMatch[0], "").trim();
    }
  }

  // If not matched by prefix, try matching category voice_command or name at beginning of rawText
  if (!matchedCategory) {
    for (const cat of categories) {
      const vcNorm = normalizeTextKey(cat.voice_command);
      const nameNorm = normalizeTextKey(cat.name);

      if (
        normalizedRaw.startsWith(vcNorm) ||
        normalizedRaw.startsWith(nameNorm)
      ) {
        matchedCategory = cat;
        // Remove matched category from start
        const matchLen = normalizedRaw.startsWith(vcNorm)
          ? vcNorm.length
          : nameNorm.length;
        workingText = workingText.substring(matchLen).trim();
        break;
      }
    }
  }

  if (matchedCategory) {
    categoryId = matchedCategory.id;
    categoryName = matchedCategory.name;
  } else {
    // Look at first word for unknown category error
    const firstWord = rawText.split(/\s+/)[0];
    errors.push(`Categoría no reconocida: "${firstWord}"`);
  }

  // 2. Tag extraction (check for "etiquetas ...", "etiqueta ...", "tags ...", "tag ...", "con etiquetas ...")
  const tagRegex = /(?:\s|^)(?:con\s+)?(?:etiquetas?|tags?)\s+(.+)$/i;
  const tagMatch = workingText.match(tagRegex);
  if (tagMatch && tagMatch[1]) {
    const tagText = tagMatch[1].trim();
    workingText = workingText.replace(tagRegex, "").trim();

    // Split tagText by commas or " y " or spaces
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
  }

  // 3. Date extraction (check for "fecha <date>", "para <date>", or explicit YYYY-MM-DD date format)
  // Match only if preceded by fecha/para OR if date is explicit YYYY-MM-DD OR at start of workingText right after category
  const explicitDateMatch =
    workingText.match(
      /(?:\s|^)(?:fecha\s+|para\s+)(hoy|mañana|manana|ayer|\d{4}-\d{2}-\d{2})(?:\s+|$)/i,
    ) ?? workingText.match(/(?:\s|^)(\d{4}-\d{2}-\d{2})(?:\s+|$)/i);

  if (explicitDateMatch && explicitDateMatch[1]) {
    const dateStr = explicitDateMatch[1].toLowerCase();
    workingText = workingText.replace(explicitDateMatch[0], " ").trim();

    const baseDate = new Date(refDate);
    if (dateStr === "hoy") {
      occurredAt = baseDate.toISOString();
    } else if (dateStr === "mañana" || dateStr === "manana") {
      baseDate.setDate(baseDate.getDate() + 1);
      occurredAt = baseDate.toISOString();
    } else if (dateStr === "ayer") {
      baseDate.setDate(baseDate.getDate() - 1);
      occurredAt = baseDate.toISOString();
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const parsed = new Date(`${dateStr}T00:00:00Z`);
      if (!isNaN(parsed.getTime())) {
        occurredAt = parsed.toISOString();
      }
    }
  }

  // 4. Content extraction
  // Clean prefix "contenido " if present
  let content = workingText
    .replace(/^(?:contenido|que dice|dice)\s+/i, "")
    .trim();
  // Remove leading/trailing punctuation or extra delimiters
  content = content.replace(/^[,.:;\-\s]+|[,.:;\-\s]+$/g, "").trim();

  if (!content) {
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
  };
}
