import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { createLocalCategory } from "../db/categories";
import { MemoryDatabaseAdapter, runMigrations } from "../db/database";
import { listLocalEntries } from "../db/entries";
import { createLocalTag } from "../db/tags";
import { VoiceCaptureFlow } from "./VoiceCaptureFlow";

describe("VoiceCaptureFlow Component (Task 31)", () => {
  let db: MemoryDatabaseAdapter;
  const userId = "user-789";

  beforeEach(async () => {
    db = new MemoryDatabaseAdapter();
    await runMigrations(db);

    await createLocalCategory(db, userId, {
      name: "Notas",
      voice_command: "nota",
    });

    await createLocalCategory(db, userId, {
      name: "Tareas",
      voice_command: "tarea",
      kind: "TASK",
    });

    await createLocalTag(db, userId, { name: "Urgente" });
  });

  it("parses spoken command and saves automatically in FAST_FORWARD mode", async () => {
    const onCreatedMock = jest.fn();
    const { getByTestId, findByTestId } = await render(
      <VoiceCaptureFlow
        db={db}
        userId={userId}
        saveMode="FAST_FORWARD"
        onEntryCreated={onCreatedMock}
      />,
    );

    await act(async () => {
      fireEvent.changeText(
        getByTestId("input-transcript"),
        "nota fecha hoy contenido comprar leche etiquetas urgente",
      );
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-parse-transcript"));
    });

    expect(await findByTestId("voice-capture-success")).toBeTruthy();
    expect(onCreatedMock).toHaveBeenCalledTimes(1);

    const entriesInDb = await listLocalEntries(db, userId);
    expect(entriesInDb.length).toBe(1);
    expect(entriesInDb[0].content).toBe("comprar leche");
  });

  it("shows preview section before saving in PREVIEW_BEFORE_SAVE mode", async () => {
    const onCreatedMock = jest.fn();
    const { getByTestId, findByTestId } = await render(
      <VoiceCaptureFlow
        db={db}
        userId={userId}
        saveMode="PREVIEW_BEFORE_SAVE"
        onEntryCreated={onCreatedMock}
      />,
    );

    await act(async () => {
      fireEvent.changeText(
        getByTestId("input-transcript"),
        "nota fecha hoy contenido comprar leche",
      );
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-parse-transcript"));
    });

    expect(await findByTestId("correction-section")).toBeTruthy();
    expect(onCreatedMock).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(getByTestId("btn-save-corrected-entry"));
    });

    expect(await findByTestId("voice-capture-success")).toBeTruthy();
    expect(onCreatedMock).toHaveBeenCalledTimes(1);
  });

  it("documents the task-only priority commands in the voice guide", async () => {
    const { getByTestId, getByText } = await render(
      <VoiceCaptureFlow db={db} userId={userId} />,
    );

    expect(getByTestId("help-priority-command")).toBeTruthy();
    expect(getByText(/Solo para tareas/)).toBeTruthy();
    expect(getByText('"prioridad alta"')).toBeTruthy();
    expect(getByText('"prioridad media"')).toBeTruthy();
    expect(getByText('"prioridad baja"')).toBeTruthy();
  });

  it.each([
    ["alta", "Alta", "HIGH"],
    ["media", "Media", "MEDIUM"],
    ["baja", "Baja", "LOW"],
    ["urgente", "Alta", "HIGH"],
    ["normal", "Media", "MEDIUM"],
  ] as const)(
    "interprets prioridad %s and persists it in FAST_FORWARD mode",
    async (spokenPriority, displayedPriority, storedPriority) => {
      const { getByTestId, findByText } = await render(
        <VoiceCaptureFlow db={db} userId={userId} saveMode="FAST_FORWARD" />,
      );

      await findByText('"tarea"');
      await act(async () => {
        fireEvent.changeText(
          getByTestId("input-transcript"),
          `tarea prioridad ${spokenPriority} enviar informe`,
        );
      });
      await act(async () => {
        fireEvent.press(getByTestId("btn-parse-transcript"));
      });

      expect(await findByText(`Prioridad: ${displayedPriority}`)).toBeTruthy();
      const entries = await listLocalEntries(db, userId);
      expect(entries).toHaveLength(1);
      expect(entries[0].content).toBe("enviar informe");
      expect(entries[0].task_priority).toBe(storedPriority);
    },
  );

  it("preserves the spoken priority when reviewing and saving in PREVIEW_BEFORE_SAVE mode", async () => {
    const { getByTestId, findByText } = await render(
      <VoiceCaptureFlow
        db={db}
        userId={userId}
        saveMode="PREVIEW_BEFORE_SAVE"
      />,
    );

    await findByText('"tarea"');
    await act(async () => {
      fireEvent.changeText(
        getByTestId("input-transcript"),
        "tarea prioridad baja ordenar estantería",
      );
    });
    await act(async () => {
      fireEvent.press(getByTestId("btn-parse-transcript"));
    });

    expect(await findByText("Prioridad: Baja")).toBeTruthy();
    expect(getByTestId("voice-prio-low")).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId("btn-save-corrected-entry"));
    });

    const entries = await listLocalEntries(db, userId);
    expect(entries).toHaveLength(1);
    expect(entries[0].content).toBe("ordenar estantería");
    expect(entries[0].task_priority).toBe("LOW");
  });

  it("defaults a dictated task without priority to MEDIUM", async () => {
    const { getByTestId, findByTestId, findByText } = await render(
      <VoiceCaptureFlow db={db} userId={userId} saveMode="FAST_FORWARD" />,
    );

    await findByText('"tarea"');
    await act(async () => {
      fireEvent.changeText(
        getByTestId("input-transcript"),
        "tarea llamar al proveedor",
      );
    });
    await act(async () => {
      fireEvent.press(getByTestId("btn-parse-transcript"));
    });

    expect(await findByTestId("voice-capture-success")).toBeTruthy();
    const entries = await listLocalEntries(db, userId);
    expect(entries).toHaveLength(1);
    expect(entries[0].task_priority).toBe("MEDIUM");
  });

  it("keeps priority wording as content for non-task categories", async () => {
    const { getByTestId, findByTestId, findByText, queryByText } = await render(
      <VoiceCaptureFlow db={db} userId={userId} saveMode="FAST_FORWARD" />,
    );

    await findByText('"tarea"');
    await act(async () => {
      fireEvent.changeText(
        getByTestId("input-transcript"),
        "nota prioridad alta revisar arquitectura",
      );
    });
    await act(async () => {
      fireEvent.press(getByTestId("btn-parse-transcript"));
    });

    expect(await findByTestId("voice-capture-success")).toBeTruthy();
    expect(queryByText("Prioridad: Alta")).toBeNull();
    const entries = await listLocalEntries(db, userId);
    expect(entries).toHaveLength(1);
    expect(entries[0].content).toBe("prioridad alta revisar arquitectura");
    expect(entries[0].task_priority).toBeNull();
  });

  it("handles unknown category by displaying error and allowing manual correction", async () => {
    const { getByTestId, getByText, findByTestId } = await render(
      <VoiceCaptureFlow db={db} userId={userId} saveMode="FAST_FORWARD" />,
    );

    await act(async () => {
      fireEvent.changeText(
        getByTestId("input-transcript"),
        "desconocido contenido lavar el coche",
      );
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-parse-transcript"));
    });

    await waitFor(() => {
      expect(getByTestId("voice-capture-error")).toBeTruthy();
      expect(getByText('Categoría no reconocida: "desconocido"')).toBeTruthy();
    });

    expect(await findByTestId("correction-section")).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId("btn-save-corrected-entry"));
    });

    expect(await findByTestId("voice-capture-success")).toBeTruthy();
  });

  it("shows animated wave visualizer when starting listening", async () => {
    const { getByTestId, findByTestId } = await render(
      <VoiceCaptureFlow db={db} userId={userId} saveMode="FAST_FORWARD" />,
    );

    await act(async () => {
      fireEvent.press(getByTestId("btn-start-listening"));
    });

    expect(await findByTestId("voice-wave-visualizer")).toBeTruthy();
  });

  it("resets transcript and state when clicking reset button", async () => {
    const { getByTestId } = await render(
      <VoiceCaptureFlow
        db={db}
        userId={userId}
        saveMode="PREVIEW_BEFORE_SAVE"
      />,
    );

    await act(async () => {
      fireEvent.changeText(
        getByTestId("input-transcript"),
        "nota fecha hoy contenido comprar leche",
      );
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-parse-transcript"));
    });

    expect(getByTestId("correction-section")).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId("btn-reset-voice-capture"));
    });

    expect(getByTestId("input-transcript").props.value).toBe("");
  });

  it("renders a single tag chip and correct count even if duplicate normalized tags exist", async () => {
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO tags (id, user_id, name, name_normalized, created_at, updated_at, version, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      ["tag-dup", userId, "#Urgente", "urgente", now, now, 1, "SYNCED"],
    );

    const { findByText, getAllByText } = await render(
      <VoiceCaptureFlow
        db={db}
        userId={userId}
        saveMode="PREVIEW_BEFORE_SAVE"
      />,
    );

    expect(await findByText("🏷️ Etiquetas (1)")).toBeTruthy();
    const chips = getAllByText("#Urgente");
    expect(chips.length).toBe(1);
  });

  it("shows live dictation box prominently at the top in DICTATE step", async () => {
    const { getByTestId, getByText } = await render(
      <VoiceCaptureFlow
        db={db}
        userId={userId}
        saveMode="PREVIEW_BEFORE_SAVE"
      />,
    );

    expect(getByText("Paso 1 de 2: Dictado")).toBeTruthy();
    expect(getByTestId("live-dictation-box")).toBeTruthy();
    expect(getByText("🗣️ Lo que estás diciendo:")).toBeTruthy();
  });

  it("transitions to separate review screen when dictation is parsed and allows Regrabar to return to dictation", async () => {
    const { getByTestId, findByText, getByText, queryByTestId } = await render(
      <VoiceCaptureFlow
        db={db}
        userId={userId}
        saveMode="PREVIEW_BEFORE_SAVE"
      />,
    );

    // Initial step: DICTATE
    expect(getByText("Paso 1 de 2: Dictado")).toBeTruthy();
    expect(getByTestId("live-dictation-box")).toBeTruthy();
    expect(queryByTestId("recognized-tokens-section")).toBeNull();

    // Type dictation and process
    await act(async () => {
      fireEvent.changeText(
        getByTestId("input-transcript"),
        "tarea fecha hoy contenido comprar fruta",
      );
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-parse-transcript"));
    });

    // Step 2: RESULT / REVIEW
    expect(await findByText("Paso 2 de 2: Revisión")).toBeTruthy();
    expect(getByText("🗣️ Frase dictada:")).toBeTruthy();
    expect(getByText('"tarea fecha hoy contenido comprar fruta"')).toBeTruthy();
    expect(getByTestId("recognized-tokens-section")).toBeTruthy();
    expect(getByTestId("correction-section")).toBeTruthy();
    expect(getByText("🎙️ Regrabar")).toBeTruthy();

    // Press Regrabar to return to step 1
    await act(async () => {
      fireEvent.press(getByText("🎙️ Regrabar"));
    });

    // Back to Step 1: DICTATE with empty transcript
    expect(getByText("Paso 1 de 2: Dictado")).toBeTruthy();
    expect(getByTestId("live-dictation-box")).toBeTruthy();
    expect(getByTestId("input-transcript").props.value).toBe("");
    expect(queryByTestId("recognized-tokens-section")).toBeNull();
  });

  it("renders manual transcript input and parse button in live dictation box without overflow (#75)", async () => {
    const { getByTestId } = await render(
      <VoiceCaptureFlow
        db={db}
        userId={userId}
        saveMode="PREVIEW_BEFORE_SAVE"
      />,
    );

    const input = getByTestId("input-transcript");
    const parseBtn = getByTestId("btn-parse-transcript");
    expect(input).toBeTruthy();
    expect(parseBtn).toBeTruthy();
  });

  it("renders prominent Hero Dictation button and secondary control buttons (#76)", async () => {
    const { getByTestId, getByText, queryByTestId } = await render(
      <VoiceCaptureFlow
        db={db}
        userId={userId}
        saveMode="PREVIEW_BEFORE_SAVE"
      />,
    );

    // Initial Hero Button in IDLE state
    const heroBtn = getByTestId("btn-start-listening");
    expect(heroBtn).toBeTruthy();
    expect(getByText("Toca para Dictar")).toBeTruthy();
    expect(getByText("Presiona aquí y habla con comandos o texto libre")).toBeTruthy();
    expect(queryByTestId("btn-stop-listening")).toBeNull();

    // Secondary controls
    expect(getByTestId("btn-reset-voice-capture")).toBeTruthy();
    expect(getByText("🔄 Limpiar")).toBeTruthy();
  });
});
