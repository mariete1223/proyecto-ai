import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { DateTimePicker } from "./DateTimePicker";

describe("DateTimePicker Component (#75)", () => {
  it("renders with presets and picker fields without errors", async () => {
    const onChangeMock = jest.fn();
    const { getByTestId, getByText } = await render(
      <DateTimePicker
        value="2026-10-18T18:00:00.000Z"
        onChange={onChangeMock}
        label="Fecha y Hora de Prueba"
        testID="test-date-picker"
      />,
    );

    expect(getByText("Fecha y Hora de Prueba")).toBeTruthy();
    expect(getByTestId("date-presets")).toBeTruthy();
    expect(getByTestId("preset-now")).toBeTruthy();
    expect(getByTestId("preset-today-18")).toBeTruthy();
    expect(getByTestId("preset-tomorrow-9")).toBeTruthy();
    expect(getByTestId("preset-none")).toBeTruthy();
  });

  it("handles preset buttons correctly", async () => {
    const onChangeMock = jest.fn();
    const { getByTestId } = await render(
      <DateTimePicker
        value=""
        onChange={onChangeMock}
        testID="test-date-picker"
      />,
    );

    fireEvent.press(getByTestId("preset-today-18"));
    expect(onChangeMock).toHaveBeenCalled();
    const emittedIso = onChangeMock.mock.calls[0][0];
    expect(emittedIso).toContain("T");

    fireEvent.press(getByTestId("preset-none"));
    expect(onChangeMock).toHaveBeenLastCalledWith("");
  });
});
