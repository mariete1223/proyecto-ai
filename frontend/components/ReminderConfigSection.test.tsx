import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { ReminderConfigSection } from "./ReminderConfigSection";
import { notificationService } from "../services/notificationService";

describe("ReminderConfigSection Component (#67)", () => {
  const baseOccurredAt = "2026-10-20T10:00:00.000Z";
  const baseReminderTime = "2026-10-20T08:00:00.000Z";
  const baseReminderEndTime = "2026-10-22T20:00:00.000Z";

  beforeEach(() => {
    jest
      .spyOn(notificationService, "getPermissionStatus")
      .mockReturnValue("granted");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders enabled state with start date, end date and recurrence options", async () => {
    const onRecurrenceChangeMock = jest.fn();
    const onReminderEndTimeChangeMock = jest.fn();

    const { getByText, getByTestId } = await render(
      <ReminderConfigSection
        enabled={true}
        onEnabledChange={jest.fn()}
        reminderTime={baseReminderTime}
        onReminderTimeChange={jest.fn()}
        reminderEndTime={baseReminderEndTime}
        onReminderEndTimeChange={onReminderEndTimeChangeMock}
        offsetMinutes={0}
        onOffsetMinutesChange={jest.fn()}
        recurrence="NONE"
        onRecurrenceChange={onRecurrenceChangeMock}
        occurredAt={baseOccurredAt}
      />,
    );

    expect(getByText("🔔 Recordatorios y Notificaciones")).toBeTruthy();
    expect(getByTestId("input-reminder-end-date")).toBeTruthy();
    expect(getByText("Cada 2 horas")).toBeTruthy();
    expect(getByText("Cada 4 horas")).toBeTruthy();
    expect(getByText("Cada 6 horas")).toBeTruthy();
    expect(getByText("Cada 8 horas")).toBeTruthy();
    expect(getByText("Cada 12 horas")).toBeTruthy();
    expect(getByTestId("chip-recurrence-interval-hours")).toBeTruthy();
  });

  it("selects an hourly preset like Cada 4 horas and triggers onRecurrenceChange", async () => {
    const onRecurrenceChangeMock = jest.fn();

    const { getByText } = await render(
      <ReminderConfigSection
        enabled={true}
        onEnabledChange={jest.fn()}
        reminderTime={baseReminderTime}
        onReminderTimeChange={jest.fn()}
        reminderEndTime={baseReminderEndTime}
        onReminderEndTimeChange={jest.fn()}
        offsetMinutes={0}
        onOffsetMinutesChange={jest.fn()}
        recurrence="NONE"
        onRecurrenceChange={onRecurrenceChangeMock}
        occurredAt={baseOccurredAt}
      />,
    );

    fireEvent.press(getByText("Cada 4 horas"));
    expect(onRecurrenceChangeMock).toHaveBeenCalledWith("EVERY_4_HOURS");
  });

  it("activates custom hours input when tapping Cada X horas and updates recurrence", async () => {
    const onRecurrenceChangeMock = jest.fn();

    const { getByTestId } = await render(
      <ReminderConfigSection
        enabled={true}
        onEnabledChange={jest.fn()}
        reminderTime={baseReminderTime}
        onReminderTimeChange={jest.fn()}
        reminderEndTime={baseReminderEndTime}
        onReminderEndTimeChange={jest.fn()}
        offsetMinutes={0}
        onOffsetMinutesChange={jest.fn()}
        recurrence="NONE"
        onRecurrenceChange={onRecurrenceChangeMock}
        occurredAt={baseOccurredAt}
      />,
    );

    fireEvent.press(getByTestId("chip-recurrence-interval-hours"));
    await waitFor(() => {
      expect(getByTestId("custom-hours-container")).toBeTruthy();
      expect(getByTestId("input-recurrence-custom-hours")).toBeTruthy();
    });

    fireEvent.changeText(getByTestId("input-recurrence-custom-hours"), "5");
    await waitFor(() => {
      expect(onRecurrenceChangeMock).toHaveBeenCalledWith("EVERY_5_HOURS");
    });
  });

  it("displays hourly summary details when recurrence is set to EVERY_6_HOURS", async () => {
    const { getByText } = await render(
      <ReminderConfigSection
        enabled={true}
        onEnabledChange={jest.fn()}
        reminderTime={baseReminderTime}
        onReminderTimeChange={jest.fn()}
        reminderEndTime={baseReminderEndTime}
        onReminderEndTimeChange={jest.fn()}
        offsetMinutes={0}
        onOffsetMinutesChange={jest.fn()}
        recurrence="EVERY_6_HOURS"
        onRecurrenceChange={jest.fn()}
        occurredAt={baseOccurredAt}
      />,
    );

    expect(getByText(/Sonará de forma periódica cada 6 horas/i)).toBeTruthy();
    expect(getByText(/Aviso periódico flexible cada 6 horas/i)).toBeTruthy();
  });
});
