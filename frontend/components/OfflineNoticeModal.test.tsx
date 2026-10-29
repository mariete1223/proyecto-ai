import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { OfflineNoticeModal } from "./OfflineNoticeModal";

describe("OfflineNoticeModal Component", () => {
  it("renders offline notice modal with no internet copy when reason is NO_INTERNET", async () => {
    const onCloseMock = jest.fn();
    const { getByTestId, getByText } = await render(
      <OfflineNoticeModal
        visible={true}
        onClose={onCloseMock}
        reason="NO_INTERNET"
      />,
    );

    expect(getByTestId("offline-notice-modal")).toBeTruthy();
    expect(getByTestId("offline-notice-card")).toBeTruthy();
    expect(getByText("📡 SIN INTERNET")).toBeTruthy();
    expect(getByTestId("offline-notice-title").props.children).toBe(
      "Modo Sin Conexión",
    );
    expect(getByTestId("offline-notice-desc").props.children).toContain(
      "sin conexión a internet",
    );
    expect(getByTestId("offline-notice-sync-box")).toBeTruthy();
    expect(getByText(/cuenta online/i)).toBeTruthy();
  });

  it("renders local mode notice modal with backend unreachable copy when reason is BACKEND_UNREACHABLE (#139)", async () => {
    const onCloseMock = jest.fn();
    const { getByTestId, getByText } = await render(
      <OfflineNoticeModal
        visible={true}
        onClose={onCloseMock}
        reason="BACKEND_UNREACHABLE"
      />,
    );

    expect(getByTestId("offline-notice-modal")).toBeTruthy();
    expect(getByTestId("offline-notice-card")).toBeTruthy();
    expect(getByText("🖥️ MODO LOCAL")).toBeTruthy();
    expect(getByTestId("offline-notice-title").props.children).toBe(
      "Operando en Modo Local",
    );
    expect(getByTestId("offline-notice-desc").props.children).toContain(
      "el servidor backend de VoxDaily no está disponible",
    );
    expect(getByTestId("offline-notice-desc").props.children).toContain(
      "Tu dispositivo dispone de conexión a internet",
    );
    expect(getByTestId("offline-notice-sync-box")).toBeTruthy();
    expect(getByText("🔄 Sincronización automática pendiente")).toBeTruthy();
  });

  it("calls onClose when confirmation button is pressed", async () => {
    const onCloseMock = jest.fn();
    const { getByTestId } = await render(
      <OfflineNoticeModal visible={true} onClose={onCloseMock} />,
    );

    fireEvent.press(getByTestId("btn-dismiss-offline-notice"));
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when close 'X' button is pressed", async () => {
    const onCloseMock = jest.fn();
    const { getByTestId } = await render(
      <OfflineNoticeModal visible={true} onClose={onCloseMock} />,
    );

    fireEvent.press(getByTestId("btn-close-offline-notice"));
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it("does not render modal when visible is false", async () => {
    const onCloseMock = jest.fn();
    const { queryByTestId } = await render(
      <OfflineNoticeModal visible={false} onClose={onCloseMock} />,
    );

    expect(queryByTestId("offline-notice-modal")).toBeNull();
  });
});
