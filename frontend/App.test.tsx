import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import React from "react";
import App from "./App";
import { authStorage } from "./services/authService";
import * as webApi from "./services/webApi";

describe("App", () => {
  beforeEach(() => {
    jest.spyOn(webApi, "checkBackendHealth").mockResolvedValue(true);
    authStorage.saveSession({
      token: "test-mock-token",
      email: "tester@voxdaily.com",
      userId: "user-test-app",
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    authStorage.clearSession();
  });

  it("renders the starter screen", async () => {
    const { findByText } = await render(<App />);

    expect(await findByText("VoxDaily")).toBeTruthy();
  });

  it("navigates to calendar tab after manual entry is created (#87)", async () => {
    const { getByText, getByTestId, findByTestId, queryByTestId } =
      await render(<App />);

    // Tap writing/manual entry button from mobile home
    const manualBtn = await findByTestId("btn-mobile-manual-entry");
    await act(async () => {
      fireEvent.press(manualBtn);
    });

    // Entry form modal should be visible
    expect(await findByTestId("entry-form-container")).toBeTruthy();

    // Wait for categories to finish loading
    await waitFor(() => {
      expect(getByText("Notas")).toBeTruthy();
    });

    // Fill in content
    await act(async () => {
      fireEvent.changeText(
        getByTestId("input-content"),
        "Nueva tarea de prueba para el calendario",
      );
    });

    // Save
    await act(async () => {
      fireEvent.press(getByTestId("btn-submit-entry"));
    });

    // Modal should close and active view should navigate to calendar (#87)
    await waitFor(() => {
      expect(queryByTestId("entry-form-container")).toBeNull();
      expect(getByTestId("calendar-month-view")).toBeTruthy();
    });
  });

  it("navigates to calendar tab and automatically opens the entry's day detail panel (#105)", async () => {
    const { getByText, getByTestId, findByTestId, queryByTestId } =
      await render(<App />);

    const manualBtn = await findByTestId("btn-mobile-manual-entry");
    await act(async () => {
      fireEvent.press(manualBtn);
    });

    expect(await findByTestId("entry-form-container")).toBeTruthy();

    await waitFor(() => {
      expect(getByText("Notas")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.changeText(
        getByTestId("input-content"),
        "Cita con el dentista en el calendario",
      );
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-submit-entry"));
    });

    await waitFor(() => {
      expect(queryByTestId("entry-form-container")).toBeNull();
      expect(getByTestId("calendar-month-view")).toBeTruthy();
      expect(getByTestId("day-detail-panel")).toBeTruthy();
      expect(getByText(/Cita con el dentista en el calendario/)).toBeTruthy();
    });
  });

  it("renders AuthScreen when unauthenticated and backend connection is healthy", async () => {
    authStorage.clearSession();
    jest.spyOn(webApi, "checkBackendHealth").mockResolvedValueOnce(true);

    const { getByTestId, queryByTestId } = await render(<App />);

    await waitFor(() => {
      expect(getByTestId("auth-screen")).toBeTruthy();
      expect(queryByTestId("offline-notice-modal")).toBeNull();
    });
  });

  it("automatically enters offline mode and displays OfflineNoticeModal when opening app without connection", async () => {
    authStorage.clearSession();
    jest.spyOn(webApi, "checkBackendHealth").mockResolvedValueOnce(false);

    const { findByTestId, getByTestId } = await render(<App />);

    expect(await findByTestId("offline-notice-modal")).toBeTruthy();
    expect(getByTestId("banner-offline-mode")).toBeTruthy();
  });
});
