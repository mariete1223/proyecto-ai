import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { createLocalCategory } from "../db/categories";
import { MemoryDatabaseAdapter, runMigrations } from "../db/database";
import { createLocalEntry } from "../db/entries";
import { createLocalTag } from "../db/tags";
import { ClassificationExplorer } from "./ClassificationExplorer";

describe("ClassificationExplorer Component (Task 37)", () => {
  let db: MemoryDatabaseAdapter;
  const userId = "user-789";

  let catTrabajoId: string;
  let catSaludId: string;
  let tagUrgenteId: string;

  beforeEach(async () => {
    db = new MemoryDatabaseAdapter();
    await runMigrations(db);

    const c1 = await createLocalCategory(db, userId, {
      name: "Trabajo",
      voice_command: "trabajo",
      color: "#38BDF8",
    });
    catTrabajoId = c1.id;

    const c2 = await createLocalCategory(db, userId, {
      name: "Salud",
      voice_command: "salud",
      color: "#10B981",
    });
    catSaludId = c2.id;

    const tag = await createLocalTag(db, userId, { name: "Urgente" });
    tagUrgenteId = tag.id;

    // Create 7 entries in Trabajo to test pagination (pageSize = 3)
    for (let i = 1; i <= 7; i++) {
      await createLocalEntry(db, userId, {
        category_id: catTrabajoId,
        content: `Tarea de trabajo #${i}`,
        tag_ids: i <= 2 ? [tagUrgenteId] : [],
      });
    }
  });

  it("filters entries by category and supports pagination", async () => {
    const onSelectMock = jest.fn();
    const { getByTestId, getByText } = await render(
      <ClassificationExplorer
        db={db}
        userId={userId}
        pageSize={3}
        onSelectEntry={onSelectMock}
      />,
    );

    await waitFor(() => {
      expect(getByTestId("classification-explorer")).toBeTruthy();
      expect(getByText("Trabajo")).toBeTruthy();
      expect(getByText("Tarea de trabajo #1")).toBeTruthy();
    });

    // Pagination test: click load more
    await act(async () => {
      fireEvent.press(getByTestId("btn-load-more-explorer"));
    });

    expect(getByText("Tarea de trabajo #4")).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId("explore-cat-" + catSaludId));
    });

    await waitFor(() => {
      expect(
        getByText("No hay entradas asociadas a esta categoría."),
      ).toBeTruthy();
    });
  });

  it("filters entries by tag tab and shows empty state when appropriate", async () => {
    const { getByTestId, getByText } = await render(
      <ClassificationExplorer db={db} userId={userId} pageSize={5} />,
    );

    await waitFor(() => {
      expect(getByText("Trabajo")).toBeTruthy();
    });

    // Switch to Por Etiquetas tab
    await act(async () => {
      fireEvent.press(getByTestId("tab-tags"));
    });

    await waitFor(() => {
      expect(getByText("#Urgente (2)")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId(`explore-tag-${tagUrgenteId}`));
    });

    await waitFor(() => {
      expect(getByText("Tarea de trabajo #1")).toBeTruthy();
      expect(getByText("Tarea de trabajo #2")).toBeTruthy();
    });
  });
});
