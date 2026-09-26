import { Category, Tag } from "../types/domain";
import { parseSpokenCommand } from "./voiceParser";

describe("Spoken Command Parser (voiceParser)", () => {
  const sampleCategories: Category[] = [
    {
      id: "cat-1",
      user_id: "user-1",
      kind: "STANDARD",
      name: "Notas",
      name_normalized: "notas",
      voice_command: "nota",
      voice_command_normalized: "nota",
      description: "",
      color: "#38BDF8",
      icon: "folder",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      version: 1,
      sync_status: "SYNCED",
    },
    {
      id: "cat-2",
      user_id: "user-1",
      kind: "TASK",
      name: "Tareas",
      name_normalized: "tareas",
      voice_command: "tarea",
      voice_command_normalized: "tarea",
      description: "",
      color: "#818CF8",
      icon: "check",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      version: 1,
      sync_status: "SYNCED",
    },
  ];

  const sampleTags: Tag[] = [
    {
      id: "tag-1",
      user_id: "user-1",
      name: "Urgente",
      name_normalized: "urgente",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      version: 1,
      sync_status: "SYNCED",
    },
    {
      id: "tag-2",
      user_id: "user-1",
      name: "Salud",
      name_normalized: "salud",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      version: 1,
      sync_status: "SYNCED",
    },
  ];

  const refDate = new Date("2026-09-26T12:00:00.000Z");

  it("parses structured input with category, date, content and tags", () => {
    const transcript =
      "nota fecha hoy contenido comprar leche en el supermercado etiquetas urgente y salud";
    const result = parseSpokenCommand(
      transcript,
      sampleCategories,
      sampleTags,
      refDate,
    );

    expect(result.isSuccess).toBe(true);
    expect(result.categoryId).toBe("cat-1");
    expect(result.categoryName).toBe("Notas");
    expect(result.occurredAt).toBe(refDate.toISOString());
    expect(result.content).toBe("comprar leche en el supermercado");
    expect(result.tagIds).toEqual(["tag-1", "tag-2"]);
    expect(result.tagNames).toEqual(["Urgente", "Salud"]);
  });

  it("handles optional date and optional tags correctly", () => {
    const transcript = "tarea llamar al doctor por la mañana";
    const result = parseSpokenCommand(
      transcript,
      sampleCategories,
      sampleTags,
      refDate,
    );

    expect(result.isSuccess).toBe(true);
    expect(result.categoryId).toBe("cat-2");
    expect(result.occurredAt).toBeNull();
    expect(result.content).toBe("llamar al doctor por la mañana");
    expect(result.tagIds).toEqual([]);
  });

  it("parses relative date 'mañana'", () => {
    const transcript = "tarea fecha mañana entregar informe laboral";
    const result = parseSpokenCommand(
      transcript,
      sampleCategories,
      sampleTags,
      refDate,
    );

    const expectedDate = new Date("2026-09-27T12:00:00.000Z").toISOString();
    expect(result.isSuccess).toBe(true);
    expect(result.occurredAt).toBe(expectedDate);
    expect(result.content).toBe("entregar informe laboral");
  });

  it("parses relative date 'ayer'", () => {
    const transcript = "nota fecha ayer rellenar formulario de gastos";
    const result = parseSpokenCommand(
      transcript,
      sampleCategories,
      sampleTags,
      refDate,
    );

    const expectedDate = new Date("2026-09-25T12:00:00.000Z").toISOString();
    expect(result.isSuccess).toBe(true);
    expect(result.occurredAt).toBe(expectedDate);
  });

  it("parses ISO format date '2026-10-15'", () => {
    const transcript = "nota fecha 2026-10-15 cita médica de revisión";
    const result = parseSpokenCommand(
      transcript,
      sampleCategories,
      sampleTags,
      refDate,
    );

    expect(result.isSuccess).toBe(true);
    expect(result.occurredAt).toBe("2026-10-15T00:00:00.000Z");
    expect(result.content).toBe("cita médica de revisión");
  });

  it("returns recoverable error for unknown category", () => {
    const transcript = "recordatorio fecha hoy hacer ejercicios";
    const result = parseSpokenCommand(
      transcript,
      sampleCategories,
      sampleTags,
      refDate,
    );

    expect(result.isSuccess).toBe(false);
    expect(result.categoryId).toBeNull();
    expect(result.errors).toContain('Categoría no reconocida: "recordatorio"');
  });

  it("returns error for empty transcript or missing content", () => {
    const resultEmpty = parseSpokenCommand(
      "",
      sampleCategories,
      sampleTags,
      refDate,
    );
    expect(resultEmpty.isSuccess).toBe(false);
    expect(resultEmpty.errors).toContain("La transcripción está vacía.");

    const resultNoContent = parseSpokenCommand(
      "nota fecha hoy",
      sampleCategories,
      sampleTags,
      refDate,
    );
    expect(resultNoContent.isSuccess).toBe(false);
    expect(resultNoContent.errors).toContain(
      "No se pudo extraer el contenido de la transcripción.",
    );
  });
});
