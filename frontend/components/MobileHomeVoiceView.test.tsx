import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { MobileHomeVoiceView } from "./MobileHomeVoiceView";
import { MemoryDatabaseAdapter, runMigrations } from "../db/database";
import { createLocalCategory } from "../db/categories";

describe("MobileHomeVoiceView Component", () => {
  let db: MemoryDatabaseAdapter;
  const userId = "user-mobile-test";

  beforeEach(async () => {
    db = new MemoryDatabaseAdapter();
    await runMigrations(db);
    await createLocalCategory(db, userId, {
      name: "Notas",
      voice_command: "nota",
      kind: "STANDARD",
    });
  });

  it("renders big mic hero button and action buttons", async () => {
    const onOpenManualForm = jest.fn();
    const onOpenLlmImport = jest.fn();

    const { getByTestId, findByTestId, queryByText, queryByTestId } =
      await render(
        <MobileHomeVoiceView
          db={db}
          userId={userId}
          onOpenManualForm={onOpenManualForm}
          onOpenLlmImport={onOpenLlmImport}
        />,
      );

    expect(getByTestId("mobile-home-voice-view")).toBeTruthy();
    expect(getByTestId("btn-big-mic-start")).toBeTruthy();

    fireEvent.press(getByTestId("btn-mobile-manual-entry"));
    expect(onOpenManualForm).toHaveBeenCalled();

    fireEvent.press(getByTestId("btn-mobile-llm-import"));
    expect(onOpenLlmImport).toHaveBeenCalled();

    // Open voice modal (#85)
    fireEvent.press(getByTestId("btn-big-mic-start"));
    const closeBtn = await findByTestId("btn-close-mobile-voice");
    expect(closeBtn).toBeTruthy();

    // Verify absence of duplicate title and Salir button (#85)
    expect(queryByText("Captura Hablada por Voz")).toBeNull();
    expect(queryByText("✕ Salir")).toBeNull();
    expect(queryByTestId("btn-header-close-voice")).toBeNull();

    // Close modal via Cerrar button (#85)
    if (closeBtn.props.onClick) {
      closeBtn.props.onClick();
    } else {
      closeBtn.props.onPress?.();
    }
    await waitFor(() => {
      expect(queryByTestId("mobile-voice-capture-panel")).toBeNull();
    });
  });
});
