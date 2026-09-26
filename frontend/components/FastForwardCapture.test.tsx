import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { createLocalCategory } from "../db/categories";
import { MemoryDatabaseAdapter, runMigrations } from "../db/database";
import { listLocalEntries } from "../db/entries";
import { createLocalTag } from "../db/tags";
import { FastForwardCapture } from "./FastForwardCapture";

describe("FastForwardCapture Component (Task 34)", () => {
  let db: MemoryDatabaseAdapter;
  const userId = "user-789";

  beforeEach(async () => {
    db = new MemoryDatabaseAdapter();
    await runMigrations(db);

    await createLocalCategory(db, userId, {
      name: "Notas",
      voice_command: "nota",
    });

    await createLocalTag(db, userId, { name: "Urgente" });
  });

  it("saves entry immediately and shows confirmation toast with edit link", async () => {
    const onCreatedMock = jest.fn();
    const onOpenEditMock = jest.fn();

    const { getByTestId, findByTestId } = await render(
      <FastForwardCapture
        db={db}
        userId={userId}
        onEntryCreated={onCreatedMock}
        onOpenEdit={onOpenEditMock}
      />,
    );

    await act(async () => {
      fireEvent.press(getByTestId("btn-sim-ff-voice"));
    });

    expect(await findByTestId("fast-forward-toast")).toBeTruthy();
    expect(onCreatedMock).toHaveBeenCalledTimes(1);

    const entriesInDb = await listLocalEntries(db, userId);
    expect(entriesInDb.length).toBe(1);
    expect(entriesInDb[0].content).toBe("comprar insumos de oficina");

    const createdId = entriesInDb[0].id;
    await act(async () => {
      fireEvent.press(getByTestId(`btn-edit-ff-${createdId}`));
    });

    expect(onOpenEditMock).toHaveBeenCalledWith(createdId);
  });
});
