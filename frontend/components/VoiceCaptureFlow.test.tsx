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

    // Both save buttons are disabled before manual correction
    expect(
      getByTestId("btn-quick-save-tokens").props.accessibilityState?.disabled,
    ).toBe(true);
    expect(
      getByTestId("btn-save-corrected-entry").props.accessibilityState
        ?.disabled,
    ).toBe(true);

    // Manually select a valid category chip
    await act(async () => {
      fireEvent.press(getByText("Notas"));
    });

    // Manual save button is now enabled
    expect(
      getByTestId("btn-save-corrected-entry").props.accessibilityState
        ?.disabled,
    ).toBe(false);

    await act(async () => {
      fireEvent.press(getByTestId("btn-save-corrected-entry"));
    });

    expect(await findByTestId("voice-capture-success")).toBeTruthy();
  });

  it("disables saving when no command is recognized and enables repeating dictation (#79)", async () => {
    const { getByTestId, getByText, queryByTestId, findByText } = await render(
      <VoiceCaptureFlow
        db={db}
        userId={userId}
        saveMode="PREVIEW_BEFORE_SAVE"
      />,
    );

    await act(async () => {
      fireEvent.changeText(getByTestId("input-transcript"), "Hola");
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-parse-transcript"));
    });

    // Step 2: RESULT
    expect(await findByText("Paso 2 de 2: Revisión")).toBeTruthy();
    expect(getByText('Categoría no reconocida: "Hola"')).toBeTruthy();

    // Verify quick save and manual save are disabled
    const quickSaveBtn = getByTestId("btn-quick-save-tokens");
    expect(quickSaveBtn.props.accessibilityState?.disabled).toBe(true);

    const manualSaveBtn = getByTestId("btn-save-corrected-entry");
    expect(manualSaveBtn.props.accessibilityState?.disabled).toBe(true);

    // Verify quick re-record button is present and functional
    const quickRerecordBtn = getByTestId("btn-quick-rerecord");
    expect(quickRerecordBtn).toBeTruthy();

    await act(async () => {
      fireEvent.press(quickRerecordBtn);
    });

    // Returned to Step 1 clean
    expect(getByText("Paso 1 de 2: Dictado")).toBeTruthy();
    expect(getByTestId("input-transcript").props.value).toBe("");
    expect(queryByTestId("recognized-tokens-section")).toBeNull();
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

  it("shows live dictation box and secondary controls conditionally only when dictating or with text (#80)", async () => {
    const { getByTestId, queryByTestId, getByText } = await render(
      <VoiceCaptureFlow
        db={db}
        userId={userId}
        saveMode="PREVIEW_BEFORE_SAVE"
      />,
    );

    expect(getByText("Paso 1 de 2: Dictado")).toBeTruthy();
    // In idle without text: box and secondary controls are hidden
    expect(queryByTestId("live-dictation-box")).toBeNull();
    expect(queryByTestId("secondary-controls-row")).toBeNull();

    // When text is typed / dictated, box and secondary controls appear
    await act(async () => {
      fireEvent.changeText(
        getByTestId("input-transcript"),
        "nota reunión con equipo",
      );
    });

    expect(getByTestId("live-dictation-box")).toBeTruthy();
    expect(getByTestId("live-dictation-text")).toBeTruthy();
    expect(getByText("nota reunión con equipo")).toBeTruthy();
    expect(getByTestId("live-parsed-entities")).toBeTruthy();
    expect(getByText("📁 Notas")).toBeTruthy();
    expect(getByTestId("btn-reset-voice-capture")).toBeTruthy();
    expect(getByText("🔄 Limpiar")).toBeTruthy();
  });

  it("transitions to separate review screen when dictation is parsed and allows Regrabar to return to dictation", async () => {
    const { getByTestId, findByText, getByText, queryByTestId } = await render(
      <VoiceCaptureFlow
        db={db}
        userId={userId}
        saveMode="PREVIEW_BEFORE_SAVE"
      />,
    );

    // Initial step: DICTATE - live dictation box is hidden in idle
    expect(getByText("Paso 1 de 2: Dictado")).toBeTruthy();
    expect(queryByTestId("live-dictation-box")).toBeNull();
    expect(queryByTestId("recognized-tokens-section")).toBeNull();

    // Type dictation and process
    await act(async () => {
      fireEvent.changeText(
        getByTestId("input-transcript"),
        "tarea fecha hoy contenido comprar fruta",
      );
    });

    expect(getByTestId("live-dictation-box")).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId("btn-parse-transcript"));
    });

    expect(await findByText("Paso 2 de 2: Revisión")).toBeTruthy();
    expect(getByText("🗣️ Frase dictada:")).toBeTruthy();
    expect(getByText('"tarea fecha hoy contenido comprar fruta"')).toBeTruthy();
    expect(getByTestId("recognized-tokens-section")).toBeTruthy();
    expect(getByTestId("correction-section")).toBeTruthy();
    expect(getByTestId("btn-reset-voice-capture")).toBeTruthy();

    // Press Regrabar to return to step 1
    await act(async () => {
      fireEvent.press(getByTestId("btn-reset-voice-capture"));
    });

    // Back to Step 1: DICTATE with empty transcript (idle state)
    expect(getByText("Paso 1 de 2: Dictado")).toBeTruthy();
    expect(queryByTestId("live-dictation-box")).toBeNull();
    expect(getByTestId("input-transcript").props.value).toBe("");
    expect(queryByTestId("recognized-tokens-section")).toBeNull();
  });

  it("renders manual transcript input and parse button when dictation box is active (#75, #80)", async () => {
    const { getByTestId } = await render(
      <VoiceCaptureFlow
        db={db}
        userId={userId}
        saveMode="PREVIEW_BEFORE_SAVE"
      />,
    );

    // Enter text to activate dictation box
    await act(async () => {
      fireEvent.changeText(getByTestId("input-transcript"), "prueba de texto");
    });

    const input = getByTestId("input-transcript");
    const parseBtn = getByTestId("btn-parse-transcript");
    expect(input).toBeTruthy();
    expect(parseBtn).toBeTruthy();
  });

  it("renders prominent Hero Dictation button and hides secondary controls until dictating (#76, #80)", async () => {
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
    expect(
      getByText("Presiona aquí y habla con comandos o texto libre"),
    ).toBeTruthy();
    expect(queryByTestId("btn-stop-listening")).toBeNull();

    // Secondary controls are hidden in IDLE before dictating
    expect(queryByTestId("secondary-controls-row")).toBeNull();
    expect(queryByTestId("btn-reset-voice-capture")).toBeNull();

    // When text is dictated, secondary controls appear
    await act(async () => {
      fireEvent.changeText(getByTestId("input-transcript"), "alguna nota");
    });

    expect(getByTestId("secondary-controls-row")).toBeTruthy();
    expect(getByTestId("btn-reset-voice-capture")).toBeTruthy();
    expect(getByText("🔄 Limpiar")).toBeTruthy();
  });

  it("renders clean header without redundant title and without duplicate Salir button (#85)", async () => {
    const { queryByText, queryByTestId, getByText } = await render(
      <VoiceCaptureFlow
        db={db}
        userId={userId}
        saveMode="PREVIEW_BEFORE_SAVE"
      />,
    );

    expect(getByText("Paso 1 de 2: Dictado")).toBeTruthy();
    expect(queryByText("Captura Hablada por Voz")).toBeNull();
    expect(queryByTestId("btn-header-close-voice")).toBeNull();
    expect(queryByText("✕ Salir")).toBeNull();
  });

  it("hides status banner in idle when microphone is ready and shows warning only if not ready (#81)", async () => {
    const { queryByTestId, queryByText } = await render(
      <VoiceCaptureFlow
        db={db}
        userId={userId}
        saveMode="PREVIEW_BEFORE_SAVE"
      />,
    );

    // In idle ready state, no status banner is shown
    expect(queryByTestId("voice-status-banner")).toBeNull();
    expect(queryByText("Micrófono listo para dictado")).toBeNull();
  });

  it("renders Regrabar and Guardar side by side and removes Cancel button from action rows (#88)", async () => {
    const onCloseMock = jest.fn();
    const { getByTestId, findByText, queryByTestId } = await render(
      <VoiceCaptureFlow
        db={db}
        userId={userId}
        saveMode="PREVIEW_BEFORE_SAVE"
        onClose={onCloseMock}
      />,
    );

    await act(async () => {
      fireEvent.changeText(
        getByTestId("input-transcript"),
        "nota contenido prueba botones",
      );
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-parse-transcript"));
    });

    expect(await findByText("Paso 2 de 2: Revisión")).toBeTruthy();

    // In quick tokens bar:
    expect(getByTestId("btn-quick-rerecord")).toBeTruthy();
    expect(getByTestId("btn-quick-save-tokens")).toBeTruthy();
    expect(queryByTestId("btn-quick-cancel-tokens")).toBeNull();

    // In bottom actions bar:
    expect(getByTestId("btn-reset-voice-capture")).toBeTruthy();
    expect(getByTestId("btn-save-corrected-entry")).toBeTruthy();
    expect(queryByTestId("btn-close-voice-flow")).toBeNull();
  });
});
