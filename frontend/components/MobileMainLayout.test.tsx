import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
import { Text, View } from "react-native";
import { checkBackendHealth } from "../services/webApi";
import {
  getSwipePanResponderConfig,
  MobileMainLayout,
  MobileTab,
  ORDERED_MOBILE_TABS,
} from "./MobileMainLayout";

jest.mock("../services/webApi", () => {
  const actual = jest.requireActual("../services/webApi");
  return {
    ...actual,
    checkBackendHealth: jest.fn(),
  };
});

describe("MobileMainLayout Component", () => {
  let defaultApiConfig: { baseUrl: string };

  beforeEach(() => {
    (checkBackendHealth as jest.Mock).mockReset();
    (checkBackendHealth as jest.Mock).mockResolvedValue(true);
    defaultApiConfig = { baseUrl: "http://localhost:8000" };
  });

  afterEach(() => {
    cleanup();
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

  it("applies compact dimensions to top header, content area and bottom tab bar to avoid wasting vertical screen space (#123)", async () => {
    const { getByTestId } = await render(
      <MobileMainLayout
        apiConfig={defaultApiConfig}
        activeTab="VOICE_CAPTURE"
        onTabChange={jest.fn()}
      >
        <View />
      </MobileMainLayout>,
    );

    await waitFor(() => {
      const bottomBar = getByTestId("mobile-bottom-tab-bar");
      const bottomStyle = Array.isArray(bottomBar.props.style)
        ? Object.assign({}, ...bottomBar.props.style)
        : bottomBar.props.style;

      // Bottom bar must not have oversized height or bottom padding
      expect(bottomStyle.height).toBeLessThanOrEqual(64);
      expect(bottomStyle.paddingBottom).toBeLessThanOrEqual(8);

      const contentArea = getByTestId("mobile-content-area");
      const contentStyle = Array.isArray(contentArea.props.style)
        ? Object.assign({}, ...contentArea.props.style)
        : contentArea.props.style;

      expect(contentStyle.paddingTop).toBeLessThanOrEqual(10);
      expect(contentStyle.paddingBottom).toBeLessThanOrEqual(75);
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

    await act(async () => {
      fireEvent.press(getByTestId("mobile-tab-calendar"));
    });
    expect(onTabChange).toHaveBeenCalledWith("CALENDAR");

    await act(async () => {
      fireEvent.press(getByTestId("mobile-tab-tasks"));
    });
    expect(onTabChange).toHaveBeenCalledWith("PENDING_TASKS");
  });

  it("renders connection status chip when user is logged in and opens modal to log out", async () => {
    const onLogout = jest.fn();
    const { getByTestId, getByText, queryByText } = await render(
      <MobileMainLayout
        apiConfig={defaultApiConfig}
        activeTab="VOICE_CAPTURE"
        onTabChange={jest.fn()}
        currentUserEmail="user@test.com"
        onLogout={onLogout}
      >
        <View />
      </MobileMainLayout>,
    );

    // Initial health check resolves to true
    await waitFor(() => {
      expect(getByTestId("btn-connection-status")).toBeTruthy();
      expect(getByText("Online")).toBeTruthy();
    });

    // Does not show direct 'Salir' button in header
    expect(queryByText("👤 Salir")).toBeNull();

    // Clicking connection status opens modal
    await act(async () => {
      fireEvent.press(getByTestId("btn-connection-status"));
    });

    await waitFor(() => {
      expect(getByTestId("modal-account-status")).toBeTruthy();
      expect(getByText("Conexión y Cuenta")).toBeTruthy();
      expect(getByText("user@test.com")).toBeTruthy();
      expect(getByText("Conectado al servidor")).toBeTruthy();
    });

    // Clicking logout invokes onLogout
    await act(async () => {
      fireEvent.press(getByTestId("btn-confirm-logout"));
    });
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("renders offline chip when backend check fails", async () => {
    (checkBackendHealth as jest.Mock).mockResolvedValue(false);

    const { getByTestId, getByText } = await render(
      <MobileMainLayout
        apiConfig={defaultApiConfig}
        activeTab="VOICE_CAPTURE"
        onTabChange={jest.fn()}
        currentUserEmail="user@test.com"
      >
        <View />
      </MobileMainLayout>,
    );

    await waitFor(() => {
      expect(getByTestId("btn-connection-status")).toBeTruthy();
      expect(getByText("Offline")).toBeTruthy();
    });
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
