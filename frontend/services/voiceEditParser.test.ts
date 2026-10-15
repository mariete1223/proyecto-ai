import { parseVoiceEditCommand } from "./voiceEditParser";
import { Entry } from "../types/domain";

describe("voiceEditParser (#68)", () => {
  const refDate = new Date(2026, 9, 20, 10, 0, 0); // 20 Oct 2026 10:00:00

  const baseEntry: Entry = {
    id: "entry-123",
    user_id: "user-1",
    category_id: "cat-1",
    title: "Título Anterior",
    content: "Contenido original de la nota",
    occurred_at: "2026-10-20T10:00:00.000Z",
    task_status: null,
    task_recurrence: null,
    capture_session_id: null,
    reminder_enabled: false,
    created_at: "2026-10-20T10:00:00.000Z",
    updated_at: "2026-10-20T10:00:00.000Z",
    version: 1,
    sync_status: "SYNCED",
    tag_ids: [],
  };

  it("extracts title update when saying 'poner título Comprar víveres'", () => {
    const res = parseVoiceEditCommand(
      "poner título Comprar víveres",
      baseEntry,
      refDate,
    );
    expect(res.hasChanges).toBe(true);
    expect(res.changes.title).toBe("Comprar víveres");
    expect(res.actions).toContain('Título: "Comprar víveres"');
  });

  it("extracts 24h time update when saying 'cambiar la hora a las 18:30'", () => {
    const res = parseVoiceEditCommand(
      "cambiar la hora a las 18:30",
      baseEntry,
      refDate,
    );
    expect(res.hasChanges).toBe(true);
    expect(res.changes.occurred_at).toBeDefined();
    const d = new Date(res.changes.occurred_at!);
    expect(d.getHours()).toBe(18);
    expect(d.getMinutes()).toBe(30);
    expect(res.actions).toContain("Hora: 18:30");
  });

  it("extracts 12h time with afternoon period when saying 'poner a las 5 de la tarde'", () => {
    const res = parseVoiceEditCommand(
      "poner a las 5 de la tarde",
      baseEntry,
      refDate,
    );
    expect(res.hasChanges).toBe(true);
    expect(res.changes.occurred_at).toBeDefined();
    const d = new Date(res.changes.occurred_at!);
    expect(d.getHours()).toBe(17);
    expect(d.getMinutes()).toBe(0);
    expect(res.actions).toContain("Hora: 17:00");
  });

  it("extracts reminder 15 minutes before when saying 'poner aviso 15 minutos antes'", () => {
    const res = parseVoiceEditCommand(
      "poner aviso 15 minutos antes",
      baseEntry,
      refDate,
    );
    expect(res.hasChanges).toBe(true);
    expect(res.changes.reminder_enabled).toBe(true);
    expect(res.changes.reminder_offset_minutes).toBe(15);
    expect(res.actions).toContain("Aviso: 15 min antes");
  });

  it("extracts reminder 1 hour before when saying 'activar aviso 1 hora antes'", () => {
    const res = parseVoiceEditCommand(
      "activar aviso 1 hora antes",
      baseEntry,
      refDate,
    );
    expect(res.hasChanges).toBe(true);
    expect(res.changes.reminder_enabled).toBe(true);
    expect(res.changes.reminder_offset_minutes).toBe(60);
    expect(res.actions).toContain("Aviso: 1 hora antes");
  });

  it("disables reminder when saying 'quitar aviso'", () => {
    const res = parseVoiceEditCommand(
      "por favor quitar aviso",
      baseEntry,
      refDate,
    );
    expect(res.hasChanges).toBe(true);
    expect(res.changes.reminder_enabled).toBe(false);
    expect(res.actions).toContain("Aviso desactivado");
  });

  it("configures periodic reminder when saying 'aviso cada 4 horas'", () => {
    const res = parseVoiceEditCommand(
      "poner aviso cada 4 horas",
      baseEntry,
      refDate,
    );
    expect(res.hasChanges).toBe(true);
    expect(res.changes.reminder_enabled).toBe(true);
    expect(res.changes.reminder_recurrence).toBe("EVERY_4_HOURS");
    expect(res.actions).toContain("Frecuencia: cada 4 horas");
  });

  it("handles multi-field command: title + hour + reminder", () => {
    const res = parseVoiceEditCommand(
      "poner título Reunión de Proyecto y cambiar la hora a las 16:45 y poner aviso 15 minutos antes",
      baseEntry,
      refDate,
    );
    expect(res.hasChanges).toBe(true);
    expect(res.changes.title).toBe("Reunión de Proyecto");
    const d = new Date(res.changes.occurred_at!);
    expect(d.getHours()).toBe(16);
    expect(d.getMinutes()).toBe(45);
    expect(res.changes.reminder_enabled).toBe(true);
    expect(res.changes.reminder_offset_minutes).toBe(15);
    expect(res.actions.length).toBe(3);
  });

  it("extracts reminder 1 day before when saying 'poner aviso 1 día antes'", () => {
    const res = parseVoiceEditCommand(
      "poner aviso 1 día antes",
      baseEntry,
      refDate,
    );
    expect(res.hasChanges).toBe(true);
    expect(res.changes.reminder_enabled).toBe(true);
    expect(res.changes.reminder_offsets_minutes).toEqual([1440]);
    expect(res.changes.reminder_offset_minutes).toBe(1440);
    expect(res.actions).toContain("Aviso: 1 día antes");
  });

  it("extracts reminder 3 hours before when saying 'aviso 3 horas antes'", () => {
    const res = parseVoiceEditCommand(
      "poner aviso 3 horas antes",
      baseEntry,
      refDate,
    );
    expect(res.hasChanges).toBe(true);
    expect(res.changes.reminder_enabled).toBe(true);
    expect(res.changes.reminder_offsets_minutes).toEqual([180]);
    expect(res.changes.reminder_offset_minutes).toBe(180);
    expect(res.actions).toContain("Aviso: 3 horas antes");
  });

  it("extracts multiple reminder offsets when saying 'avísame 1 día antes y 1 hora antes'", () => {
    const res = parseVoiceEditCommand(
      "avísame 1 día antes y 1 hora antes",
      baseEntry,
      refDate,
    );
    expect(res.hasChanges).toBe(true);
    expect(res.changes.reminder_enabled).toBe(true);
    expect(res.changes.reminder_offsets_minutes).toEqual([1440, 60]);
    expect(res.actions).toContain("Aviso: 1 día antes, 1 hora antes");
  });

  it("extracts three offsets when saying 'notificar 1 día antes, 3 horas antes y 1 hora antes'", () => {
    const res = parseVoiceEditCommand(
      "notificar 1 día antes, 3 horas antes y 1 hora antes",
      baseEntry,
      refDate,
    );
    expect(res.hasChanges).toBe(true);
    expect(res.changes.reminder_enabled).toBe(true);
    expect(res.changes.reminder_offsets_minutes).toEqual([1440, 180, 60]);
    expect(res.actions).toContain(
      "Aviso: 1 día antes, 3 horas antes, 1 hora antes",
    );
  });

  it("returns hasChanges false when no edit command is recognized", () => {
    const res = parseVoiceEditCommand(
      "hola buenos días cómo estás",
      baseEntry,
      refDate,
    );
    expect(res.hasChanges).toBe(false);
    expect(res.actions.length).toBe(0);
  });
});
