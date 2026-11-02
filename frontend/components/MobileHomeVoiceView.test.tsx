import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
import { MobileHomeVoiceView } from "./MobileHomeVoiceView";
import { MemoryDatabaseAdapter, runMigrations } from "../db/database";
import { createLocalCategory } from "../db/categories";
import { notificationService } from "../services/notificationService";

describe("MobileHomeVoiceView Component", () => {
  let db: MemoryDatabaseAdapter;
  const userId = "user-mobile-test";

  beforeEach(async () => {
    jest.restoreAllMocks();
    db = new MemoryDatabaseAdapter();
    await runMigrations(db);
    await createLocalCategory(db, userId, {
      name: "Notas",
      voice_command: "nota",
      kind: "STANDARD",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders notification status banner when permission is default and activates on button press (#148)", async () => {
    jest
      .spyOn(notificationService, "getPermissionStatus")
      .mockReturnValue("default");
    const requestSpy = jest
      .spyOn(notificationService, "requestPermissions")
      .mockResolvedValue("granted");

    const { getByTestId, findByTestId, queryByTestId } = await render(
      <MobileHomeVoiceView
        db={db}
        userId={userId}
        onOpenManualForm={jest.fn()}
        onOpenLlmImport={jest.fn()}
      />,
    );

    const banner = await findByTestId("mobile-notif-status-banner");
    expect(banner).toBeTruthy();
    const activateBtn = getByTestId("btn-activate-notif-banner");
    expect(activateBtn).toBeTruthy();

    fireEvent.press(activateBtn);

    expect(requestSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(queryByTestId("mobile-notif-status-banner")).toBeNull();
    });
  });

  it("does not render notification status banner when permission is already granted (#148)", async () => {
    jest
      .spyOn(notificationService, "getPermissionStatus")
      .mockReturnValue("granted");

    const { queryByTestId } = await render(
      <MobileHomeVoiceView
        db={db}
        userId={userId}
        onOpenManualForm={jest.fn()}
        onOpenLlmImport={jest.fn()}
      />,
    );

    expect(queryByTestId("mobile-notif-status-banner")).toBeNull();
  });

  it("renders denied notice without activation button when permission is denied (#148)", async () => {
    jest
      .spyOn(notificationService, "getPermissionStatus")
      .mockReturnValue("denied");

    const { getByTestId, queryByTestId } = await render(
      <MobileHomeVoiceView
        db={db}
        userId={userId}
        onOpenManualForm={jest.fn()}
        onOpenLlmImport={jest.fn()}
      />,
    );

    const title = getByTestId("mobile-notif-banner-title");
    expect(title).toBeTruthy();
    expect(title.props.children).toBe("🚫 Notificaciones bloqueadas");
    expect(queryByTestId("btn-activate-notif-banner")).toBeNull();
  });

  it("renders big mic hero button, pinned action dock, and confines layout (#146)", async () => {
    const onOpenManualForm = jest.fn();
    const onOpenLlmImport = jest.fn();

    const { getByTestId, findByTestId, queryByText, queryByTestId, getByText } =
      await render(
        <MobileHomeVoiceView
          db={db}
          userId={userId}
          onOpenManualForm={onOpenManualForm}
          onOpenLlmImport={onOpenLlmImport}
        />,
      );

    const container = getByTestId("mobile-home-voice-view");
    expect(container).toBeTruthy();
    const containerStyle = Array.isArray(container.props.style)
      ? Object.assign({}, ...container.props.style)
      : container.props.style;
    expect(containerStyle.flex).toBe(1);
    expect(containerStyle.minHeight).toBe(0);
    expect(containerStyle.overflow).toBe("hidden");

    const scrollArea = getByTestId("mobile-home-scroll-area");
    expect(scrollArea).toBeTruthy();
    const scrollStyle = Array.isArray(scrollArea.props.style)
      ? Object.assign({}, ...scrollArea.props.style)
      : scrollArea.props.style;
    expect(scrollStyle.flex).toBe(1);
    expect(scrollStyle.minHeight).toBe(0);

    const pinnedDockContainer = getByTestId("mobile-pinned-dock-container");
    expect(pinnedDockContainer).toBeTruthy();
    const dockStyle = Array.isArray(pinnedDockContainer.props.style)
      ? Object.assign({}, ...pinnedDockContainer.props.style)
      : pinnedDockContainer.props.style;
    expect(dockStyle.flexShrink).toBe(0);
    expect(dockStyle.paddingBottom).toBeGreaterThanOrEqual(12);

    const thumbDock = getByTestId("mobile-thumb-zone-card");
    expect(thumbDock).toBeTruthy();
    const thumbStyle = Array.isArray(thumbDock.props.style)
      ? Object.assign({}, ...thumbDock.props.style)
      : thumbDock.props.style;
    expect(thumbStyle.flexShrink).toBe(0);

    expect(getByTestId("btn-big-mic-start")).toBeTruthy();
    expect(getByText("Toca para Grabar por Voz")).toBeTruthy();
    expect(
      queryByText(
        /puedes crear todas las categorías y etiquetas que necesites/i,
      ),
    ).toBeTruthy();

    fireEvent.press(getByTestId("btn-mobile-manual-entry"));
    expect(onOpenManualForm).toHaveBeenCalled();

    fireEvent.press(getByTestId("btn-mobile-llm-import"));
    expect(onOpenLlmImport).toHaveBeenCalled();

    // Open voice modal (#85)
    fireEvent.press(getByTestId("btn-big-mic-start"));
    const closeBtn = await findByTestId("btn-close-mobile-voice");
    expect(closeBtn).toBeTruthy();

    // Verify absence of duplicate title and Salir button (#85)
    expect(queryByText("Captura Hablada por Voz")).toBeNull();
    expect(queryByText("✕ Salir")).toBeNull();
    expect(queryByTestId("btn-header-close-voice")).toBeNull();

    // Verify pinned dictate dock is mounted in voice modal (#150)
    const pinnedDictateDock = await findByTestId("pinned-dictate-dock");
    expect(pinnedDictateDock).toBeTruthy();
    expect(getByTestId("btn-start-listening")).toBeTruthy();

    // Close modal via Cerrar button (#85)
    if (closeBtn.props.onClick) {
      closeBtn.props.onClick();
    } else {
      closeBtn.props.onPress?.();
    }
    await waitFor(() => {
      expect(queryByTestId("mobile-voice-capture-panel")).toBeNull();
      expect(getByTestId("mobile-thumb-zone-card")).toBeTruthy();
    });
  });
});
