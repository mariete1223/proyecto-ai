import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { createLocalCategory } from "../db/categories";
import { MemoryDatabaseAdapter, runMigrations } from "../db/database";
import { listLocalEntries } from "../db/entries";
import { createLocalTag } from "../db/tags";
import { MixedCaptureFlow } from "./MixedCaptureFlow";

describe("MixedCaptureFlow Component (Task 32)", () => {
  let db: MemoryDatabaseAdapter;
  const userId = "user-789";

  beforeEach(async () => {
    db = new MemoryDatabaseAdapter();
    await runMigrations(db);

    await createLocalCategory(db, userId, {
      name: "Trabajo",
      voice_command: "trabajo",
    });

    await createLocalCategory(db, userId, {
      name: "Personal",
      voice_command: "personal",
    });

    await createLocalTag(db, userId, { name: "Prioritario" });
  });

  it("renders manual selection chips for categories and tags", async () => {
    const { getByTestId, getByText } = await render(
      <MixedCaptureFlow db={db} userId={userId} />,
    );

    await waitFor(() => {
      expect(getByTestId("mixed-capture-flow")).toBeTruthy();
      expect(getByText("Trabajo")).toBeTruthy();
      expect(getByText("Personal")).toBeTruthy();
      expect(getByText("#Prioritario")).toBeTruthy();
    });
  });

  it("combines manual selections with dictated content and saves entry", async () => {
    const onSuccessMock = jest.fn();
    const { getByTestId, findByTestId } = await render(
      <MixedCaptureFlow db={db} userId={userId} onSuccess={onSuccessMock} />,
    );

    await act(async () => {
      fireEvent.changeText(
        getByTestId("input-dictated-content"),
        "Dictado de reunión con clientes",
      );
      fireEvent.changeText(
        getByTestId("input-mixed-date"),
        "2026-09-30T10:00:00Z",
      );
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-submit-mixed"));
    });

    expect(await findByTestId("mixed-capture-success")).toBeTruthy();
    expect(onSuccessMock).toHaveBeenCalledTimes(1);

    const entriesInDb = await listLocalEntries(db, userId);
    expect(entriesInDb.length).toBe(1);
    expect(entriesInDb[0].content).toBe("Dictado de reunión con clientes");
    expect(entriesInDb[0].occurred_at).toBe("2026-09-30T10:00:00Z");
  });

  it("shows error when dictated content is empty", async () => {
    const { getByTestId, getByText } = await render(
      <MixedCaptureFlow db={db} userId={userId} />,
    );

    await waitFor(() => {
      expect(getByText("Trabajo")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-submit-mixed"));
    });

    await waitFor(() => {
      expect(getByTestId("mixed-capture-error")).toBeTruthy();
      expect(
        getByText("El contenido dictado no puede estar vacío."),
      ).toBeTruthy();
    });
  });
});
