import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
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

  it("renders big mic hero button, pinned action dock, and confines layout (#146)", async () => {
    const onOpenManualForm = jest.fn();
    const onOpenLlmImport = jest.fn();

    const { getByTestId, findByTestId, queryByText, queryByTestId, getByText } =
      await render(
        <MobileHomeVoiceView
          db={db}
          userId={userId}
          onOpenManualForm={onOpenManualForm}
          onOpenLlmImport={onOpenLlmImport}
        />,
      );

    const container = getByTestId("mobile-home-voice-view");
    expect(container).toBeTruthy();
    const containerStyle = Array.isArray(container.props.style)
      ? Object.assign({}, ...container.props.style)
      : container.props.style;
    expect(containerStyle.flex).toBe(1);
    expect(containerStyle.minHeight).toBe(0);
    expect(containerStyle.overflow).toBe("hidden");

    const scrollArea = getByTestId("mobile-home-scroll-area");
    expect(scrollArea).toBeTruthy();
    const scrollStyle = Array.isArray(scrollArea.props.style)
      ? Object.assign({}, ...scrollArea.props.style)
      : scrollArea.props.style;
    expect(scrollStyle.flex).toBe(1);
    expect(scrollStyle.minHeight).toBe(0);

    const thumbDock = getByTestId("mobile-thumb-zone-card");
    expect(thumbDock).toBeTruthy();
    const thumbStyle = Array.isArray(thumbDock.props.style)
      ? Object.assign({}, ...thumbDock.props.style)
      : thumbDock.props.style;
    expect(thumbStyle.flexShrink).toBe(0);

    expect(getByTestId("btn-big-mic-start")).toBeTruthy();
    expect(getByText("Toca para Grabar por Voz")).toBeTruthy();
    expect(
      queryByText(
        /puedes crear todas las categorías y etiquetas que necesites/i,
      ),
    ).toBeTruthy();

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
      expect(getByTestId("mobile-thumb-zone-card")).toBeTruthy();
    });
  });
});
