import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Text, View } from "react-native";
import {
  getSwipePanResponderConfig,
  MobileMainLayout,
  MobileTab,
  ORDERED_MOBILE_TABS,
} from "./MobileMainLayout";

describe("MobileMainLayout Component", () => {
  const defaultApiConfig = {
    baseUrl: "http://localhost:8000",
    fetchFn: jest.fn().mockResolvedValue({ ok: true, status: 200 } as Response),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

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

    await waitFor(() => {
      expect(getByTestId("mobile-main-layout")).toBeTruthy();
      const bottomBar = getByTestId("mobile-bottom-tab-bar");
      expect(bottomBar).toBeTruthy();
      expect(getByTestId("mobile-content-area")).toBeTruthy();
      const swipeContainer = getByTestId("mobile-swipe-container");
      expect(swipeContainer).toBeTruthy();
      expect(swipeContainer.props.onMoveShouldSetResponder).toBeDefined();
      expect(swipeContainer.props.onResponderRelease).toBeDefined();
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

    await waitFor(() => {
      expect(getByTestId("mobile-tab-calendar")).toBeTruthy();
    });

    fireEvent.press(getByTestId("mobile-tab-calendar"));
    expect(onTabChange).toHaveBeenCalledWith("CALENDAR");

    fireEvent.press(getByTestId("mobile-tab-tasks"));
    expect(onTabChange).toHaveBeenCalledWith("PENDING_TASKS");
  });

  describe("Horizontal Swipe Navigation Logic", () => {
    it("recognizes dominant horizontal moves in both bubble and capture phases and ignores vertical scrolls", () => {
      const onTabChange = jest.fn();
      const config = getSwipePanResponderConfig("CALENDAR", onTabChange);

      // Start should not capture touch immediately
      expect(config.onStartShouldSetPanResponder()).toBe(false);
      expect(config.onStartShouldSetPanResponderCapture()).toBe(false);

      // Termination request should return false to keep gesture active
      expect(config.onPanResponderTerminationRequest()).toBe(false);

      // Significant horizontal move (|dx| >= 20 and |dx| > |dy| * 1.5)
      expect(
        config.onMoveShouldSetPanResponder({} as any, { dx: 25, dy: 5 } as any),
      ).toBe(true);
      expect(
        config.onMoveShouldSetPanResponderCapture(
          {} as any,
          { dx: 25, dy: 5 } as any,
        ),
      ).toBe(true);

      // Horizontal move with delta < 20 should not activate
      expect(
        config.onMoveShouldSetPanResponder({} as any, { dx: 15, dy: 2 } as any),
      ).toBe(false);
      expect(
        config.onMoveShouldSetPanResponderCapture(
          {} as any,
          { dx: 15, dy: 2 } as any,
        ),
      ).toBe(false);

      // Predominantly vertical move (|dy| >= |dx| or not exceeding 1.5x)
      expect(
        config.onMoveShouldSetPanResponder(
          {} as any,
          { dx: 35, dy: 40 } as any,
        ),
      ).toBe(false);
      expect(
        config.onMoveShouldSetPanResponderCapture(
          {} as any,
          { dx: 35, dy: 40 } as any,
        ),
      ).toBe(false);
      expect(
        config.onMoveShouldSetPanResponder(
          {} as any,
          { dx: 40, dy: 30 } as any,
        ),
      ).toBe(false);
      expect(
        config.onMoveShouldSetPanResponderCapture(
          {} as any,
          { dx: 40, dy: 30 } as any,
        ),
      ).toBe(false);
    });

    it("navigates left and right between tabs with valid swipes", () => {
      let currentTab: MobileTab = "CALENDAR";
      const onTabChange = jest.fn((tab: MobileTab) => {
        currentTab = tab;
      });
      const performSwipe = (dx: number, dy: number) => {
        const config = getSwipePanResponderConfig(currentTab, onTabChange);
        config.onPanResponderRelease({} as any, { dx, dy } as any);
      };

      // Swipe Right (dx >= 40, |dx| > |dy| * 1.5): CALENDAR -> VOICE_CAPTURE
      performSwipe(50, 10);
      expect(onTabChange).toHaveBeenLastCalledWith("VOICE_CAPTURE");
      expect(currentTab).toBe("VOICE_CAPTURE");

      // Swipe Left (dx <= -40, |dx| > |dy| * 1.5): VOICE_CAPTURE -> CALENDAR
      performSwipe(-50, 10);
      expect(onTabChange).toHaveBeenLastCalledWith("CALENDAR");
      expect(currentTab).toBe("CALENDAR");

      // Swipe Left: CALENDAR -> PENDING_TASKS
      performSwipe(-60, 5);
      expect(onTabChange).toHaveBeenLastCalledWith("PENDING_TASKS");
      expect(currentTab).toBe("PENDING_TASKS");

      // Swipe Left: PENDING_TASKS -> EXPLORER
      performSwipe(-45, 8);
      expect(onTabChange).toHaveBeenLastCalledWith("EXPLORER");
      expect(currentTab).toBe("EXPLORER");

      // Swipe Left: EXPLORER -> LLM_IMPORT
      performSwipe(-70, 0);
      expect(onTabChange).toHaveBeenLastCalledWith("LLM_IMPORT");
      expect(currentTab).toBe("LLM_IMPORT");
    });

    it("respects boundary conditions on first and last tabs", () => {
      const onTabChange = jest.fn();

      // First tab: swipe right should do nothing
      const configFirst = getSwipePanResponderConfig(
        "VOICE_CAPTURE",
        onTabChange,
      );
      configFirst.onPanResponderRelease({} as any, { dx: 80, dy: 5 } as any);
      expect(onTabChange).not.toHaveBeenCalled();

      // Last tab: swipe left should do nothing
      const configLast = getSwipePanResponderConfig("LLM_IMPORT", onTabChange);
      configLast.onPanResponderRelease({} as any, { dx: -80, dy: 5 } as any);
      expect(onTabChange).not.toHaveBeenCalled();
    });

    it("ignores swipes with insufficient distance or dominant vertical scroll", () => {
      const onTabChange = jest.fn();
      const config = getSwipePanResponderConfig("CALENDAR", onTabChange);

      // Distance below threshold (|dx| < 40)
      config.onPanResponderRelease({} as any, { dx: 35, dy: 5 } as any);
      expect(onTabChange).not.toHaveBeenCalled();

      // Vertical dominant scroll (|dy| >= |dx| / 1.5)
      config.onPanResponderRelease({} as any, { dx: 50, dy: 45 } as any);
      expect(onTabChange).not.toHaveBeenCalled();

      // Pure vertical scroll
      config.onPanResponderRelease({} as any, { dx: 5, dy: 100 } as any);
      expect(onTabChange).not.toHaveBeenCalled();
    });
  });
});
