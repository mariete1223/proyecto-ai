import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { AccountModal } from "./AccountModal";

describe("AccountModal Component", () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    isBackendConnected: true,
    currentUserEmail: "user@example.com",
    onOpenLegal: jest.fn(),
    onLogout: jest.fn(),
    onExportBackup: jest.fn(),
    onDeleteAccount: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders connection status, user email, and action buttons", async () => {
    const { getByText, getByTestId } = await render(
      <AccountModal {...defaultProps} />,
    );

    expect(getByText("Conexión y Cuenta")).toBeTruthy();
    expect(getByText("user@example.com")).toBeTruthy();
    expect(getByText("Conectado al servidor")).toBeTruthy();
    expect(getByTestId("btn-export-backup")).toBeTruthy();
    expect(getByTestId("btn-open-legal-from-account")).toBeTruthy();
    expect(getByTestId("btn-confirm-logout")).toBeTruthy();
    expect(getByTestId("btn-start-delete-account")).toBeTruthy();
  });

  it("triggers onExportBackup and displays feedback message", async () => {
    const onExportBackup = jest.fn().mockResolvedValue(undefined);
    const { getByTestId, findByTestId } = await render(
      <AccountModal {...defaultProps} onExportBackup={onExportBackup} />,
    );

    const exportBtn = getByTestId("btn-export-backup");
    await act(async () => {
      fireEvent.press(exportBtn);
    });

    expect(onExportBackup).toHaveBeenCalledTimes(1);
    expect(await findByTestId("backup-success-text")).toBeTruthy();
  });

  it("handles delete account confirmation flow", async () => {
    const onDeleteAccount = jest.fn().mockResolvedValue(undefined);
    const { getByTestId, findByTestId, queryByTestId } = await render(
      <AccountModal {...defaultProps} onDeleteAccount={onDeleteAccount} />,
    );

    // Initial state: confirmation card is not visible
    expect(queryByTestId("confirm-delete-box")).toBeNull();

    // Start delete flow
    const startBtn = getByTestId("btn-start-delete-account");
    fireEvent.press(startBtn);

    // Confirmation box appears
    expect(await findByTestId("confirm-delete-box")).toBeTruthy();

    // Confirm deletion
    const confirmBtn = await findByTestId("btn-confirm-delete-account");
    await act(async () => {
      fireEvent.press(confirmBtn);
    });

    expect(onDeleteAccount).toHaveBeenCalledTimes(1);
  });

  it("allows cancelling delete account flow", async () => {
    const { getByTestId, findByTestId, queryByTestId } = await render(
      <AccountModal {...defaultProps} />,
    );

    await act(async () => {
      fireEvent.press(getByTestId("btn-start-delete-account"));
    });
    expect(await findByTestId("confirm-delete-box")).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId("btn-cancel-delete"));
    });
    expect(queryByTestId("confirm-delete-box")).toBeNull();
  });

  it("triggers onLogout and closes modal", async () => {
    const onLogout = jest.fn();
    const onClose = jest.fn();
    const { getByTestId } = await render(
      <AccountModal {...defaultProps} onLogout={onLogout} onClose={onClose} />,
    );

    fireEvent.press(getByTestId("btn-confirm-logout"));
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("triggers onOpenLegal and closes modal", async () => {
    const onOpenLegal = jest.fn();
    const onClose = jest.fn();
    const { getByTestId } = await render(
      <AccountModal
        {...defaultProps}
        onOpenLegal={onOpenLegal}
        onClose={onClose}
      />,
    );

    fireEvent.press(getByTestId("btn-open-legal-from-account"));
    expect(onOpenLegal).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
