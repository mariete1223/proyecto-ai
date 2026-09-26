import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { WebMainLayout } from "./WebMainLayout";

describe("WebMainLayout Component (Task 42)", () => {
  const configConnected = {
    baseUrl: "http://localhost:8000",
    fetchFn: jest.fn().mockResolvedValue({ ok: true, status: 200 } as Response),
  };

  const configDisconnected = {
    baseUrl: "http://localhost:8000",
    fetchFn: jest.fn().mockRejectedValue(new TypeError("Failed to fetch")),
  };

  it("renders web layout header, stats bar, and tabs", async () => {
    const { getByTestId, getByText } = await render(
      <WebMainLayout
        apiConfig={configConnected}
        stats={{ totalEntries: 42, pendingTasks: 5, totalCategories: 3 }}
      />,
    );

    await waitFor(() => {
      expect(getByTestId("web-main-layout")).toBeTruthy();
      expect(getByText("Proyecto AI")).toBeTruthy();
      expect(getByTestId("web-quick-stats")).toBeTruthy();
      expect(getByText("42")).toBeTruthy();
      expect(getByText("5")).toBeTruthy();
      expect(getByText("📅 Calendario")).toBeTruthy();
      expect(getByText("☑️ Tareas Pendientes")).toBeTruthy();
    });
  });

  it("shows backend unreachable banner when backend fails health check", async () => {
    const { getByTestId, getByText } = await render(
      <WebMainLayout apiConfig={configDisconnected} />,
    );

    await waitFor(() => {
      expect(getByTestId("web-backend-unreachable")).toBeTruthy();
      expect(
        getByText(
          "Servidor backend privado no disponible. En la versión web, las operaciones requieren conexión directa al backend FastAPI.",
        ),
      ).toBeTruthy();
    });
  });

  it("handles tab switching", async () => {
    const onTabChange = jest.fn();

    const { getByTestId } = await render(
      <WebMainLayout apiConfig={configConnected} onTabChange={onTabChange} />,
    );

    await waitFor(() => {
      expect(getByTestId("nav-pending-tasks")).toBeTruthy();
    });

    fireEvent.press(getByTestId("nav-pending-tasks"));
    expect(onTabChange).toHaveBeenCalledWith("PENDING_TASKS");

    fireEvent.press(getByTestId("nav-explorer"));
    expect(onTabChange).toHaveBeenCalledWith("EXPLORER");
  });
});
