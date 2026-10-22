import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { OfflineNoticeModal } from "./OfflineNoticeModal";

describe("OfflineNoticeModal Component", () => {
  it("renders offline notice modal with explanatory text and sync message when visible", async () => {
    const onCloseMock = jest.fn();
    const { getByTestId, getByText } = await render(
      <OfflineNoticeModal visible={true} onClose={onCloseMock} />,
    );

    expect(getByTestId("offline-notice-modal")).toBeTruthy();
    expect(getByTestId("offline-notice-card")).toBeTruthy();
    expect(getByText("📡 MODO SIN CONEXIÓN")).toBeTruthy();
    expect(getByTestId("offline-notice-title").props.children).toBe(
      "Estás en Modo Offline",
    );
    expect(getByTestId("offline-notice-desc").props.children).toContain(
      "utilizando la aplicación sin conexión al servidor",
    );
    expect(getByTestId("offline-notice-sync-box")).toBeTruthy();
    expect(getByText(/cuenta online/i)).toBeTruthy();
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
