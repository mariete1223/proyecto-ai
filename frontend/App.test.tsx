import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import React from "react";
import App from "./App";
import { authStorage } from "./services/authService";

describe("App", () => {
  beforeEach(() => {
    authStorage.saveSession({
      token: "test-mock-token",
      email: "tester@voxdaily.com",
      userId: "user-test-app",
    });
  });

  afterEach(() => {
    authStorage.clearSession();
  });

  it("renders the starter screen", async () => {
    const { getByText } = await render(<App />);

    expect(getByText("VoxDaily")).toBeTruthy();
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
});
