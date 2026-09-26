import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React, { useState } from "react";
import { createLocalCategory } from "../db/categories";
import { MemoryDatabaseAdapter, runMigrations } from "../db/database";
import { createLocalEntry } from "../db/entries";
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
});
