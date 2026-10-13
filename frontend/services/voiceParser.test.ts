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

  it("ignores filler words before the first valid category command", () => {
    const transcript =
      "hola eh mmm bueno nota fecha hoy contenido comprar leche etiquetas urgente";
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
    expect(result.content).toBe("comprar leche");
    expect(result.tagNames).toEqual(["Urgente"]);
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
  });

  it("parses spoken time 'a las 1600' and removes it from content", () => {
    const transcript = "tarea fecha, hoy a las 1600.Voy a llamar a María";
    const result = parseSpokenCommand(
      transcript,
      sampleCategories,
      sampleTags,
      refDate,
    );

    expect(result.isSuccess).toBe(true);
    expect(result.categoryId).toBe("cat-2");
    expect(result.content).toBe("Voy a llamar a María");
    expect(result.occurredAt).toBeDefined();
    const d = new Date(result.occurredAt!);
    expect(d.getHours()).toBe(16);
    expect(d.getMinutes()).toBe(0);
  });

  it("parses relative date 'pasado mañana' and time 'a las 4 de la tarde'", () => {
    const transcript =
      "nota fecha pasado mañana a las 4 de la tarde reunión de equipo";
    const result = parseSpokenCommand(
      transcript,
      sampleCategories,
      sampleTags,
      refDate,
    );

    expect(result.isSuccess).toBe(true);
    expect(result.categoryId).toBe("cat-1");
    expect(result.content).toBe("reunión de equipo");
    expect(result.occurredAt).toBeDefined();
    const d = new Date(result.occurredAt!);
    expect(d.getHours()).toBe(16);
    expect(d.getMinutes()).toBe(0);
  });

  it("parses spoken hour words 'a las cuatro' defaulting to PM (16:00)", () => {
    const transcript = "nota fecha hoy a las cuatro comprar leche";
    const result = parseSpokenCommand(
      transcript,
      sampleCategories,
      sampleTags,
      refDate,
    );

    expect(result.isSuccess).toBe(true);
    expect(result.content).toBe("comprar leche");
    expect(result.occurredAt).toBeDefined();
    const d = new Date(result.occurredAt!);
    expect(d.getHours()).toBe(16);
    expect(d.getMinutes()).toBe(0);
  });

  it("defaults unspecified hours 1-11 to PM (e.g. 5 -> 17:00) unless 'de la mañana' is specified", () => {
    const resPm = parseSpokenCommand(
      "nota fecha hoy a las cinco hacer ejercicio",
      sampleCategories,
      sampleTags,
      refDate,
    );
    expect(resPm.isSuccess).toBe(true);
    expect(new Date(resPm.occurredAt!).getHours()).toBe(17);

    const resAm = parseSpokenCommand(
      "nota fecha hoy a las 5 de la mañana ir a correr",
      sampleCategories,
      sampleTags,
      refDate,
    );
    expect(resAm.isSuccess).toBe(true);
    expect(new Date(resAm.occurredAt!).getHours()).toBe(5);
  });

  it("normalizes missing spaces after dots and separates tags from content and date", () => {
    const transcript =
      "Nota etiqueta urgente.He ido a.Romper cosas. fecha, mañana a las cuatro";
    const result = parseSpokenCommand(
      transcript,
      sampleCategories,
      sampleTags,
      refDate,
    );

    expect(result.isSuccess).toBe(true);
    expect(result.categoryId).toBe("cat-1");
    expect(result.tagNames).toEqual(["Urgente"]);
    expect(result.content).toBe("He ido a. Romper cosas");
    expect(result.occurredAt).toBeDefined();
    const d = new Date(result.occurredAt!);
    expect(d.getHours()).toBe(16);
  });

  it("parses Spanish spoken date 'Fecha. 5 del 10 de 2026.' correctly", () => {
    const transcript =
      "Tarea Fecha. 5 del 10 de 2026. Tengo que renovar el. El paro en la aplicación del serv para que no me lo quiten";
    const result = parseSpokenCommand(
      transcript,
      sampleCategories,
      sampleTags,
      refDate,
    );

    expect(result.isSuccess).toBe(true);
    expect(result.categoryId).toBe("cat-2");
    expect(result.occurredAt).toBeDefined();
    const d = new Date(result.occurredAt!);
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(9); // October (0-indexed 9 = 10)
    expect(d.getUTCDate()).toBe(5);
    expect(result.content).toBe(
      "Tengo que renovar el. El paro en la aplicación del serv para que no me lo quiten",
    );
  });

  it("parses Spanish date spoken BEFORE category command", () => {
    const transcript =
      "Fecha 5 de octubre de 2026 Tarea renovar el paro en la aplicación del serv";
    const result = parseSpokenCommand(
      transcript,
      sampleCategories,
      sampleTags,
      refDate,
    );

    expect(result.isSuccess).toBe(true);
    expect(result.categoryId).toBe("cat-2");
    expect(result.occurredAt).toBeDefined();
    const d = new Date(result.occurredAt!);
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(9);
    expect(d.getUTCDate()).toBe(5);
    expect(result.content).toBe("renovar el paro en la aplicación del serv");
  });

  it("strips trigger prefix 'Para. La fecha de' when spoken before Spanish date", () => {
    const transcript =
      "Hola, querría. A tarea. Para. La fecha de El dos del 10 de 2026. Tengo que gestionar. El tema de. El doctorado";
    const result = parseSpokenCommand(
      transcript,
      sampleCategories,
      sampleTags,
      refDate,
    );

    expect(result.isSuccess).toBe(true);
    expect(result.categoryId).toBe("cat-2");
    expect(result.occurredAt).toBeDefined();
    const d = new Date(result.occurredAt!);
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(9);
    expect(d.getUTCDate()).toBe(2);
    expect(result.content).toBe(
      "Tengo que gestionar. El tema de. El doctorado",
    );
  });

  it("strips trigger prefix 'a fecha de hoy' when spoken before time/date", () => {
    const transcript =
      "Nota. a fecha de hoy a las 22:00. Tengo que ir a voleibol y llevarme las rodilleras";
    const result = parseSpokenCommand(
      transcript,
      sampleCategories,
      sampleTags,
      refDate,
    );

    expect(result.isSuccess).toBe(true);
    expect(result.categoryId).toBe("cat-1");
    expect(result.occurredAt).toBeDefined();
    const d = new Date(result.occurredAt!);
    expect(d.getHours()).toBe(22);
    expect(result.content).toBe(
      "Tengo que ir a voleibol y llevarme las rodilleras",
    );
  });

  it("strips 'Sin fecha' prefix when a valid date command follows", () => {
    const transcript =
      "Tarea. Sin fecha. para el 6 del 10. Tengo que hacer una aplicación 2026";
    const result = parseSpokenCommand(
      transcript,
      sampleCategories,
      sampleTags,
      refDate,
    );

    expect(result.isSuccess).toBe(true);
    expect(result.categoryId).toBe("cat-2");
    expect(result.occurredAt).toBeDefined();
    const d = new Date(result.occurredAt!);
    expect(d.getUTCMonth()).toBe(9);
    expect(d.getUTCDate()).toBe(6);
    expect(result.content).toBe("Tengo que hacer una aplicación 2026");
  });

  it("suppresses question marks and handles date parsing cleanly when transcript contains intonation question marks", () => {
    const recuerdoCat: Category = {
      id: "cat-recuerdo",
      user_id: "user-1",
      kind: "STANDARD",
      name: "Recuerdo",
      name_normalized: "recuerdo",
      voice_command: "recuerdo",
      voice_command_normalized: "recuerdo",
      description: "",
      color: "#F59E0B",
      icon: "bookmark",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      version: 1,
      sync_status: "SYNCED",
    };

    const transcript =
      "recuerdo ?Para la fecha de hoy. Diciendo un día muy bonito con Carmen";
    const result = parseSpokenCommand(
      transcript,
      [...sampleCategories, recuerdoCat],
      sampleTags,
      refDate,
    );

    expect(result.isSuccess).toBe(true);
    expect(result.categoryId).toBe("cat-recuerdo");
    expect(result.categoryName).toBe("Recuerdo");
    expect(result.occurredAt).toBe(refDate.toISOString());
    expect(result.content).toBe("Diciendo un día muy bonito con Carmen");
  });

  describe("Task Priority Spoken Commands (exclusive to TASK categories)", () => {
    it("extracts 'prioridad alta' for TASK category and strips the command cleanly", () => {
      const transcript = "tarea prioridad alta enviar informe financiero";
      const result = parseSpokenCommand(transcript, sampleCategories, sampleTags, refDate);

      expect(result.isSuccess).toBe(true);
      expect(result.categoryId).toBe("cat-2");
      expect(result.taskPriority).toBe("HIGH");
      expect(result.content).toBe("enviar informe financiero");
      expect(result.tokens?.some((t) => t.label === "Prioridad: Alta")).toBe(true);
    });

    it("extracts 'prioridad urgente' as HIGH priority for TASK category", () => {
      const transcript = "tarea prioridad urgente reparar fuga de agua";
      const result = parseSpokenCommand(transcript, sampleCategories, sampleTags, refDate);

      expect(result.isSuccess).toBe(true);
      expect(result.categoryId).toBe("cat-2");
      expect(result.taskPriority).toBe("HIGH");
      expect(result.content).toBe("reparar fuga de agua");
    });

    it("extracts 'prioridad baja' for TASK category", () => {
      const transcript = "tarea prioridad baja ordenar estantería";
      const result = parseSpokenCommand(transcript, sampleCategories, sampleTags, refDate);

      expect(result.isSuccess).toBe(true);
      expect(result.categoryId).toBe("cat-2");
      expect(result.taskPriority).toBe("LOW");
      expect(result.content).toBe("ordenar estantería");
    });

    it("extracts 'con prioridad media' for TASK category", () => {
      const transcript = "tarea con prioridad media llamar al proveedor";
      const result = parseSpokenCommand(transcript, sampleCategories, sampleTags, refDate);

      expect(result.isSuccess).toBe(true);
      expect(result.categoryId).toBe("cat-2");
      expect(result.taskPriority).toBe("MEDIUM");
      expect(result.content).toBe("llamar al proveedor");
    });

    it("defaults task priority to MEDIUM when not specified for TASK category", () => {
      const transcript = "tarea revisar código de sincronización";
      const result = parseSpokenCommand(transcript, sampleCategories, sampleTags, refDate);

      expect(result.isSuccess).toBe(true);
      expect(result.categoryId).toBe("cat-2");
      expect(result.taskPriority).toBe("MEDIUM");
      expect(result.content).toBe("revisar código de sincronización");
    });

    it("does NOT recognize 'prioridad' command when category is not TASK (e.g. Notas)", () => {
      const transcript = "nota prioridad alta sobre la arquitectura del sistema";
      const result = parseSpokenCommand(transcript, sampleCategories, sampleTags, refDate);

      expect(result.isSuccess).toBe(true);
      expect(result.categoryId).toBe("cat-1"); // Notas (STANDARD)
      expect(result.taskPriority).toBeNull();
      // 'prioridad alta' remains part of the content because the command is exclusive to tasks
      expect(result.content).toContain("prioridad alta");
      expect(result.tokens?.some((t) => t.label.startsWith("Prioridad:"))).toBe(false);
    });
  });

  describe("Relative Next-Week Date Parsing ('lunes de la semana que viene', 'semana siguiente', etc.)", () => {
    // 2026-10-13 is a Tuesday
    const tuesdayRef = new Date("2026-10-13T10:00:00.000Z");
    // 2026-10-12 is a Monday
    const mondayRef = new Date("2026-10-12T10:00:00.000Z");
    // 2026-10-18 is a Sunday
    const sundayRef = new Date("2026-10-18T10:00:00.000Z");

    it("parses 'lunes de la semana que viene' from a Tuesday reference date", () => {
      const transcript =
        "tarea fecha lunes de la semana que viene comprar entradas para el teatro";
      const result = parseSpokenCommand(
        transcript,
        sampleCategories,
        sampleTags,
        tuesdayRef,
      );

      expect(result.isSuccess).toBe(true);
      expect(result.categoryId).toBe("cat-2");
      expect(result.occurredAt).toBeDefined();

      const d = new Date(result.occurredAt!);
      expect(d.getUTCFullYear()).toBe(2026);
      expect(d.getUTCMonth()).toBe(9); // October
      expect(d.getUTCDate()).toBe(19); // Monday next week
      expect(result.content).toBe("comprar entradas para el teatro");
      expect(result.tokens?.some((t) => t.label.includes("Lunes de la próxima semana"))).toBe(true);
    });

    it("parses 'para el lunes de la semana que viene' from a Monday reference date (+7 days)", () => {
      const transcript =
        "tarea para el lunes de la semana que viene pagar cuota del gimnasio";
      const result = parseSpokenCommand(
        transcript,
        sampleCategories,
        sampleTags,
        mondayRef,
      );

      expect(result.isSuccess).toBe(true);
      const d = new Date(result.occurredAt!);
      expect(d.getUTCDate()).toBe(19);
      expect(result.content).toBe("pagar cuota del gimnasio");
    });

    it("parses 'el lunes de la semana que viene' from a Sunday reference date (the next day)", () => {
      const transcript =
        "tarea el lunes de la semana que viene llamar a la clínica";
      const result = parseSpokenCommand(
        transcript,
        sampleCategories,
        sampleTags,
        sundayRef,
      );

      expect(result.isSuccess).toBe(true);
      const d = new Date(result.occurredAt!);
      expect(d.getUTCDate()).toBe(19);
      expect(result.content).toBe("llamar a la clínica");
    });

    it("parses 'martes de la próxima semana' accurately", () => {
      const transcript =
        "tarea para el martes de la próxima semana entregar documentación";
      const result = parseSpokenCommand(
        transcript,
        sampleCategories,
        sampleTags,
        tuesdayRef,
      );

      expect(result.isSuccess).toBe(true);
      const d = new Date(result.occurredAt!);
      expect(d.getUTCDate()).toBe(20);
      expect(result.content).toBe("entregar documentación");
    });

    it("parses 'viernes de la semana siguiente' accurately", () => {
      const transcript =
        "tarea fecha viernes de la semana siguiente cena con amigos";
      const result = parseSpokenCommand(
        transcript,
        sampleCategories,
        sampleTags,
        tuesdayRef,
      );

      expect(result.isSuccess).toBe(true);
      const d = new Date(result.occurredAt!);
      expect(d.getUTCDate()).toBe(23);
      expect(result.content).toBe("cena con amigos");
    });

    it("parses 'el lunes que viene' as next Monday", () => {
      const transcript =
        "tarea el lunes que viene reunión con el equipo de producto";
      const result = parseSpokenCommand(
        transcript,
        sampleCategories,
        sampleTags,
        tuesdayRef,
      );

      expect(result.isSuccess).toBe(true);
      const d = new Date(result.occurredAt!);
      expect(d.getUTCDate()).toBe(19);
      expect(result.content).toBe("reunión con el equipo de producto");
    });

    it("parses standalone 'semana siguiente' defaulting to Monday of next week", () => {
      const transcript = "tarea semana siguiente revisar inventario del almacén";
      const result = parseSpokenCommand(
        transcript,
        sampleCategories,
        sampleTags,
        tuesdayRef,
      );

      expect(result.isSuccess).toBe(true);
      const d = new Date(result.occurredAt!);
      expect(d.getUTCDate()).toBe(19);
      expect(result.content).toBe("revisar inventario del almacén");
      expect(result.tokens?.some((t) => t.label === "Fecha: Próxima semana")).toBe(true);
    });

    it("parses standalone 'la semana que viene' defaulting to Monday of next week", () => {
      const transcript = "tarea la semana que viene planificar nuevo sprint";
      const result = parseSpokenCommand(
        transcript,
        sampleCategories,
        sampleTags,
        tuesdayRef,
      );

      expect(result.isSuccess).toBe(true);
      const d = new Date(result.occurredAt!);
      expect(d.getUTCDate()).toBe(19);
      expect(result.content).toBe("planificar nuevo sprint");
    });

    it("parses standalone 'para la próxima semana'", () => {
      const transcript = "tarea para la próxima semana enviar presupuesto al cliente";
      const result = parseSpokenCommand(
        transcript,
        sampleCategories,
        sampleTags,
        tuesdayRef,
      );

      expect(result.isSuccess).toBe(true);
      const d = new Date(result.occurredAt!);
      expect(d.getUTCDate()).toBe(19);
      expect(result.content).toBe("enviar presupuesto al cliente");
    });

    it("combines next-week date with explicit time correctly", () => {
      const transcript =
        "tarea para el lunes de la semana que viene a las 17:00 cita con el dentista";
      const result = parseSpokenCommand(
        transcript,
        sampleCategories,
        sampleTags,
        tuesdayRef,
      );

      expect(result.isSuccess).toBe(true);
      const d = new Date(result.occurredAt!);
      expect(d.getUTCDate()).toBe(19);
      expect(d.getHours()).toBe(17);
      expect(d.getMinutes()).toBe(0);
      expect(result.content).toBe("cita con el dentista");
    });

    it("parses next-week date when spoken BEFORE the category command", () => {
      const transcript =
        "El lunes de la semana que viene tarea pagar impuesto de circulación";
      const result = parseSpokenCommand(
        transcript,
        sampleCategories,
        sampleTags,
        tuesdayRef,
      );

      expect(result.isSuccess).toBe(true);
      expect(result.categoryId).toBe("cat-2");
      const d = new Date(result.occurredAt!);
      expect(d.getUTCDate()).toBe(19);
      expect(result.content).toBe("pagar impuesto de circulación");
    });

    it("cleans trailing 'como fecha' phrase cleanly from content", () => {
      const transcript =
        "tarea lunes de la semana que viene como fecha renovar pasaporte";
      const result = parseSpokenCommand(
        transcript,
        sampleCategories,
        sampleTags,
        tuesdayRef,
      );

      expect(result.isSuccess).toBe(true);
      const d = new Date(result.occurredAt!);
      expect(d.getUTCDate()).toBe(19);
      expect(result.content).toBe("renovar pasaporte");
    });
  });
});
