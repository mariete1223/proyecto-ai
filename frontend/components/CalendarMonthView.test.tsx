import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { createLocalCategory } from "../db/categories";
import { MemoryDatabaseAdapter, runMigrations } from "../db/database";
import { createLocalEntry } from "../db/entries";
import { CalendarMonthView } from "./CalendarMonthView";

describe("CalendarMonthView Component (Task 35)", () => {
  let db: MemoryDatabaseAdapter;
  const userId = "user-789";
  const refDate = new Date("2026-09-15T12:00:00Z");

  let catId: string;

  beforeEach(async () => {
    db = new MemoryDatabaseAdapter();
    await runMigrations(db);

    const cat = await createLocalCategory(db, userId, {
      name: "Trabajo",
      voice_command: "trabajo",
      color: "#38BDF8",
    });
    catId = cat.id;

    // Create 4 entries on Sept 15 to test saturation (+1 indicator)
    for (let i = 1; i <= 4; i++) {
      await createLocalEntry(db, userId, {
        category_id: catId,
        content: `Entrada del día 15 #${i}`,
        occurred_at: `2026-09-15T10:0${i}:00Z`,
      });
    }
  });

  it("renders month title and day grid with entries", async () => {
    const { getByTestId, getByText } = await render(
      <CalendarMonthView db={db} userId={userId} initialDate={refDate} />,
    );

    await waitFor(() => {
      expect(getByTestId("calendar-month-view")).toBeTruthy();
      expect(getByTestId("calendar-month-title")).toBeTruthy();
      expect(getByText("Septiembre 2026")).toBeTruthy();
      expect(getByTestId("day-cell-2026-09-15")).toBeTruthy();
    });
  });

  it("handles day saturation (+1 indicator for >3 entries on same day)", async () => {
    const { getByTestId, getByText } = await render(
      <CalendarMonthView db={db} userId={userId} initialDate={refDate} />,
    );

    await waitFor(() => {
      expect(getByTestId("day-cell-2026-09-15")).toBeTruthy();
      expect(getByText("+1")).toBeTruthy();
    });
  });

  it("navigates to previous and next month", async () => {
    const { getByTestId, getByText } = await render(
      <CalendarMonthView db={db} userId={userId} initialDate={refDate} />,
    );

    await waitFor(() => {
      expect(getByText("Septiembre 2026")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-prev-month"));
    });

    await waitFor(() => {
      expect(getByText("Agosto 2026")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-next-month"));
    });

    await waitFor(() => {
      expect(getByText("Septiembre 2026")).toBeTruthy();
    });
  });

  it("opens day detail panel on day press and selects entry", async () => {
    const onSelectMock = jest.fn();
    const { getByTestId, getByText, findByTestId } = await render(
      <CalendarMonthView
        db={db}
        userId={userId}
        initialDate={refDate}
        onSelectEntry={onSelectMock}
      />,
    );

    await waitFor(() => {
      expect(getByTestId("day-cell-2026-09-15")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("day-cell-2026-09-15"));
    });

    expect(await findByTestId("day-detail-panel")).toBeTruthy();
    expect(getByText("Entradas del 2026-09-15")).toBeTruthy();
    expect(getByText("Entrada del día 15 #1")).toBeTruthy();
  });
});
