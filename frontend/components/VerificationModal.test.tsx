import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { VerificationModal } from "./VerificationModal";
import * as authService from "../services/authService";

describe("VerificationModal Component", () => {
  it("renders properly when visible and displays user email", async () => {
    const screen = await render(
      <VerificationModal
        visible={true}
        email="testuser@example.com"
        baseUrl="http://localhost:8000"
        onClose={jest.fn()}
        onVerified={jest.fn()}
      />,
    );

    expect(screen.getByText("Verifica tu cuenta")).toBeTruthy();
    expect(screen.getByText("testuser@example.com")).toBeTruthy();
    expect(
      screen.getByPlaceholderText("Pega aquí el código de tu correo"),
    ).toBeTruthy();
    expect(screen.getByTestId("btn-close-verification")).toBeTruthy();
    expect(screen.getByTestId("btn-dismiss-verification")).toBeTruthy();
    screen.unmount();
  });

  it("handles email verification submission successfully", async () => {
    const verifySpy = jest
      .spyOn(authService, "verifyEmail")
      .mockResolvedValueOnce({
        success: true,
        message: "Cuenta verificada con éxito.",
      });

    const onVerifiedMock = jest.fn();
    const screen = await render(
      <VerificationModal
        visible={true}
        email="testuser@example.com"
        baseUrl="http://localhost:8000"
        onClose={jest.fn()}
        onVerified={onVerifiedMock}
        testIDPrefix="auth"
      />,
    );

    const tokenInput = screen.getByPlaceholderText(
      "Pega aquí el código de tu correo",
    );
    await act(async () => {
      fireEvent.changeText(tokenInput, "test-token-1234");
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId("auth-btn-verify-token"));
    });

    await waitFor(() => {
      expect(verifySpy).toHaveBeenCalledWith(
        "http://localhost:8000",
        "test-token-1234",
      );
      expect(screen.getByText(/Cuenta verificada con éxito/i)).toBeTruthy();
      expect(onVerifiedMock).toHaveBeenCalledWith("testuser@example.com");
    });

    verifySpy.mockRestore();
    screen.unmount();
  });

  it("handles resend verification email", async () => {
    const resendSpy = jest
      .spyOn(authService, "resendVerification")
      .mockResolvedValueOnce({
        success: true,
        message: "Correo de confirmación enviado.",
      });

    const screen = await render(
      <VerificationModal
        visible={true}
        email="testuser@example.com"
        baseUrl="http://localhost:8000"
        onClose={jest.fn()}
        onVerified={jest.fn()}
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId("btn-resend-verification"));
    });

    await waitFor(() => {
      expect(resendSpy).toHaveBeenCalledWith(
        "http://localhost:8000",
        "testuser@example.com",
      );
      expect(screen.getByText(/Correo de confirmación enviado/i)).toBeTruthy();
    });

    resendSpy.mockRestore();
    screen.unmount();
  });

  it("calls onClose when close icon or dismiss button is clicked", async () => {
    const onCloseMock = jest.fn();
    const screen = await render(
      <VerificationModal
        visible={true}
        email="testuser@example.com"
        baseUrl="http://localhost:8000"
        onClose={onCloseMock}
        onVerified={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByTestId("btn-close-verification"));
    expect(onCloseMock).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId("btn-dismiss-verification"));
    expect(onCloseMock).toHaveBeenCalledTimes(2);
    screen.unmount();
  });
});
