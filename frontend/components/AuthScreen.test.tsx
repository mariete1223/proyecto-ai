import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { AuthScreen } from "./AuthScreen";
import * as authService from "../services/authService";

describe("AuthScreen Component", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("renders branding, login title, and input fields", async () => {
    const { getByText, getByPlaceholderText, getByTestId } = await render(
      <AuthScreen baseUrl="http://localhost:8000" onSuccess={jest.fn()} />,
    );

    expect(getByTestId("auth-screen")).toBeTruthy();
    expect(getByText("VoxDaily")).toBeTruthy();
    expect(getByText("Voice Journal & Calendar")).toBeTruthy();
    expect(getByPlaceholderText("tu@email.com")).toBeTruthy();
    expect(getByPlaceholderText("Mínimo 8 caracteres")).toBeTruthy();
    expect(getByText("Acceder")).toBeTruthy();
  });

  it("switches to registration mode", async () => {
    const { getAllByText, getByTestId } = await render(
      <AuthScreen baseUrl="http://localhost:8000" onSuccess={jest.fn()} />,
    );

    await act(async () => {
      fireEvent.press(getByTestId("tab-auth-register"));
    });

    await waitFor(() => {
      expect(getAllByText("Crear Cuenta").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("validates empty or invalid email", async () => {
    const { getByText, getByTestId } = await render(
      <AuthScreen baseUrl="http://localhost:8000" onSuccess={jest.fn()} />,
    );

    await act(async () => {
      fireEvent.press(getByTestId("auth-btn-submit"));
    });

    await waitFor(() => {
      expect(
        getByText("Por favor, introduce un correo electrónico válido."),
      ).toBeTruthy();
    });
  });

  it("shows confirmation instruction banner upon successful registration", async () => {
    const registerSpy = jest
      .spyOn(authService, "registerUser")
      .mockResolvedValueOnce({
        success: true,
        message:
          "Cuenta creada con éxito. Por favor, revisa tu correo electrónico para verificar tu cuenta antes de iniciar sesión.",
      });

    const { getByText, getByPlaceholderText, getByTestId } = await render(
      <AuthScreen baseUrl="http://localhost:8000" onSuccess={jest.fn()} />,
    );

    await act(async () => {
      fireEvent.press(getByTestId("tab-auth-register"));
    });

    const emailInput = getByPlaceholderText("tu@email.com");
    const passwordInput = getByPlaceholderText("Mínimo 8 caracteres");

    await act(async () => {
      fireEvent.changeText(emailInput, "newuser@example.com");
      fireEvent.changeText(passwordInput, "StrongPassword123!");
    });

    await act(async () => {
      fireEvent.press(getByTestId("auth-btn-submit"));
    });

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalled();
      expect(getByTestId("auth-info-banner")).toBeTruthy();
      expect(getByText(/revisa tu correo electrónico/i)).toBeTruthy();
    });
  });

  it("displays unverified error banner and resend button when account is not verified", async () => {
    const loginSpy = jest
      .spyOn(authService, "loginUser")
      .mockResolvedValueOnce({
        success: false,
        error: "Email address is not verified. Please check your inbox.",
        isUnverified: true,
      });
    const resendSpy = jest
      .spyOn(authService, "resendVerification")
      .mockResolvedValueOnce({
        success: true,
        message: "Correo de confirmación enviado.",
      });

    const { getByPlaceholderText, getByTestId } = await render(
      <AuthScreen baseUrl="http://localhost:8000" onSuccess={jest.fn()} />,
    );

    const emailInput = getByPlaceholderText("tu@email.com");
    const passwordInput = getByPlaceholderText("Mínimo 8 caracteres");

    await act(async () => {
      fireEvent.changeText(emailInput, "unverified@example.com");
      fireEvent.changeText(passwordInput, "ValidPassword123!");
    });

    await act(async () => {
      fireEvent.press(getByTestId("auth-btn-submit"));
    });

    await waitFor(() => {
      expect(loginSpy).toHaveBeenCalled();
      expect(getByTestId("auth-error-banner")).toBeTruthy();
      expect(getByTestId("btn-resend-verification")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-resend-verification"));
    });

    await waitFor(() => {
      expect(resendSpy).toHaveBeenCalledWith(
        "http://localhost:8000",
        "unverified@example.com",
      );
      expect(getByTestId("auth-info-banner")).toBeTruthy();
    });
  });

  it("allows switching to verify mode and verifying a token", async () => {
    const verifySpy = jest
      .spyOn(authService, "verifyEmail")
      .mockResolvedValueOnce({
        success: true,
        message: "Cuenta verificada exitosamente.",
      });

    const { getByPlaceholderText, getByTestId } = await render(
      <AuthScreen baseUrl="http://localhost:8000" onSuccess={jest.fn()} />,
    );

    await act(async () => {
      fireEvent.press(getByTestId("tab-auth-verify"));
    });

    let tokenInput: any;
    await waitFor(() => {
      tokenInput = getByPlaceholderText("Pega aquí el token de tu correo");
      expect(tokenInput).toBeTruthy();
    });

    await act(async () => {
      fireEvent.changeText(tokenInput, "valid-token-123");
    });

    await act(async () => {
      fireEvent.press(getByTestId("auth-btn-verify-token"));
    });

    await waitFor(() => {
      expect(verifySpy).toHaveBeenCalledWith(
        "http://localhost:8000",
        "valid-token-123",
      );
      expect(getByTestId("auth-info-banner")).toBeTruthy();
    });
  });

  it("calls onContinueOffline when guest/offline button is pressed", async () => {
    const offlineMock = jest.fn();
    const { getByTestId } = await render(
      <AuthScreen
        baseUrl="http://localhost:8000"
        onSuccess={jest.fn()}
        onContinueOffline={offlineMock}
      />,
    );

    const guestBtn = getByTestId("btn-continue-offline");
    expect(guestBtn).toBeTruthy();

    await act(async () => {
      fireEvent.press(guestBtn);
    });

    expect(offlineMock).toHaveBeenCalledTimes(1);
  });
});
