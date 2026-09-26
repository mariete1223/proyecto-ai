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
});
