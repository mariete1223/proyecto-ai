import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React, { useState } from "react";
import { createLocalCategory } from "../db/categories";
import { MemoryDatabaseAdapter, runMigrations } from "../db/database";
import { createLocalEntry } from "../db/entries";
import { createLocalTag } from "../db/tags";
import { CalendarCategoryFilter } from "./CalendarCategoryFilter";
import { CalendarMonthView } from "./CalendarMonthView";

describe("CalendarCategoryFilter Component (Task 36)", () => {
  let db: MemoryDatabaseAdapter;
  const userId = "user-789";
  const refDate = new Date("2026-09-15T12:00:00Z");

  let catNotasId: string;
  let catTareasId: string;

  beforeEach(async () => {
    db = new MemoryDatabaseAdapter();
    await runMigrations(db);

    const c1 = await createLocalCategory(db, userId, {
      name: "Notas",
      voice_command: "nota",
      color: "#38BDF8",
    });
    catNotasId = c1.id;

    const c2 = await createLocalCategory(db, userId, {
      name: "Tareas",
      voice_command: "tarea",
      kind: "TASK",
      color: "#818CF8",
    });
    catTareasId = c2.id;

    await createLocalEntry(db, userId, {
      category_id: catNotasId,
      content: "Nota en Septiembre 15",
      occurred_at: "2026-09-15T10:00:00Z",
    });

    await createLocalEntry(db, userId, {
      category_id: catTareasId,
      content: "Tarea en Septiembre 15",
      occurred_at: "2026-09-15T11:00:00Z",
    });
  });

  it("toggles category filter and resets filter properly", async () => {
    const onFilterChangeMock = jest.fn();
    const { getByTestId, getByText } = await render(
      <CalendarCategoryFilter
        db={db}
        userId={userId}
        onFilterChange={onFilterChangeMock}
      />,
    );

    await waitFor(() => {
      expect(getByTestId("calendar-category-filter")).toBeTruthy();
      expect(getByText("Notas")).toBeTruthy();
      expect(getByText("Tareas")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId(`filter-chip-${catNotasId}`));
    });

    expect(onFilterChangeMock).toHaveBeenCalledWith([catNotasId]);

    await act(async () => {
      fireEvent.press(getByTestId("btn-reset-cat-filter"));
    });

    expect(onFilterChangeMock).toHaveBeenCalledWith([]);
  });

  it("combines category filter with month navigation in CalendarMonthView", async () => {
    function CombinedContainer() {
      const [filter, setFilter] = useState<string[]>([]);
      return (
        <>
          <CalendarCategoryFilter
            db={db}
            userId={userId}
            onFilterChange={setFilter}
          />
          <CalendarMonthView
            db={db}
            userId={userId}
            initialDate={refDate}
            selectedCategoryIds={filter}
          />
        </>
      );
    }

    const { getByTestId, getByText } = await render(<CombinedContainer />);

    await waitFor(() => {
      expect(getByTestId("calendar-month-view")).toBeTruthy();
      expect(getByTestId("day-cell-2026-09-15")).toBeTruthy();
    });

    // Filter to only Tareas category
    await act(async () => {
      fireEvent.press(getByTestId(`filter-chip-${catTareasId}`));
    });

    // Open day detail and verify only Tareas entry appears
    await act(async () => {
      fireEvent.press(getByTestId("day-cell-2026-09-15"));
    });

    await waitFor(() => {
      expect(getByText("Tarea en Septiembre 15")).toBeTruthy();
    });
  });

  it("filters and searches tags in Por Etiquetas tab and calls onTagFilterChange (#55)", async () => {
    const tagCarmen = await createLocalTag(db, userId, {
      name: "Carmen",
      color: "#F59E0B",
    });
    const tagUrgente = await createLocalTag(db, userId, {
      name: "Urgente",
      color: "#EC4899",
    });

    const onFilterChangeMock = jest.fn();
    const onTagFilterChangeMock = jest.fn();

    const { getByTestId, getByText, queryByText } = await render(
      <CalendarCategoryFilter
        db={db}
        userId={userId}
        onFilterChange={onFilterChangeMock}
        onTagFilterChange={onTagFilterChangeMock}
      />,
    );

    await waitFor(() => {
      expect(getByTestId("filter-tab-tags")).toBeTruthy();
    });

    // Switch to Por Etiquetas tab
    await act(async () => {
      fireEvent.press(getByTestId("filter-tab-tags"));
    });

    await waitFor(() => {
      expect(getByText("#Carmen")).toBeTruthy();
      expect(getByText("#Urgente")).toBeTruthy();
    });

    // Type in tag search input
    await act(async () => {
      fireEvent.changeText(getByTestId("input-search-calendar-tags"), "carm");
    });

    expect(getByText("#Carmen")).toBeTruthy();
    expect(queryByText("#Urgente")).toBeNull();

    // Select tag Carmen
    await act(async () => {
      fireEvent.press(getByTestId(`filter-tag-chip-${tagCarmen.id}`));
    });

    expect(onTagFilterChangeMock).toHaveBeenCalledWith([tagCarmen.id]);

    // Press reset filters
    await act(async () => {
      fireEvent.press(getByTestId("btn-reset-cat-filter"));
    });

    expect(onTagFilterChangeMock).toHaveBeenCalledWith([]);
  });

  it("combines tag filter with CalendarMonthView to show only matching entries (#55)", async () => {
    const tagCarmen = await createLocalTag(db, userId, {
      name: "Carmen",
      color: "#F59E0B",
    });

    // Create entry with tagCarmen on Sept 15
    await createLocalEntry(db, userId, {
      category_id: catNotasId,
      content: "Entrada especial con tag Carmen",
      occurred_at: "2026-09-15T12:00:00Z",
      tag_ids: [tagCarmen.id],
    });

    function CombinedTagCalendar() {
      const [tagFilter, setTagFilter] = useState<string[]>([]);
      return (
        <>
          <CalendarCategoryFilter
            db={db}
            userId={userId}
            onFilterChange={() => {}}
            onTagFilterChange={setTagFilter}
          />
          <CalendarMonthView
            db={db}
            userId={userId}
            initialDate={refDate}
            selectedTagIds={tagFilter}
          />
        </>
      );
    }

    const { getByTestId, getByText, queryByText } = await render(
      <CombinedTagCalendar />,
    );

    // Switch to tags tab
    await act(async () => {
      fireEvent.press(getByTestId("filter-tab-tags"));
    });

    await waitFor(() => {
      expect(getByTestId(`filter-tag-chip-${tagCarmen.id}`)).toBeTruthy();
    });

    // Select tag Carmen
    await act(async () => {
      fireEvent.press(getByTestId(`filter-tag-chip-${tagCarmen.id}`));
    });

    // Open day detail on Sept 15
    await act(async () => {
      fireEvent.press(getByTestId("day-cell-2026-09-15"));
    });

    await waitFor(() => {
      expect(getByText("Entrada especial con tag Carmen")).toBeTruthy();
    });

    // Entries without tagCarmen should not appear in filtered view
    expect(queryByText("Nota en Septiembre 15")).toBeNull();
    expect(queryByText("Tarea en Septiembre 15")).toBeNull();
  });
});
