import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
import React from "react";
import { WebMainLayout } from "./WebMainLayout";
import { checkBackendHealth } from "../services/webApi";

jest.mock("../services/webApi", () => {
  const actual = jest.requireActual("../services/webApi");
  return {
    ...actual,
    checkBackendHealth: jest.fn(),
  };
});

describe("WebMainLayout Component (Task 42)", () => {
  const config = { baseUrl: "http://localhost:8000" };

  beforeEach(() => {
    (checkBackendHealth as jest.Mock).mockReset();
    (checkBackendHealth as jest.Mock).mockResolvedValue(true);
  });

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it("renders web layout header, stats bar, and tabs", async () => {
    const { getByTestId, getByText } = await render(
      <WebMainLayout
        apiConfig={config}
        stats={{ totalEntries: 42, pendingTasks: 5, totalCategories: 3 }}
      />,
    );

    await waitFor(() => {
      expect(getByTestId("web-main-layout")).toBeTruthy();
      expect(getByText("VoxDaily")).toBeTruthy();
      expect(getByTestId("web-quick-stats")).toBeTruthy();
      expect(getByText("42")).toBeTruthy();
      expect(getByText("5")).toBeTruthy();
      expect(getByText("📅 Calendario")).toBeTruthy();
      expect(getByText("☑️ Tareas Pendientes")).toBeTruthy();
    });
  });

  it("shows backend unreachable banner when backend fails health check", async () => {
    (checkBackendHealth as jest.Mock).mockResolvedValue(false);

    const { getByTestId, getByText } = await render(
      <WebMainLayout apiConfig={config} />,
    );

    await waitFor(() => {
      expect(getByTestId("web-backend-unreachable")).toBeTruthy();
      expect(
        getByText(
          "Servidor backend no disponible. La aplicación está operando en Modo Local en este dispositivo. Tus cambios se guardan localmente y se sincronizarán automáticamente cuando el servidor vuelva a estar en línea.",
        ),
      ).toBeTruthy();
    });
  });

  it("handles tab switching", async () => {
    const onTabChange = jest.fn();

    const { getByTestId } = await render(
      <WebMainLayout apiConfig={config} onTabChange={onTabChange} />,
    );

    await waitFor(() => {
      expect(getByTestId("nav-pending-tasks")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("nav-pending-tasks"));
    });
    expect(onTabChange).toHaveBeenCalledWith("PENDING_TASKS");

    await act(async () => {
      fireEvent.press(getByTestId("nav-explorer"));
    });
    expect(onTabChange).toHaveBeenCalledWith("EXPLORER");
  });

  describe("Account management: Backup & GDPR Deletion", () => {
    it("triggers onExportBackup and shows feedback message", async () => {
      const onExportBackup = jest.fn().mockResolvedValue(undefined);
      const { findByTestId } = await render(
        <WebMainLayout
          apiConfig={{ baseUrl: "http://localhost:8000" }}
          activeTab="CALENDAR"
          currentUserEmail="user@example.com"
          onExportBackup={onExportBackup}
        />,
      );

      // Open account modal
      const userBadge = await findByTestId("btn-user-auth");
      fireEvent.press(userBadge);

      const exportBtn = await findByTestId("btn-export-backup");
      await act(async () => {
        fireEvent.press(exportBtn);
      });

      expect(onExportBackup).toHaveBeenCalledTimes(1);
      const successText = await findByTestId("backup-success-text");
      expect(successText).toBeTruthy();
    });

    it("handles delete account confirmation flow", async () => {
      const onDeleteAccount = jest.fn().mockResolvedValue(undefined);
      const { findByTestId } = await render(
        <WebMainLayout
          apiConfig={{ baseUrl: "http://localhost:8000" }}
          activeTab="CALENDAR"
          currentUserEmail="user@example.com"
          onDeleteAccount={onDeleteAccount}
        />,
      );

      // Open account modal
      const userBadge = await findByTestId("btn-user-auth");
      fireEvent.press(userBadge);

      // Click start delete account
      const startDeleteBtn = await findByTestId("btn-start-delete-account");
      fireEvent.press(startDeleteBtn);

      // Confirmation box appears
      const confirmBtn = await findByTestId("btn-confirm-delete-account");
      await act(async () => {
        fireEvent.press(confirmBtn);
      });

      expect(onDeleteAccount).toHaveBeenCalledTimes(1);
    });
  });
});
