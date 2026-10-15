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

    const { getByTestId } = await render(
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
  });
});
