import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Platform, StyleSheet } from "react-native";
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

    await act(async () => {
      fireEvent.press(getByTestId("preset-today-18"));
    });
    expect(onChangeMock).toHaveBeenCalled();
    const emittedIso = onChangeMock.mock.calls[0][0];
    expect(emittedIso).toContain("T");

    await act(async () => {
      fireEvent.press(getByTestId("preset-none"));
    });
    expect(onChangeMock).toHaveBeenLastCalledWith("");
  });

  it("renders with empty value correctly without errors (#96)", async () => {
    const { getByTestId, queryByText } = await render(
      <DateTimePicker value="" onChange={() => {}} />,
    );
    expect(getByTestId("preset-none")).toBeTruthy();
    expect(queryByText("✨")).toBeNull();
  });

  it("applies active styles when presets are selected (#101)", async () => {
    let currentValue = "";
    const onChangeMock = jest.fn((val: string) => {
      currentValue = val;
    });

    const { getByTestId, rerender } = await render(
      <DateTimePicker value={currentValue} onChange={onChangeMock} />,
    );

    // Initial state with empty value: preset-none is active
    let noneStyle = StyleSheet.flatten(getByTestId("preset-none").props.style);
    expect(noneStyle.borderColor).toBe("#ef4444");

    // Press 'Ahora'
    await act(async () => {
      fireEvent.press(getByTestId("preset-now"));
    });
    expect(onChangeMock).toHaveBeenCalled();
    await rerender(
      <DateTimePicker value={currentValue} onChange={onChangeMock} />,
    );
    let nowStyle = StyleSheet.flatten(getByTestId("preset-now").props.style);
    expect(nowStyle.borderColor).toBe("#38BDF8");

    // Press 'Hoy 18:00'
    await act(async () => {
      fireEvent.press(getByTestId("preset-today-18"));
    });
    await rerender(
      <DateTimePicker value={currentValue} onChange={onChangeMock} />,
    );
    let today18Style = StyleSheet.flatten(
      getByTestId("preset-today-18").props.style,
    );
    expect(today18Style.borderColor).toBe("#38BDF8");

    // Press 'Mañana 09:00'
    await act(async () => {
      fireEvent.press(getByTestId("preset-tomorrow-9"));
    });
    await rerender(
      <DateTimePicker value={currentValue} onChange={onChangeMock} />,
    );
    let tomorrow9Style = StyleSheet.flatten(
      getByTestId("preset-tomorrow-9").props.style,
    );
    expect(tomorrow9Style.borderColor).toBe("#38BDF8");

    // Press 'Sin Fecha'
    await act(async () => {
      fireEvent.press(getByTestId("preset-none"));
    });
    await rerender(
      <DateTimePicker value={currentValue} onChange={onChangeMock} />,
    );
    noneStyle = StyleSheet.flatten(getByTestId("preset-none").props.style);
    expect(noneStyle.borderColor).toBe("#ef4444");
  });
});
