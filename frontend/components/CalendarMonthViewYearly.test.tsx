import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
import React from "react";
import { createLocalCategory } from "../db/categories";
import { MemoryDatabaseAdapter, runMigrations } from "../db/database";
import { createLocalEntry, listLocalEntries } from "../db/entries";
import { CalendarMonthView } from "./CalendarMonthView";

describe("CalendarMonthView Yearly Recurrence (#103)", () => {
  let db: MemoryDatabaseAdapter;
  const userId = "test-user-123";
  let catId: string;
  const refDate = new Date("2026-09-15T12:00:00Z");

  beforeEach(async () => {
    db = new MemoryDatabaseAdapter();
    await runMigrations(db);

    const cat = await createLocalCategory(db, userId, {
      name: "Trabajo",
      voice_command: "trabajo",
      description: "Entradas de trabajo",
      color: "#38BDF8",
      icon: "briefcase",
    });
    catId = cat.id;

    // Create a base entry on Sept 15, 2026
    await createLocalEntry(db, userId, {
      category_id: catId,
      title: "Reunión regular",
      content: "Contenido de prueba",
      occurred_at: "2026-09-15T10:00:00.000Z",
      reminder_enabled: true,
      reminder_recurrence: "NONE",
    });
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it("projects yearly recurring entries across different calendar years (#103)", async () => {
    // Create a yearly recurring entry in past year 2024 on Sept 20
    await createLocalEntry(db, userId, {
      category_id: catId,
      title: "Cumpleaños de Mamá",
      content: "Comprar flores y tarta",
      occurred_at: "2024-09-20T09:00:00.000Z",
      reminder_enabled: true,
      reminder_recurrence: "YEARLY",
    });

    // Render calendar for September 2026
    const { getByTestId, getByText } = await render(
      <CalendarMonthView db={db} userId={userId} initialDate={refDate} />,
    );

    // Verify cell 2026-09-20 exists in the grid
    await waitFor(() => {
      expect(getByTestId("day-cell-2026-09-20")).toBeTruthy();
    });

    // Tap on Sept 20, 2026
    await act(async () => {
      fireEvent.press(getByTestId("day-cell-2026-09-20"));
    });

    await waitFor(() => {
      expect(getByTestId("day-detail-panel")).toBeTruthy();
      expect(getByText(/Cumpleaños de Mamá/i)).toBeTruthy();
      expect(getByText(/Comprar flores y tarta/i)).toBeTruthy();
    });
  });

  it("allows selecting Anual (YEARLY) in quick reminder drawer (#103)", async () => {
    const onEntryUpdatedMock = jest.fn();
    const { getByTestId } = await render(
      <CalendarMonthView
        db={db}
        userId={userId}
        initialDate={refDate}
        onEntryUpdated={onEntryUpdatedMock}
      />,
    );

    await waitFor(() => {
      expect(getByTestId("day-cell-2026-09-15")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("day-cell-2026-09-15"));
    });

    await waitFor(() => {
      expect(getByTestId("day-detail-panel")).toBeTruthy();
    });

    // Find the first entry's reminder button
    const allEntries = await listLocalEntries(db, userId);
    const firstEntry = allEntries[0];

    const bellBtn = getByTestId(`btn-open-quick-reminder-${firstEntry.id}`);
    await act(async () => {
      fireEvent.press(bellBtn);
    });

    // Check that preset-rec-YEARLY exists and press it
    await waitFor(() => {
      expect(getByTestId(`preset-rec-YEARLY-${firstEntry.id}`)).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId(`preset-rec-YEARLY-${firstEntry.id}`));
    });

    // Save reminder
    const saveBtn = getByTestId(`btn-save-reminder-${firstEntry.id}`);
    await act(async () => {
      fireEvent.press(saveBtn);
    });

    await waitFor(() => {
      expect(onEntryUpdatedMock).toHaveBeenCalled();
    });

    const updated = await listLocalEntries(db, userId);
    const found = updated.find((e) => e.id === firstEntry.id);
    expect(found?.reminder_recurrence).toBe("YEARLY");
  });
});
