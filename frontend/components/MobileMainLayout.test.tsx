import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Text, View } from "react-native";
import { MobileMainLayout, MobileTab } from "./MobileMainLayout";

describe("MobileMainLayout Component", () => {
  const defaultApiConfig = {
    baseUrl: "http://192.168.0.124:8000",
  };

  it("renders mobile top header and bottom navigation tab bar", async () => {
    const onTabChange = jest.fn();
    const { getByTestId, getByText } = await render(
      <MobileMainLayout
        apiConfig={defaultApiConfig}
        activeTab="VOICE_CAPTURE"
        onTabChange={onTabChange}
      >
        <View testID="child-content">
          <Text>Contenido de Prueba</Text>
        </View>
      </MobileMainLayout>,
    );

    expect(getByTestId("mobile-main-layout")).toBeTruthy();
    const bottomBar = getByTestId("mobile-bottom-tab-bar");
    expect(bottomBar).toBeTruthy();
    expect(getByText("VoxDaily")).toBeTruthy();
    expect(getByText("Contenido de Prueba")).toBeTruthy();

    const style = Array.isArray(bottomBar.props.style)
      ? Object.assign({}, ...bottomBar.props.style)
      : bottomBar.props.style;
    expect(style.bottom).toBe(0);
    expect(style.left).toBe(0);
    expect(style.right).toBe(0);
    expect(style.zIndex).toBe(100);
  });

  it("handles tab clicks on bottom navigation bar", async () => {
    const onTabChange = jest.fn();
    const { getByTestId } = await render(
      <MobileMainLayout
        apiConfig={defaultApiConfig}
        activeTab="VOICE_CAPTURE"
        onTabChange={onTabChange}
      >
        <View />
      </MobileMainLayout>,
    );

    fireEvent.press(getByTestId("mobile-tab-calendar"));
    expect(onTabChange).toHaveBeenCalledWith("CALENDAR");

    fireEvent.press(getByTestId("mobile-tab-tasks"));
    expect(onTabChange).toHaveBeenCalledWith("PENDING_TASKS");
  });
});
