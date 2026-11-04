import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { ForgotPasswordModal } from "./ForgotPasswordModal";
import * as authService from "../services/authService";

describe("ForgotPasswordModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("handles requesting password reset and transitioning to reset step", async () => {
    const mockRequest = jest
      .spyOn(authService, "requestPasswordReset")
      .mockResolvedValueOnce({
        success: true,
        message: "Si el correo está registrado, recibirás un mensaje.",
      });

    const handleClose = jest.fn();
    const handleSuccess = jest.fn();

    const { getByTestId, getByText } = await render(
      <ForgotPasswordModal
        visible={true}
        baseUrl="http://localhost:8000"
        onClose={handleClose}
        onSuccess={handleSuccess}
      />,
    );

    expect(getByTestId("forgot-password-modal")).toBeTruthy();
    expect(getByText("🔑 Recuperar Contraseña")).toBeTruthy();

    // Type email
    await act(async () => {
      fireEvent.changeText(
        getByTestId("forgot-input-email"),
        "user@example.com",
      );
    });

    // Submit
    await act(async () => {
      fireEvent.press(getByTestId("btn-submit-forgot"));
    });

    expect(mockRequest).toHaveBeenCalledWith(
      "http://localhost:8000",
      "user@example.com",
    );

    // Should now be on reset step
    await waitFor(() => {
      expect(getByText("🔒 Nueva Contraseña")).toBeTruthy();
    });
  });

  test("handles resetting password successfully", async () => {
    const mockReset = jest
      .spyOn(authService, "resetPassword")
      .mockResolvedValueOnce({
        success: true,
        message: "Contraseña restablecida con éxito.",
      });

    const handleClose = jest.fn();
    const handleSuccess = jest.fn();

    const { getByText, getByTestId } = await render(
      <ForgotPasswordModal
        visible={true}
        baseUrl="http://localhost:8000"
        initialToken="test-token-123"
        onClose={handleClose}
        onSuccess={handleSuccess}
      />,
    );

    expect(getByText("🔒 Nueva Contraseña")).toBeTruthy();

    await act(async () => {
      fireEvent.changeText(
        getByTestId("forgot-input-new-password"),
        "ValidNewPassword123!",
      );
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-submit-new-password"));
    });

    expect(mockReset).toHaveBeenCalledWith(
      "http://localhost:8000",
      "test-token-123",
      "ValidNewPassword123!",
    );
  });
});
