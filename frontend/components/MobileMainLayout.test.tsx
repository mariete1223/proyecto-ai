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
    expect(getByTestId("mobile-bottom-tab-bar")).toBeTruthy();
    expect(getByText("Proyecto AI")).toBeTruthy();
    expect(getByText("Contenido de Prueba")).toBeTruthy();
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
