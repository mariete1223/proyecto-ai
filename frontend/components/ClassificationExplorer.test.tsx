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
    const baseTime = Date.now();
    for (let i = 1; i <= 7; i++) {
      await createLocalEntry(db, userId, {
        category_id: catTrabajoId,
        content: `Tarea de trabajo #${i}`,
        occurred_at: new Date(baseTime + i * 1000).toISOString(),
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
    });

    await act(async () => {
      fireEvent.press(getByTestId("explore-cat-" + catTrabajoId));
    });

    await waitFor(() => {
      expect(getByText("Tarea de trabajo #7")).toBeTruthy();
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

  it("allows creating a new category directly in the explorer tab", async () => {
    const onCatalogUpdatedMock = jest.fn();
    const { getByTestId, findByText } = await render(
      <ClassificationExplorer
        db={db}
        userId={userId}
        pageSize={5}
        onCatalogUpdated={onCatalogUpdatedMock}
      />,
    );

    await act(async () => {
      fireEvent.press(getByTestId("btn-open-add-category"));
    });

    expect(getByTestId("explorer-category-form")).toBeTruthy();

    await act(async () => {
      fireEvent.changeText(getByTestId("input-new-cat-name"), "Finanzas");
      fireEvent.changeText(getByTestId("input-new-cat-voice"), "finanzas");
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-save-new-category"));
    });

    expect(await findByText("Finanzas")).toBeTruthy();
    expect(onCatalogUpdatedMock).toHaveBeenCalled();
  });

  it("allows creating a new tag directly in the explorer tab", async () => {
    const onCatalogUpdatedMock = jest.fn();
    const { getByTestId, findByText } = await render(
      <ClassificationExplorer
        db={db}
        userId={userId}
        pageSize={5}
        onCatalogUpdated={onCatalogUpdatedMock}
      />,
    );

    await act(async () => {
      fireEvent.press(getByTestId("tab-tags"));
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-open-add-tag"));
    });

    expect(getByTestId("explorer-tag-form")).toBeTruthy();

    await act(async () => {
      fireEvent.changeText(getByTestId("input-new-tag-name"), "Importante");
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-save-new-tag"));
    });

    expect(await findByText("#Importante (0)")).toBeTruthy();
    expect(onCatalogUpdatedMock).toHaveBeenCalled();
    // Verify that the view stays on the TAGS tab (btn-open-add-tag is unique to TAGS tab)
    expect(getByTestId("btn-open-add-tag")).toBeTruthy();
  });

  it("remains on TAGS tab when refreshTrigger updates from parent", async () => {
    const { getByTestId, rerender } = await render(
      <ClassificationExplorer
        db={db}
        userId={userId}
        pageSize={5}
        refreshTrigger={100}
      />,
    );

    // Switch to TAGS tab
    await act(async () => {
      fireEvent.press(getByTestId("tab-tags"));
    });
    expect(getByTestId("btn-open-add-tag")).toBeTruthy();

    // Rerender with updated refreshTrigger (simulating sync completion / parent reload)
    await act(async () => {
      rerender(
        <ClassificationExplorer
          db={db}
          userId={userId}
          pageSize={5}
          refreshTrigger={200}
        />,
      );
    });

    // Active tab must still be TAGS
    expect(getByTestId("btn-open-add-tag")).toBeTruthy();
  });

  it("displays custom tag colors on chips, inactive dots, and tag action bar (#53)", async () => {
    // Create a tag with specific custom color
    const customTag = await createLocalTag(db, userId, {
      name: "Carmen",
      color: "#F59E0B",
    });

    const { getByTestId, queryByTestId } = await render(
      <ClassificationExplorer db={db} userId={userId} pageSize={5} />,
    );

    // Switch to TAGS tab
    await act(async () => {
      fireEvent.press(getByTestId("tab-tags"));
    });

    // The first tag alphabetically (#Carmen) is selected by default
    await waitFor(() => {
      expect(getByTestId("tag-action-color-dot")).toBeTruthy();
    });

    // Carmen is active, so its chip has backgroundColor: #F59E0B
    const activeChip = getByTestId(`explore-tag-${customTag.id}`);
    expect(activeChip.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: "#F59E0B" }),
      ]),
    );

    // And action bar has tag-action-color-dot with #F59E0B
    const actionDot = getByTestId("tag-action-color-dot");
    expect(actionDot.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: "#F59E0B" }),
      ]),
    );

    // Unselected tag (#Urgente) has tag-dot
    expect(getByTestId(`tag-dot-${tagUrgenteId}`)).toBeTruthy();

    // Now select Urgente
    await act(async () => {
      fireEvent.press(getByTestId(`explore-tag-${tagUrgenteId}`));
    });

    // Now Carmen is unselected and must have tag-dot-customTag.id
    await waitFor(() => {
      expect(getByTestId(`tag-dot-${customTag.id}`)).toBeTruthy();
    });
  });

  it("filters entries by date range (Desde / Hasta) and allows clearing filter (#118)", async () => {
    // Create entries with different occurred_at dates in catTrabajo
    await createLocalEntry(db, userId, {
      category_id: catTrabajoId,
      title: "Entrada Enero",
      content: "Trabajo de Enero",
      occurred_at: "2026-01-15T10:00:00Z",
    });
    await createLocalEntry(db, userId, {
      category_id: catTrabajoId,
      title: "Entrada Junio",
      content: "Trabajo de Junio",
      occurred_at: "2026-06-15T10:00:00Z",
    });
    await createLocalEntry(db, userId, {
      category_id: catTrabajoId,
      title: "Entrada Diciembre",
      content: "Trabajo de Diciembre",
      occurred_at: "2026-12-15T10:00:00Z",
    });

    const { getByTestId, queryByText, getByText } = await render(
      <ClassificationExplorer db={db} userId={userId} pageSize={10} />,
    );

    // Select category Trabajo
    await act(async () => {
      fireEvent.press(getByTestId(`explore-cat-${catTrabajoId}`));
    });

    // Initial render: all entries in Trabajo are visible
    await waitFor(() => {
      expect(getByText(/Trabajo de Enero/i)).toBeTruthy();
      expect(getByText(/Trabajo de Junio/i)).toBeTruthy();
      expect(getByText(/Trabajo de Diciembre/i)).toBeTruthy();
    });

    // Filter from 2026-05-01 to 2026-07-01 (should only show Junio)
    await act(async () => {
      fireEvent.changeText(getByTestId("input-date-range-start"), "2026-05-01");
      fireEvent.changeText(getByTestId("input-date-range-end"), "2026-07-01");
    });

    await waitFor(() => {
      expect(queryByText(/Trabajo de Enero/i)).toBeNull();
      expect(getByText(/Trabajo de Junio/i)).toBeTruthy();
      expect(queryByText(/Trabajo de Diciembre/i)).toBeNull();
    });

    // Clear filter button appears and resets the filter
    expect(getByTestId("btn-clear-date-filter")).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByTestId("btn-clear-date-filter"));
    });

    await waitFor(() => {
      expect(getByText(/Trabajo de Enero/i)).toBeTruthy();
      expect(getByText(/Trabajo de Junio/i)).toBeTruthy();
      expect(getByText(/Trabajo de Diciembre/i)).toBeTruthy();
    });
  });
});
