import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { LlmBatchProcessor } from "./LlmBatchProcessor";
import { MemoryDatabaseAdapter, runMigrations } from "../db/database";
import { createLocalCategory } from "../db/categories";
import { createLocalTag } from "../db/tags";

describe("LlmBatchProcessor Component", () => {
  let db: MemoryDatabaseAdapter;
  const userId = "user-test-llm";

  beforeEach(async () => {
    db = new MemoryDatabaseAdapter();
    await runMigrations(db);

    await createLocalCategory(db, userId, {
      name: "Notas",
      voice_command: "nota",
      kind: "STANDARD",
      color: "#38BDF8",
    });
    await createLocalCategory(db, userId, {
      name: "Tareas",
      voice_command: "tarea",
      kind: "TASK",
      color: "#818CF8",
    });
    await createLocalTag(db, userId, {
      name: "Trabajo",
    });
    await createLocalTag(db, userId, {
      name: "Salud",
    });
  });

  it("renders prompt copy tab and allows copying prompt", async () => {
    const { getByTestId, getByText } = await render(
      <LlmBatchProcessor
        db={db}
        userId={userId}
        initialText="Diario del día sobre Carmen y médico"
      />,
    );

    expect(getByText("🤖 Estructurar Nota Libre con IA (LLM)")).toBeTruthy();
    const inputNote = getByTestId("input-llm-raw-note");
    expect(inputNote.props.value).toContain(
      "Diario del día sobre Carmen y médico",
    );

    await act(async () => {
      fireEvent.press(getByTestId("btn-copy-llm-prompt"));
    });

    await waitFor(() => {
      expect(getByText("✓ ¡Prompt copiado al portapapeles!")).toBeTruthy();
    });
  });

  it("parses valid LLM JSON response and previews extracted entries", async () => {
    const { getByTestId, getByText } = await render(
      <LlmBatchProcessor db={db} userId={userId} />,
    );

    await act(async () => {
      fireEvent.press(getByTestId("btn-tab-llm-import"));
    });

    const jsonInputArea = getByTestId("input-llm-json-response");

    const jsonInput = JSON.stringify([
      {
        category_name: "Notas",
        title: "Reunión de proyecto",
        content: "Hablamos del diseño de la aplicación.",
        tags: ["Trabajo"],
      },
      {
        category_name: "Tareas",
        title: "Llamar al médico",
        content: "Pedir resultados de la analítica.",
        task_status: "PENDING",
        tags: ["Salud"],
      },
    ]);

    await act(async () => {
      fireEvent.changeText(jsonInputArea, jsonInput);
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-parse-llm-json"));
    });

    await waitFor(() => {
      expect(
        getByText("Vista previa de entradas detectadas (2):"),
      ).toBeTruthy();
      expect(getByText("Reunión de proyecto")).toBeTruthy();
      expect(getByText("Hablamos del diseño de la aplicación.")).toBeTruthy();
      expect(getByText("Llamar al médico")).toBeTruthy();
      expect(getByText("Pedir resultados de la analítica.")).toBeTruthy();
    });
  });

  it("saves parsed LLM entries to database on button press", async () => {
    const onImportCompleted = jest.fn();

    const { getByTestId } = await render(
      <LlmBatchProcessor
        db={db}
        userId={userId}
        onImportCompleted={onImportCompleted}
      />,
    );

    await act(async () => {
      fireEvent.press(getByTestId("btn-tab-llm-import"));
    });

    const jsonInputArea = getByTestId("input-llm-json-response");

    const jsonInput = JSON.stringify([
      {
        category_name: "Tareas",
        title: "Comprar fruta",
        content: "Comprar manzanas y plátanos.",
        task_status: "PENDING",
      },
    ]);

    await act(async () => {
      fireEvent.changeText(jsonInputArea, jsonInput);
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-parse-llm-json"));
    });

    const btnSave = getByTestId("btn-save-all-llm-entries");

    await act(async () => {
      fireEvent.press(btnSave);
    });

    await waitFor(() => {
      expect(onImportCompleted).toHaveBeenCalled();
      expect(onImportCompleted.mock.calls[0][0].length).toBe(1);
      expect(onImportCompleted.mock.calls[0][0][0].content).toBe(
        "Comprar manzanas y plátanos.",
      );
    });
  });

  it("keeps occurred_at as null for unstructured notes with multiple dates in text", async () => {
    const onImportCompleted = jest.fn();

    const { getByTestId, getByText } = await render(
      <LlmBatchProcessor
        db={db}
        userId={userId}
        onImportCompleted={onImportCompleted}
      />,
    );

    await act(async () => {
      fireEvent.press(getByTestId("btn-tab-llm-import"));
    });

    const jsonInputArea = getByTestId("input-llm-json-response");

    const jsonInput = JSON.stringify([
      {
        category_name: "Notas",
        title: "Diario desestructurado",
        content:
          "Ayer estuve con Juan, el viernes tengo cita y el 20 de octubre es el examen.",
        occurred_at: "2026-10-20T10:00:00Z",
        tags: ["Trabajo"],
      },
    ]);

    await act(async () => {
      fireEvent.changeText(jsonInputArea, jsonInput);
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-parse-llm-json"));
    });

    await waitFor(() => {
      expect(getByText("Diario desestructurado")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-save-all-llm-entries"));
    });

    await waitFor(() => {
      expect(onImportCompleted).toHaveBeenCalled();
      const saved = onImportCompleted.mock.calls[0][0][0];
      expect(saved.occurred_at).toBeNull();
      expect(saved.content).toBe(
        "Ayer estuve con Juan, el viernes tengo cita y el 20 de octubre es el examen.",
      );
    });
  });

  describe("Voice dictation in Step 1", () => {
    let mockSpeechInstance: any = null;

    class MockSpeechRecognition {
      continuous = false;
      interimResults = false;
      lang = "";
      onresult: any = null;
      onerror: any = null;
      onend: any = null;
      start = jest.fn();
      stop = jest.fn();

      constructor() {
        mockSpeechInstance = this;
      }
    }

    beforeEach(() => {
      mockSpeechInstance = null;
      (window as any).SpeechRecognition = MockSpeechRecognition;
    });

    afterEach(() => {
      delete (window as any).SpeechRecognition;
      delete (window as any).webkitSpeechRecognition;
    });

    it("renders dictation button and toggles listening state", async () => {
      const { getByTestId, queryByTestId, getByText } = await render(
        <LlmBatchProcessor db={db} userId={userId} />,
      );

      const dictateBtn = getByTestId("btn-dictate-llm-note");
      expect(getByText("🎙️ Dictar por Voz")).toBeTruthy();
      expect(queryByTestId("llm-voice-listening-badge")).toBeNull();

      // Start dictation
      await act(async () => {
        fireEvent.press(dictateBtn);
      });

      expect(getByText("⏹️ Detener Dictado")).toBeTruthy();
      expect(getByTestId("llm-voice-listening-badge")).toBeTruthy();
      expect(getByText("🔴 Escuchando... Habla ahora")).toBeTruthy();

      // Stop dictation
      await act(async () => {
        fireEvent.press(dictateBtn);
      });

      expect(getByText("🎙️ Dictar por Voz")).toBeTruthy();
      expect(queryByTestId("llm-voice-listening-badge")).toBeNull();
    });

    it("populates and appends transcribed text in real-time", async () => {
      const { getByTestId } = await render(
        <LlmBatchProcessor
          db={db}
          userId={userId}
          initialText="Texto previo escrito manualmente."
        />,
      );

      const inputArea = getByTestId("input-llm-raw-note");
      expect(inputArea.props.value).toBe("Texto previo escrito manualmente.");

      const dictateBtn = getByTestId("btn-dictate-llm-note");
      await act(async () => {
        fireEvent.press(dictateBtn);
      });

      expect(mockSpeechInstance).not.toBeNull();

      // Simulate first phrase spoken
      await act(async () => {
        mockSpeechInstance.onresult({
          results: [
            {
              isFinal: true,
              0: {
                transcript:
                  "Hoy tuve una reunión con el equipo y acordamos la entrega para el martes.",
              },
            },
          ],
        });
      });

      expect(inputArea.props.value).toBe(
        "Texto previo escrito manualmente.\nHoy tuve una reunión con el equipo y acordamos la entrega para el martes.",
      );

      // Stop dictation
      await act(async () => {
        fireEvent.press(dictateBtn);
      });

      // Clear button clears text
      const clearBtn = getByTestId("btn-clear-llm-note");
      await act(async () => {
        fireEvent.press(clearBtn);
      });

      expect(inputArea.props.value).toBe("");
    });

    it("stops dictation automatically when switching tabs", async () => {
      const { getByTestId, queryByTestId, getByText } = await render(
        <LlmBatchProcessor db={db} userId={userId} />,
      );

      await act(async () => {
        fireEvent.press(getByTestId("btn-dictate-llm-note"));
      });

      expect(getByText("⏹️ Detener Dictado")).toBeTruthy();

      // Switch to Import tab
      await act(async () => {
        fireEvent.press(getByTestId("btn-tab-llm-import"));
      });

      // Switch back to Prompt tab
      await act(async () => {
        fireEvent.press(getByTestId("btn-tab-llm-prompt"));
      });

      expect(getByText("🎙️ Dictar por Voz")).toBeTruthy();
      expect(queryByTestId("llm-voice-listening-badge")).toBeNull();
    });
  });
});
